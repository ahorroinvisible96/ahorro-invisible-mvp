"use client";
// ─── Outbox durable V2 ──────────────────────────────────────────────────────────
// Cada acción de negocio se encola (localStorage, por usuario) como un COMANDO semántico
// con su occurredAt/timezone capturados en el momento de la acción. Un único "flusher"
// (Web Locks → uno por navegador aunque haya varias pestañas) lo envía en orden FIFO a las
// RPC V2 con el JWT del propio usuario (supabase.rpc → auth.uid()).
//
//   · Idempotencia: cada comando lleva su clave (id determinista V1→V2 para creaciones,
//     UUID aleatorio fijo para mutaciones). Reintentar = misma clave = mismo resultado.
//   · Durabilidad: el comando solo sale de la cola cuando la RPC confirma (o la clasifica).
//   · Observabilidad: dead letters / resoluciones → public.v2_client_events (sin PII ni importes).

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { userTimezone } from '@/lib/dates';
import { getFlags, v2WritesOn, v2WriteAuthority } from './flags';
import { newUuid, v1Uuid, isUuid, type LegacyKind } from './ids';
import { analytics } from '@/services/analytics';

export const APP_VERSION = '1.2.0-v2';

// ─── Tipos de comando ──────────────────────────────────────────────────────────
export type Surface =
  | 'onboarding' | 'dashboard_widget' | 'daily_page' | 'goals_page' | 'goal_detail'
  | 'extra_saving_page' | 'extra_saving_modal' | 'history' | 'profile' | 'settings';

export type CommandPayloads = {
  'goal.create': {
    goal: string; title: string; target: number; horizon: number; source: 'dashboard' | 'goals_page';
    setPrimary: boolean; final?: number | null; step?: number | null;
    realismUnrealistic?: boolean | null; surface?: Surface;
  };
  'goal.update': { goal: string; title?: string; target?: number; horizon?: number; surface?: Surface };
  'goal.setPrimary': { goal: string; surface?: Surface };
  'goal.archive': { goal: string; dest: 'hucha' | string; surface?: Surface };
  'goal.reactivate': { goal: string; surface?: Surface };
  'goal.delete': { goal: string; dest: 'hucha' | string; surface?: Surface };
  'hucha.transfer': { toGoal: string; amount: number; surface?: Surface };
  'daily.record': {
    decision: string; questionId: string; optionKey: string; customText?: string | null;
    amount: number; goal: string | null; surface: Surface;
  };
  'daily.void': { entity: 'daily' | 'extra' | 'grace'; id: string; reason: 'user_reset_today' | 'user_deleted_in_history'; surface: Surface };
  'daily.amend': { entity: 'daily' | 'extra'; id: string; newAmount: number; surface: Surface };
  'extra.record': { txn: string; amount: number; goal: string | null; note?: string | null; surface: Surface };
  'grace.use': { decision: string; surface: Surface };
  'income.declare': { band: string; source: 'profile' | 'dashboard_widget' };
  'onboarding.complete': {
    session: string; assessment: string; income: string; goal: string;
    answers: ('comodo' | 'social' | 'impulsivo')[]; habit: 'nunca' | 'algo' | 'suelo' | 'bastante';
    band: string; ref: number; pct: number; floor: number; recMonthly: number; recTarget: number;
    chosenTarget: number; horizon: number; warning: 'none' | 'over_recommendation' | 'over_30pct_reference_income';
    title: string;
  };
  'account.reset': Record<string, never>;
  'local.import': { payload: Record<string, unknown> };
};
export type CommandType = keyof CommandPayloads;

export type Command<T extends CommandType = CommandType> = {
  id: string;             // clave de idempotencia para mutaciones
  type: T;
  payload: CommandPayloads[T];
  occurredAt: string;     // ISO UTC capturado al encolar
  tz: string;             // IANA capturada al encolar
  attempts: number;
  nextAt: number;
  createdAt: number;
  lastError?: string;
};

// ─── Almacenamiento ────────────────────────────────────────────────────────────
const qKey = (uid: string) => `ai_v2_outbox:${uid}`;
const dKey = (uid: string) => `ai_v2_dead:${uid}`;
const MAX_LIMITED_ATTEMPTS = 30;     // not_found / insufficient_balance (p. ej. antes del backfill)
const MAX_QUEUE = 1000;

