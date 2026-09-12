/**
 * Question Selection Engine — Motor de selección de preguntas diarias
 *
 * Selecciona la pregunta del día según:
 *   1. Avatar del usuario (comodo | social | impulsivo)
 *   2. Franja horaria actual (Mañana | Tarde | Noche)
 *
 * NO existe scoring, NO existe IA en la selección, NO existe cambio de avatar.
 * Las preguntas se sirven para registrar ahorro y reforzar hábitos.
 *
 * Estabilidad: dentro de la misma franja horaria del mismo día, el mismo
 * usuario recibe siempre la misma pregunta (hash determinístico por fecha+franja+avatar).
 * Al cambiar de franja, puede cambiar la pregunta si aún no respondió.
 */

import {
  QUESTIONS_BANK,
  getQuestionsForSlot,
  type BankQuestion,
  type AvatarKey,
  type TimeWindow,
} from './dailyQuestionsBank';

export type { AvatarKey, TimeWindow, BankQuestion };

// ── Franja horaria ─────────────────────────────────────────────────────────────
export function getCurrentTimeWindow(): TimeWindow {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'Mañana';
  if (hour >= 14 && hour < 20) return 'Tarde';
  return 'Noche'; // 20-06
}

// ── Contexto temporal ─────────────────────────────────────────────────────────
export interface TemporalContext {
  date: string;       // YYYY-MM-DD
  timeWindow: TimeWindow;
}

export function getTemporalContext(): TemporalContext {
  return {
    date: new Date().toISOString().split('T')[0],
    timeWindow: getCurrentTimeWindow(),
  };
}

// ── Hash determinístico ───────────────────────────────────────────────────────
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash);
}

// ── Selección principal ───────────────────────────────────────────────────────

/**
 * Selecciona la pregunta diaria para un usuario.
 *
 * @param avatar           Avatar del usuario
 * @param date             Fecha (YYYY-MM-DD). Por defecto: hoy.
 * @param timeWindow       Franja horaria. Por defecto: la actual.
 * @param excludeIds       IDs de preguntas recientes a evitar (últimos 7 días)
 */
export function selectDailyQuestion(
  avatar: AvatarKey,
  date?: string,
  timeWindow?: TimeWindow,
  excludeIds: string[] = [],
): BankQuestion {
  const ctx = getTemporalContext();
  const resolvedDate = date ?? ctx.date;
  const resolvedSlot = timeWindow ?? ctx.timeWindow;

  // Obtener pool filtrado por avatar + franja
  let pool = getQuestionsForSlot(avatar, resolvedSlot);

  // Excluir preguntas recientes si quedan suficientes candidatos
  const filtered = pool.filter(q => !excludeIds.includes(q.id));
  if (filtered.length >= 3) pool = filtered;

  if (pool.length === 0) {
    // Fallback: cualquier pregunta del avatar sin filtro de franja
    const avatarPool = QUESTIONS_BANK.filter(q => q.avatar === avatar);
    if (avatarPool.length > 0) pool = avatarPool;
    else pool = QUESTIONS_BANK; // último recurso
  }

  // Hash determinístico: misma fecha + franja + avatar → misma pregunta
  const seed = `${resolvedDate}:${resolvedSlot}:${avatar}`;
  const idx = hashSeed(seed) % pool.length;
  return pool[idx];
}

/**
 * Selecciona una pregunta alternativa distinta a la actual.
 * Útil cuando el usuario quiere ver otra pregunta antes de responder.
 * Usa aleatoriedad real (no determinística) para variedad.
 */
export function selectAlternativeQuestion(
  avatar: AvatarKey,
  timeWindow: TimeWindow,
  currentQuestionId: string,
  excludeIds: string[] = [],
): BankQuestion | null {
  let pool = getQuestionsForSlot(avatar, timeWindow);
  const allExcluded = [...excludeIds, currentQuestionId];
  pool = pool.filter(q => !allExcluded.includes(q.id));

  if (pool.length === 0) {
    // Fallback: avatar sin filtro de franja, excluyendo la actual
    pool = QUESTIONS_BANK
      .filter(q => q.avatar === avatar && !allExcluded.includes(q.id));
  }
  if (pool.length === 0) return null;

  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

/**
 * Obtiene la pregunta diaria contextual para el usuario.
 * Si ya respondió hoy, devuelve la misma pregunta respondida.
 *
 * @param avatar             Avatar del usuario
 * @param answeredToday      Si ya respondió la pregunta hoy
 * @param lastQuestionId     ID de la pregunta que respondió (si respondió)
 * @param recentQuestionIds  IDs de preguntas de los últimos 7 días
 */
export function getContextualDailyQuestion(
  avatar: AvatarKey | null,
  answeredToday: boolean,
  lastQuestionId: string | null = null,
  recentQuestionIds: string[] = [],
): BankQuestion {
  // Si ya respondió hoy, devolver la misma pregunta
  if (answeredToday && lastQuestionId) {
    const answered = QUESTIONS_BANK.find(q => q.id === lastQuestionId);
    if (answered) return answered;
  }

  const resolvedAvatar: AvatarKey = avatar ?? 'comodo';
  const ctx = getTemporalContext();
  return selectDailyQuestion(resolvedAvatar, ctx.date, ctx.timeWindow, recentQuestionIds);
}

/**
 * Convierte una BankQuestion al formato simplificado para el dashboard.
 */
export function toDashboardQuestion(q: BankQuestion): {
  questionId: string;
  text: string;
  options: string[];
  avatar: AvatarKey;
  timeSlot: TimeWindow;
} {
  return {
    questionId: q.id,
    text: q.text,
    options: q.options,
    avatar: q.avatar,
    timeSlot: q.timeSlot,
  };
}
