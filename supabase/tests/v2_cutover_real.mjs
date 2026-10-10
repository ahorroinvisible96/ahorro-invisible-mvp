// 5B.3 — Pruebas REALES (GoTrue + PostgREST de staging) de la migración 017 y del contrato del outbox.
// Uso: (vault en 127.0.0.1:54330) node v2_cutover_real.mjs
// Cubre: flags, identidad V1→V2 determinista, idempotencia/reintentos, already_present, amend/void,
// ingresos, gracia, onboarding (pesos 1/2/2), import one-shot, reset, RLS cruzada, observabilidad,
// concurrencia (doble clic / dos pestañas), permisos anon/service_role.
import { randomUUID as uuid, randomBytes, createHash } from 'node:crypto';
const C = await (await fetch('http://127.0.0.1:54330/creds')).json();
const results = []; let fails = 0;
const t = async (name, fn) => { try { await fn(); results.push([name, 'PASS']); console.log('  PASS', name); } catch (e) { fails++; results.push([name, 'FAIL', e.message]); console.log('  FAIL', name, '\n       ', e.message); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const H = (jwt, key = C.anon) => ({ apikey: key, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });
async function req(method, path, jwt, body, key) {
  const r = await fetch(`${C.url}${path}`, { method, headers: H(jwt, key), body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch { j = txt; }
  return { s: r.status, j };
}
async function mkUser() {
  const email = `t_${randomBytes(4).toString('hex')}@staging.test`, password = randomBytes(18).toString('base64url');
  const a = await req('POST', '/auth/v1/admin/users', C.service, { email, password, email_confirm: true }, C.service);
  if (a.s >= 300) throw new Error('admin create ' + JSON.stringify(a.j));
  const s = await req('POST', '/auth/v1/token?grant_type=password', C.anon, { email, password });
  if (!s.j.access_token) throw new Error('login ' + JSON.stringify(s.j));
  return { id: a.j.id, jwt: s.j.access_token };
}
// Réplica de src/services/v2/ids.ts → private.v1_uuid
function v1Uuid(user, kind, legacy) {
  const h = createHash('sha256').update(`ai:v1:${user}:${kind}:${legacy}`, 'utf8').digest('hex');
  const s = h.slice(0, 12) + '8' + h.slice(13, 16) + '89ab'[parseInt(h.slice(16, 18), 16) % 4] + h.slice(17, 32);
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}
const TZ = 'Europe/Madrid';
const now = () => new Date(Date.now() - 30e3).toISOString();
const rpc = (u, fn, args, key) => req('POST', `/rest/v1/rpc/${fn}`, u ? u.jwt : (key ?? C.anon), args, key);
const ok = (r, m = '') => assert(r.s === 200, `${m} HTTP ${r.s} ${JSON.stringify(r.j).slice(0, 300)}`);
const state = async (u) => { const r = await rpc(u, 'get_dashboard_state', { p_timezone: TZ }); ok(r, 'state'); return r.j; };

const A = await mkUser(), B = await mkUser();
console.log('usuarios reales creados en auth.users (staging)');
const ms = Date.now();
const gLegacy = `goal_${ms}`, gId = v1Uuid(A.id, 'goal', gLegacy);

await t('C1 flags: legibles por anon/authenticated, NO modificables por clientes', async () => {
  const r = await req('GET', '/rest/v1/app_flags?select=key,enabled', C.anon);
  assert(r.s === 200 && r.j.length >= 5, JSON.stringify(r.j));
  const u = await req('PATCH', '/rest/v1/app_flags?key=eq.V2_READS', A.jwt, { enabled: true });
  assert(u.s >= 400 || (Array.isArray(u.j) && u.j.length === 0), `flag modificada ${u.s}`);
  const s = await req('PATCH', '/rest/v1/app_flags?key=eq.V2_READS', C.service, { enabled: true }, C.service);
  assert(s.s >= 400 || (Array.isArray(s.j) && s.j.length === 0), `service modificó flag ${s.s}`);
});
await t('C2 identidad V1→V2: el cliente y private.v1_uuid producen el mismo id (create_goal con legacy)', async () => {
  const args = { p_goal_id: gId, p_title: 'Viaje', p_target_amount: 300, p_horizon_months: 6, p_source: 'goals_page', p_set_primary: true, p_occurred_at: now(), p_timezone: TZ, p_surface: 'goals_page', p_legacy_id: gLegacy };
  ok(await rpc(A, 'create_goal', args));
  const g = await req('GET', `/rest/v1/goals?id=eq.${gId}&select=legacy_id,ledger_managed,is_primary,data_origin`, A.jwt);
  assert(g.j.length === 1 && g.j[0].legacy_id === gLegacy && g.j[0].data_origin === 'v2_live', JSON.stringify(g.j));
  A.args = args;
});
await t('C3 reintento idéntico (refresh/red) = mismo resultado, sin duplicar', async () => {
  const r = await rpc(A, 'create_goal', A.args); ok(r);
  const g = await req('GET', `/rest/v1/goals?user_id=eq.${A.id}&ledger_managed=eq.true&select=id`, A.jwt);
  assert(g.j.length === 1, 'duplicado ' + g.j.length);
});
await t('C4 legacy_id que no corresponde al id → rechazado', async () => {
  const r = await rpc(A, 'create_goal', { ...A.args, p_goal_id: uuid(), p_legacy_id: `goal_${ms + 1}` });
  assert(r.s >= 400 && JSON.stringify(r.j).includes('legacy_id'), `${r.s} ${JSON.stringify(r.j)}`);
});
await t('C5 misma entidad ya existente con otra clave de llamada → already_present (backfill/réplica)', async () => {
  const r = await rpc(A, 'create_goal', { ...A.args, p_title: 'Viaje (reintento con payload distinto)' });
  // misma clave + payload distinto = conflicto de idempotencia (no reescribe)
  assert(r.s >= 400 || r.j.already_present === true || r.j.goal_id === gId, `${r.s} ${JSON.stringify(r.j)}`);
});
const dLegacy = `dec_${ms}`, dId = v1Uuid(A.id, 'dec', dLegacy);
await t('C6 decisión diaria: 10 € declarados = 10 € al objetivo (identity_v1) + already_present', async () => {
  const args = { p_decision_id: dId, p_occurred_at: now(), p_timezone: TZ, p_outcome: 'saved', p_question_bank_version: 'qb_v1', p_question_id: 'Q_CO_M_A_001', p_selected_option_key: 'caprichos', p_declared_amount: 10, p_goal_id: gId, p_surface: 'daily_page', p_legacy_id: dLegacy };
  ok(await rpc(A, 'record_daily_decision', args));
  ok(await rpc(A, 'record_daily_decision', args), 'retry');
  const s = await state(A);
  const g = s.goals.find((x) => x.id === gId);
  assert(Number(g.balance) === 10, 'balance ' + g.balance);
  const d = s.decisions.find((x) => x.id === dId);
  assert(d && d.credit_rule_version === 'identity_v1' && Number(d.amount) === 10 && d.legacy_id === dLegacy, JSON.stringify(d));
  assert(s.today_decision && s.today_decision.decision_id === dId, 'today_decision');
});
await t('C7 doble clic / dos pestañas: 6 decisiones distintas el mismo día en paralelo → exactamente 1', async () => {
  const B2 = B; const rs = await Promise.all([...Array(6)].map(() => rpc(B2, 'record_daily_decision', { p_decision_id: uuid(), p_occurred_at: now(), p_timezone: TZ, p_outcome: 'zero', p_question_bank_version: 'qb_v1', p_question_id: 'Q_CO_M_A_001', p_selected_option_key: '__unspecified__', p_declared_amount: 0, p_surface: 'daily_page' })));
  const okN = rs.filter((r) => r.s === 200).length;
  assert(okN === 1, `éxitos ${okN}: ${rs.map((r) => r.s + ':' + JSON.stringify(r.j).slice(0, 60)).join(' | ')}`);
  assert(rs.filter((r) => r.s !== 200).every((r) => JSON.stringify(r.j).includes('daily_decision_exists')), 'error inesperado');
});
await t('C8 mismo comando 8 veces en paralelo (reintentos concurrentes) → 1 asiento', async () => {
  const id = uuid();
  const args = { p_transaction_id: id, p_occurred_at: now(), p_timezone: TZ, p_amount: 30, p_goal_id: null, p_note: null, p_surface: 'extra_saving_page' };
  const rs = await Promise.all([...Array(8)].map(() => rpc(A, 'record_extra_saving', args)));
  assert(rs.every((r) => r.s === 200), rs.map((r) => r.s).join(','));
  const tx = await req('GET', `/rest/v1/savings_transactions?transaction_id=eq.${id}&select=amount`, A.jwt);
  assert(tx.j.length === 1, 'asientos ' + tx.j.length);
  A.extra = id;
});
await t('C9 amend_decision_amount a 0 y vuelta (paridad V1) con saldo coherente', async () => {
  ok(await rpc(A, 'amend_decision_amount', { p_mutation_id: uuid(), p_decision_id: dId, p_new_amount: 0, p_occurred_at: now(), p_timezone: TZ, p_surface: 'history' }));
  let s = await state(A); assert(Number(s.goals.find((x) => x.id === gId).balance) === 0, 'no bajó a 0');
  ok(await rpc(A, 'amend_decision_amount', { p_mutation_id: uuid(), p_decision_id: dId, p_new_amount: 12.5, p_occurred_at: now(), p_timezone: TZ, p_surface: 'history' }));
  s = await state(A); assert(Number(s.goals.find((x) => x.id === gId).balance) === 12.5, 'no subió a 12.5');
});
await t('C10 amend_extra_saving + void_extra_saving (append-only, cadena revertida completa)', async () => {
  ok(await rpc(A, 'amend_extra_saving', { p_mutation_id: uuid(), p_transaction_id: A.extra, p_new_amount: 40, p_occurred_at: now(), p_timezone: TZ, p_surface: 'history' }));
  let s = await state(A); assert(Number(s.hucha.balance) === 40, 'hucha ' + s.hucha.balance);
  const m = uuid(); const va = { p_mutation_id: m, p_transaction_id: A.extra, p_occurred_at: now(), p_timezone: TZ, p_surface: 'history' };
  ok(await rpc(A, 'void_extra_saving', va));
  ok(await rpc(A, 'void_extra_saving', va), 'retry void');
  s = await state(A); assert(Number(s.hucha.balance) === 0, 'hucha tras void ' + s.hucha.balance);
  const again = await rpc(A, 'void_extra_saving', { p_mutation_id: uuid(), p_transaction_id: A.extra, p_occurred_at: now(), p_timezone: TZ, p_surface: 'history' });
  assert(again.s >= 400 && JSON.stringify(again.j).includes('transaction_not_active'), 'segundo void distinto debe fallar');
});
await t('C11 hucha → objetivo (transferencia equilibrada) y saldo insuficiente rechazado', async () => {
  ok(await rpc(A, 'record_extra_saving', { p_transaction_id: uuid(), p_occurred_at: now(), p_timezone: TZ, p_amount: 20, p_goal_id: null, p_note: 'nota', p_surface: 'extra_saving_modal' }));
  ok(await rpc(A, 'transfer_between_buckets', { p_transfer_group_id: uuid(), p_from_bucket: 'hucha', p_from_goal_id: null, p_to_bucket: 'goal', p_to_goal_id: gId, p_amount: 15, p_occurred_at: now(), p_timezone: TZ, p_surface: 'goals_page' }));
  const bad = await rpc(A, 'transfer_between_buckets', { p_transfer_group_id: uuid(), p_from_bucket: 'hucha', p_from_goal_id: null, p_to_bucket: 'goal', p_to_goal_id: gId, p_amount: 50, p_occurred_at: now(), p_timezone: TZ, p_surface: 'goals_page' });
  assert(bad.s >= 400 && JSON.stringify(bad.j).includes('insufficient_balance'), JSON.stringify(bad.j));
  const s = await state(A);
  assert(Number(s.hucha.balance) === 5 && Number(s.goals.find((x) => x.id === gId).balance) === 27.5, `hucha ${s.hucha.balance} goal ${s.goals[0].balance}`);
  assert(Number(s.totals.total_balance) === 32.5, 'total ' + s.totals.total_balance);
});
await t('C12 update_goal + declare_income + use_grace_day (ayer) + gracia única por mes', async () => {
  ok(await rpc(A, 'update_goal', { p_mutation_id: uuid(), p_goal_id: gId, p_occurred_at: now(), p_timezone: TZ, p_title: 'Viaje 2', p_target_amount: 400, p_surface: 'goal_detail' }));
  ok(await rpc(A, 'declare_income', { p_declaration_id: uuid(), p_band_code: '1500_2000', p_occurred_at: now(), p_timezone: TZ, p_source: 'profile' }));
  const gl = `grace_${ms}`;
  const g1 = await rpc(A, 'use_grace_day', { p_decision_id: v1Uuid(A.id, 'grace', gl), p_occurred_at: now(), p_timezone: TZ, p_surface: 'dashboard_widget', p_legacy_id: gl });
  const s = await state(A);
  assert(s.income?.band_code === '1500_2000', 'income ' + JSON.stringify(s.income));
  assert(s.goals.find((x) => x.id === gId).title === 'Viaje 2', 'title');
  if (g1.s === 200) {
    assert(s.grace_available === false || new Date().getDate() === 1, 'grace_available tras usarla');
    const g2 = await rpc(A, 'use_grace_day', { p_decision_id: uuid(), p_occurred_at: now(), p_timezone: TZ, p_surface: 'dashboard_widget' });
    assert(g2.s >= 400, 'segunda gracia aceptada');
  } else {
    assert(JSON.stringify(g1.j).match(/grace_already_used|daily_decision_exists/), JSON.stringify(g1.j));
  }
});
await t('C13 RLS: B no ve el estado, objetivos ni eventos de A; B no puede operar sobre ids de A', async () => {
  const s = await state(B);
  assert(!s.goals.some((x) => x.id === gId) && Number(s.totals.total_balance) === 0, 'B ve datos de A');
  const r = await rpc(B, 'amend_decision_amount', { p_mutation_id: uuid(), p_decision_id: dId, p_new_amount: 1, p_occurred_at: now(), p_timezone: TZ, p_surface: 'history' });
  assert(r.s >= 400, 'B modificó decisión de A');
  const v = await rpc(B, 'void_extra_saving', { p_mutation_id: uuid(), p_transaction_id: A.extra, p_occurred_at: now(), p_timezone: TZ, p_surface: 'history' });
  assert(v.s >= 400, 'B anuló ahorro de A');
});
await t('C14 observabilidad: v2_client_events propio sí, ajeno no, inmutable', async () => {
  const i = await req('POST', '/rest/v1/v2_client_events', A.jwt, { kind: 'outbox_retry', rpc_name: 'create_goal', error_code: 'network', attempts: 1, app_version: '1.2.0-v2' });
  assert(i.s === 201, `${i.s} ${JSON.stringify(i.j)}`);
  const x = await req('POST', '/rest/v1/v2_client_events', A.jwt, { user_id: B.id, kind: 'outbox_retry' });
  assert(x.s >= 400, 'insert para otro usuario');
  const pii = await req('POST', '/rest/v1/v2_client_events', A.jwt, { kind: 'outbox_retry', error_code: 'Email juan@x.com' });
  assert(pii.s >= 400, 'texto libre aceptado');
  const u = await req('PATCH', `/rest/v1/v2_client_events?user_id=eq.${A.id}`, A.jwt, { attempts: 9 });
  assert(u.s >= 400 || (Array.isArray(u.j) && u.j.length === 0), 'update permitido');
  const r = await req('GET', '/rest/v1/v2_client_events?select=user_id', B.jwt);
  assert(r.j.length === 0, 'B ve eventos de A');
});
await t('C15 onboarding real (start + complete, pesos 1/2/2, recomendación servidor, legacy goal)', async () => {
  const sess = uuid(), ol = `goal_${ms + 7}`, og = v1Uuid(B.id, 'goal', ol);
  ok(await rpc(B, 'start_onboarding', { p_session_id: sess, p_occurred_at: now(), p_timezone: TZ, p_flow_version: 'onb_5steps_v1', p_client_app_version: '1.2.0-v2' }));
  const args = { p_session_id: sess, p_occurred_at: now(), p_timezone: TZ,
    p_answers: [{ question_key: 'onb_q1', option_key: 'c' }, { question_key: 'onb_q2', option_key: 'b' }, { question_key: 'onb_q3', option_key: 'b' }],
    p_assessment_id: uuid(), p_questionnaire_version: 'onb_avatar_v1', p_scoring_version: 'score_v1', p_result_avatar: 'social',
    p_scores: { comodo: 0, social: 4, impulsivo: 1 }, p_savings_habit: 'algo', p_income_declaration_id: uuid(), p_income_band_code: '1500_2000',
    p_income_band_catalog_version: 'income_ref_v1', p_rule_version: 'rec_v1', p_rec_reference_income_amount: 1750, p_rec_savings_rate_pct: 10,
    p_rec_monthly_floor_amount: 50, p_rec_horizon_months: 6, p_recommended_monthly_amount: 175, p_recommended_target_amount: 1050,
    p_chosen_target_amount: 1050, p_chosen_horizon_months: 6, p_warning_shown: 'none', p_goal_id: og, p_goal_title: 'Colchón',
    p_client_app_version: '1.2.0-v2', p_goal_legacy_id: ol };
  ok(await rpc(B, 'complete_onboarding', args));
  ok(await rpc(B, 'complete_onboarding', args), 'retry');
  const s = await state(B);
  assert(s.onboarding.completed && s.onboarding.source === 'v2' && s.avatar === 'social', JSON.stringify(s.onboarding) + s.avatar);
  assert(s.primary_goal_id === og && s.goals[0].legacy_id === ol, 'goal onboarding');
  // Un segundo onboarding con otra sesión es legítimo tras "Borrar mis datos" (paridad V1); la misma sesión es idempotente.
  const again = await rpc(B, 'complete_onboarding', { ...args, p_chosen_target_amount: 999 });
  assert(again.s >= 400 && JSON.stringify(again.j).match(/idempotency_conflict|onboarding_already_completed/), 'sesión completada reescrita');
});
await t('C16 import one-shot del navegador: gracia + decisión local sin asiento; segundo import = already_imported', async () => {
  const payload = { grace: [{ legacy_id: `grace_${ms - 86400000 * 20}`, date: new Date(Date.now() - 86400000 * 20).toISOString().slice(0, 10) }],
    decisions: [{ legacy_id: `dec_${ms - 86400000 * 21}`, date: new Date(Date.now() - 86400000 * 21).toISOString().slice(0, 10), amount: 3, question_id: 'Q_CO_M_A_001', option_key: 'caprichos', goal_legacy_id: null }],
    onboarding_answers: null };
  const before = Number((await state(B)).totals.total_balance);
  const r = await rpc(B, 'import_legacy_local_state', { p_import_id: uuid(), p_payload: payload, p_occurred_at: now(), p_timezone: TZ }); ok(r);
  assert(r.j.grace_imported === 1 && r.j.decisions_imported === 1, JSON.stringify(r.j));
  const r2 = await rpc(B, 'import_legacy_local_state', { p_import_id: uuid(), p_payload: payload, p_occurred_at: now(), p_timezone: TZ }); ok(r2);
  assert(r2.j.already_imported === true, JSON.stringify(r2.j));
  const s = await state(B);
  assert(Number(s.totals.total_balance) === before, 'el import creó saldo');
  assert(s.decisions.some((d) => d.legacy_id === payload.decisions[0].legacy_id && d.data_origin === 'v1_local_import' && d.credited === false), 'decisión importada');
});
await t('C17 shadow_check no actúa fuera de la ventana READ→WRITE (flags OFF)', async () => {
  const r = await rpc(A, 'shadow_check', { p_app_version: '1.2.0-v2' }); ok(r);
  assert(r.j.checked === false, JSON.stringify(r.j));
});
await t('C18 reset_account_data: saldos 0, decisiones anuladas, objetivos borrados, idempotente', async () => {
  const ra = { p_mutation_id: uuid(), p_occurred_at: now(), p_timezone: TZ, p_surface: 'settings' };
  ok(await rpc(A, 'reset_account_data', ra));
  ok(await rpc(A, 'reset_account_data', ra), 'retry');
  const s = await state(A);
  assert(Number(s.totals.total_balance) === 0 && s.goals.length === 0 && s.decisions.length === 0, JSON.stringify(s.totals));
  const tx = await req('GET', `/rest/v1/savings_transactions?select=transaction_id`, A.jwt);
  assert(tx.j.length > 0, 'el ledger se borró físicamente');
});
await t('C19 anon y service_role sin EXECUTE en RPC nuevas', async () => {
  for (const [fn, args] of [['get_dashboard_state', { p_timezone: TZ }], ['declare_income', { p_declaration_id: uuid(), p_band_code: 'lt_1000', p_occurred_at: now(), p_timezone: TZ }], ['reset_account_data', { p_mutation_id: uuid(), p_occurred_at: now(), p_timezone: TZ }]]) {
    const a = await rpc(null, fn, args); assert(a.s >= 400, `anon ${fn} ${a.s}`);
    const s = await req('POST', `/rest/v1/rpc/${fn}`, C.service, args, C.service); assert(s.s >= 400, `service ${fn} ${s.s}`);
  }
});
await t('C20 private.* (v1_v2_compare, v1_uuid) no expuesto por PostgREST', async () => {
  for (const fn of ['v1_v2_compare', 'v1_uuid', 'extra_chain_amount']) {
    const r = await req('POST', `/rest/v1/rpc/${fn}`, A.jwt, {}); assert(r.s >= 400, `${fn} expuesto ${r.s}`);
  }
});

for (const u of [A, B]) await req('DELETE', `/auth/v1/admin/users/${u.id}`, C.service, null, C.service);
console.log(`RESULTADO 017 REAL: ${results.length - fails}/${results.length} OK`);
process.exit(fails ? 1 : 0);