export function currentUid(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const u = localStorage.getItem('supabaseUserId');
    return isUuid(u) ? u.toLowerCase() : null;
  } catch { return null; }
}

function readQ(key: string): Command[] {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as Command[]) : []; } catch { return []; }
}
function writeQ(key: string, q: Command[]) {
  try { localStorage.setItem(key, JSON.stringify(q)); } catch { /* cuota: se conserva la versión anterior */ }
}

export function pendingCount(uid = currentUid()): number { return uid ? readQ(qKey(uid)).length : 0; }
export function deadCount(uid = currentUid()): number { return uid ? readQ(dKey(uid)).length : 0; }
export function listPending(uid = currentUid()): Command[] { return uid ? readQ(qKey(uid)) : []; }

const enqueueListeners = new Set<() => void>();
export function onEnqueue(fn: () => void): () => void { enqueueListeners.add(fn); return () => { enqueueListeners.delete(fn); }; }

/** Encola un comando para el usuario de la sesión. Devuelve el comando (o null si no hay sesión). */
export function enqueue<T extends CommandType>(type: T, payload: CommandPayloads[T], opts?: { id?: string }): Command<T> | null {
  const uid = currentUid();
  if (!uid) return null;
  const cmd: Command<T> = {
    id: opts?.id ?? newUuid(), type, payload,
    occurredAt: new Date().toISOString(), tz: userTimezone(),
    attempts: 0, nextAt: 0, createdAt: Date.now(),
  };
  let q = readQ(qKey(uid));
  // Sin V2 activo la cola no debe crecer sin límite: lo anterior a 72 h no sería aceptado por el servidor.
  if (!v2WritesOn()) q = q.filter((c) => Date.now() - c.createdAt < 72 * 3600_000);
  if (q.length >= MAX_QUEUE) q = q.slice(q.length - MAX_QUEUE + 1);
  q.push(cmd as Command);
  writeQ(qKey(uid), q);
  enqueueListeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  return cmd;
}

// ─── Observabilidad ────────────────────────────────────────────────────────────
type EventKind = 'outbox_dead_letter' | 'outbox_resolved_absent' | 'outbox_retry' | 'outbox_already_present'
  | 'outbox_covered_by_backfill' | 'local_import_done' | 'local_import_failed';

const sanitize = (s: string | undefined | null) =>
  s ? s.toLowerCase().replace(/[^a-z0-9_:.-]+/g, '_').slice(0, 80) || null : null;

export async function logEvent(kind: EventKind, rpc: string | null, idem: string | null, code?: string | null, attempts?: number) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from('v2_client_events').insert({
      kind, rpc_name: rpc && /^[a-z_]{1,64}$/.test(rpc) ? rpc : null,
      idem_key: isUuid(idem) ? idem : null, error_code: sanitize(code ?? null),
      attempts: attempts ?? null, app_version: APP_VERSION,
    });
  } catch { /* la observabilidad nunca bloquea */ }
}

// ─── Ejecución ─────────────────────────────────────────────────────────────────
type RpcResult = { data: unknown; error: { message: string; code?: string; details?: string } | null };

async function rpc(name: string, args: Record<string, unknown>): Promise<RpcResult> {
  if (!supabase) return { data: null, error: { message: 'no_supabase', code: 'CLIENT' } };
  const r = await supabase.rpc(name, args);
  return { data: r.data, error: r.error ? { message: r.error.message, code: r.error.code, details: r.error.details ?? undefined } : null };
}

const id2 = (uid: string, kind: LegacyKind, local: string) => (isUuid(local) ? Promise.resolve(local.toLowerCase()) : v1Uuid(uid, kind, local));
const legacy = (local: string) => (isUuid(local) ? null : local);
const money = (n: number) => Math.round(n * 100) / 100;

