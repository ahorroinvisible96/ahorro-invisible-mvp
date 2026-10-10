import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── Admin Supabase client (bypasses RLS) ──────────────────────────────────────
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function GET() {
  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase no configurado (falta SERVICE_ROLE_KEY)' },
      { status: 500 },
    );
  }

  try {
    // ── Queries en paralelo (fuente de verdad V2) ───────────────────────────────────────────────
    const [profilesRes, goalsRes, decisionsRes, ledgerRes] = await Promise.all([
      supabase.from('user_profiles').select('id, money_feeling, streak_current'),
      supabase.from('v_goal_state').select('goal_id, title, target_amount, current_balance, is_primary, status, first_completed_at'),
      supabase.from('daily_decisions').select('decision_id, local_date, question_id, selected_option_key, outcome, status')
        .eq('status', 'active').neq('outcome', 'grace').order('local_date', { ascending: false }).limit(500),
      supabase.from('savings_transactions').select('decision_id, amount, local_date, transaction_type')
        .in('transaction_type', ['daily_saving', 'extra_saving', 'amendment', 'reversal']),
    ]);

    const profiles = profilesRes.data ?? [];
    const goals = (goalsRes.data ?? []).filter((g: Record<string, unknown>) => g.status !== 'deleted');
    const ledger = ledgerRes.data ?? [];
    const amountByDecision: Record<string, number> = {};
    for (const t of ledger) if (t.decision_id) amountByDecision[t.decision_id] = (amountByDecision[t.decision_id] ?? 0) + Number(t.amount);
    const decisions = (decisionsRes.data ?? []).map((d: Record<string, unknown>) => ({
      id: d.decision_id, date: d.local_date, question_id: d.question_id, answer_key: d.selected_option_key,
      delta_amount: amountByDecision[String(d.decision_id)] ?? 0,
    }));
    const retention = null;       // KPIs de retención/activación: Analytics V2 (5C)
    const questionStats: unknown[] = [];
    const activation: unknown[] = [];

    // ── KPI calculations ──────────────────────────────────────────────────────
    const totalUsers = profiles.length;

    // Ahorro registrado (excluye saldos de apertura de migración y transferencias internas)
    const totalSaved = ledger.reduce((sum: number, t: Record<string, unknown>) => sum + Number(t.amount ?? 0), 0);

    const dailyDecisions = decisions;

    const avgStreak =
      profiles.length > 0
        ? profiles.reduce(
            (sum: number, p: Record<string, unknown>) =>
              sum + Number(p.streak_current ?? 0),
            0,
          ) / profiles.length
        : 0;

    const activeGoals = goals.filter(
      (g: Record<string, unknown>) => g.status === 'active',
    );
    const completedGoals = goals.filter(
      (g: Record<string, unknown>) => g.first_completed_at != null,
    );

    // ── Daily savings aggregation (last 30 days) ──────────────────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysStr = thirtyDaysAgo.toISOString().split('T')[0];

    const dailySavingsMap: Record<string, number> = {};
    for (const t of ledger) {
      const date = String(t.local_date);
      if (date >= thirtyDaysStr) {
        dailySavingsMap[date] = (dailySavingsMap[date] ?? 0) + Number(t.amount ?? 0);
      }
    }

    // Fill in missing days with 0
    const dailySavings: { date: string; amount: number; cumulative: number }[] = [];
    let cumulative = 0;
    const cursor = new Date(thirtyDaysAgo);
    const today = new Date();
    while (cursor <= today) {
      const dateStr = cursor.toISOString().split('T')[0];
      const dayAmount = dailySavingsMap[dateStr] ?? 0;
      cumulative += dayAmount;
      dailySavings.push({ date: dateStr, amount: dayAmount, cumulative });
      cursor.setDate(cursor.getDate() + 1);
    }

    // ── Money feeling distribution ────────────────────────────────────────────
    const feelingDist: Record<string, number> = {};
    for (const p of profiles) {
      const feeling = String(p.money_feeling ?? 'Sin respuesta');
      feelingDist[feeling] = (feelingDist[feeling] ?? 0) + 1;
    }

    // ── Recent decisions (last 50) ────────────────────────────────────────────
    const recentDecisions = decisions.slice(0, 50).map((d) => ({
      id: d.id,
      date: d.date,
      question_id: d.question_id,
      answer_key: d.answer_key,
      delta_amount: d.delta_amount,
      monthly_projection: null,
      yearly_projection: null,
    }));

    // ── Goal progress ─────────────────────────────────────────────────────────
    const goalProgress = activeGoals.slice(0, 20).map((g: Record<string, unknown>) => ({
      id: g.goal_id,
      title: g.title,
      target_amount: Number(g.target_amount ?? 0),
      current_amount: Number(g.current_balance ?? 0),
      percent:
        Number(g.target_amount) > 0
          ? Math.min(100, Math.round((Number(g.current_balance) / Number(g.target_amount)) * 100))
          : 0,
      is_primary: g.is_primary,
    }));

    return NextResponse.json({
      kpis: {
        totalUsers,
        totalSaved,
        totalDecisions: dailyDecisions.length,
        avgStreak: Math.round(avgStreak * 10) / 10,
        activeGoals: activeGoals.length,
        completedGoals: completedGoals.length,
      },
      retention,
      dailySavings,
      feelingDist,
      questionStats,
      recentDecisions,
      goalProgress,
      activation,
    });
  } catch (err) {
    console.error('[analytics API] Error:', err);
    return NextResponse.json(
      { error: 'Error al obtener datos analíticos' },
      { status: 500 },
    );
  }
}
