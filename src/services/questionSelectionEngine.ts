/**
 * Question Selection Engine — Motor contextual de selección de preguntas
 *
 * Combina tres variables para elegir la pregunta diaria más relevante:
 *   1. Perfil del usuario (avatar + subavatar)
 *   2. Día de la semana
 *   3. Franja horaria actual
 *
 * Comportamiento clave:
 *   - Si el usuario NO ha respondido la pregunta diaria, puede actualizarse
 *     automáticamente al cambiar de franja horaria.
 *   - Si el usuario YA respondió, la pregunta se bloquea para ese día.
 *   - Cada franja horaria prioriza diferentes tipos de pregunta.
 */

import {
  DAILY_QUESTIONS_BANK,
  type DailyQuestion,
} from './dailyQuestionsBank';
import type { AvatarKey, SubavatarKey } from './profilingService';

// ── Franjas horarias ─────────────────────────────────────────────────────────
export type TimeWindow = 'Mañana' | 'Tarde' | 'Noche';

export function getCurrentTimeWindow(): TimeWindow {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'Mañana';
  if (hour >= 14 && hour < 21) return 'Tarde';
  return 'Noche';
}

// ── Día de la semana en español ──────────────────────────────────────────────
const DAY_NAMES = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
] as const;

export function getCurrentDayName(): string {
  return DAY_NAMES[new Date().getDay()];
}

// ── Contexto temporal completo ───────────────────────────────────────────────
export interface TemporalContext {
  dayName: string;
  dayIndex: number;        // 0 = Domingo … 6 = Sábado
  timeWindow: TimeWindow;
  isWeekend: boolean;
  monthPhase: 'Inicio' | 'Mitad' | 'Final' | 'Cualquiera';
}

export function getTemporalContext(): TemporalContext {
  const now = new Date();
  const dayIndex = now.getDay();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  let monthPhase: TemporalContext['monthPhase'] = 'Cualquiera';
  if (dayOfMonth <= 5) monthPhase = 'Inicio';
  else if (dayOfMonth >= 12 && dayOfMonth <= 18) monthPhase = 'Mitad';
  else if (dayOfMonth >= daysInMonth - 5) monthPhase = 'Final';

  return {
    dayName: DAY_NAMES[dayIndex],
    dayIndex,
    timeWindow: getCurrentTimeWindow(),
    isWeekend: dayIndex === 0 || dayIndex === 5 || dayIndex === 6,
    monthPhase,
  };
}

// ── Perfil del usuario ───────────────────────────────────────────────────────
export interface UserProfile {
  avatar: AvatarKey | 'constructor' | null;
  subavatar: SubavatarKey | null;
  streak: number;
}

// ── Scoring de relevancia ────────────────────────────────────────────────────
interface ScoredQuestion {
  question: DailyQuestion;
  score: number;
}

/**
 * Comprueba si el `bestDays` de una pregunta encaja con el día actual.
 * Formatos soportados:
 *   - "Cualquier día"
 *   - "Lunes, Martes, Miércoles"
 *   - "Lunes a Viernes"
 *   - "Viernes, Sábado"
 *   - "Sábado, Domingo"
 *   - "Últimos 5 días" / "Últimos 3 días" / "Primeros 5 días" / etc.
 */
function matchesBestDays(bestDays: string, ctx: TemporalContext): boolean {
  const bd = bestDays.toLowerCase().trim();

  // "Cualquier día" siempre encaja
  if (bd.includes('cualquier')) return true;

  // Rangos del tipo "Lunes a Viernes", "Domingo a Jueves"
  const rangeMatch = bd.match(/^(\w+)\s+a\s+(\w+)$/);
  if (rangeMatch) {
    const startIdx = DAY_NAMES.findIndex(d => d.toLowerCase() === rangeMatch[1]);
    const endIdx = DAY_NAMES.findIndex(d => d.toLowerCase() === rangeMatch[2]);
    if (startIdx !== -1 && endIdx !== -1) {
      if (startIdx <= endIdx) {
        return ctx.dayIndex >= startIdx && ctx.dayIndex <= endIdx;
      }
      // Wrap-around (p.ej. "Viernes a Lunes")
      return ctx.dayIndex >= startIdx || ctx.dayIndex <= endIdx;
    }
  }

  // "Últimos N días" / "Primeros N días"
  if (bd.includes('ltimos') || bd.includes('últimos')) {
    const n = parseInt(bd.match(/\d+/)?.[0] ?? '5');
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return now.getDate() > daysInMonth - n;
  }
  if (bd.includes('primeros')) {
    const n = parseInt(bd.match(/\d+/)?.[0] ?? '5');
    return new Date().getDate() <= n;
  }

  // Lista de días: "Viernes, Sábado"
  const currentDayLower = ctx.dayName.toLowerCase();
  return bd.split(',').some(d => d.trim() === currentDayLower);
}