/** Traduce un comando a la(s) RPC V2. Devuelve el nombre de la última RPC y su resultado. */
async function execute(uid: string, c: Command): Promise<{ rpcName: string; res: RpcResult }> {
  const base = { p_occurred_at: c.occurredAt, p_timezone: c.tz };
  switch (c.type) {
    case 'goal.create': {
      const p = c.payload as CommandPayloads['goal.create'];
      return { rpcName: 'create_goal', res: await rpc('create_goal', {
        p_goal_id: await id2(uid, 'goal', p.goal), p_title: p.title, p_target_amount: money(p.target),
        p_horizon_months: p.horizon, p_source: p.source, p_set_primary: p.setPrimary, ...base,
        p_final_target_amount: p.final ?? null, p_step_index: p.step ?? null,
        p_realism_is_unrealistic: p.realismUnrealistic ?? null, p_surface: p.surface ?? 'goals_page',
        p_legacy_id: legacy(p.goal),
      }) };
    }
    case 'goal.update': {
      const p = c.payload as CommandPayloads['goal.update'];
      return { rpcName: 'update_goal', res: await rpc('update_goal', {
        p_mutation_id: c.id, p_goal_id: await id2(uid, 'goal', p.goal), ...base,
        p_title: p.title ?? null, p_target_amount: p.target != null ? money(p.target) : null,
        p_horizon_months: p.horizon ?? null, p_surface: p.surface ?? 'goals_page',
      }) };
    }
    case 'goal.setPrimary': {
      const p = c.payload as CommandPayloads['goal.setPrimary'];
      return { rpcName: 'set_primary_goal', res: await rpc('set_primary_goal', {
        p_mutation_id: c.id, p_goal_id: await id2(uid, 'goal', p.goal), ...base, p_surface: p.surface ?? 'goals_page' }) };
    }
    case 'goal.archive':
    case 'goal.delete': {
      const p = c.payload as CommandPayloads['goal.archive'];
      const name = c.type === 'goal.archive' ? 'archive_goal' : 'delete_goal';
      const toHucha = p.dest === 'hucha' || !p.dest;
      return { rpcName: name, res: await rpc(name, {
        p_mutation_id: c.id, p_goal_id: await id2(uid, 'goal', p.goal), ...base,
        p_destination_type: toHucha ? 'hucha' : 'goal',
        p_destination_goal_id: toHucha ? null : await id2(uid, 'goal', p.dest),
        p_surface: p.surface ?? 'goals_page',
      }) };
    }
    case 'goal.reactivate': {
      const p = c.payload as CommandPayloads['goal.reactivate'];
      return { rpcName: 'reactivate_goal', res: await rpc('reactivate_goal', {
        p_mutation_id: c.id, p_goal_id: await id2(uid, 'goal', p.goal), ...base, p_surface: p.surface ?? 'goals_page' }) };
    }
    case 'hucha.transfer': {
      const p = c.payload as CommandPayloads['hucha.transfer'];
      return { rpcName: 'transfer_between_buckets', res: await rpc('transfer_between_buckets', {
        p_transfer_group_id: c.id, p_from_bucket: 'hucha', p_from_goal_id: null, p_to_bucket: 'goal',
        p_to_goal_id: await id2(uid, 'goal', p.toGoal), p_amount: money(p.amount), ...base,
        p_surface: p.surface ?? 'goals_page',
      }) };
    }
    case 'daily.record': {
      const p = c.payload as CommandPayloads['daily.record'];
      const saved = p.amount > 0;
      const args = {
        p_decision_id: await id2(uid, 'dec', p.decision), ...base, p_outcome: saved ? 'saved' : 'zero',
        p_question_bank_version: 'qb_v1', p_question_id: p.questionId, p_selected_option_key: p.optionKey,
        p_declared_amount: saved ? money(p.amount) : 0,
        p_custom_text: p.optionKey === '__custom__' ? (p.customText ?? null) : null,
        p_goal_id: p.goal ? await id2(uid, 'goal', p.goal) : null,
        p_impression_id: null, p_surface: p.surface, p_legacy_id: legacy(p.decision),
      };
      let res = await rpc('record_daily_decision', args);
      // Etiqueta fuera del catálogo publicado: el importe se registra igual, sin inventar una opción.
      if (res.error?.message?.startsWith('invalid_option')) {
        res = await rpc('record_daily_decision', { ...args, p_selected_option_key: '__unspecified__', p_custom_text: null });
      }
      return { rpcName: 'record_daily_decision', res };
    }
    case 'daily.void': {
      const p = c.payload as CommandPayloads['daily.void'];
      if (p.entity === 'extra') {
        return { rpcName: 'void_extra_saving', res: await rpc('void_extra_saving', {
          p_mutation_id: c.id, p_transaction_id: await id2(uid, 'extra', p.id), ...base, p_surface: p.surface }) };
      }
      return { rpcName: 'void_decision', res: await rpc('void_decision', {
        p_mutation_id: c.id, p_decision_id: await id2(uid, p.entity === 'grace' ? 'grace' : 'dec', p.id),
        p_reason: p.reason, ...base, p_surface: p.surface }) };
    }
    case 'daily.amend': {
      const p = c.payload as CommandPayloads['daily.amend'];
      if (p.entity === 'extra') {
        return { rpcName: 'amend_extra_saving', res: await rpc('amend_extra_saving', {
          p_mutation_id: c.id, p_transaction_id: await id2(uid, 'extra', p.id), p_new_amount: money(p.newAmount), ...base, p_surface: p.surface }) };
      }
      return { rpcName: 'amend_decision_amount', res: await rpc('amend_decision_amount', {
        p_mutation_id: c.id, p_decision_id: await id2(uid, 'dec', p.id), p_new_amount: money(p.newAmount), ...base, p_surface: p.surface }) };
    }
    case 'extra.record': {
      const p = c.payload as CommandPayloads['extra.record'];
      const note = p.note?.trim() ? p.note.trim().slice(0, 200) : null;
      return { rpcName: 'record_extra_saving', res: await rpc('record_extra_saving', {
        p_transaction_id: await id2(uid, 'extra', p.txn), ...base, p_amount: money(p.amount),
        p_goal_id: p.goal ? await id2(uid, 'goal', p.goal) : null, p_note: note, p_surface: p.surface,
        p_legacy_id: legacy(p.txn),
      }) };
    }
    case 'grace.use': {
      const p = c.payload as CommandPayloads['grace.use'];
      return { rpcName: 'use_grace_day', res: await rpc('use_grace_day', {
        p_decision_id: await id2(uid, 'grace', p.decision), ...base, p_surface: p.surface, p_legacy_id: legacy(p.decision) }) };
    }
    case 'income.declare': {
      const p = c.payload as CommandPayloads['income.declare'];
      return { rpcName: 'declare_income', res: await rpc('declare_income', {
        p_declaration_id: c.id, p_band_code: p.band, ...base, p_source: p.source, p_catalog_version: 'income_ref_v1' }) };
    }
    case 'onboarding.complete': {
      const p = c.payload as CommandPayloads['onboarding.complete'];
      const s = await rpc('start_onboarding', { p_session_id: p.session, ...base, p_flow_version: 'onb_5steps_v1', p_client_app_version: APP_VERSION });
      if (s.error && !/onboarding_already_(started|completed)/.test(s.error.message)) return { rpcName: 'start_onboarding', res: s };
      const W = [1, 2, 2];
      const scores = { comodo: 0, social: 0, impulsivo: 0 };
      p.answers.forEach((a, i) => { scores[a] += W[i]; });
      const max = Math.max(scores.comodo, scores.social, scores.impulsivo);
      const avatar = scores.impulsivo === max ? 'impulsivo' : scores.social === max ? 'social' : 'comodo';
      const opt = { comodo: 'a', social: 'b', impulsivo: 'c' } as const;
      return { rpcName: 'complete_onboarding', res: await rpc('complete_onboarding', {
        p_session_id: p.session, ...base,
        p_answers: p.answers.map((a, i) => ({ question_key: `onb_q${i + 1}`, option_key: opt[a] })),
        p_assessment_id: p.assessment, p_questionnaire_version: 'onb_avatar_v1', p_scoring_version: 'score_v1',
        p_result_avatar: avatar, p_scores: scores, p_savings_habit: p.habit,
        p_income_declaration_id: p.income, p_income_band_code: p.band, p_income_band_catalog_version: 'income_ref_v1',
        p_rule_version: 'rec_v1', p_rec_reference_income_amount: p.ref, p_rec_savings_rate_pct: p.pct,
        p_rec_monthly_floor_amount: p.floor, p_rec_horizon_months: p.horizon,
        p_recommended_monthly_amount: p.recMonthly, p_recommended_target_amount: p.recTarget,
        p_chosen_target_amount: money(p.chosenTarget), p_chosen_horizon_months: p.horizon, p_warning_shown: p.warning,
        p_goal_id: await id2(uid, 'goal', p.goal), p_goal_title: p.title, p_client_app_version: APP_VERSION,
        p_goal_legacy_id: legacy(p.goal),
      }) };
    }
    case 'account.reset':
      return { rpcName: 'reset_account_data', res: await rpc('reset_account_data', { p_mutation_id: c.id, ...base, p_surface: 'settings' }) };
    case 'local.import': {
      const p = c.payload as CommandPayloads['local.import'];
      return { rpcName: 'import_legacy_local_state', res: await rpc('import_legacy_local_state', {
        p_import_id: c.id, p_payload: p.payload, ...base }) };
    }
  }
  return { rpcName: 'unknown', res: { data: null, error: { message: 'unknown_command', code: 'CLIENT' } } };
}

