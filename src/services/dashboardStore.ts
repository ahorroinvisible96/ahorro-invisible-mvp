import type {
  IncomeRange,
  Goal,
  DailyDecision,
  DailyDecisionRule,
  DashboardSummary,
  SavingsEvolutionPoint,
  Hucha,
  SavingsProfile,
  AdaptiveEvaluation,
} from '@/types/Dashboard';
import {
  getContextualDailyQuestion,
  selectAlternativeQuestion,
  toDashboardQuestion,
  getCurrentTimeWindow,
  getTemporalContext,
} from './questionSelectionEngine';
import type { AvatarKey } from './dailyQuestionsBank';
import { getQuestionById } from './dailyQuestionsBank';
import { STORAGE_KEY } from '@/lib/constants';
import { localDateStr, localDateDaysAgo, localMonthStr, addDaysStr } from '@/lib/dates';
import { enqueue, pendingCount, type Surface } from './v2/outbox';
import { v2ReadsOn, v1RuntimeOn } from './v2/flags';
import { deleteDecisionFromSupabase } from './syncService';

// STORAGE_KEY importado desde @/lib/constants
// Data Model V2 (5B): mientras V2_READS esté apagado este store es la fuente de lectura (V1);
// con V2_READS encendido es SOLO una caché de get_dashboard_state() + estado optimista de la
// outbox. Toda mutación de negocio encola su comando V2 (outbox durable) además de su efecto local.

// ─── Helper: distinguir decisión diaria de ahorro extra / grace day ─────────
const isDaily = (d: DailyDecision) =>
  d.questionId !== 'extra_saving' && d.questionId !== 'grace_day';
// Días que cuentan para la racha: decisiones diarias + días de gracia (misma regla que V2).
const countsForStreak = (d: DailyDecision) => d.questionId !== 'extra_saving';

// Ids V1 únicos aunque haya dos acciones en el mismo milisegundo (doble click).
let lastIdMs = 0;
function nextIdMs(): number {
  let t = Date.now();
  if (t <= lastIdMs) t = lastIdMs + 1;
  lastIdMs = t;
  return t;
}

// Antirrebote de acciones idénticas (doble click / doble envío) en < 1,5 s.
const recentActions = new Map<string, number>();
function isDuplicateAction(key: string): boolean {
  const now = Date.now();
  const prev = recentActions.get(key);
  recentActions.set(key, now);
  return prev !== undefined && now - prev < 1500;
}

const ALLOWED_HORIZONS = [1, 2, 3, 6, 12];
/** Horizonte V2 permitido más cercano (empate → el menor). */
export function normalizeHorizon(h: number): number {
  const n = Number.isFinite(h) && h > 0 ? h : 3;
  return ALLOWED_HORIZONS.reduce((best, x) => (Math.abs(x - n) < Math.abs(best - n) ? x : best), ALLOWED_HORIZONS[0]);
}
const money = (n: number) => Math.round(n * 100) / 100;
const clampTarget = (n: number) => Math.min(100000, Math.max(0.01, money(n)));