/**
 * Comprueba si el `bestTimeWindow` encaja con la franja horaria actual.
 */
function matchesTimeWindow(bestTimeWindow: string, currentWindow: TimeWindow): boolean {
  const tw = bestTimeWindow.toLowerCase().trim();
  if (tw === 'cualquiera' || tw === '') return true;
  return tw === currentWindow.toLowerCase();
}

/**
 * Comprueba si la fase del mes encaja.
 */
function matchesMonthPhase(questionPhase: string, contextPhase: TemporalContext['monthPhase']): boolean {
  const qp = questionPhase.toLowerCase().trim();
  if (qp === 'cualquiera' || qp === '') return true;
  if (qp === 'post-cobro' && contextPhase === 'Inicio') return true;
  return qp.toLowerCase() === contextPhase.toLowerCase();
}

// ── Motor principal de scoring ────────────────────────────────────────────────
/**
 * Calcula una puntuación de relevancia para cada pregunta del banco
 * basándose en el perfil del usuario y el contexto temporal.
 *
 * Pesos de scoring:
 *   +40  — Avatar primario coincide con el del usuario
 *   +25  — Avatar secundario coincide
 *   +20  — Subavatar primario coincide
 *   +15  — Subavatar secundario coincide
 *   +20  — Día de la semana encaja con bestDays
 *   +15  — Franja horaria encaja con bestTimeWindow
 *   +10  — Fase del mes encaja con monthPhase
 *   +N   — priorityBase de la pregunta (0-10)
 *   +N   — scenarioWeight de la pregunta (0-3)
 *   +5   — Constructor bonus (racha >= 7)
 */
export function scoreQuestions(
  profile: UserProfile,
  ctx: TemporalContext,
): ScoredQuestion[] {
  return DAILY_QUESTIONS_BANK.map(q => {
    let score = 0;

    // ── 1. Perfil del usuario ────────────────────────────────────────────
    if (profile.avatar) {
      // Match avatar primario
      if (q.targetAvatarPrimary === profile.avatar) {
        score += 40;
      }
      // Match avatar secundario
      if (q.targetAvatarSecondary === profile.avatar) {
        score += 25;
      }
    }

    if (profile.subavatar) {
      if (q.targetSubavatarPrimary === profile.subavatar) {
        score += 20;
      }
      if (q.targetSubavatarSecondary === profile.subavatar) {
        score += 15;
      }
    }

    // Constructor bonus: si la racha es alta, dar bonus a preguntas Constructor
    if (profile.streak >= 7 && q.targetAvatarPrimary === 'constructor') {
      score += 5;
    }

    // ── 2. Día de la semana ──────────────────────────────────────────────
    if (matchesBestDays(q.bestDays, ctx)) {
      score += 20;
    }

    // ── 3. Franja horaria ────────────────────────────────────────────────
    if (matchesTimeWindow(q.bestTimeWindow, ctx.timeWindow)) {
      score += 15;
    }

    // ── 4. Fase del mes ──────────────────────────────────────────────────
    if (matchesMonthPhase(q.monthPhase, ctx.monthPhase)) {
      score += 10;
    }

    // ── 5. Pesos intrínsecos de la pregunta ──────────────────────────────
    score += q.priorityBase;
    score += q.scenarioWeight * 2;

    return { question: q, score };
  });
}

// ── Selección ponderada con variación ────────────────────────────────────────
/**
 * Genera un hash determinístico a partir de una seed string.
 * Usado para que la misma franja horaria del mismo día devuelva
 * la misma pregunta (estabilidad), pero cambie entre franjas.
 */
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Selecciona la pregunta más relevante para el momento actual.
 *
 * @param profile   Perfil del usuario (avatar, subavatar, racha)
 * @param ctx       Contexto temporal (día, franja, fase del mes)
 * @param excludeIds   IDs de preguntas ya respondidas recientemente
 * @returns La pregunta seleccionada
 */