type Verdict = 'done' | 'already' | 'resolved' | 'retry' | 'retry_limited' | 'auth' | 'dead';

// ─── Eventos de negocio confirmados (PostHog) ───────────────────────────────────────────
// Solo con veredicto 'done' (la RPC acaba de escribir): 'already' significa que ya se escribió y
// se emitió entonces (o se perdió la respuesta; tolerancia documentada en tracking_plan.md).
// Ids: los que devuelve el servidor; si no, los mismos que se enviaron a la RPC.
async function emitConfirmed(uid: string, c: Command, data: unknown): Promise<void> {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  const num = (v: unknown) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));
  const base = (surface?: Surface) => ({ command_id: c.id, command_type: c.type, surface: surface ?? null, occurred_at: c.occurredAt });
  const completion = async (goalLocal: string | null, trigger: string, surface: Surface) => {
    if (d.goal_completion === 'completed' && goalLocal) {
      analytics.confirmed('goal_completed_confirmed', { ...base(surface), goal_id: await id2(uid, 'goal', goalLocal), trigger });
    }
  };
  switch (c.type) {
    case 'goal.create': {
      const p = c.payload as CommandPayloads['goal.create'];
      analytics.confirmed('goal_created_confirmed', { ...base(p.surface), goal_id: str(d.goal_id) ?? await id2(uid, 'goal', p.goal),
        is_primary: d.is_primary ?? p.setPrimary, target_amount: money(p.target), horizon_months: p.horizon, source: p.source });
      return;
    }
    case 'goal.update':
    case 'goal.setPrimary': {
      const p = c.payload as CommandPayloads['goal.update'];
      analytics.confirmed('goal_updated_confirmed', { ...base(p.surface), goal_id: str(d.goal_id) ?? await id2(uid, 'goal', p.goal),
        changed: d.changed ?? true, set_primary: c.type === 'goal.setPrimary' });
      return;
    }
    case 'goal.archive':
    case 'goal.delete': {
      const p = c.payload as CommandPayloads['goal.archive'];
      analytics.confirmed(c.type === 'goal.archive' ? 'goal_archived_confirmed' : 'goal_deleted_confirmed', {
        ...base(p.surface), goal_id: str(d.goal_id) ?? await id2(uid, 'goal', p.goal),
        destination_type: p.dest === 'hucha' || !p.dest ? 'hucha' : 'goal', balance_moved_amount: num(d.balance_moved_amount) });
      return;
    }
    case 'goal.reactivate': {
      const p = c.payload as CommandPayloads['goal.reactivate'];
      analytics.confirmed('goal_reactivated_confirmed', { ...base(p.surface), goal_id: str(d.goal_id) ?? await id2(uid, 'goal', p.goal) });
      return;
    }
    case 'hucha.transfer': {
      const p = c.payload as CommandPayloads['hucha.transfer'];
      analytics.confirmed('hucha_transfer_confirmed', { ...base(p.surface), transfer_group_id: str(d.transfer_group_id) ?? c.id,
        goal_id: await id2(uid, 'goal', p.toGoal), amount: money(p.amount) });
      return;
    }
    case 'daily.record': {
      const p = c.payload as CommandPayloads['daily.record'];
      analytics.confirmed('daily_decision_confirmed', { ...base(p.surface),
        decision_id: str(d.decision_id) ?? await id2(uid, 'dec', p.decision), transaction_id: str(d.transaction_id),
        outcome: str(d.outcome) ?? (p.amount > 0 ? 'saved' : 'zero'), amount: num(d.recorded_amount) ?? money(p.amount),
        question_id: p.questionId, option_key: p.optionKey === '__custom__' ? '__custom__' : p.optionKey,
        goal_id: p.goal ? await id2(uid, 'goal', p.goal) : null, local_date: str(d.local_date) });
      await completion(p.goal, 'daily_saving', p.surface);
      return;
    }
    case 'extra.record': {
      const p = c.payload as CommandPayloads['extra.record'];
      analytics.confirmed('extra_saving_confirmed', { ...base(p.surface),
        transaction_id: str(d.transaction_id) ?? await id2(uid, 'extra', p.txn), amount: num(d.recorded_amount) ?? money(p.amount),
        goal_id: p.goal ? await id2(uid, 'goal', p.goal) : null, local_date: str(d.local_date) });
      await completion(p.goal, 'extra_saving', p.surface);
      return;
    }
    case 'daily.void': {
      const p = c.payload as CommandPayloads['daily.void'];
      analytics.confirmed('saving_voided_confirmed', { ...base(p.surface), entity: p.entity,
        entity_id: str(d.decision_id) ?? str(d.transaction_id), reason: p.reason, reversals: num(d.reversals) });
      return;
    }
    case 'daily.amend': {
      const p = c.payload as CommandPayloads['daily.amend'];
      analytics.confirmed('saving_amended_confirmed', { ...base(p.surface), entity: p.entity,
        entity_id: str(d.decision_id) ?? str(d.transaction_id), changed: d.changed ?? null,
        previous_amount: num(d.previous_amount), new_amount: money(p.newAmount) });
      return;
    }
    case 'grace.use': {
      const p = c.payload as CommandPayloads['grace.use'];
      analytics.confirmed('grace_day_confirmed', { ...base(p.surface), decision_id: str(d.decision_id) ?? await id2(uid, 'grace', p.decision),
        local_date: str(d.local_date) });
      return;
    }
    case 'income.declare': {
      const p = c.payload as CommandPayloads['income.declare'];
      analytics.confirmed('income_declared_confirmed', { ...base(), income_band: p.band, source: p.source });
      return;
    }
    case 'onboarding.complete': {
      const p = c.payload as CommandPayloads['onboarding.complete'];
      analytics.confirmed('onboarding_completed_confirmed', { ...base('onboarding'), goal_id: await id2(uid, 'goal', p.goal),
        income_band: p.band, savings_habit: p.habit, warning_shown: p.warning,
        chosen_target_amount: money(p.chosenTarget), horizon_months: p.horizon });
      return;
    }
    case 'account.reset':
      analytics.confirmed('account_reset_confirmed', { ...base('settings') });
      return;
    default:
      return; // local.import: migración técnica, sin evento de producto
  }
}

