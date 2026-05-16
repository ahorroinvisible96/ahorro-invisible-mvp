/**
 * buildAIContext.ts — Constructor de contexto seguro para Gemini
 *
 * Lee datos del usuario desde Supabase y construye un objeto de contexto
 * anonimizado (sin datos sensibles) para que Gemini tome decisiones
 * sobre qué pregunta mostrar.
 *
 * Zona horaria: Europe/Madrid (UTC+1 / UTC+2 en horario de verano)
 */

import { getSupabase } from '../geminiService';

// ── Tipos ──────────────────────────────────────────────────────────────────

export type TimeWindow = 'Madrugada' | 'Mañana' | 'Tarde' | 'Noche';

export interface AIContext {
  // Perfil avatar
  avatar_dominant: string | null;
  avatar_secondary: string | null;
  avatar_confidence: number;
  avatar_scores: Record<string, number> | null;

  // Temporal
  day_of_week: string;
  day_of_week_index: number;
  time_window: TimeWindow;
  hour_approx: number;
  is_weekend: boolean;
  month_phase: 'inicio' | 'mitad' | 'final' | 'cualquiera';
  day_of_month: number;

  // Objetivo activo
  active_goal_title: string | null;
  active_goal_progress_pct: number;

  // Historial reciente (últimos 14 días)
  recent_question_ids: string[];
  recent_answer_keys: string[];
  recent_responded: boolean[];
  recent_savings: number[];
  total_saved_last_7d: number;
  active_days_last_7d: number;
  streak_current: number;

  // Categorías que funcionan mejor
  best_categories: string[];

  // Frecuencia de uso
  usage_frequency: 'daily' | 'frequent' | 'occasional' | 'rare';

  // Señales de fatiga
  consecutive_no_response: number;
  days_since_last_response: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;

/** Obtiene la hora actual en zona horaria Europe/Madrid */
function getMadridDate(): Date {
  const now = new Date();
  const madridStr = now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' });
  return new Date(madridStr);
}

export function getCurrentTimeWindow(): TimeWindow {
  const hour = getMadridDate().getHours();
  if (hour >= 0 && hour < 6) return 'Madrugada';
  if (hour >= 6 && hour < 14) return 'Mañana';
  if (hour >= 14 && hour < 20) return 'Tarde';
  return 'Noche'; // 20-24
}

export function getMadridDateString(): string {
  const d = getMadridDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Builder principal ──────────────────────────────────────────────────────

export async function buildAIContext(userId: string): Promise<AIContext> {
  const supabase = getSupabase();
  const madridNow = getMadridDate();
  const dayIndex = madridNow.getDay();
  const dayOfMonth = madridNow.getDate();
  const daysInMonth = new Date(madridNow.getFullYear(), madridNow.getMonth() + 1, 0).getDate();

  // Fase del mes
  let monthPhase: AIContext['month_phase'] = 'cualquiera';
  if (dayOfMonth <= 5) monthPhase = 'inicio';
  else if (dayOfMonth >= 12 && dayOfMonth <= 18) monthPhase = 'mitad';
  else if (dayOfMonth >= daysInMonth - 5) monthPhase = 'final';

  // ── Leer datos de Supabase en paralelo ───────────────────────────────────
  const [profileRes, goalsRes, decisionsRes, interactionsRes] = await Promise.all([
    supabase.from('user_profiles')
      .select('avatar, subavatar, avatar_scores, streak_current')
      .eq('id', userId)
      .single(),
    supabase.from('goals')
      .select('title, current_amount, target_amount')
      .eq('user_id', userId)
      .eq('archived', false)
      .limit(1),
    supabase.from('decisions')
      .select('date, question_id, delta_amount')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(14),
    supabase.from('question_interactions')
      .select('question_id, answer_key, responded, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  const profile = profileRes.data;
  const goals = goalsRes.data ?? [];
  const decisions = decisionsRes.data ?? [];
  const interactions = interactionsRes.data ?? [];

  // ── Cálculos derivados ────────────────────────────────────────────────────
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentDecisions = decisions.filter(d => new Date(d.date).getTime() >= sevenDaysAgo);
  const totalSaved7d = recentDecisions.reduce((s, d) => s + Number(d.delta_amount ?? 0), 0);
  const activeDays7d = new Set(recentDecisions.map(d => d.date)).size;

  // Categorías con mejor rendimiento (de las que respondió con ahorro > 0)
  const respondedWithSavings = interactions.filter(i => i.responded && i.answer_key !== 'skip');
  const categoryCount: Record<string, number> = {};
  for (const i of respondedWithSavings) {
    const qid = i.question_id;
    // Extraer prefijo de categoría del ID: Q_CI_01 → Q_CI
    const prefix = qid?.substring(0, 4) ?? '';
    categoryCount[prefix] = (categoryCount[prefix] ?? 0) + 1;
  }
  const bestCategories = Object.entries(categoryCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k]) => k);

  // Frecuencia de uso
  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const activeDays14d = new Set(
    decisions.filter(d => new Date(d.date).getTime() >= fourteenDaysAgo).map(d => d.date)
  ).size;
  let usageFrequency: AIContext['usage_frequency'] = 'rare';
  if (activeDays14d >= 12) usageFrequency = 'daily';
  else if (activeDays14d >= 7) usageFrequency = 'frequent';
  else if (activeDays14d >= 3) usageFrequency = 'occasional';

  // Señales de fatiga
  const recentInteractions = interactions.slice(0, 5);
  let consecutiveNoResponse = 0;
  for (const i of recentInteractions) {
    if (!i.responded) consecutiveNoResponse++;
    else break;
  }

  const lastResponded = interactions.find(i => i.responded);
  const daysSinceLastResponse = lastResponded
    ? Math.floor((Date.now() - new Date(lastResponded.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // Objetivo activo
  const activeGoal = goals[0] ?? null;
  const goalProgressPct = activeGoal
    ? Math.round((activeGoal.current_amount / activeGoal.target_amount) * 100)
    : 0;

  return {
    avatar_dominant: profile?.avatar ?? null,
    avatar_secondary: profile?.subavatar ?? null,
    avatar_confidence: profile?.avatar_scores ? 0.8 : 0.5,
    avatar_scores: profile?.avatar_scores ?? null,

    day_of_week: DAY_NAMES[dayIndex],
    day_of_week_index: dayIndex,
    time_window: getCurrentTimeWindow(),
    hour_approx: madridNow.getHours(),
    is_weekend: dayIndex === 0 || dayIndex === 5 || dayIndex === 6,
    month_phase: monthPhase,
    day_of_month: dayOfMonth,

    active_goal_title: activeGoal?.title ?? null,
    active_goal_progress_pct: goalProgressPct,

    recent_question_ids: decisions.map(d => d.question_id).filter(Boolean),
    recent_answer_keys: interactions.map(i => i.answer_key).filter(Boolean),
    recent_responded: interactions.map(i => i.responded),
    recent_savings: decisions.map(d => Number(d.delta_amount ?? 0)),
    total_saved_last_7d: totalSaved7d,
    active_days_last_7d: activeDays7d,
    streak_current: profile?.streak_current ?? 0,

    best_categories: bestCategories,
    usage_frequency: usageFrequency,

    consecutive_no_response: consecutiveNoResponse,
    days_since_last_response: daysSinceLastResponse,
  };
}
