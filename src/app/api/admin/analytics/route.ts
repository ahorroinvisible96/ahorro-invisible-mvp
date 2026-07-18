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
    // ── Queries en paralelo ───────────────────────────────────────────────────
    const [
      profilesRes,
      goalsRes,
      decisionsRes,
      retentionRes,
      questionStatsRes,
      activationRes,
    ] = await Promise.all([
      supabase.from('user_profiles').select('*'),
      supabase.from('goals').select('*'),
      supabase.from('decisions').select('*').order('date', { ascending: false }).limit(500),
      supabase.from('v_retention').select('*'),
      supabase.from('v_question_stats').select('*'),
      supabase.from('v_activation').select('*'),
    ]);

    const profiles = profilesRes.data ?? [];
    const goals = goalsRes.data ?? [];
    const decisions = decisionsRes.data ?? [];
    const retention = retentionRes.data?.[0] ?? null;
    const questionStats = questionStatsRes.data ?? [];
    const activation = activationRes.data ?? [];

    // ── KPI calculations ──────────────────────────────────────────────────────
    const totalUsers = profiles.length;

    const totalSaved = decisions.reduce(
      (sum: number, d: Record<string, unknown>) => sum + Number(d.delta_amount ?? 0),
      0,
    );

    const dailyDecisions = decisions.filter(
      (d: Record<string, unknown>) =>
        d.question_id !== 'extra_saving' && d.question_id !== 'grace_day',
    );

    const avgStreak =
      profiles.length > 0
        ? profiles.reduce(
            (sum: number, p: Record<string, unknown>) =>
              sum + Number(p.streak_current ?? 0),
            0,
          ) / profiles.length
        : 0;

    const activeGoals = goals.filter(
      (g: Record<string, unknown>) => !g.archived,
    );
    const completedGoals = goals.filter(
      (g: Record<string, unknown>) => g.completed_at != null,
    );

    // ── Daily savings aggregation (last 30 days) ──────────────────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysStr = thirtyDaysAgo.toISOString().split('T')[0];

    const dailySavingsMap: Record<string, number> = {};
    for (const d of dailyDecisions) {
      const date = String(d.date);
      if (date >= thirtyDaysStr) {
        dailySavingsMap[date] = (dailySavingsMap[date] ?? 0) + Number(d.delta_amount ?? 0);
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
    const recentDecisions = decisions.slice(0, 50).map((d: Record<string, unknown>) => ({
      id: d.id,
      date: d.date,
      question_id: d.question_id,
      answer_key: d.answer_key,
      delta_amount: d.delta_amount,
      monthly_projection: d.monthly_projection,
      yearly_projection: d.yearly_projection,
    }));

    // ── Goal progress ─────────────────────────────────────────────────────────
    const goalProgress = activeGoals.slice(0, 20).map((g: Record<string, unknown>) => ({
      id: g.id,
      title: g.title,
      target_amount: Number(g.target_amount ?? 0),
      current_amount: Number(g.current_amount ?? 0),
      percent:
        Number(g.target_amount) > 0
          ? Math.min(100, Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100))
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