function classify(c: Command, res: RpcResult): Verdict {
  if (!res.error) {
    const d = res.data as Record<string, unknown> | null;
    return d && (d.already_present === true || d.already_imported === true) ? 'already' : 'done';
  }
  const msg = (res.error.message || '').toLowerCase();
  const code = res.error.code || '';
  if (code === 'P0001') {
    const k = msg.split(':')[0].trim();
    if (c.type === 'daily.void' && ['not_found', 'decision_not_active', 'transaction_not_active'].includes(k)) return 'resolved';
    if (c.type === 'onboarding.complete' && k === 'onboarding_already_completed') return 'resolved';
    if (c.type === 'grace.use' && k === 'grace_already_used') return 'resolved';
    if (c.type === 'daily.amend' && k === 'decision_not_amendable') return 'resolved';
    // Con V2 como autoridad de escritura el ledger está completo: insufficient_balance es determinista
    // (reintentarlo solo bloquearía la cola FIFO). Antes del corte puede deberse a histórico aún no migrado.
    if (k === 'insufficient_balance' && v2WriteAuthority()) return 'dead';
    if (k === 'not_found' || k === 'insufficient_balance') return 'retry_limited';
    if (k === 'not_authenticated') return 'auth';
    return 'dead';
  }
  if (code === 'PGRST301' || code === 'PGRST302' || msg.includes('jwt')) return 'auth';
  if (code.startsWith('23') || code === '42501' || code === '42883' || code === 'PGRST202' || code === 'CLIENT') return 'dead';
  return 'retry';     // red, 5xx, timeouts, offline
}

