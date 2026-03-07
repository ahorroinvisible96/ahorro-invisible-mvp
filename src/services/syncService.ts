"use client";

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const STORAGE_KEY = 'ahorro_invisible_dashboard_v1';

// ─── Push local data → Supabase ───────────────────────────────────────────────
export async function pushLocalDataToSupabase(
  userId: string,
): Promise<{ success: boolean; migrated: number; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, migrated: 0, error: 'Supabase no configurado.' };
  }

  // Verificar sesión activa; si expiró, refrescar
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) {
        console.error('[sync] Sin sesión válida, sync abortado:', refreshErr.message);
        return { success: false, migrated: 0, error: 'Sin sesión activa' };
      }
    }
  } catch (e) { console.error('[sync] Error verificando sesión:', e); }

  let raw: string | null = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch { /* SSR */ }
  if (!raw) return { success: true, migrated: 0 };

  let store: {
    userName?: string;
    moneyFeeling?: string;
    incomeRange?: Record<string, unknown>;
    goals?: Record<string, unknown>[];
    decisions?: Record<string, unknown>[];
    hucha?: { balance: number; entries: unknown[] };
  };
  try { store = JSON.parse(raw); } catch { return { success: false, migrated: 0, error: 'JSON parse error' }; }

  let migrated = 0;
  const now = new Date().toISOString();

  // ─ Calcular métricas analíticas desde el store local ─────────────────────
  const decisions = (store.decisions ?? []) as Record<string, unknown>[];
  const dailyDecisions = decisions.filter(d => d.questionId !== 'extra_saving' && d.questionId !== 'grace_day');
  const extraDecisions = decisions.filter(d => d.questionId === 'extra_saving');
  const totalSaved = decisions.reduce((s, d) => s + Number(d.deltaAmount ?? 0), 0);
  const dailySaved = dailyDecisions.reduce((s, d) => s + Number(d.deltaAmount ?? 0), 0);
  const extraSaved = extraDecisions.reduce((s, d) => s + Number(d.deltaAmount ?? 0), 0);
  const activeDates = new Set(dailyDecisions.map(d => d.date as string));
  const activeDaysCount = activeDates.size;
  const lastActiveAt = dailyDecisions.length
    ? [...activeDates].sort().slice(-1)[0] + 'T23:59:59Z'
    : null;

  // Calcular streak actual (días consecutivos con decisión diaria)
  const today = new Date().toISOString().split('T')[0];
  let streakCurrent = 0;
  {
    let cursor = new Date(today);
    while (true) {
      const dateStr = cursor.toISOString().split('T')[0];
      if (!activeDates.has(dateStr)) break;
      streakCurrent++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  // 1. Perfil + analytics
  try {
    const { error } = await supabase.from('user_profiles').upsert(
      {
        id: userId,
        name: store.userName ?? null,
        money_feeling: store.moneyFeeling ?? null,
        income_range: store.incomeRange ?? null,
        updated_at: now,
        streak_current: streakCurrent,
        streak_max: streakCurrent,
        total_saved: totalSaved,
        daily_saved: dailySaved,
        extra_saved: extraSaved,
        decisions_count: dailyDecisions.length,
        extra_savings_count: extraDecisions.length,
        goals_created_count: (store.goals ?? []).length,
        active_days_count: activeDaysCount,
        last_active_at: lastActiveAt,
      },
      { onConflict: 'id' },
    );
    if (error) console.error('[sync] user_profiles:', error.code, error.message);
    else migrated += 1;
  } catch (e) { console.error('[sync] user_profiles exception:', e); }

  // 2. Goals — upsert uno a uno para aislar errores
  if (store.goals?.length) {
    const goals = (store.goals as Record<string, unknown>[])
      .filter(g => g.id && g.title)
      .map(g => ({
        id: g.id as string,
        user_id: userId,
        title: g.title as string,
        target_amount: Number(g.targetAmount ?? 0),
        current_amount: Number(g.currentAmount ?? 0),
        horizon_months: Number(g.horizonMonths ?? 12),
        is_primary: Boolean(g.isPrimary),
        archived: Boolean(g.archived),
        created_at: (g.createdAt as string) || now,
        updated_at: (g.updatedAt as string) || now,
        source: (g.source as string) || 'dashboard',
        completed_at: (g.completedAt as string) || null,
      }));

    for (const goal of goals) {
      try {
        const { error } = await supabase.from('goals').upsert(goal, { onConflict: 'id' });
        if (error) console.error('[sync] goal:', error.code, error.message, goal.id);
        else migrated += 1;
      } catch (e) { console.error('[sync] goal exception:', e); }
    }
  }

  // 3. Decisions — upsert una a una; si falla por FK de goal_id, reintentar sin goal_id
  if (store.decisions?.length) {
    const decisions = (store.decisions as Record<string, unknown>[])
      .filter(d => d.id && d.questionId !== 'grace_day' && d.date)
      .map(d => ({
        id: d.id as string,
        user_id: userId,
        date: d.date as string,
        question_id: d.questionId as string,
        answer_key: (d.answerKey as string) || '',
        goal_id: (d.goalId as string) || null,
        delta_amount: Number(d.deltaAmount ?? 0),
        monthly_projection: Number(d.monthlyProjection ?? 0),
        yearly_projection: Number(d.yearlyProjection ?? 0),
        created_at: (d.createdAt as string) || now,
      }));

    for (const dec of decisions) {
      try {
        const { error } = await supabase.from('decisions').upsert(dec, { onConflict: 'id' });
        if (error) {
          // 23503 = FK violation (goal_id no existe en goals aún) → reintentar sin goal_id
          if (error.code === '23503') {
            const { error: err2 } = await supabase
              .from('decisions')
              .upsert({ ...dec, goal_id: null }, { onConflict: 'id' });
            if (err2) console.error('[sync] decision retry sin goal_id:', err2.code, err2.message, dec.id);
            else migrated += 1;
          } else {
            console.error('[sync] decision:', error.code, error.message, dec.id, dec.question_id, dec.date);
          }
        } else {
          migrated += 1;
        }
      } catch (e) { console.error('[sync] decision exception:', e); }
    }
  }

  // 4. Hucha
  if (store.hucha != null) {
    try {
      const { error } = await supabase.from('hucha').upsert(
        { user_id: userId, balance: Number(store.hucha.balance ?? 0), entries: store.hucha.entries ?? [] },
        { onConflict: 'user_id' },
      );
      if (error) console.error('[sync] hucha:', error.code, error.message);
    } catch (e) { console.error('[sync] hucha exception:', e); }
  }

  try { localStorage.setItem('supabase_last_sync', now); } catch { /* SSR */ }
  console.log(`[sync] completado: ${migrated} registros`);
  return { success: true, migrated };
}

// ─── Pull Supabase → localStorage (restaurar en nuevo dispositivo) ────────────
export async function pullDataFromSupabase(
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Supabase no está configurado.' };
  }

  try {
    const [profileRes, goalsRes, decisionsRes, huchaRes] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', userId).single(),
      supabase.from('goals').select('*').eq('user_id', userId).eq('archived', false),
      supabase.from('decisions').select('*').eq('user_id', userId).order('date', { ascending: true }),
      supabase.from('hucha').select('*').eq('user_id', userId).single(),
    ]);

    const profile = profileRes.data;
    const goals = goalsRes.data ?? [];
    const decisions = decisionsRes.data ?? [];
    const hucha = huchaRes.data;

    const localStore = {
      userName: profile?.name ?? '',
      userEmail: '',
      incomeRange: profile?.income_range ?? null,
      moneyFeeling: profile?.money_feeling ?? null,
      goals: goals.map((g: Record<string, unknown>) => ({
        id: g.id,
        title: g.title,
        targetAmount: g.target_amount,
        currentAmount: g.current_amount,
        horizonMonths: g.horizon_months,
        isPrimary: g.is_primary,
        archived: g.archived,
        createdAt: g.created_at,
        updatedAt: g.updated_at,
      })),
      decisions: decisions.map((d: Record<string, unknown>) => ({
        id: d.id,
        date: d.date,
        questionId: d.question_id,
        answerKey: d.answer_key,
        goalId: d.goal_id ?? '',
        deltaAmount: d.delta_amount,
        monthlyProjection: d.monthly_projection,
        yearlyProjection: d.yearly_projection,
        createdAt: d.created_at,
      })),
      hucha: { balance: hucha?.balance ?? 0, entries: hucha?.entries ?? [] },
      seenMilestones: [],
      graceUsedMonth: null,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(localStore));
    localStorage.setItem('supabase_last_sync', new Date().toISOString());
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── Sync status ─────────────────────────────────────────────────────────────
export function getLastSyncTime(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('supabase_last_sync');
}