/** option_key del catálogo qb_v1 = slug del texto de la opción. */
export function slugifyOption(label: string): string {
  return label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Tramo V2 (income_ref_v1) a partir del rango V1 {min,max}. */
export function incomeBandFromRange(r: IncomeRange): string {
  const m = Number(r.min) || 0;
  if (m < 1000) return 'lt_1000';
  if (m < 1500) return '1000_1500';
  if (m < 2000) return '1500_2000';
  if (m < 2500) return '2000_2500';
  if (m < 3000) return '2500_3000';
  return 'gt_3000';
}
const BAND_RANGES: Record<string, IncomeRange> = {
  lt_1000: { min: 0, max: 1000, currency: 'EUR' },
  '1000_1500': { min: 1000, max: 1500, currency: 'EUR' },
  '1500_2000': { min: 1500, max: 2000, currency: 'EUR' },
  '2000_2500': { min: 2000, max: 2500, currency: 'EUR' },
  '2500_3000': { min: 2500, max: 3000, currency: 'EUR' },
  gt_3000: { min: 3000, max: 10000, currency: 'EUR' },
};

// ─── Motor económico ─────────────────────────────────────────────────────────
export const DAILY_DECISION_RULES: DailyDecisionRule[] = [
  // ─ Originales ────────────────────────────────────────────────────────────
  { category: 'consumo',      questionId: 'coffee',          answerKey: 'no',        immediateDelta: 3,  monthlyProjection: 60,  yearlyProjection: 720,  impactType: 'avoided' },
  { category: 'consumo',      questionId: 'coffee',          answerKey: 'yes',       immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  { category: 'food',         questionId: 'delivery',        answerKey: 'no',        immediateDelta: 8,  monthlyProjection: 120, yearlyProjection: 1440, impactType: 'avoided' },
  { category: 'food',         questionId: 'delivery',        answerKey: 'yes',       immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  { category: 'transport',    questionId: 'transport',       answerKey: 'public',    immediateDelta: 5,  monthlyProjection: 80,  yearlyProjection: 960,  impactType: 'optimization' },
  { category: 'transport',    questionId: 'transport',       answerKey: 'car',       immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  { category: 'consumo',      questionId: 'impulse',         answerKey: 'avoided',   immediateDelta: 15, monthlyProjection: 150, yearlyProjection: 1800, impactType: 'avoided' },
  { category: 'consumo',      questionId: 'impulse',         answerKey: 'bought',    immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  { category: 'subscription', questionId: 'subscription',    answerKey: 'cancelled', immediateDelta: 10, monthlyProjection: 10,  yearlyProjection: 120,  impactType: 'optimization', allowCustomAmount: true },
  { category: 'subscription', questionId: 'subscription',    answerKey: 'kept',      immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  // ─ Hogar ─────────────────────────────────────────────────────────────────
  { category: 'hogar',        questionId: 'hogar_energy',    answerKey: 'yes',       immediateDelta: 2,  monthlyProjection: 40,  yearlyProjection: 480,  impactType: 'avoided' },
  { category: 'hogar',        questionId: 'hogar_energy',    answerKey: 'no',        immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  { category: 'hogar',        questionId: 'hogar_water',     answerKey: 'yes',       immediateDelta: 3,  monthlyProjection: 50,  yearlyProjection: 600,  impactType: 'avoided' },
  { category: 'hogar',        questionId: 'hogar_water',     answerKey: 'no',        immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  { category: 'hogar',        questionId: 'hogar_meal_plan', answerKey: 'yes',       immediateDelta: 15, monthlyProjection: 60,  yearlyProjection: 720,  impactType: 'optimization' },
  { category: 'hogar',        questionId: 'hogar_meal_plan', answerKey: 'no',        immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  { category: 'hogar',        questionId: 'hogar_heating',   answerKey: 'yes',       immediateDelta: 5,  monthlyProjection: 30,  yearlyProjection: 360,  impactType: 'optimization' },
  { category: 'hogar',        questionId: 'hogar_heating',   answerKey: 'no',        immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  // ─ Salud ──────────────────────────────────────────────────────────────────
  { category: 'salud',        questionId: 'salud_lunch',     answerKey: 'yes',       immediateDelta: 8,  monthlyProjection: 160, yearlyProjection: 1920, impactType: 'avoided' },
  { category: 'salud',        questionId: 'salud_lunch',     answerKey: 'no',        immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  { category: 'salud',        questionId: 'salud_exercise',  answerKey: 'free',      immediateDelta: 7,  monthlyProjection: 30,  yearlyProjection: 360,  impactType: 'avoided' },
  { category: 'salud',        questionId: 'salud_exercise',  answerKey: 'gym',       immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  { category: 'salud',        questionId: 'salud_generic',   answerKey: 'generic',   immediateDelta: 8,  monthlyProjection: 24,  yearlyProjection: 288,  impactType: 'avoided' },
  { category: 'salud',        questionId: 'salud_generic',   answerKey: 'brand',     immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  // ─ Ocio ───────────────────────────────────────────────────────────────────
  { category: 'ocio',         questionId: 'ocio_streaming',  answerKey: 'home',      immediateDelta: 10, monthlyProjection: 40,  yearlyProjection: 480,  impactType: 'avoided' },
  { category: 'ocio',         questionId: 'ocio_streaming',  answerKey: 'out',       immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  { category: 'ocio',         questionId: 'ocio_bar',        answerKey: 'home',      immediateDelta: 7,  monthlyProjection: 112, yearlyProjection: 1344, impactType: 'avoided' },
  { category: 'ocio',         questionId: 'ocio_bar',        answerKey: 'bar',       immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  { category: 'ocio',         questionId: 'ocio_library',    answerKey: 'free',      immediateDelta: 12, monthlyProjection: 24,  yearlyProjection: 288,  impactType: 'avoided' },
  { category: 'ocio',         questionId: 'ocio_library',    answerKey: 'bought',    immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  // ─ Tecnología ─────────────────────────────────────────────────────────────
  { category: 'tech',         questionId: 'tech_apps',       answerKey: 'avoided',   immediateDelta: 5,  monthlyProjection: 15,  yearlyProjection: 180,  impactType: 'avoided' },
  { category: 'tech',         questionId: 'tech_apps',       answerKey: 'bought',    immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  { category: 'tech',         questionId: 'tech_gadget',     answerKey: 'resisted',  immediateDelta: 20, monthlyProjection: 40,  yearlyProjection: 480,  impactType: 'avoided' },
  { category: 'tech',         questionId: 'tech_gadget',     answerKey: 'bought',    immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  // ─ Transporte alternativo ─────────────────────────────────────────────────
  { category: 'transport',    questionId: 'transport_alt',   answerKey: 'alt',       immediateDelta: 6,  monthlyProjection: 96,  yearlyProjection: 1152, impactType: 'optimization' },
  { category: 'transport',    questionId: 'transport_alt',   answerKey: 'car',       immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  { category: 'transport',    questionId: 'transport_share', answerKey: 'shared',    immediateDelta: 8,  monthlyProjection: 64,  yearlyProjection: 768,  impactType: 'optimization' },
  { category: 'transport',    questionId: 'transport_share', answerKey: 'alone',     immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  // ─ Impulso online ─────────────────────────────────────────────────────────
  { category: 'consumo',      questionId: 'impulse_online',  answerKey: 'closed',    immediateDelta: 20, monthlyProjection: 80,  yearlyProjection: 960,  impactType: 'avoided' },
  { category: 'consumo',      questionId: 'impulse_online',  answerKey: 'bought',    immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
];

// ─── Pregunta del día (tipo simplificado para el dashboard) ──────────────────
export type DailyQuestion = {
  questionId: string;
  text: string;
  options: string[];
  avatar: AvatarKey;
  timeSlot: import('./questionSelectionEngine').TimeWindow;
  /** Importe estimado de ahorro (solo informativo) */
  suggestedAmount?: number;
};

// ─── Avatar de usuario (perfil de comportamiento) ─────────────────────────────
// NOTA: Usuarios con avatar 'desordenado' (legado) son tratados como 'impulsivo'
// en tiempo de ejecución. Ver migración 003_refactor_avatars.sql.
export type UserAvatar = 'comodo' | 'social' | 'impulsivo';

/** Mapea avatar legacy 'desordenado' al avatar actual más cercano */
function resolveAvatar(avatar: string | null | undefined): AvatarKey {
  if (avatar === 'desordenado') return 'impulsivo';
  if (avatar === 'comodo' || avatar === 'social' || avatar === 'impulsivo') return avatar;
  return 'comodo';
}

export const AVATAR_META: Record<UserAvatar, {
  label: string;
  emoji: string;
  color: string;
  tagline: string;
  description: string;
}> = {
  comodo: {
    label: 'Cómodo',
    emoji: '🛋️',
    color: '#f59e0b',
    tagline: 'Te gusta la facilidad, pero puedes optimizarla.',
    description: 'Tiendes a gastar en comodidad y rapidez. Tus preguntas diarias te ayudarán a encontrar alternativas igual de prácticas pero más económicas.',
  },
  social: {
    label: 'Social',
    emoji: '🧑‍🤝‍🧑',
    color: '#10b981',
    tagline: 'Disfrutas salir, pero puedes elegir mejor cómo.',
    description: 'Gastas más cuando hay planes y gente de por medio. Tus preguntas diarias te ayudarán a disfrutar sin excederte.',
  },
  impulsivo: {
    label: 'Impulsivo',
    emoji: '⚡',
    color: '#ef4444',
    tagline: 'Actúas rápido. Aprender a frenar te cambiará la vida.',
    description: 'Tomas decisiones de gasto en el momento, sin pensarlo demasiado. Tus preguntas diarias te darán ese segundo de pausa que lo cambia todo.',
  },
};

/**
 * Obtiene la pregunta del día usando el motor contextual de selección.
 *
 * Combina:
 *   1. Perfil del usuario (avatar)
 *   2. Día de la semana
 *   3. Franja horaria actual (Mañana / Tarde / Noche)
 *
 * Si el usuario NO ha respondido la pregunta diaria, la pregunta puede
 * cambiar al cambiar de franja horaria (p.ej. de mañana a tarde).
 *
 * Si YA respondió, devuelve la misma pregunta del legacy pool como fallback.
 */
export function getTodayQuestion(): DailyQuestion {
  // ── Leer perfil del usuario ───────────────────────────────────────────────
  let userAvatar: string | null = null;
  let answeredToday = false;
  let lastQuestionId: string | null = null;
  const recentQuestionIds: string[] = [];

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoreState;
        userAvatar = parsed.userAvatar ?? null;

        const today = localDateStr();
        const dailyDecisions = (parsed.decisions ?? []).filter(
          (d: DailyDecision) => d.questionId !== 'extra_saving' && d.questionId !== 'grace_day'
        );
        const todayDecision = dailyDecisions.find((d: DailyDecision) => d.date === today);
        answeredToday = !!todayDecision;
        lastQuestionId = todayDecision?.questionId ?? null;

        const cutoff7 = localDateDaysAgo(7);
        for (const d of dailyDecisions) {
          if (d.date >= cutoff7 && !recentQuestionIds.includes(d.questionId)) {
            recentQuestionIds.push(d.questionId);
          }
        }
      }
      if (!userAvatar) {
        const onbRaw = localStorage.getItem('onboardingData');
        if (onbRaw) {
          const onb = JSON.parse(onbRaw) as { userAvatar?: string };
          userAvatar = onb.userAvatar ?? null;
        }
      }
    } catch { /* fallthrough */ }
  }

  // ── Selección directa: avatar + franja horaria (sin scoring ni IA) ────────
  const resolvedAvatar = resolveAvatar(userAvatar);
  const bankQuestion = getContextualDailyQuestion(
    resolvedAvatar,
    answeredToday,
    lastQuestionId,
    recentQuestionIds,
  );
  return toDashboardQuestion(bankQuestion);
}

/**
 * Obtiene una pregunta alternativa distinta a la actual.
 * Mantiene el mismo avatar dominante y franja horaria,
 * pero devuelve una pregunta diferente para dar variedad.
 * Devuelve null si no hay alternativas disponibles.
 */
export function getAlternativeQuestion(currentQuestionId: string): DailyQuestion | null {
  let userAvatar: string | null = null;
  const recentQuestionIds: string[] = [];

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoreState;
        userAvatar = parsed.userAvatar ?? null;
        const cutoff7 = localDateDaysAgo(7);
        const dailyDecisions = (parsed.decisions ?? []).filter(
          (d: DailyDecision) => d.questionId !== 'extra_saving' && d.questionId !== 'grace_day'
        );
        for (const d of dailyDecisions) {
          if (d.date >= cutoff7 && !recentQuestionIds.includes(d.questionId)) {
            recentQuestionIds.push(d.questionId);
          }
        }
      }
      if (!userAvatar) {
        const onbRaw = localStorage.getItem('onboardingData');
        if (onbRaw) {
          const onb = JSON.parse(onbRaw) as { userAvatar?: string };
          userAvatar = onb.userAvatar ?? null;
        }
      }
    } catch { /* fallthrough */ }
  }

  const resolvedAvatar = resolveAvatar(userAvatar);
  const ctx = getTemporalContext();
  const alt = selectAlternativeQuestion(resolvedAvatar, ctx.timeWindow, currentQuestionId, recentQuestionIds);
  return alt ? toDashboardQuestion(alt) : null;
}

/**
 * Devuelve la franja horaria actual (para que el componente
 * pueda detectar cambios de franja y refrescar la pregunta).
 */
export { getCurrentTimeWindow } from './questionSelectionEngine';

// ─── Forma interna del store ────────────────────────────────────────────
type StoreState = {
  userName: string;
  userEmail: string;
  incomeRange: IncomeRange | null;
  moneyFeeling: string | null;
  userAvatar: UserAvatar | null;
  goals: Goal[];
  decisions: DailyDecision[];
  hucha: Hucha;
  seenMilestones: number[];
  graceUsedMonth: string | null;
  savingsProfile: SavingsProfile | null;
  savingsPercent: number;
  goalPercentMilestonesSeen: Record<string, number[]>;
  lastAdaptiveEvaluation: string | null;
  /** Dueño de la caché (uid). Si cambia de usuario se descarta la caché de negocio. */
  ownerUid?: string | null;
  /** Métricas calculadas por el servidor (get_dashboard_state) cuando V2 es la fuente de lectura. */
  v2?: { streak: number; streakBrokeYesterday: boolean; graceAvailable: boolean; totalSaved: number; fetchedAt: number } | null;
};

const SEED: StoreState = {
  userName: 'Usuario',
  userEmail: '',
  incomeRange: null,
  moneyFeeling: null,
  userAvatar: null,
  goals: [],
  decisions: [],
  hucha: { balance: 0, entries: [] },
  seenMilestones: [],
  graceUsedMonth: null,
  savingsProfile: null,
  savingsPercent: 6,
  goalPercentMilestonesSeen: {},
  lastAdaptiveEvaluation: null,
};

// ─── I/O localStorage ─────────────────────────────────────────────────────────
function loadStore(): StoreState {
  if (typeof window === 'undefined') return structuredClone(SEED);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoreState;
      // Migración: si el nombre aún es el seed por defecto, intentar leer del registro
      if (!parsed.userName || parsed.userName === 'Usuario') {
        const regName = localStorage.getItem('userName');
        if (regName) parsed.userName = regName;
      }
      // Migración: asegurar campo userEmail
      if (!parsed.userEmail) {
        parsed.userEmail = localStorage.getItem('userEmail') ?? '';
      }
      // Migración: asegurar campo hucha
      if (!parsed.hucha) parsed.hucha = { balance: 0, entries: [] };
      // Migración: asegurar campos de fase 2
      if (!parsed.seenMilestones) parsed.seenMilestones = [];
      if (parsed.graceUsedMonth === undefined) parsed.graceUsedMonth = null;
      // Migración: sistema adaptativo
      if (parsed.savingsProfile === undefined) parsed.savingsProfile = null;
      if (!parsed.savingsPercent) parsed.savingsPercent = 6;
      if (!parsed.goalPercentMilestonesSeen) parsed.goalPercentMilestonesSeen = {};
      if (parsed.lastAdaptiveEvaluation === undefined) parsed.lastAdaptiveEvaluation = null;
      // Migración: userAvatar
      if (parsed.userAvatar === undefined) parsed.userAvatar = null;
      return parsed;
    }
  } catch { /* fallthrough */ }
  // Primer arranque: leer datos del registro
  const state = structuredClone(SEED);
  state.userName = localStorage.getItem('userName') ?? 'Usuario';
  state.userEmail = localStorage.getItem('userEmail') ?? '';
  // Migración: leer moneyFeeling del onboardingData si existe
  try {
    const onbRaw = localStorage.getItem('onboardingData');
    if (onbRaw) {
      const onb = JSON.parse(onbRaw);
      if (onb.moneyFeeling) state.moneyFeeling = onb.moneyFeeling;
    }
  } catch { /* fallthrough */ }
  persistStore(state);
  return state;
}

function persistStore(state: StoreState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* fallthrough */ }
}

// ─── Lógica interna ───────────────────────────────────────────────────────────
function computeStreak(decisions: DailyDecision[]): number {
  const days = new Set(decisions.filter(countsForStreak).map((d) => d.date));
  if (!decisions.some(isDaily)) return 0;
  const today = localDateStr();
  let cursor = days.has(today) ? today : addDaysStr(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDaysStr(cursor, -1);
  }
  return streak;
}

function computeIntensity(decisions: DailyDecision[]): 'low' | 'medium' | 'high' | 'unknown' {
  const cutoff = localDateDaysAgo(7);
  const recent = decisions.filter((d) => d.date >= cutoff);
  if (recent.length === 0) return 'unknown';
  const total = recent.reduce((s, d) => s + d.deltaAmount, 0);
  if (total > 40) return 'high';
  if (total > 10) return 'medium';
  return 'low';
}

function buildEvolutionPoints(
  decisions: DailyDecision[],
  range: '7d' | '30d' | '90d',
): SavingsEvolutionPoint[] {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const cutoff = localDateDaysAgo(days);
  const filtered = decisions.filter((d) => d.date >= cutoff);
  if (filtered.length === 0) return [];

  const byDate: Record<string, number> = {};
  for (const d of filtered) {
    byDate[d.date] = (byDate[d.date] ?? 0) + d.deltaAmount;
  }
  const dates = Object.keys(byDate).sort();
  let cumulative = 0;
  return dates.map((date) => {
    cumulative += byDate[date];
    return { date, value: cumulative };
  });
}

// ─── Helpers: sistema adaptativo ─────────────────────────────────────────────
function checkGoalPercentMilestone(
  state: StoreState,
): { goalId: string; goalTitle: string; percent: 25 | 50 | 75 | 100 } | null {
  const PCTS: (25 | 50 | 75 | 100)[] = [25, 50, 75, 100];
  for (const goal of state.goals.filter((g) => !g.archived && g.targetAmount > 0)) {
    const progress = goal.currentAmount / goal.targetAmount;
    const seen = state.goalPercentMilestonesSeen?.[goal.id] ?? [];
    for (const milestone of PCTS) {
      if (progress >= milestone / 100 && !seen.includes(milestone)) {
        return { goalId: goal.id, goalTitle: goal.title, percent: milestone };
      }
    }
  }
  return null;
}

function checkAdaptiveEvaluation(
  state: StoreState,
  streak: number,
  intensity: 'low' | 'medium' | 'high' | 'unknown',
): AdaptiveEvaluation | null {
  if (!state.savingsProfile) return null;
  const daily = state.decisions.filter(isDaily);
  if (daily.length === 0) return null;
  const last = state.lastAdaptiveEvaluation;
  if (last) {
    const daysSince = Math.floor((Date.now() - new Date(last + 'T12:00:00').getTime()) / 86_400_000);
    if (daysSince < 14) return null;
  } else {
    const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0]?.date;
    if (!first) return null;
    const daysSinceFirst = Math.floor((Date.now() - new Date(first + 'T12:00:00').getTime()) / 86_400_000);
    if (daysSinceFirst < 14) return null;
  }
  const current = state.savingsPercent ?? 6;

  // Calcular % de completion del objetivo activo respecto al tiempo transcurrido
  const primaryGoal = state.goals.find((g) => !g.archived && g.isPrimary) ?? state.goals.find((g) => !g.archived);
  let completionScore: 'high' | 'medium' | 'low' = 'medium';
  if (primaryGoal && primaryGoal.startDate && primaryGoal.targetDate) {
    const start = new Date(primaryGoal.startDate + 'T12:00:00').getTime();
    const end = new Date(primaryGoal.targetDate + 'T12:00:00').getTime();
    const now = Date.now();
    const totalDuration = end - start;
    const elapsed = now - start;
    const timeProgress = totalDuration > 0 ? Math.min(elapsed / totalDuration, 1) : 0;
    const goalProgress = primaryGoal.targetAmount > 0 ? primaryGoal.currentAmount / primaryGoal.targetAmount : 0;
    // Compare actual % achieved vs expected % for this time
    const relativeProgress = timeProgress > 0 ? goalProgress / timeProgress : goalProgress;
    if (relativeProgress >= 0.8) completionScore = 'high';
    else if (relativeProgress >= 0.4) completionScore = 'medium';
    else completionScore = 'low';
  } else {
    // Fallback: usar intensity + streak
    if (streak >= 7 && (intensity === 'high' || intensity === 'medium')) completionScore = 'high';
    else if (streak <= 2 && intensity === 'low') completionScore = 'low';
  }

  if (completionScore === 'high') {
    const next = Math.min(20, current + 2);
    if (next <= current) return null;
    return { type: 'increase', newPercent: next, message: 'Lo estás haciendo genial. Aumentemos un poco el ritmo para llegar antes a tu meta.' };
  }
  if (completionScore === 'low') {
    const next = Math.max(1, current - 1);
    if (next >= current) return null;
    return { type: 'decrease', newPercent: next, message: 'Ajustemos tu objetivo para que sea más fácil mantener la constancia.' };
  }
  return null;
}

// ─── API pública: lectura ─────────────────────────────────────────────────────
/** Con V2 como fuente de lectura y sin acciones pendientes, las métricas vienen del servidor. */
function serverMetrics(state: StoreState): StoreState['v2'] {
  if (!state.v2 || !v2ReadsOn() || pendingCount() > 0) return null;
  return state.v2;
}

export function buildSummary(range: '7d' | '30d' | '90d' = '30d'): DashboardSummary {
  const state = loadStore();
  const today = localDateStr();
  const activeGoals = state.goals.filter((g) => !g.archived);
  const primaryGoal =
    activeGoals.find((g) => g.isPrimary) ?? activeGoals[0] ?? null;

  const todayDecision = state.decisions.find((d) => d.date === today && isDaily(d)) ?? null;
  const evolutionPoints = buildEvolutionPoints(state.decisions, range);

  // Velocidad media de ahorro (últimos 30 días)
  const cutoff30 = localDateDaysAgo(30);
  const recent30 = state.decisions.filter((d) => d.date >= cutoff30);
  const avgMonthlySavings = recent30.reduce((s, d) => s + d.deltaAmount, 0);

  // Tiempo estimado restante para el objetivo principal
  let estimatedMonthsRemaining: number | null = null;
  if (primaryGoal && !primaryGoal.archived && primaryGoal.currentAmount < primaryGoal.targetAmount) {
    const remaining = primaryGoal.targetAmount - primaryGoal.currentAmount;
    if (avgMonthlySavings > 0) {
      estimatedMonthsRemaining = Math.ceil(remaining / avgMonthlySavings);
    } else {
      estimatedMonthsRemaining = primaryGoal.horizonMonths;
    }
  }

  const srv = serverMetrics(state);
  const totalSaved = srv ? srv.totalSaved : state.decisions.reduce((s, d) => s + d.deltaAmount, 0);
  const streak = srv ? srv.streak : computeStreak(state.decisions);
  const intensity = computeIntensity(state.decisions);

  // Adaptive helpers
  const goalPercentMilestone = checkGoalPercentMilestone(state);
  const adaptiveEvaluation = checkAdaptiveEvaluation(state, streak, intensity);
  const last3 = [0, 1, 2].map((i) => localDateDaysAgo(i));
  const dailyDecisions = state.decisions.filter(isDaily);
  const lowActivityAlert =
    dailyDecisions.length > 0 &&
    activeGoals.length > 0 &&
    !last3.some((date) => dailyDecisions.some((d) => d.date === date));

  // ─ Milestones ──────────────────────────────────────────────────────────────
  const MILESTONES = [50, 100, 500, 1000, 2000, 5000];
  const newMilestone = MILESTONES.find(m => totalSaved >= m && !state.seenMilestones.includes(m)) ?? null;

  // ─ Streak recovery ─────────────────────────────────────────────────────────
  const yesterday = localDateDaysAgo(1);
  const hadYesterdayDecision = state.decisions.some(d => d.date === yesterday && countsForStreak(d));
  const streakBrokeYesterday = srv
    ? srv.streakBrokeYesterday
    : streak === 0 && !hadYesterdayDecision && state.decisions.filter(isDaily).length > 0;
  const currentMonth = localMonthStr();
  const graceAvailable = srv ? srv.graceAvailable : (state.graceUsedMonth ?? '') !== currentMonth;

  return {
    userName: state.userName,
    userEmail: state.userEmail,
    moneyFeeling: state.moneyFeeling,
    systemActive: true,
    incomeRange: state.incomeRange,
    goals: state.goals,
    primaryGoal,
    daily: {
      date: today,
      status: todayDecision ? 'completed' : 'pending',
      decisionId: todayDecision?.id ?? null,
    },
    savingsEvolution: {
      range,
      mode: evolutionPoints.length > 0 ? 'live' : 'demo',
      points: evolutionPoints,
    },
    intensity,
    avgMonthlySavings,
    estimatedMonthsRemaining,
    streak,
    totalSaved,
    hucha: state.hucha ?? { balance: 0, entries: [] },
    newMilestone,
    streakBrokeYesterday,
    graceAvailable,
    savingsProfile: state.savingsProfile ?? null,
    savingsPercent: state.savingsPercent ?? 6,
    goalPercentMilestone,
    adaptiveEvaluation,
    lowActivityAlert,
  };
}

// ─── Helpers internos de mutación ─────────────────────────────────────────────
const activeGoal = (state: StoreState, id: string | null | undefined) =>
  id ? state.goals.find((g) => g.id === id && !g.archived) ?? null : null;

function addMonthsStr(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1 + months, d, 12, 0, 0);
  return localDateStr(dt);
}

// ─── API pública: mutaciones ──────────────────────────────────────────────────
export function storeUpdateIncome(
  incomeRange: IncomeRange,
  currentRange: '7d' | '30d' | '90d' = '30d',
  opts?: { source?: 'profile' | 'dashboard_widget'; skipV2?: boolean },
): DashboardSummary {
  const state = loadStore();
  state.incomeRange = incomeRange;
  persistStore(state);
  if (!opts?.skipV2) {
    enqueue('income.declare', { band: incomeBandFromRange(incomeRange), source: opts?.source ?? 'profile' });
  }
  return buildSummary(currentRange);
}

export function storeCreateGoal(
  data: Pick<Goal, 'title' | 'targetAmount' | 'currentAmount' | 'horizonMonths'> & {
    isPrimary?: boolean;
    source?: 'onboarding' | 'dashboard';
    finalGoalAmount?: number;
    isUnrealistic?: boolean;
    startDate?: string;
    targetDate?: string;
    subGoalIndex?: number;
  },
  currentRange: '7d' | '30d' | '90d' = '30d',
  opts?: { surface?: Surface; skipV2?: boolean; id?: string },
): DashboardSummary {
  const title = (data.title ?? '').trim().slice(0, 80) || 'Mi objetivo';
  const target = clampTarget(Number(data.targetAmount) || 0);
  const horizon = normalizeHorizon(Number(data.horizonMonths));
  if (!(target > 0) || isDuplicateAction(`goal:${title}:${target}:${horizon}`)) return buildSummary(currentRange);

  const state = loadStore();
  const now = new Date().toISOString();
  const today = localDateStr();
  const activeGoals = state.goals.filter((g) => !g.archived);
  const shouldBePrimary = data.isPrimary === true || activeGoals.length === 0;
  if (shouldBePrimary) {
    state.goals = state.goals.map((g) => (g.isPrimary ? { ...g, isPrimary: false, updatedAt: now } : g));
  }
  const id = opts?.id ?? `goal_${nextIdMs()}`;
  const startDate = data.startDate ?? today;
  const finalGoal = data.finalGoalAmount != null && data.finalGoalAmount >= target ? clampTarget(data.finalGoalAmount) : undefined;
  state.goals.push({
    id,
    title,
    targetAmount: target,
    finalGoalAmount: finalGoal,
    currentAmount: 0,
    horizonMonths: horizon,
    isPrimary: shouldBePrimary,
    archived: false,
    createdAt: now,
    updatedAt: now,
    source: data.source ?? 'dashboard',
    completedAt: null,
    startDate,
    targetDate: data.targetDate ?? addMonthsStr(startDate, horizon),
    isUnrealistic: data.isUnrealistic ?? false,
    subGoalIndex: data.subGoalIndex ?? 0,
  });
  persistStore(state);

  // El onboarding registra su objetivo dentro de complete_onboarding (comando onboarding.complete).
  if (!opts?.skipV2 && data.source !== 'onboarding') {
    enqueue('goal.create', {
      goal: id, title, target, horizon,
      source: opts?.surface === 'dashboard_widget' ? 'dashboard' : 'goals_page',
      setPrimary: data.isPrimary === true, final: finalGoal ?? null,
      step: data.subGoalIndex ?? null, realismUnrealistic: data.isUnrealistic ?? null,
      surface: opts?.surface ?? 'goals_page',
    });
  }
  // Saldo inicial: en V2 no existen saldos editables → se registra como ahorro extra explícito.
  const initAmount = money(Number(data.currentAmount) || 0);
  if (initAmount > 0) {
    storeAddExtraSaving('Saldo inicial', initAmount, id, currentRange, { surface: opts?.surface ?? 'goals_page', force: true });
  }
  return buildSummary(currentRange);
}

/** Archivar sin elegir destino: el saldo va a la hucha (mismo comportamiento que V2). */
export function storeArchiveGoal(
  goalId: string,
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  return storeArchiveGoalSafe(goalId, 'hucha', currentRange);
}

export function storeSetPrimaryGoal(
  goalId: string,
  currentRange: '7d' | '30d' | '90d' = '30d',
  opts?: { surface?: Surface },
): DashboardSummary {
  const state = loadStore();
  const goal = activeGoal(state, goalId);
  if (!goal || goal.isPrimary) return buildSummary(currentRange);
  const now = new Date().toISOString();
  state.goals = state.goals.map((g) => ({
    ...g,
    isPrimary: g.id === goalId,
    updatedAt: g.id === goalId || g.isPrimary ? now : g.updatedAt,
  }));
  persistStore(state);
  enqueue('goal.setPrimary', { goal: goalId, surface: opts?.surface ?? 'goals_page' });
  return buildSummary(currentRange);
}

export function storeUpdateGoal(
  goalId: string,
  patch: Partial<Pick<Goal, 'title' | 'targetAmount' | 'currentAmount' | 'horizonMonths' | 'isPrimary'>>,
  currentRange: '7d' | '30d' | '90d' = '30d',
  opts?: { surface?: Surface },
): DashboardSummary {
  const state = loadStore();
  const now = new Date().toISOString();
  const goal = activeGoal(state, goalId);
  if (!goal) return buildSummary(currentRange);

  // Los saldos no son editables (V2: el saldo solo cambia por asientos del ledger).
  const v2Patch: { title?: string; target?: number; horizon?: number } = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim().slice(0, 80);
    if (t && t !== goal.title) { goal.title = t; v2Patch.title = t; }
  }
  if (patch.targetAmount !== undefined) {
    const t = clampTarget(Number(patch.targetAmount) || 0);
    if (t > 0 && t !== goal.targetAmount) { goal.targetAmount = t; v2Patch.target = t; }
  }
  if (patch.horizonMonths !== undefined && Number(patch.horizonMonths) !== goal.horizonMonths) {
    const h = normalizeHorizon(Number(patch.horizonMonths));
    if (h !== goal.horizonMonths) { goal.horizonMonths = h; v2Patch.horizon = h; }
  }
  if (goal.finalGoalAmount != null && goal.finalGoalAmount < goal.targetAmount) goal.finalGoalAmount = undefined;
  goal.updatedAt = now;
  persistStore(state);
  if (Object.keys(v2Patch).length > 0) {
    enqueue('goal.update', { goal: goalId, ...v2Patch, surface: opts?.surface ?? 'goals_page' });
  }
  if (patch.isPrimary === true && !goal.isPrimary) {
    return storeSetPrimaryGoal(goalId, currentRange, opts);
  }
  return buildSummary(currentRange);
}

export function storeUpdateUserName(
  userName: string,
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  state.userName = userName.trim() || state.userName;
  // Mantener sincronizado el localStorage legacy
  if (typeof window !== 'undefined') {
    localStorage.setItem('userName', state.userName);
  }
  persistStore(state);
  return buildSummary(currentRange);
}

export function storeInitUser(
  userName: string,
  userEmail: string,
): void {
  if (typeof window === 'undefined') return;
  const state = loadStore();
  if (userName.trim()) state.userName = userName.trim();
  if (userEmail.trim()) state.userEmail = userEmail.trim();
  persistStore(state);
}

export function storeUpdateMoneyFeeling(
  moneyFeeling: string,
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  state.moneyFeeling = moneyFeeling;
  persistStore(state);
  return buildSummary(currentRange);
}

export function storeSetUserAvatar(
  avatar: UserAvatar,
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  state.userAvatar = avatar;
  persistStore(state);
  return buildSummary(currentRange);
}

const entityOf = (d: DailyDecision): 'daily' | 'extra' | 'grace' =>
  d.questionId === 'extra_saving' ? 'extra' : d.questionId === 'grace_day' ? 'grace' : 'daily';

/** Un ahorro solo puede revertirse si su objetivo sigue activo y conserva saldo suficiente (V2 nunca deja saldos negativos). */
function canReverseFrom(goal: Goal | undefined, amount: number): boolean {
  return !!goal && !goal.archived && goal.currentAmount + 1e-9 >= amount;
}

/** Réplica V1 (solo mientras V1 siga en el runtime): borra la fila legacy para que no reaparezca. */
function replicateV1Delete(decisionId: string) {
  if (v1RuntimeOn()) deleteDecisionFromSupabase(decisionId).catch(() => null);
}

export function storeDeleteDecision(
  decisionId: string,
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  const now = new Date().toISOString();
  const dec = state.decisions.find((d) => d.id === decisionId);
  if (dec) {
    const goal = state.goals.find((g) => g.id === dec.goalId);
    // V2: no se modifica el saldo de un objetivo archivado (goal_not_active) ni se deja en negativo
    // (insufficient_balance: el dinero ya se movió a otro bucket) → misma regla aquí.
    if (dec.deltaAmount > 0 && !canReverseFrom(goal, dec.deltaAmount)) return buildSummary(currentRange);
    if (goal) {
      goal.currentAmount = money(Math.max(0, goal.currentAmount - dec.deltaAmount));
      goal.updatedAt = now;
    }
    state.decisions = state.decisions.filter((d) => d.id !== decisionId);
    persistStore(state);
    enqueue('daily.void', { entity: entityOf(dec), id: dec.id, reason: 'user_deleted_in_history', surface: 'history' });
    replicateV1Delete(dec.id);
  }
  return buildSummary(currentRange);
}

/** Devuelve false si la edición no está permitida (V2: decisión sin ahorro, objetivo archivado o histórico no acreditado). */
export function storeCanEditDecision(decisionId: string): boolean {
  const state = loadStore();
  const dec = state.decisions.find((d) => d.id === decisionId);
  if (!dec || entityOf(dec) === 'grace') return false;
  if (dec.v2Credited === false) return false;
  if (entityOf(dec) === 'daily' && !(dec.deltaAmount > 0)) return false;
  const goal = state.goals.find((g) => g.id === dec.goalId);
  return !goal?.archived;
}

export function storeEditDecision(
  decisionId: string,
  newAmount: number,
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const amount = money(Number(newAmount));
  if (!(amount >= 0) || amount > 100000 || !storeCanEditDecision(decisionId)) return buildSummary(currentRange);
  const state = loadStore();
  const now = new Date().toISOString();
  const dec = state.decisions.find((d) => d.id === decisionId);
  if (dec && dec.deltaAmount !== amount) {
    const oldAmount = dec.deltaAmount;
    const diff = amount - oldAmount;
    dec.deltaAmount = amount;
    dec.updatedAt = now; // Necesario para merge correcto en pullAndMergeFromSupabase.
                         // Garantiza que localTs > 0 y esta edición no sea sobreescrita
                         // por la versión remota si el push falla temporalmente.
    const goal = state.goals.find((g) => g.id === dec.goalId);
    if (diff < 0 && !canReverseFrom(goal, -diff)) { dec.deltaAmount = oldAmount; return buildSummary(currentRange); }
    if (goal) {
      goal.currentAmount = money(Math.max(0, goal.currentAmount + diff));
      goal.updatedAt = now;
    }
    persistStore(state);
    enqueue('daily.amend', { entity: entityOf(dec) === 'extra' ? 'extra' : 'daily', id: dec.id, newAmount: amount, surface: 'history' });
  }
  return buildSummary(currentRange);
}

export function storeResetDecision(
  currentRange: '7d' | '30d' | '90d' = '30d',
  opts?: { surface?: Surface },
): DashboardSummary {
  const state = loadStore();
  const today = localDateStr();
  const now = new Date().toISOString();
  const todayDec = state.decisions.find((d) => d.date === today && isDaily(d));
  if (todayDec) {
    const goal = state.goals.find((g) => g.id === todayDec.goalId);
    if (todayDec.deltaAmount > 0 && !canReverseFrom(goal, todayDec.deltaAmount)) return buildSummary(currentRange);
    if (goal) {
      goal.currentAmount = money(Math.max(0, goal.currentAmount - todayDec.deltaAmount));
      goal.updatedAt = now;
    }
    state.decisions = state.decisions.filter((d) => !(d.date === today && isDaily(d)));
    persistStore(state);
    enqueue('daily.void', { entity: 'daily', id: todayDec.id, reason: 'user_reset_today', surface: opts?.surface ?? 'dashboard_widget' });
    replicateV1Delete(todayDec.id);
  }
  return buildSummary(currentRange);
}

export function storeAddExtraSaving(
  name: string,
  amount: number,
  goalId: string,
  currentRange: '7d' | '30d' | '90d' = '30d',
  opts?: { surface?: Surface; force?: boolean },
): DashboardSummary {
  const value = money(Number(amount));
  const state = loadStore();
  const goal = activeGoal(state, goalId);
  // V2: un ahorro extra siempre cae en un bucket real (objetivo activo).
  if (!goal || !(value > 0) || value > 100000) return buildSummary(currentRange);
  if (!opts?.force && isDuplicateAction(`extra:${goalId}:${value}:${name}`)) return buildSummary(currentRange);
  const today = localDateStr();
  const now = new Date().toISOString();
  const id = `extra_${nextIdMs()}`;
  const note = (name ?? '').trim().slice(0, 200) || 'Ahorro extra';
  state.decisions.push({
    id,
    date: today,
    questionId: 'extra_saving',
    answerKey: note,
    goalId,
    deltaAmount: value,
    monthlyProjection: 0,
    yearlyProjection: 0,
    createdAt: now,
  });
  goal.currentAmount = money(goal.currentAmount + value);
  goal.updatedAt = now;
  if (!goal.completedAt && goal.currentAmount >= goal.targetAmount && goal.targetAmount > 0) {
    goal.completedAt = now;
  }
  persistStore(state);
  enqueue('extra.record', { txn: id, amount: value, goal: goalId, note, surface: opts?.surface ?? 'extra_saving_page' });
  return buildSummary(currentRange);
}

// ─── Archivar objetivo con seguridad de saldo ────────────────────────────────
// Devuelve el saldo que tenía el objetivo (para que la UI decida si mostrar modal)
export function storeGetGoalBalance(goalId: string): number {
  const state = loadStore();
  const goal = state.goals.find((g) => g.id === goalId);
  return goal?.currentAmount ?? 0;
}

// Archiva el objetivo y reasigna su saldo al destino indicado:
// - targetGoalId: reasigna a otro objetivo existente
// - 'hucha': envía a la hucha
export function storeArchiveGoalSafe(
  goalId: string,
  destination: string | 'hucha',
  currentRange: '7d' | '30d' | '90d' = '30d',
  opts?: { surface?: Surface },
): DashboardSummary {
  const state = loadStore();
  const now = new Date().toISOString();
  const today = localDateStr();
  const goal = activeGoal(state, goalId);
  if (!goal) return buildSummary(currentRange);
  const dest = destination !== 'hucha' && activeGoal(state, destination) && destination !== goalId ? destination : 'hucha';

  const balance = goal.currentAmount;

  // Reasignar saldo
  if (balance > 0) {
    if (dest === 'hucha') {
      if (!state.hucha) state.hucha = { balance: 0, entries: [], updatedAt: now };
      state.hucha.balance = money(state.hucha.balance + balance);
      state.hucha.entries.push({
        amount: balance,
        fromGoalId: goalId,
        fromGoalTitle: goal.title,
        date: today,
      });
      state.hucha.updatedAt = now; // P1: necesario para merge correcto por updated_at
    } else {
      const target = activeGoal(state, dest)!;
      target.currentAmount = money(target.currentAmount + balance);
      target.updatedAt = now;
    }
  }

  // Redirigir decisions del objetivo archivado al destino (solo histórico local V1)
  if (dest !== 'hucha') {
    state.decisions = state.decisions.map((d) =>
      d.goalId === goalId ? { ...d, goalId: dest } : d,
    );
  }

  // Archivar el objetivo
  const wasPrimary = goal.isPrimary;
  goal.isPrimary = false;
  goal.currentAmount = 0;
  goal.archived = true;
  goal.updatedAt = now;

  if (wasPrimary) {
    // Misma regla que V2 (reassign_primary): el activo más antiguo.
    const next = state.goals.filter((g) => !g.archived && g.id !== goalId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0];
    if (next) { next.isPrimary = true; next.updatedAt = now; }
  }

  persistStore(state);
  enqueue('goal.archive', { goal: goalId, dest, surface: opts?.surface ?? 'goals_page' });
  return buildSummary(currentRange);
}

// Transfiere saldo de la hucha a un objetivo (total o parcial)
export function storeTransferFromHucha(
  goalId: string,
  amount: number,
  currentRange: '7d' | '30d' | '90d' = '30d',
  opts?: { surface?: Surface },
): DashboardSummary {
  const state = loadStore();
  const now = new Date().toISOString();
  const goal = activeGoal(state, goalId);
  if (!goal || !state.hucha || state.hucha.balance <= 0) return buildSummary(currentRange);

  const transfer = money(Math.min(Number(amount) || 0, state.hucha.balance));
  if (!(transfer > 0)) return buildSummary(currentRange);
  state.hucha.balance = money(state.hucha.balance - transfer);
  state.hucha.updatedAt = now; // P2: solo cuando hay transferencia real > 0
  goal.currentAmount = money(goal.currentAmount + transfer);
  goal.updatedAt = now;

  persistStore(state);
  enqueue('hucha.transfer', { toGoal: goalId, amount: transfer, surface: opts?.surface ?? 'goals_page' });
  return buildSummary(currentRange);
}

// ─── Reactivar objetivo archivado ────────────────────────────────────────────
export function storeReactivateGoal(
  goalId: string,
  currentRange: '7d' | '30d' | '90d' = '30d',
  opts?: { surface?: Surface },
): DashboardSummary {
  const state = loadStore();
  const now = new Date().toISOString();
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal || !goal.archived) return buildSummary(currentRange);

  goal.archived = false;
  goal.updatedAt = now;

  // Si no hay ningún objetivo principal activo, este pasa a ser principal
  const hasActivePrimary = state.goals.some((g) => !g.archived && g.isPrimary);
  goal.isPrimary = !hasActivePrimary;

  persistStore(state);
  enqueue('goal.reactivate', { goal: goalId, surface: opts?.surface ?? 'goals_page' });
  return buildSummary(currentRange);
}

// ─── Eliminar objetivo definitivamente ───────────────────────────────────────
// Si el objetivo tiene saldo y no se indica destino, el saldo va a la hucha (nunca se pierde dinero).
export function storeDeleteGoalPermanent(
  goalId: string,
  destination: string | 'hucha' | null,
  currentRange: '7d' | '30d' | '90d' = '30d',
  opts?: { surface?: Surface },
): DashboardSummary {
  const state = loadStore();
  const now = new Date().toISOString();
  const today = localDateStr();
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return buildSummary(currentRange);

  const balance = goal.currentAmount;
  const dest = destination && destination !== 'hucha' && destination !== goalId && activeGoal(state, destination)
    ? destination : 'hucha';

  // Resolver saldo si existe
  if (balance > 0) {
    if (dest === 'hucha') {
      if (!state.hucha) state.hucha = { balance: 0, entries: [], updatedAt: now };
      state.hucha.balance = money(state.hucha.balance + balance);
      state.hucha.entries.push({
        amount: balance,
        fromGoalId: goalId,
        fromGoalTitle: goal.title,
        date: today,
      });
      state.hucha.updatedAt = now; // P3: necesario para merge correcto por updated_at
    } else {
      const target = activeGoal(state, dest)!;
      target.currentAmount = money(target.currentAmount + balance);
      target.updatedAt = now;
    }
  }

  // Histórico local V1: redirigir decisiones al destino; con hucha se conservan (sin objetivo).
  state.decisions = state.decisions.map((d) =>
    d.goalId === goalId ? { ...d, goalId: dest !== 'hucha' ? dest : '' } : d,
  );

  const wasPrimary = goal.isPrimary;
  // Eliminar el objetivo del array
  state.goals = state.goals.filter((g) => g.id !== goalId);
  if (wasPrimary) {
    const next = state.goals.filter((g) => !g.archived)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0];
    if (next) { next.isPrimary = true; next.updatedAt = now; }
  }

  persistStore(state);
  enqueue('goal.delete', { goal: goalId, dest, surface: opts?.surface ?? 'goals_page' });
  return buildSummary(currentRange);
}

// Claves de autenticación que se conservan tras el reset
const AUTH_KEYS_TO_PRESERVE = ['isAuthenticated', 'userEmail', 'userName', 'supabaseUserId', 'rememberMe', 'theme'];
// La outbox V2, los flags y el marcador de import se conservan: el reset debe llegar al servidor.
const isPreservedKey = (k: string) => AUTH_KEYS_TO_PRESERVE.includes(k) || k.startsWith('ai_v2_');

export function storeResetAllData(): void {
  if (typeof window === 'undefined') return;
  enqueue('account.reset', {});
  try {
    // 1. Snapshot de claves auth a conservar
    const preserved: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isPreservedKey(k)) { const v = localStorage.getItem(k); if (v !== null) preserved[k] = v; }
    }

    // 2. Borrar todas las claves de app (incluye widget_collapse_*, sync timestamps, onboarding, etc.)
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && !isPreservedKey(k)) keysToDelete.push(k);
    }
    keysToDelete.forEach((k) => localStorage.removeItem(k));

    // 3. Restaurar claves auth
    Object.entries(preserved).forEach(([k, v]) => localStorage.setItem(k, v));
  } catch { /* fallthrough */ }
}

export function storeExportData(): string {
  const state = loadStore();
  return JSON.stringify(state, null, 2);
}

export function storeGetDailyForDate(date: string): { status: 'pending' | 'completed'; decisionId: string | null } {
  const state = loadStore();
  const found = state.decisions.find((d) => d.date === date && isDaily(d)) ?? null;
  return {
    status: found ? 'completed' : 'pending',
    decisionId: found?.id ?? null,
  };
}

export function storeListActiveGoals(): Goal[] {
  const state = loadStore();
  return state.goals.filter((g) => !g.archived);
}

export function storeListArchivedGoals(): Goal[] {
  const state = loadStore();
  return state.goals.filter((g) => g.archived);
}

// D1 (Data Model V2): se ELIMINA el multiplicador por ingresos. Lo que el usuario declara
// es lo que se registra (credit_rule_version = identity_v1).

// ─── Día de gracia (streak recovery) ─────────────────────────────────────────
export function storeUseGraceDay(
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  const yesterday = localDateDaysAgo(1);
  const now = new Date().toISOString();
  const currentMonth = localMonthStr();
  if (state.decisions.some(d => d.date === yesterday && d.questionId !== 'extra_saving')) return buildSummary(currentRange);
  if (state.graceUsedMonth === currentMonth || state.decisions.some(d => d.questionId === 'grace_day' && d.date.slice(0, 7) === currentMonth)) {
    return buildSummary(currentRange);
  }
  const id = `grace_${nextIdMs()}`;
  state.decisions.push({
    id,
    date: yesterday,
    questionId: 'grace_day',
    answerKey: 'grace',
    goalId: '',
    deltaAmount: 0,
    monthlyProjection: 0,
    yearlyProjection: 0,
    createdAt: now,
  });
  state.graceUsedMonth = currentMonth;
  persistStore(state);
  enqueue('grace.use', { decision: id, surface: 'dashboard_widget' });
  return buildSummary(currentRange);
}

// ─── Marcar hito celebrado ───────────────────────────────────────────────────
export function storeMarkMilestoneSeen(milestone: number): void {
  const state = loadStore();
  if (!state.seenMilestones.includes(milestone)) {
    state.seenMilestones.push(milestone);
    persistStore(state);
  }
}

// ─── Sistema adaptativo: funciones públicas ───────────────────────────────────
export function checkGoalRealism(
  targetAmount: number,
  horizonMonths: number,
  incomeRange: IncomeRange | null,
  savingsPercent: number,
): {
  isUnrealistic: boolean;
  estimatedMonths: number;
  requiredMonthly: number;
  recommendedMonthly: number;
  suggestedAmount: number;
  suggestedHorizonMonths: number;
} {
  const incomeMid = incomeRange ? (incomeRange.min + incomeRange.max) / 2 : 1500;
  const recommendedMonthly = Math.max(1, Math.round(incomeMid * savingsPercent / 100));
  const estimatedMonths = Math.ceil(targetAmount / recommendedMonthly);
  const requiredMonthly = horizonMonths > 0 ? Math.ceil(targetAmount / horizonMonths) : targetAmount;
  const isUnrealistic = estimatedMonths > 3 || requiredMonthly > recommendedMonthly * 1.2;
  const suggestedAmount = Math.round(recommendedMonthly * 2);
  return { isUnrealistic, estimatedMonths, requiredMonthly, recommendedMonthly, suggestedAmount, suggestedHorizonMonths: 2 };
}

export function computeInitialGoalSuggestion(
  incomeRange: IncomeRange | null,
  profile: SavingsProfile | null,
): { monthly: number; target: number; horizonMonths: number } | null {
  if (!incomeRange || !profile) return null;
  const mid = (incomeRange.min + incomeRange.max) / 2;
  const PERCENTS: Record<SavingsProfile, number> = { low: 0.03, medium: 0.06, high: 0.12 };
  const monthly = Math.round(mid * PERCENTS[profile]);
  if (monthly <= 0) return null;
  const target = Math.round(monthly * 2);
  const horizonMonths = Math.max(1, Math.ceil(target / monthly));
  return { monthly, target, horizonMonths };
}

export function storeSetSavingsProfile(
  profile: SavingsProfile,
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  const PERCENTS: Record<SavingsProfile, number> = { low: 3, medium: 6, high: 12 };
  state.savingsProfile = profile;
  state.savingsPercent = PERCENTS[profile];
  persistStore(state);
  return buildSummary(currentRange);
}

export function storeMarkGoalPercentMilestone(goalId: string, percent: number): void {
  const state = loadStore();
  if (!state.goalPercentMilestonesSeen) state.goalPercentMilestonesSeen = {};
  if (!state.goalPercentMilestonesSeen[goalId]) state.goalPercentMilestonesSeen[goalId] = [];
  if (!state.goalPercentMilestonesSeen[goalId].includes(percent)) {
    state.goalPercentMilestonesSeen[goalId].push(percent);
    persistStore(state);
  }
}

export function storeAcknowledgeAdaptiveEvaluation(newPercent?: number): void {
  const state = loadStore();
  state.lastAdaptiveEvaluation = localDateStr();
  if (newPercent !== undefined) state.savingsPercent = newPercent;
  persistStore(state);
}

/** Traduce el answerKey de la UI ('saved|Etiqueta', 'zero|custom:texto', 'saved') a opción del catálogo. */
function parseAnswer(answerKey: string): { optionKey: string; customText: string | null } {
  const idx = answerKey.indexOf('|');
  const signal = idx >= 0 ? answerKey.slice(idx + 1) : '';
  if (signal.startsWith('custom:')) {
    const text = signal.slice(7).trim().slice(0, 200);
    return text ? { optionKey: '__custom__', customText: text } : { optionKey: '__unspecified__', customText: null };
  }
  const slug = signal ? slugifyOption(signal) : '';
  return slug ? { optionKey: slug, customText: null } : { optionKey: '__unspecified__', customText: null };
}

/**
 * Registra la decisión de ahorro del día.
 *
 * Nuevo flujo (formato importe):
 *   - savedAmount: cuánto ha ahorrado el usuario (0 = no ahorró nada)
 *   - El importe lo pone el usuario directamente (default 0 €) y se registra TAL CUAL (D1).
 */
export function storeSubmitDecision(
  questionId: string,
  answerKey: string,
  goalId: string,
  currentRange: '7d' | '30d' | '90d' = '30d',
  customAmount?: number,
  opts?: { surface?: Surface },
): DashboardSummary {
  const state = loadStore();
  const today = localDateStr();

  if (state.decisions.some((d) => d.date === today && isDaily(d))) {
    return buildSummary(currentRange);
  }

  const savedAmount = customAmount != null && customAmount > 0 ? money(Math.min(customAmount, 100000)) : 0;
  const goal = activeGoal(state, goalId);
  // Un ahorro siempre cae en un objetivo activo (la UI no permite otra cosa).
  if (savedAmount > 0 && !goal) return buildSummary(currentRange);

  const now = new Date().toISOString();
  const id = `dec_${nextIdMs()}`;
  state.decisions.push({
    id,
    date: today,
    questionId,
    answerKey,
    goalId: goal ? goalId : '',
    deltaAmount: savedAmount,
    monthlyProjection: 0,
    yearlyProjection: 0,
    createdAt: now,
  });

  if (goal) {
    goal.currentAmount = money(goal.currentAmount + savedAmount);
    goal.updatedAt = now;
  }

  persistStore(state);
  const { optionKey, customText } = parseAnswer(answerKey);
  enqueue('daily.record', {
    decision: id, questionId, optionKey, customText, amount: savedAmount,
    goal: goal ? goalId : null, surface: opts?.surface ?? 'daily_page',
  });

  return buildSummary(currentRange);
}

// ─── Proyección del estado V2 (get_dashboard_state) sobre la caché local ─────
type V2Goal = {
  id: string; legacy_id: string | null; title: string; target_amount: number | string; final_target_amount: number | string | null;
  step_index: number | null; horizon_months: number; status: string; is_primary: boolean; source: string;
  start_date: string | null; created_at: string; updated_at: string; first_completed_at: string | null; balance: number | string;
};
type V2Decision = {
  kind: 'daily' | 'grace' | 'extra'; id: string; legacy_id: string | null; local_date: string; occurred_at: string;
  outcome?: string; question_id?: string | null; option_key?: string | null; custom_text?: string | null; note?: string | null;
  goal_id: string | null; amount: number | string; credited: boolean;
};
export type V2DashboardState = {
  today: string; timezone: string;
  onboarding: { completed: boolean; source: string };
  income: { band_code: string } | null;
  avatar: string | null;
  goals: V2Goal[];
  primary_goal_id: string | null;
  hucha: { balance: number | string; entries: { amount: number | string; date: string; from_goal_id: string | null }[] };
  totals: { registered_savings: number | string; total_balance: number | string };
  streak: number; streak_broke_yesterday: boolean; grace_available: boolean;
  decisions: V2Decision[];
};

/** Sustituye la caché de negocio por el estado autoritativo del servidor (sin tocar preferencias de UI). */
export function storeApplyV2State(s: V2DashboardState, ownerUid: string): void {
  const prev = loadStore();
  const sameOwner = !prev.ownerUid || prev.ownerUid === ownerUid;
  const state: StoreState = sameOwner ? prev : { ...structuredClone(SEED), userName: prev.userName, userEmail: prev.userEmail };
  const prevGoals = new Map(state.goals.map((g) => [g.id, g]));
  const prevDecs = new Map(state.decisions.map((d) => [d.id, d]));
  const localGoalId = new Map<string, string>();
  for (const g of s.goals) localGoalId.set(g.id, g.legacy_id ?? g.id);
  const mapGoal = (id: string | null | undefined) => (id ? localGoalId.get(id) ?? '' : '');

  state.goals = s.goals.map((g) => {
    const id = g.legacy_id ?? g.id;
    const p = prevGoals.get(id);
    const start = g.start_date ?? g.created_at.slice(0, 10);
    return {
      id,
      title: g.title,
      targetAmount: Number(g.target_amount),
      finalGoalAmount: g.final_target_amount != null ? Number(g.final_target_amount) : undefined,
      currentAmount: Number(g.balance),
      horizonMonths: g.horizon_months,
      isPrimary: g.is_primary,
      archived: g.status !== 'active',
      createdAt: g.created_at,
      updatedAt: g.updated_at,
      source: g.source === 'onboarding' ? 'onboarding' : 'dashboard',
      completedAt: g.first_completed_at,
      startDate: start,
      targetDate: addMonthsStr(start, g.horizon_months),
      isUnrealistic: p?.isUnrealistic ?? false,
      subGoalIndex: g.step_index ?? p?.subGoalIndex ?? 0,
    } satisfies Goal;
  });

  state.decisions = s.decisions.map((d) => {
    const id = d.legacy_id ?? d.id;
    const p = prevDecs.get(id);
    if (d.kind === 'grace') {
      return { id, date: d.local_date, questionId: 'grace_day', answerKey: 'grace', goalId: '', deltaAmount: 0,
        monthlyProjection: 0, yearlyProjection: 0, createdAt: d.occurred_at };
    }
    if (d.kind === 'extra') {
      return { id, date: d.local_date, questionId: 'extra_saving', answerKey: d.note ?? p?.answerKey ?? 'Ahorro extra',
        goalId: mapGoal(d.goal_id), deltaAmount: Number(d.amount), monthlyProjection: 0, yearlyProjection: 0,
        createdAt: d.occurred_at };
    }
    const outcome = d.outcome === 'saved' ? 'saved' : 'zero';
    const signal = d.custom_text ? `custom:${d.custom_text}` : d.option_key && !d.option_key.startsWith('__') ? d.option_key : '';
    return {
      id, date: d.local_date, questionId: d.question_id ?? p?.questionId ?? 'legacy_v1',
      answerKey: p?.answerKey ?? (signal ? `${outcome}|${signal}` : outcome),
      goalId: mapGoal(d.goal_id), deltaAmount: Number(d.amount), monthlyProjection: 0, yearlyProjection: 0,
      createdAt: d.occurred_at, v2Credited: d.credited,
    };
  });

  const titleOf = (id: string | null) => s.goals.find((g) => g.id === id)?.title ?? '';
  state.hucha = {
    balance: Number(s.hucha.balance),
    entries: s.hucha.entries.map((e) => ({ amount: Number(e.amount), fromGoalId: mapGoal(e.from_goal_id), fromGoalTitle: titleOf(e.from_goal_id), date: e.date })),
    updatedAt: new Date().toISOString(),
  };
  state.graceUsedMonth = s.grace_available ? null : localMonthStr();
  if (s.income?.band_code && BAND_RANGES[s.income.band_code]) state.incomeRange = BAND_RANGES[s.income.band_code];
  if (s.avatar === 'comodo' || s.avatar === 'social' || s.avatar === 'impulsivo') state.userAvatar = s.avatar;
  state.ownerUid = ownerUid;
  state.v2 = {
    streak: s.streak, streakBrokeYesterday: s.streak_broke_yesterday, graceAvailable: s.grace_available,
    totalSaved: Number(s.totals.registered_savings), fetchedAt: Date.now(),
  };
  persistStore(state);
}

/** Marca el dueño de la caché local (para descartarla si entra otro usuario en el mismo navegador). */
export function storeSetOwner(uid: string): void {
  const state = loadStore();
  if (state.ownerUid !== uid) { state.ownerUid = uid; persistStore(state); }
}

// ─── Progreso de objetivo: puntos para gráfica ───────────────────────────────
export type GoalProgressPoint = {
  day: number;
  actual: number;
  ideal: number;
};

export function storeGetGoalProgressPoints(goalId: string): GoalProgressPoint[] {
  const state = loadStore();
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return [];

  const start = new Date(goal.startDate ?? goal.createdAt);
  start.setHours(0, 0, 0, 0);
  const horizonDays = goal.horizonMonths * 30;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysElapsed = Math.max(
    0,
    Math.min(
      Math.floor((today.getTime() - start.getTime()) / 86_400_000),
      horizonDays,
    ),
  );

  const byDay = new Map<number, number>();
  for (const d of state.decisions) {
    if (d.goalId !== goalId || d.deltaAmount <= 0) continue;
    const dd = new Date(d.date);
    dd.setHours(0, 0, 0, 0);
    const offset = Math.floor((dd.getTime() - start.getTime()) / 86_400_000);
    if (offset >= 0 && offset <= horizonDays) {
      byDay.set(offset, (byDay.get(offset) ?? 0) + d.deltaAmount);
    }
  }

  const pts: GoalProgressPoint[] = [{ day: 0, actual: 0, ideal: 0 }];
  let cum = 0;
  for (let d = 1; d <= daysElapsed; d++) {
    cum += byDay.get(d) ?? 0;
    pts.push({
      day: d,
      actual: Math.min(cum, goal.targetAmount),
      ideal: (d / horizonDays) * goal.targetAmount,
    });
  }
  return pts;
}