// ─── Flush ─────────────────────────────────────────────────────────────────────
let flushing = false;
const flushListeners = new Set<(remaining: number) => void>();
export function onFlushed(fn: (remaining: number) => void): () => void { flushListeners.add(fn); return () => { flushListeners.delete(fn); }; }

function backoff(attempts: number): number {
  return Math.min(300_000, 2_000 * 2 ** Math.min(attempts, 8)) + Math.floor(Math.random() * 1000);
}

function removeHead(uid: string, id: string) {
  writeQ(qKey(uid), readQ(qKey(uid)).filter((x) => x.id !== id));
}
function updateHead(uid: string, c: Command) {
  writeQ(qKey(uid), readQ(qKey(uid)).map((x) => (x.id === c.id ? c : x)));
}
function toDead(uid: string, c: Command) {
  removeHead(uid, c.id);
  const d = readQ(dKey(uid)); d.push(c); writeQ(dKey(uid), d.slice(-200));
}

async function sessionUid(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch { return null; }
}

async function drain(): Promise<number> {
  const uid = currentUid();
  if (!uid || !v2WritesOn()) return uid ? pendingCount(uid) : 0;
  const sUid = await sessionUid();
  if (!sUid || sUid.toLowerCase() !== uid) return pendingCount(uid); // misma identidad o nada
  const t0 = getFlags().t0;
  for (let guard = 0; guard < 200; guard++) {
    const q = readQ(qKey(uid));
    const c = q[0];
    if (!c) return 0;
    if (c.nextAt > Date.now()) return q.length;
    // Acciones anteriores a T0: ya están en V1 y las cubre el backfill → nunca doble conteo.
    if (t0 && c.type !== 'local.import' && c.type !== 'onboarding.complete' && c.occurredAt < t0) {
      removeHead(uid, c.id);
      await logEvent('outbox_covered_by_backfill', null, c.id);
      continue;
    }
    let out: { rpcName: string; res: RpcResult };
    try { out = await execute(uid, c); }
    catch (e) { out = { rpcName: 'client', res: { data: null, error: { message: String(e), code: 'NETWORK' } } }; }
    const v = classify(c, out.res);
    const errMsg = out.res.error?.message;
    if (v === 'done') {
      removeHead(uid, c.id);
      if (c.type === 'local.import') await logEvent('local_import_done', out.rpcName, c.id);
      else { try { await emitConfirmed(uid, c, out.res.data); } catch { /* la analítica nunca bloquea la cola */ } }
      continue;
    }
    if (v === 'already') { removeHead(uid, c.id); await logEvent(c.type === 'local.import' ? 'local_import_done' : 'outbox_already_present', out.rpcName, c.id, c.type === 'local.import' ? 'already_imported' : null); continue; }
    if (v === 'resolved') { removeHead(uid, c.id); await logEvent('outbox_resolved_absent', out.rpcName, c.id, errMsg?.split(':')[0]); continue; }
    if (v === 'dead') { toDead(uid, { ...c, lastError: errMsg }); await logEvent(c.type === 'local.import' ? 'local_import_failed' : 'outbox_dead_letter', out.rpcName, c.id, errMsg?.split(':')[0] ?? out.res.error?.code, c.attempts + 1); continue; }
    if (v === 'auth') {
      try { await supabase?.auth.refreshSession(); } catch { /* ignore */ }
    }
    const attempts = c.attempts + 1;
    if (v === 'retry_limited' && attempts >= MAX_LIMITED_ATTEMPTS) {
      toDead(uid, { ...c, attempts, lastError: errMsg });
      await logEvent('outbox_dead_letter', out.rpcName, c.id, errMsg?.split(':')[0], attempts);
      continue;
    }
    updateHead(uid, { ...c, attempts, nextAt: Date.now() + backoff(attempts), lastError: errMsg });
    if (attempts === 1 || attempts % 10 === 0) await logEvent('outbox_retry', out.rpcName, c.id, (errMsg ?? '').split(':')[0] || out.res.error?.code, attempts);
    return readQ(qKey(uid)).length;   // FIFO estricto: no adelantar comandos dependientes
  }
  return pendingCount(uid);
}

/** Envía la cola. Seguro con varias pestañas (Web Locks) y re-entradas. */
export async function flushOutbox(): Promise<number> {
  if (typeof window === 'undefined' || flushing) return pendingCount();
  flushing = true;
  try {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    let remaining: number;
    if (locks?.request) {
      remaining = await locks.request('ai_v2_outbox', { ifAvailable: true }, async (lock) => (lock ? drain() : pendingCount()));
    } else {
      remaining = await drain();
    }
    flushListeners.forEach((fn) => { try { fn(remaining); } catch { /* ignore */ } });
    return remaining;
  } finally {
    flushing = false;
  }
}

/** Para pruebas: fuerza el reintento inmediato de todos los comandos en espera. */
export function retryNow(uid = currentUid()) {
  if (!uid) return;
  writeQ(qKey(uid), readQ(qKey(uid)).map((c) => ({ ...c, nextAt: 0 })));
}