export function hasLocalDataToMigrate(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const store = JSON.parse(raw);
    return (store.goals?.length > 0 || store.decisions?.length > 0);
  } catch { return false; }
}

// ─── Helper: obtener userId real de la sesión activa ─────────────────────────
async function getSessionUserId(): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { data } = await supabase.auth.refreshSession();
      session = data.session;
    }
    return session?.user?.id ?? null;
  } catch { return null; }
}

// ─── Sync en tiempo real: goal → Supabase ────────────────────────────────────
export async function syncGoalToSupabase(
  goal: {
    id: string; title: string; targetAmount: number; currentAmount: number;
    horizonMonths: number; isPrimary: boolean; archived: boolean;
    createdAt: string; updatedAt: string;
    source?: string; completedAt?: string | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: 'no_supabase' };
  const userId = await getSessionUserId();
  if (!userId) { console.error('[sync] syncGoalToSupabase: sin sesión'); return { ok: false, error: 'no_session' }; }
  try {
    const { error } = await supabase.from('goals').upsert({
      id: goal.id,
      user_id: userId,
      title: goal.title,
      target_amount: goal.targetAmount,
      current_amount: goal.currentAmount,
      horizon_months: goal.horizonMonths,
      is_primary: goal.isPrimary,
      archived: goal.archived,
      created_at: goal.createdAt,
      updated_at: goal.updatedAt,
      source: goal.source ?? 'dashboard',
      completed_at: goal.completedAt ?? null,
    }, { onConflict: 'id' });
    if (error) { console.error('[sync] syncGoalToSupabase error:', error.code, error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  } catch (err) {
    console.error('[sync] syncGoalToSupabase exception:', err);
    return { ok: false, error: String(err) };
  }
}

// ─── Sync en tiempo real: decision → Supabase ────────────────────────────────
export async function syncDecisionToSupabase(
  decision: {
    id: string; date: string; questionId: string; answerKey: string;
    goalId?: string | null; deltaAmount: number;
    monthlyProjection: number; yearlyProjection: number; createdAt: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: 'no_supabase' };
  const userId = await getSessionUserId();
  if (!userId) { console.error('[sync] syncDecisionToSupabase: sin sesión'); return { ok: false, error: 'no_session' }; }

  const row = {
    id: decision.id,
    user_id: userId,
    date: decision.date,
    question_id: decision.questionId,
    answer_key: decision.answerKey,
    goal_id: decision.goalId ?? null,
    delta_amount: decision.deltaAmount,
    monthly_projection: decision.monthlyProjection,
    yearly_projection: decision.yearlyProjection,
    created_at: decision.createdAt,
  };

  try {
    const { error } = await supabase.from('decisions').upsert(row, { onConflict: 'id' });
    if (error) {
      if (error.code === '23503') {
        // FK violation: goal_id no existe aún → reintentar sin goal_id
        const { error: err2 } = await supabase.from('decisions').upsert({ ...row, goal_id: null }, { onConflict: 'id' });
        if (err2) { console.error('[sync] syncDecisionToSupabase retry:', err2.code, err2.message); return { ok: false, error: err2.message }; }
        return { ok: true };
      }
      console.error('[sync] syncDecisionToSupabase error:', error.code, error.message, decision.id);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    console.error('[sync] syncDecisionToSupabase exception:', err);
    return { ok: false, error: String(err) };
  }
}

// ─── Sync en tiempo real: hucha → Supabase ───────────────────────────────────
export async function syncHuchaToSupabase(
  balance: number,
  entries: unknown[],
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const userId = await getSessionUserId();
  if (!userId) return;
  try {
    const { error } = await supabase.from('hucha').upsert(
      { user_id: userId, balance, entries },
      { onConflict: 'user_id' },
    );
    if (error) console.error('[sync] syncHuchaToSupabase error:', error.code, error.message);
  } catch (err) {
    console.error('[sync] syncHuchaToSupabase exception:', err);
  }
}

// ─── Sync completo del store local → Supabase (on-demand) ────────────────────
export async function syncAllToSupabase(userId: string): Promise<void> {
  await pushLocalDataToSupabase(userId);
}

// ─── Guardar perfil en Supabase al registrarse ────────────────────────────────
export async function saveUserProfileToSupabase(
  userId: string,
  name: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Supabase no está configurado' };
  }
  try {
    const { error } = await supabase.from('user_profiles').upsert(
      { id: userId, name: name.trim() },
      { onConflict: 'id' },
    );
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
