/**
 * Question Selection Engine — Motor contextual de selección de preguntas
 *
 * Combina tres variables para elegir la pregunta diaria más relevante:
 *   1. Perfil del usuario (avatar)
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
  ACTIVE_QUESTIONS_BANK,
  type DailyQuestion,
  type QuestionFormat,
  type BlankOption,
} from './dailyQuestionsBank';
import type { AvatarKey } from './profilingService';

/**
 * Devuelve el banco activo de preguntas.
 * Las preguntas Q_P_ (perfil/piloto) han sido eliminadas del banco.
 * Siempre se usa ACTIVE_QUESTIONS_BANK.
 */
function getActiveBank(): DailyQuestion[] {
  return ACTIVE_QUESTIONS_BANK;
}

// ── Franjas horarias ─────────────────────────────────────────────────────────
export type TimeWindow = 'Madrugada' | 'Mañana' | 'Tarde' | 'Noche';

export function getCurrentTimeWindow(): TimeWindow {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 6) return 'Madrugada';
  if (hour >= 6 && hour < 14) return 'Mañana';
  if (hour >= 14 && hour < 20) return 'Tarde';
  return 'Noche'; // 20-24
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
  /** Avatar principal del usuario (sin 'constructor') */
  avatar: AvatarKey | null;
  /** Distribución de scores entre avatares. NUNCA visible al usuario. */
  avatarScores: Record<AvatarKey, number> | null;
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
  return getActiveBank().map(q => {
    let score = 0;

    // ── 1. Perfil del usuario ──────────────────────────────────────────────────
    if (profile.avatar) {
      if (q.targetAvatarPrimary === profile.avatar) score += 40;
      if (q.targetAvatarSecondary === profile.avatar) score += 25;
    }

    // ── 2. Día de la semana ───────────────────────────────────────────────────
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
 * Selecciona un avatar target basándose en la distribución de scores.
 *
 * Reglas:
 *   - Si la diferencia entre top-1 y top-2 es < 10% → 50/50
 *   - Si la ratio top1/(top1+top2) está entre 0.55 y 0.65 → 70/30
 *   - Si la ratio top1/(top1+top2) es > 0.65 → 100% top-1
 *
 * Este mecanismo es completamente interno y nunca se muestra al usuario.
 */
function selectTargetAvatar(
  scores: Record<AvatarKey, number>,
  seed: string,
): AvatarKey {
  const entries = (Object.entries(scores) as [AvatarKey, number][])
    .sort((a, b) => b[1] - a[1]);

  const top1 = entries[0];
  const top2 = entries[1];

  // Si solo hay un avatar con score > 0, usar ese
  if (!top2 || top2[1] === 0) return top1[0];

  const sum = top1[1] + top2[1];
  if (sum === 0) return top1[0];

  const ratio = top1[1] / sum; // 0.5 = empate perfecto, 1.0 = dominancia total

  // Calcular probabilidad de elegir top-1
  let probTop1: number;
  if (ratio < 0.55) {
    // Empate → 50/50
    probTop1 = 0.50;
  } else if (ratio <= 0.65) {
    // Dominancia moderada → 70/30
    probTop1 = 0.70;
  } else {
    // Dominancia clara → 100% top-1
    return top1[0];
  }

  // Usar hash determinístico para decidir (mismo seed = mismo resultado)
  const roll = (hashSeed(seed + ':avatar') % 100) / 100;
  return roll < probTop1 ? top1[0] : top2[0];
}

export function selectQuestion(
  profile: UserProfile,
  ctx: TemporalContext,
  excludeIds: string[] = [],
): DailyQuestion {
  // ── Determinar el avatar target para esta sesión ──────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const seed = `${today}:${ctx.timeWindow}:${profile.avatar ?? 'none'}`;

  let targetAvatar: AvatarKey | null = profile.avatar;

  // Si tenemos scores detallados, usar selección probabilística
  if (profile.avatarScores) {
    targetAvatar = selectTargetAvatar(profile.avatarScores, seed);
  }

  // ── Pre-filtrar el pool según el avatar target ────────────────────────────
  let pool = getActiveBank();

  if (targetAvatar) {
    const avatarPool = getActiveBank().filter(
      q => q.targetAvatarPrimary === targetAvatar
    );
    if (avatarPool.length >= 3) pool = avatarPool;
  }

  const scored = pool.map(q => {
    let score = 0;

    // ── 1. Perfil del usuario ──────────────────────────────────────────────────
    if (profile.avatar) {
      if (q.targetAvatarPrimary === profile.avatar) {
        score += 40;
      }
      if (q.targetAvatarSecondary === profile.avatar) {
        score += 25;
      }
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
  const idx = hashSeed(seed) % topN.length;

  return topN[idx].question;
}

/**
 * Selecciona una pregunta alternativa distinta a la actual.
 * Usa el mismo pool filtrado por avatar/franja pero excluye la pregunta actual
 * y elige aleatoriamente entre las top 8 candidatas.
 */
export function selectAlternativeQuestion(
  profile: UserProfile,
  ctx: TemporalContext,
  currentQuestionId: string,
  excludeIds: string[] = [],
): DailyQuestion | null {
  const today = new Date().toISOString().split('T')[0];
  const seed = `${today}:${ctx.timeWindow}:${profile.avatar ?? 'none'}`;

  let targetAvatar: AvatarKey | null = profile.avatar;
  if (profile.avatarScores) {
    targetAvatar = selectTargetAvatar(profile.avatarScores, seed);
  }

  let pool = getActiveBank();
  if (targetAvatar) {
    const avatarPool = getActiveBank().filter(
      q => q.targetAvatarPrimary === targetAvatar
    );
    if (avatarPool.length >= 3) pool = avatarPool;
  }

  // Excluir la pregunta actual y las recientes
  const allExcluded = [...excludeIds, currentQuestionId];

  const scored = pool.map(q => {
    let score = 0;
    if (profile.avatar) {
      if (q.targetAvatarPrimary === profile.avatar) score += 40;
      if (q.targetAvatarSecondary === profile.avatar) score += 25;
    }
    // Constructor eliminado: sin bonus por racha
    if (matchesBestDays(q.bestDays, ctx)) score += 20;
    if (matchesTimeWindow(q.bestTimeWindow, ctx.timeWindow)) score += 15;
    if (matchesMonthPhase(q.monthPhase, ctx.monthPhase)) score += 10;
    score += q.priorityBase;
    score += q.scenarioWeight * 2;
    return { question: q, score };
  }).filter(sq => !allExcluded.includes(sq.question.id));

  if (scored.length === 0) return null;

  scored.sort((a, b) => b.score - a.score);

  // Tomar top 8 para más variedad al cambiar
  const topN = scored.slice(0, Math.min(8, scored.length));

  // Aleatorio real (no determinístico) para que cada cambio sea distinto
  const idx = Math.floor(Math.random() * topN.length);
  return topN[idx].question;
}

// ── API pública: pregunta contextual del día ─────────────────────────────────

/**
 * Obtiene la pregunta diaria contextual para el usuario.
 *
 * Lógica:
 *   1. Si ya respondió hoy → no se cambia, se devuelve la que respondió
 *   2. Si NO respondió → se selecciona la más relevante para:
 *      - Su perfil (avatar)
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
    const answeredQ = getActiveBank().find(q => q.id === lastQuestionId);
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
  format: QuestionFormat;
  blankOptions?: BlankOption[];
  tags: string[];
  allowOther?: boolean;
  otherRequiresAI?: boolean;
  aiConfidenceThreshold?: number;
} {
  return {
    questionId: q.id,
    text: q.text,
    format: q.format,
    blankOptions: q.blankOptions,
    tags: [q.habitCategory, q.targetAvatarPrimary].filter(Boolean),
    allowOther: q.allowOther,
    otherRequiresAI: q.otherRequiresAI,
    aiConfidenceThreshold: q.aiConfidenceThreshold,
  };
}