export function selectQuestion(
  profile: UserProfile,
  ctx: TemporalContext,
  excludeIds: string[] = [],
): DailyQuestion {
  // ── Pre-filtrar el pool según lo que sabemos del perfil ──────────────────
  // Si sabemos avatar pero NO subavatar → restringir a los 2 bloques de 15
  // del avatar (30 preguntas). Esto evita que preguntas de otros avatares
  // se cuelen solo por buen match temporal.
  let pool = DAILY_QUESTIONS_BANK;

  if (profile.avatar && !profile.subavatar) {
    // Sin subavatar: usar los 30 del avatar conocido
    const avatarPool = DAILY_QUESTIONS_BANK.filter(
      q => q.targetAvatarPrimary === profile.avatar
    );
    // Solo usar el pool filtrado si tiene suficientes preguntas
    if (avatarPool.length >= 5) {
      pool = avatarPool;
    }
  } else if (profile.avatar && profile.subavatar) {
    // Con subavatar: priorizar las 15 del subavatar, pero incluir las
    // 15 del otro sub del mismo avatar como respaldo
    const subavatarPool = DAILY_QUESTIONS_BANK.filter(
      q => q.targetAvatarPrimary === profile.avatar
    );
    if (subavatarPool.length >= 5) {
      pool = subavatarPool;
    }
  }
  // Si avatar es null (no sabemos nada): pool completo de 135

  const scored = pool.map(q => {
    let score = 0;

    // ── 1. Perfil del usuario ────────────────────────────────────────────
    if (profile.avatar) {
      if (q.targetAvatarPrimary === profile.avatar) {
        score += 40;
      }
      if (q.targetAvatarSecondary === profile.avatar) {
        score += 25;
      }
    }

    if (profile.subavatar) {
      // Subavatar conocido: bonus fuerte para su bloque de 15
      if (q.targetSubavatarPrimary === profile.subavatar) {
        score += 20;
      }
      if (q.targetSubavatarSecondary === profile.subavatar) {
        score += 15;
      }
    }

    // Constructor bonus: si la racha es alta, dar bonus a preguntas Constructor
    if (profile.streak >= 7 && q.targetAvatarPrimary === 'constructor') {
      score += 5;
    }

    // ── 2. Día de la semana ──────────────────────────────────────────────
    if (matchesBestDays(q.bestDays, ctx)) {
      score += 20;
    }

    // ── 3. Franja horaria ────────────────────────────────────────────────
    if (matchesTimeWindow(q.bestTimeWindow, ctx.timeWindow)) {
      score += 15;
    }

    // ── 4. Fase del mes ──────────────────────────────────────────────────
    if (matchesMonthPhase(q.monthPhase, ctx.monthPhase)) {
      score += 10;
    }

    // ── 5. Pesos intrínsecos de la pregunta ──────────────────────────────
    score += q.priorityBase;
    score += q.scenarioWeight * 2;

    return { question: q, score };
  }).filter(sq => !excludeIds.includes(sq.question.id));

  // Ordenar por score descendente
  scored.sort((a, b) => b.score - a.score);

  // Tomar las top 5 preguntas para variedad
  const topN = scored.slice(0, Math.min(5, scored.length));

  // Usar hash determinístico basado en fecha + franja para estabilidad
  // pero variación entre franjas horarias
  const today = new Date().toISOString().split('T')[0];
  const seed = `${today}:${ctx.timeWindow}:${profile.avatar ?? 'none'}`;
  const idx = hashSeed(seed) % topN.length;

  return topN[idx].question;
}

// ── API pública: pregunta contextual del día ─────────────────────────────────

/**
 * Obtiene la pregunta diaria contextual para el usuario.
 *
 * Lógica:
 *   1. Si ya respondió hoy → no se cambia, se devuelve la que respondió
 *   2. Si NO respondió → se selecciona la más relevante para:
 *      - Su perfil (avatar + subavatar)
 *      - El día actual
 *      - La franja horaria actual
 *   3. La pregunta puede cambiar entre franjas (mañana → tarde → noche)
 *      siempre que NO haya sido respondida
 *
 * @param profile            Perfil del usuario
 * @param answeredToday      Si ya respondió la pregunta hoy
 * @param lastQuestionId     ID de la última pregunta mostrada (si respondió)
 * @param recentQuestionIds  IDs de preguntas respondidas los últimos 7 días
 * @returns                  La pregunta seleccionada para este momento
 */
export function getContextualDailyQuestion(
  profile: UserProfile,
  answeredToday: boolean,
  lastQuestionId: string | null = null,
  recentQuestionIds: string[] = [],
): DailyQuestion {
  // Si ya respondió hoy, devolver la misma pregunta que respondió
  if (answeredToday && lastQuestionId) {
    const answeredQ = DAILY_QUESTIONS_BANK.find(q => q.id === lastQuestionId);
    if (answeredQ) return answeredQ;
  }

  const ctx = getTemporalContext();

  // Excluir preguntas respondidas recientemente para evitar repetición
  return selectQuestion(profile, ctx, recentQuestionIds);
}

/**
 * Convierte una DailyQuestion del banco a formato del dashboardStore.
 * Nuevo formato: basado en importe, no en sí/no.
 */
export function toDashboardQuestion(q: DailyQuestion): {
  questionId: string;
  text: string;
  suggestedAmount: number;
  monthlyDelta: number;
  yearlyDelta: number;
  labelImpact: string;
  tags: string[];
} {
  return {
    questionId: q.id,
    text: q.text,
    suggestedAmount: q.suggestedAmount,
    monthlyDelta: q.monthlyDelta,
    yearlyDelta: q.yearlyDelta,
    labelImpact: q.labelImpact,
    tags: [q.habitCategory, q.targetAvatarPrimary, q.targetSubavatarPrimary].filter(Boolean),
  };
}
