"use client";
// ─── Runtime V2: ciclo de sincronización, hidratación, import legacy y shadow ───
// Orquesta (en este orden) cada vez que la app arranca, recupera el foco/conexión o encola:
//   1. flags de servidor  2. import one-shot del navegador  3. outbox → RPC V2
//   4. sync legacy V1 (solo mientras V1 siga en el runtime)  5. lectura V2 → caché  6. shadow check

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { STORAGE_KEY } from '@/lib/constants';
import { userTimezone } from '@/lib/dates';
import { refreshFlags, getFlags, v2ReadsOn, v1RuntimeOn } from './flags';
import { flushOutbox, enqueue, pendingCount, currentUid, APP_VERSION } from './outbox';
import { storeApplyV2State, storeSetOwner, slugifyOption, type V2DashboardState } from '../dashboardStore';
import { pullAndMergeFromSupabase, pushLocalDataToSupabase, pullDataFromSupabase } from '../syncService';

export const STORE_UPDATED_EVENT = 'ai-store-updated';
const notify = () => { try { window.dispatchEvent(new Event(STORE_UPDATED_EVENT)); } catch { /* SSR */ } };

let lastState: V2DashboardState | null = null;
export const lastV2State = () => lastState;

/** Lee get_dashboard_state() y lo proyecta en la caché local. Nunca pisa acciones pendientes. */
export async function hydrateFromV2(): Promise<V2DashboardState | null> {
  if (!isSupabaseConfigured || !supabase || !v2ReadsOn()) return null;
  const uid = currentUid();
  if (!uid || pendingCount(uid) > 0) return null;
  const { data, error } = await supabase.rpc('get_dashboard_state', { p_timezone: userTimezone() });
  if (error || !data) return null;
  if (pendingCount(uid) > 0 || currentUid() !== uid) return null;   // llegó una acción mientras leíamos
  const s = data as V2DashboardState;
  storeApplyV2State(s, uid);
  try {
    if (s.onboarding?.completed) localStorage.setItem('hasCompletedOnboarding', 'true');
  } catch { /* ignore */ }
  lastState = s;
  notify();
  return s;
}

// ─── Import one-shot de lo que solo existe en este navegador (v1_local_import) ──
const importKey = (uid: string) => `ai_v2_local_import:${uid}`;

function buildLocalImportPayload(uid: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const st = raw ? JSON.parse(raw) as { ownerUid?: string; decisions?: Record<string, unknown>[] } : null;
    if (st?.ownerUid && st.ownerUid !== uid) return null;          // caché de otro usuario
    const decisions = st?.decisions ?? [];
    const grace = decisions.filter((d) => d.questionId === 'grace_day' && /^grace_\d{10,16}$/.test(String(d.id)))
      .map((d) => ({ legacy_id: d.id, date: d.date, created_at: d.createdAt }));
    const daily = decisions.filter((d) => /^dec_\d{10,16}$/.test(String(d.id)))
      .map((d) => {
        const ak = String(d.answerKey ?? '');
        const sig = ak.includes('|') ? ak.slice(ak.indexOf('|') + 1) : '';
        return {
          legacy_id: d.id, date: d.date, amount: Number(d.deltaAmount ?? 0), question_id: d.questionId,
          option_key: sig && !sig.startsWith('custom:') ? slugifyOption(sig) : null,
          goal_legacy_id: d.goalId || null, created_at: d.createdAt,
        };
      });
    let answers: unknown = null; let completedAt: unknown = null;
    const onb = localStorage.getItem('onboardingData');
    if (onb) { const o = JSON.parse(onb) as { answers?: unknown; completedAt?: unknown }; answers = o.answers ?? null; completedAt = o.completedAt ?? null; }
    if (!grace.length && !daily.length && !Array.isArray(answers)) return null;
    return { grace, decisions: daily, onboarding_answers: Array.isArray(answers) ? answers : null, onboarding_completed_at: completedAt };
  } catch { return null; }
}

function maybeEnqueueLocalImport(uid: string) {
  if (!getFlags().V2_LOCAL_IMPORT) return;
  try {
    if (localStorage.getItem(importKey(uid))) return;
    const payload = buildLocalImportPayload(uid);
    if (payload) enqueue('local.import', { payload });
    localStorage.setItem(importKey(uid), new Date().toISOString());
  } catch { /* ignore */ }
}

// ─── Shadow check (ventana READ_CUTOVER → WRITE_CUTOVER) ───────────────────────
let lastShadow = 0;
async function maybeShadowCheck() {
  const f = getFlags();
  if (!supabase || !f.V2_READS || f.V2_WRITE_AUTHORITY || Date.now() - lastShadow < 10 * 60_000) return;
  if (pendingCount() > 0) return;
  lastShadow = Date.now();
  const { data } = await supabase.rpc('shadow_check', { p_app_version: APP_VERSION });
  const r = data as { checked?: boolean; real_mismatch?: number } | null;
  if (r?.checked && (r.real_mismatch ?? 0) > 0) {
    // El servidor ya apagó V2_READS (kill-switch). Volver a leer V1 inmediatamente.
    await refreshFlags();
    const uid = currentUid();
    if (uid && !v2ReadsOn()) { await pullDataFromSupabase(uid).catch(() => null); notify(); }
  }
}

// ─── Ciclo completo ────────────────────────────────────────────────────────────
let cycling = false;
export async function runSyncCycle(): Promise<void> {
  if (cycling || !isSupabaseConfigured) return;
  cycling = true;
  try {
    await refreshFlags();
    const uid = currentUid();
    if (!uid) return;
    maybeEnqueueLocalImport(uid);
    await flushOutbox();
    if (v1RuntimeOn()) {
      if (!v2ReadsOn()) await pullAndMergeFromSupabase(uid).catch(() => null);
      await pushLocalDataToSupabase(uid).catch(() => null);
      if (!v2ReadsOn()) { storeSetOwner(uid); notify(); }
    }
    if (v2ReadsOn()) {
      await hydrateFromV2();
      await maybeShadowCheck();
    }
  } finally {
    cycling = false;
  }
}

/** Tras login: restaura los datos del usuario desde la fuente de verdad vigente. */
export async function restoreAfterLogin(uid: string): Promise<{ onboardingCompleted: boolean | null }> {
  await refreshFlags();
  if (v2ReadsOn()) {
    await flushOutbox();
    const s = await hydrateFromV2();
    return { onboardingCompleted: s ? !!s.onboarding?.completed : null };
  }
  await pullDataFromSupabase(uid).catch(() => null);
  storeSetOwner(uid);
  return { onboardingCompleted: null };
}
