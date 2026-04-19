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
  toDashboardQuestion,
  getCurrentTimeWindow,
  type UserProfile,
} from './questionSelectionEngine';
import { getQuestionById } from './dailyQuestionsBank';
import type { AvatarKey, SubavatarKey } from './profilingService';
import { STORAGE_KEY } from '@/lib/constants';

// STORAGE_KEY importado desde @/lib/constants

// ─── Helper: distinguir decisión diaria de ahorro extra / grace day ─────────
const isDaily = (d: DailyDecision) =>
  d.questionId !== 'extra_saving' && d.questionId !== 'grace_day';

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

// ─── Preguntas diarias (nuevo formato basado en importe) ──────────────────────
export type DailyQuestion = {
  questionId: string;
  text: string;
  suggestedAmount: number;
  monthlyDelta: number;
  yearlyDelta: number;
  labelImpact: string;
  tags?: string[];
};

// ─── Avatar de usuario (perfil de comportamiento) ────────────────────────────
export type UserAvatar = 'comodo' | 'social' | 'impulsivo' | 'desordenado';

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
  desordenado: {
    label: 'Desordenado',
    emoji: '🌀',
    color: '#8b5cf6',
    tagline: 'No es falta de voluntad, es falta de visibilidad.',
    description: 'El dinero se te escapa en pequeños gastos sin que te des cuenta. Tus preguntas diarias te darán claridad y sensación de control.',
  },
};

export const DAILY_QUESTIONS: DailyQuestion[] = [
  // ─ Legacy pool (formato importe) ────────────────────────────────────────
  { questionId: 'coffee',         tags: ['consumo', 'food'],       text: 'Si hoy te has preparado café en casa en vez de comprarlo, ¿cuánto te has ahorrado?',              suggestedAmount: 3,  monthlyDelta: 60,  yearlyDelta: 720,  labelImpact: 'Café en casa ahorra ~60 €/mes' },
  { questionId: 'delivery',       tags: ['food', 'consumo'],       text: 'Si hoy has cocinado en vez de pedir delivery, ¿cuánto te has ahorrado?',                         suggestedAmount: 8,  monthlyDelta: 120, yearlyDelta: 1440, labelImpact: 'Cocinar en casa ahorra ~120 €/mes' },
  { questionId: 'transport',      tags: ['transport'],             text: 'Si hoy has usado transporte público en vez de taxi, ¿cuánto te has ahorrado?',                    suggestedAmount: 5,  monthlyDelta: 80,  yearlyDelta: 960,  labelImpact: 'Transporte público ahorra ~80 €/mes' },
  { questionId: 'impulse',        tags: ['impulse', 'consumo'],    text: 'Si hoy has evitado una compra impulsiva, ¿cuánto te has ahorrado?',                               suggestedAmount: 15, monthlyDelta: 150, yearlyDelta: 1800, labelImpact: 'Evitar impulsos ahorra ~150 €/mes' },
  { questionId: 'subscription',   tags: ['subscription', 'tech'],  text: 'Si hoy has cancelado una suscripción sin uso, ¿cuánto te ahorras al mes?',                        suggestedAmount: 10, monthlyDelta: 10,  yearlyDelta: 120,  labelImpact: 'Cancelar suscripciones innecesarias ahorra al año' },
  { questionId: 'hogar_energy',   tags: ['hogar'],                 text: 'Si hoy has apagado electrodomésticos que no usabas, ¿cuánto te has ahorrado?',                    suggestedAmount: 2,  monthlyDelta: 40,  yearlyDelta: 480,  labelImpact: 'Apagar electrodomésticos ahorra ~40 €/mes' },
  { questionId: 'hogar_water',    tags: ['hogar'],                 text: 'Si hoy has dado una ducha corta, ¿cuánto crees que has ahorrado en agua caliente?',               suggestedAmount: 3,  monthlyDelta: 50,  yearlyDelta: 600,  labelImpact: 'Duchas cortas ahorran ~50 €/mes' },
  { questionId: 'hogar_meal_plan',tags: ['hogar', 'food'],         text: 'Si hoy has planificado las comidas para reducir desperdicios, ¿cuánto te has ahorrado?',          suggestedAmount: 15, monthlyDelta: 60,  yearlyDelta: 720,  labelImpact: 'Planificar comidas ahorra ~60 €/mes' },
  { questionId: 'hogar_heating',  tags: ['hogar'],                 text: 'Si hoy has ajustado la temperatura del hogar para ahorrar, ¿cuánto?',                             suggestedAmount: 5,  monthlyDelta: 30,  yearlyDelta: 360,  labelImpact: 'Ajustar temperatura ahorra ~30 €/mes' },
  { questionId: 'salud_lunch',    tags: ['salud', 'food'],         text: 'Si hoy has llevado el almuerzo de casa al trabajo, ¿cuánto te has ahorrado?',                     suggestedAmount: 8,  monthlyDelta: 160, yearlyDelta: 1920, labelImpact: 'Llevar almuerzo ahorra ~160 €/mes' },
  { questionId: 'salud_exercise', tags: ['salud'],                 text: 'Si hoy has hecho ejercicio gratis (calle/casa) en vez de pagar gimnasio, ¿cuánto?',              suggestedAmount: 7,  monthlyDelta: 30,  yearlyDelta: 360,  labelImpact: 'Ejercicio al aire libre ahorra ~30 €/mes' },
  { questionId: 'salud_generic',  tags: ['salud', 'consumo'],      text: 'Si hoy has comprado productos genéricos en vez de marcas, ¿cuánto te has ahorrado?',             suggestedAmount: 8,  monthlyDelta: 24,  yearlyDelta: 288,  labelImpact: 'Productos genéricos ahorran ~24 €/mes' },
  { questionId: 'ocio_streaming', tags: ['ocio'],                  text: 'Si hoy has visto contenido en casa en vez de ir al cine, ¿cuánto te has ahorrado?',              suggestedAmount: 10, monthlyDelta: 40,  yearlyDelta: 480,  labelImpact: 'Cine en casa vs fuera ahorra ~40 €/mes' },
  { questionId: 'ocio_bar',       tags: ['ocio', 'consumo'],       text: 'Si hoy has tomado algo en casa en vez de ir al bar, ¿cuánto te has ahorrado?',                   suggestedAmount: 7,  monthlyDelta: 112, yearlyDelta: 1344, labelImpact: 'Tomar algo en casa ahorra ~112 €/mes' },
  { questionId: 'ocio_library',   tags: ['ocio'],                  text: 'Si hoy has usado contenido gratuito (biblioteca, online) en vez de comprar, ¿cuánto?',           suggestedAmount: 12, monthlyDelta: 24,  yearlyDelta: 288,  labelImpact: 'Usar contenido gratuito ahorra ~24 €/mes' },
  { questionId: 'tech_apps',      tags: ['tech', 'subscription'],  text: 'Si hoy has evitado instalar una app de pago o nueva suscripción, ¿cuánto?',                      suggestedAmount: 5,  monthlyDelta: 15,  yearlyDelta: 180,  labelImpact: 'Evitar suscripciones innecesarias ahorra ~15 €/mes' },
  { questionId: 'tech_gadget',    tags: ['tech', 'impulse'],       text: 'Si hoy has resistido la tentación de comprar un gadget, ¿cuánto te has ahorrado?',               suggestedAmount: 20, monthlyDelta: 40,  yearlyDelta: 480,  labelImpact: 'Resistir gadgets ahorra ~40 €/mes' },
  { questionId: 'transport_alt',  tags: ['transport'],             text: 'Si hoy has ido en bici, patinete o andando en vez de en coche/taxi, ¿cuánto te has ahorrado?',   suggestedAmount: 6,  monthlyDelta: 96,  yearlyDelta: 1152, labelImpact: 'Movilidad eco ahorra ~96 €/mes' },
  { questionId: 'transport_share',tags: ['transport'],             text: 'Si hoy has compartido coche con alguien, ¿cuánto te has ahorrado?',                              suggestedAmount: 8,  monthlyDelta: 64,  yearlyDelta: 768,  labelImpact: 'Compartir coche ahorra ~64 €/mes' },
  { questionId: 'impulse_online', tags: ['impulse', 'consumo'],    text: 'Si hoy has cerrado un carrito online sin comprar, ¿cuánto te has ahorrado?',                     suggestedAmount: 20, monthlyDelta: 80,  yearlyDelta: 960,  labelImpact: 'Cerrar carritos sin comprar ahorra ~80 €/mes' },
];

// Preguntas personalizadas por avatar (sustituye al sistema moneyFeeling)
const AVATAR_TAGS: Record<UserAvatar, string[]> = {
  comodo:      ['food', 'consumo', 'hogar', 'transport'],
  social:      ['ocio', 'food', 'consumo', 'transport'],
  impulsivo:   ['impulse', 'consumo', 'tech', 'ocio'],
  desordenado: ['hogar', 'subscription', 'salud', 'food'],
};

// Pregunta del día personalizada (avatar tiene prioridad sobre moneyFeeling)
const FEELING_TAGS: Record<string, string[]> = {
  reactive:  ['food', 'consumo', 'impulse', 'transport'],
  avoidant:  ['food', 'consumo', 'hogar', 'subscription'],
  anxious:   ['hogar', 'salud', 'subscription', 'food'],
};

/**
 * Obtiene la pregunta del día usando el motor contextual de selección.
 *
 * Combina:
 *   1. Perfil del usuario (avatar + subavatar)
 *   2. Día de la semana
 *   3. Franja horaria actual (Mañana / Tarde / Noche)
 *
 * Si el usuario NO ha respondido la pregunta diaria, la pregunta puede
 * cambiar al cambiar de franja horaria (p.ej. de mañana a tarde).
 *
 * Si YA respondió, devuelve la misma pregunta del legacy pool como fallback.
 */
export function getTodayQuestion(): DailyQuestion {
  // ── Leer perfil del usuario ──────────────────────────────────────────────
  let userAvatar: UserAvatar | null = null;
  let userSubavatar: string | null = null;
  let streak = 0;
  let answeredToday = false;
  let lastQuestionId: string | null = null;
  const recentQuestionIds: string[] = [];

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoreState;
        userAvatar = (parsed.userAvatar ?? null) as UserAvatar | null;

        // Leer subavatar del profiling
        const profilingRaw = localStorage.getItem('profilingResults');
        if (profilingRaw) {
          try {
            const profiling = JSON.parse(profilingRaw) as { subavatar?: string };
            userSubavatar = profiling.subavatar ?? null;
          } catch { /* fallthrough */ }
        }

        // Calcular racha y si ya respondió hoy
        const today = new Date().toISOString().split('T')[0];
        const dailyDecisions = (parsed.decisions ?? []).filter(
          (d: DailyDecision) => d.questionId !== 'extra_saving' && d.questionId !== 'grace_day'
        );
        const todayDecision = dailyDecisions.find((d: DailyDecision) => d.date === today);
        answeredToday = !!todayDecision;
        lastQuestionId = todayDecision?.questionId ?? null;

        // Racha
        streak = computeStreak(parsed.decisions ?? []);

        // Ids respondidos en los últimos 7 días (para evitar repeticiones)
        const cutoff7 = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0];
        for (const d of dailyDecisions) {
          if (d.date >= cutoff7 && !recentQuestionIds.includes(d.questionId)) {
            recentQuestionIds.push(d.questionId);
          }
        }
      }

      // Fallback: leer del onboardingData
      if (!userAvatar) {
        const onbRaw = localStorage.getItem('onboardingData');
        if (onbRaw) {
          const onb = JSON.parse(onbRaw) as { userAvatar?: string };
          userAvatar = (onb.userAvatar ?? null) as UserAvatar | null;
        }
      }
    } catch { /* fallthrough */ }
  }

  // ── Usar motor contextual del banco de 135 preguntas ─────────────────────
  const profile: UserProfile = {
    avatar: userAvatar as AvatarKey | 'constructor' | null,
    subavatar: (userSubavatar as SubavatarKey) ?? null,
    streak,
  };

  try {
    const bankQuestion = getContextualDailyQuestion(
      profile,
      answeredToday,
      lastQuestionId,
      recentQuestionIds,
    );
    return toDashboardQuestion(bankQuestion);
  } catch {
    // Fallback al pool legacy si algo falla con el banco
  }

  // ── Fallback: pool legacy ───────────────────────────────────────────────
  let pool = DAILY_QUESTIONS;
  if (userAvatar && AVATAR_TAGS[userAvatar]) {
    const preferred = DAILY_QUESTIONS.filter(q => q.tags?.some(t => AVATAR_TAGS[userAvatar!].includes(t)));
    if (preferred.length >= 5) pool = preferred;
  }
  const dayIndex = Math.floor(Date.now() / 86_400_000) % pool.length;
  return pool[dayIndex];
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
  const daily = decisions.filter(isDaily);
  if (daily.length === 0) return 0;
  const today = new Date().toISOString().split('T')[0];
  const hasToday = daily.some((d) => d.date === today);
  let streak = 0;
  let cursor = new Date(hasToday ? today : (() => {
    const d = new Date(today); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0];
  })());
  while (true) {
    const dateStr = cursor.toISOString().split('T')[0];
    const found = daily.some((d) => d.date === dateStr);
    if (!found) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function computeIntensity(decisions: DailyDecision[]): 'low' | 'medium' | 'high' | 'unknown' {
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0];
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
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0];
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
export function buildSummary(range: '7d' | '30d' | '90d' = '30d'): DashboardSummary {
  const state = loadStore();
  const today = new Date().toISOString().split('T')[0];
  const activeGoals = state.goals.filter((g) => !g.archived);
  const primaryGoal =
    activeGoals.find((g) => g.isPrimary) ?? activeGoals[0] ?? null;

  const todayDecision = state.decisions.find((d) => d.date === today && isDaily(d)) ?? null;
  const evolutionPoints = buildEvolutionPoints(state.decisions, range);

  // Velocidad media de ahorro (últimos 30 días)
  const cutoff30 = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
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

  const totalSaved = state.decisions.reduce((s, d) => s + d.deltaAmount, 0);
  const streak = computeStreak(state.decisions);
  const intensity = computeIntensity(state.decisions);

  // Adaptive helpers
  const goalPercentMilestone = checkGoalPercentMilestone(state);
  const adaptiveEvaluation = checkAdaptiveEvaluation(state, streak, intensity);
  const last3 = [0, 1, 2].map((i) => {
    const d = new Date(Date.now() - i * 86_400_000);
    return d.toISOString().split('T')[0];
  });
  const dailyDecisions = state.decisions.filter(isDaily);
  const lowActivityAlert =
    dailyDecisions.length > 0 &&
    activeGoals.length > 0 &&
    !last3.some((date) => dailyDecisions.some((d) => d.date === date));

  // ─ Milestones ──────────────────────────────────────────────────────────────
  const MILESTONES = [50, 100, 500, 1000, 2000, 5000];
  const newMilestone = MILESTONES.find(m => totalSaved >= m && !state.seenMilestones.includes(m)) ?? null;

  // ─ Streak recovery ─────────────────────────────────────────────────────────
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
  const hadYesterdayDecision = state.decisions.some(d => d.date === yesterday && isDaily(d));
  const streakBrokeYesterday = streak === 0 && !hadYesterdayDecision && state.decisions.filter(isDaily).length > 0;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const graceAvailable = (state.graceUsedMonth ?? '') !== currentMonth;

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

// ─── API pública: mutaciones ──────────────────────────────────────────────────
export function storeUpdateIncome(
  incomeRange: IncomeRange,
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  state.incomeRange = incomeRange;
  persistStore(state);
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
): DashboardSummary {
  const state = loadStore();
  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];
  const activeGoals = state.goals.filter((g) => !g.archived);
  const shouldBePrimary = data.isPrimary === true || activeGoals.length === 0;
  if (shouldBePrimary) {
    state.goals = state.goals.map((g) => ({ ...g, isPrimary: false, updatedAt: now }));
  }
  const initAmount = data.currentAmount ?? 0;
  // Compute targetDate from horizonMonths if not provided
  const targetDate = data.targetDate ?? (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + data.horizonMonths);
    return d.toISOString().split('T')[0];
  })();
  state.goals.push({
    id: `goal_${Date.now()}`,
    title: data.title,
    targetAmount: data.targetAmount,
    finalGoalAmount: data.finalGoalAmount,
    currentAmount: initAmount,
    horizonMonths: data.horizonMonths,
    isPrimary: shouldBePrimary,
    archived: false,
    createdAt: now,
    updatedAt: now,
    source: data.source ?? 'dashboard',
    completedAt: initAmount >= data.targetAmount && data.targetAmount > 0 ? now : null,
    startDate: data.startDate ?? today,
    targetDate,
    isUnrealistic: data.isUnrealistic ?? false,
    subGoalIndex: data.subGoalIndex ?? 0,
  });
  persistStore(state);
  return buildSummary(currentRange);
}

export function storeArchiveGoal(
  goalId: string,
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  const now = new Date().toISOString();
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return buildSummary(currentRange);

  const wasPrimary = goal.isPrimary;
  goal.isPrimary = false;
  goal.archived = true;
  goal.updatedAt = now;

  if (wasPrimary) {
    const next = state.goals.find((g) => !g.archived && g.id !== goalId);
    if (next) { next.isPrimary = true; next.updatedAt = now; }
  }
  persistStore(state);
  return buildSummary(currentRange);
}

export function storeSetPrimaryGoal(
  goalId: string,
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  const now = new Date().toISOString();
  state.goals = state.goals.map((g) => ({
    ...g,
    isPrimary: g.id === goalId,
    updatedAt: g.id === goalId || g.isPrimary ? now : g.updatedAt,
  }));
  persistStore(state);
  return buildSummary(currentRange);
}

export function storeUpdateGoal(
  goalId: string,
  patch: Partial<Pick<Goal, 'title' | 'targetAmount' | 'currentAmount' | 'horizonMonths' | 'isPrimary'>>,
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  const now = new Date().toISOString();
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return buildSummary(currentRange);

  if (patch.isPrimary === true) {
    state.goals = state.goals.map((g) => ({ ...g, isPrimary: false, updatedAt: now }));
  }
  Object.assign(goal, patch, { updatedAt: now });
  persistStore(state);
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

export function storeDeleteDecision(
  decisionId: string,
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  const now = new Date().toISOString();
  const dec = state.decisions.find((d) => d.id === decisionId);
  if (dec) {
    const goal = state.goals.find((g) => g.id === dec.goalId);
    if (goal) {
      goal.currentAmount = Math.max(0, goal.currentAmount - dec.deltaAmount);
      goal.updatedAt = now;
    }
    state.decisions = state.decisions.filter((d) => d.id !== decisionId);
    persistStore(state);
  }
  return buildSummary(currentRange);
}

export function storeEditDecision(
  decisionId: string,
  newAmount: number,
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  const now = new Date().toISOString();
  const dec = state.decisions.find((d) => d.id === decisionId);
  if (dec) {
    const oldAmount = dec.deltaAmount;
    const diff = newAmount - oldAmount;
    dec.deltaAmount = newAmount;
    const goal = state.goals.find((g) => g.id === dec.goalId);
    if (goal) {
      goal.currentAmount = Math.max(0, goal.currentAmount + diff);
      goal.updatedAt = now;
    }
    persistStore(state);
  }
  return buildSummary(currentRange);
}

export function storeResetDecision(
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  const todayDec = state.decisions.find((d) => d.date === today && isDaily(d));
  if (todayDec) {
    const goal = state.goals.find((g) => g.id === todayDec.goalId);
    if (goal) {
      goal.currentAmount = Math.max(0, goal.currentAmount - todayDec.deltaAmount);
      goal.updatedAt = now;
    }
    state.decisions = state.decisions.filter((d) => !(d.date === today && isDaily(d)));
    persistStore(state);
  }
  return buildSummary(currentRange);
}

export function storeAddExtraSaving(
  name: string,
  amount: number,
  goalId: string,
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  state.decisions.push({
    id: `extra_${Date.now()}`,
    date: today,
    questionId: 'extra_saving',
    answerKey: name,
    goalId,
    deltaAmount: amount,
    monthlyProjection: 0,
    yearlyProjection: 0,
    createdAt: now,
  });
  const goal = state.goals.find((g) => g.id === goalId);
  if (goal) {
    goal.currentAmount += amount;
    goal.updatedAt = now;
    if (!goal.completedAt && goal.currentAmount >= goal.targetAmount && goal.targetAmount > 0) {
      goal.completedAt = now;
    }
  }
  persistStore(state);
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
): DashboardSummary {
  const state = loadStore();
  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return buildSummary(currentRange);

  const balance = goal.currentAmount;

  // Reasignar saldo
  if (balance > 0) {
    if (destination === 'hucha') {
      if (!state.hucha) state.hucha = { balance: 0, entries: [] };
      state.hucha.balance = Math.round((state.hucha.balance + balance) * 100) / 100;
      state.hucha.entries.push({
        amount: balance,
        fromGoalId: goalId,
        fromGoalTitle: goal.title,
        date: today,
      });
    } else {
      const target = state.goals.find((g) => g.id === destination && !g.archived);
      if (target) {
        target.currentAmount = Math.round((target.currentAmount + balance) * 100) / 100;
        target.updatedAt = now;
      }
    }
  }

  // Redirigir decisions del objetivo archivado al destino
  if (destination !== 'hucha' && destination !== goalId) {
    state.decisions = state.decisions.map((d) =>
      d.goalId === goalId ? { ...d, goalId: destination } : d,
    );
  }

  // Archivar el objetivo
  const wasPrimary = goal.isPrimary;
  goal.isPrimary = false;
  goal.currentAmount = 0;
  goal.archived = true;
  goal.updatedAt = now;

  if (wasPrimary) {
    const next = state.goals.find((g) => !g.archived && g.id !== goalId);
    if (next) { next.isPrimary = true; next.updatedAt = now; }
  }

  persistStore(state);
  return buildSummary(currentRange);
}

// Transfiere saldo de la hucha a un objetivo (total o parcial)
export function storeTransferFromHucha(
  goalId: string,
  amount: number,
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  const now = new Date().toISOString();
  if (!state.hucha || state.hucha.balance <= 0) return buildSummary(currentRange);

  const transfer = Math.min(amount, state.hucha.balance);
  state.hucha.balance = Math.round((state.hucha.balance - transfer) * 100) / 100;

  const goal = state.goals.find((g) => g.id === goalId && !g.archived);
  if (goal) {
    goal.currentAmount = Math.round((goal.currentAmount + transfer) * 100) / 100;
    goal.updatedAt = now;
  }

  persistStore(state);
  return buildSummary(currentRange);
}

// ─── Reactivar objetivo archivado ────────────────────────────────────────────
export function storeReactivateGoal(
  goalId: string,
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  const now = new Date().toISOString();
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return buildSummary(currentRange);

  goal.archived = false;
  goal.updatedAt = now;

  // Si no hay ningún objetivo principal activo, este pasa a ser principal
  const hasActivePrimary = state.goals.some((g) => !g.archived && g.isPrimary);
  if (!hasActivePrimary) {
    goal.isPrimary = true;
  }

  persistStore(state);
  return buildSummary(currentRange);
}

// ─── Eliminar objetivo definitivamente ───────────────────────────────────────
// Requiere que el saldo ya esté a 0 (resuelto previamente) o se pase destino
export function storeDeleteGoalPermanent(
  goalId: string,
  destination: string | 'hucha' | null,
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return buildSummary(currentRange);

  const balance = goal.currentAmount;

  // Resolver saldo si existe
  if (balance > 0 && destination) {
    if (destination === 'hucha') {
      if (!state.hucha) state.hucha = { balance: 0, entries: [] };
      state.hucha.balance = Math.round((state.hucha.balance + balance) * 100) / 100;
      state.hucha.entries.push({
        amount: balance,
        fromGoalId: goalId,
        fromGoalTitle: goal.title,
        date: today,
      });
    } else {
      const target = state.goals.find((g) => g.id === destination && !g.archived);
      if (target) {
        target.currentAmount = Math.round((target.currentAmount + balance) * 100) / 100;
        target.updatedAt = now;
      }
    }
  }

  // Redirigir decisions al destino si existe
  if (destination && destination !== 'hucha' && destination !== goalId) {
    state.decisions = state.decisions.map((d) =>
      d.goalId === goalId ? { ...d, goalId: destination } : d,
    );
  } else {
    // Eliminar decisions del objetivo borrado (no hay donde redirigir)
    state.decisions = state.decisions.filter((d) => d.goalId !== goalId);
  }

  // Eliminar el objetivo del array
  state.goals = state.goals.filter((g) => g.id !== goalId);

  persistStore(state);
  return buildSummary(currentRange);
}

// Claves de autenticación que se conservan tras el reset
const AUTH_KEYS_TO_PRESERVE = ['isAuthenticated', 'userEmail', 'userName', 'supabaseUserId', 'rememberMe', 'theme'];

export function storeResetAllData(): void {
  if (typeof window === 'undefined') return;
  try {
    // 1. Snapshot de claves auth a conservar
    const preserved: Record<string, string> = {};
    AUTH_KEYS_TO_PRESERVE.forEach((k) => {
      const v = localStorage.getItem(k);
      if (v !== null) preserved[k] = v;
    });

    // 2. Borrar todas las claves de app (incluye widget_collapse_*, sync timestamps, onboarding, etc.)
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && !AUTH_KEYS_TO_PRESERVE.includes(k)) keysToDelete.push(k);
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

// ─── Multiplicador de impacto por rango de ingresos ──────────────────────────
function incomeMultiplier(incomeRange: IncomeRange | null): number {
  if (!incomeRange) return 1.0;
  const mid = (incomeRange.min + incomeRange.max) / 2;
  if (mid < 1500) return 0.80;
  if (mid < 2500) return 0.90;
  if (mid < 4000) return 1.00;
  if (mid < 6000) return 1.15;
  return 1.30;
}

// ─── Día de gracia (streak recovery) ─────────────────────────────────────────
export function storeUseGraceDay(
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
  const now = new Date().toISOString();
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (state.decisions.some(d => d.date === yesterday)) return buildSummary(currentRange);
  const primaryGoal = state.goals.find(g => !g.archived && g.isPrimary) ?? state.goals.find(g => !g.archived);
  state.decisions.push({
    id: `grace_${Date.now()}`,
    date: yesterday,
    questionId: 'grace_day',
    answerKey: 'grace',
    goalId: primaryGoal?.id ?? '',
    deltaAmount: 0,
    monthlyProjection: 0,
    yearlyProjection: 0,
    createdAt: now,
  });
  state.graceUsedMonth = currentMonth;
  persistStore(state);
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
  state.lastAdaptiveEvaluation = new Date().toISOString().split('T')[0];
  if (newPercent !== undefined) state.savingsPercent = newPercent;
  persistStore(state);
}

/**
 * Registra la decisión de ahorro del día.
 *
 * Nuevo flujo (formato importe):
 *   - savedAmount: cuánto ha ahorrado el usuario (0 = no ahorró nada)
 *   - El importe lo pone el usuario directamente (default 0 €)
 *
 * Se mantiene retrocompatibilidad con las legacy questions (answerKey).
 */
export function storeSubmitDecision(
  questionId: string,
  answerKey: string,
  goalId: string,
  currentRange: '7d' | '30d' | '90d' = '30d',
  customAmount?: number,
): DashboardSummary {
  const state = loadStore();
  const today = new Date().toISOString().split('T')[0];

  if (state.decisions.some((d) => d.date === today && isDaily(d))) {
    return buildSummary(currentRange);
  }

  const multiplier = incomeMultiplier(state.incomeRange);
  let effectiveDelta: number;
  let effectiveMonthly: number;
  let effectiveYearly: number;

  // Primero intentar legacy rules
  const rule = DAILY_DECISION_RULES.find(
    (r) => r.questionId === questionId && r.answerKey === answerKey,
  );

  if (rule) {
    // Legacy question pool
    const baseDelta = customAmount != null && customAmount > 0 ? customAmount : rule.immediateDelta;
    effectiveDelta = Math.round(baseDelta * multiplier * 100) / 100;
    effectiveMonthly = Math.round(rule.monthlyProjection * multiplier * 100) / 100;
    effectiveYearly = Math.round(rule.yearlyProjection * multiplier * 100) / 100;
  } else {
    // Bank question (formato importe): el usuario introduce cuánto ha ahorrado
    const bankQ = getQuestionById(questionId);
    const savedAmount = customAmount != null && customAmount > 0 ? customAmount : 0;
    effectiveDelta = Math.round(savedAmount * multiplier * 100) / 100;
    effectiveMonthly = bankQ ? Math.round(bankQ.monthlyDelta * multiplier * 100) / 100 : 0;
    effectiveYearly = bankQ ? Math.round(bankQ.yearlyDelta * multiplier * 100) / 100 : 0;
  }

  const now = new Date().toISOString();
  state.decisions.push({
    id: `dec_${Date.now()}`,
    date: today,
    questionId,
    answerKey,
    goalId,
    deltaAmount: effectiveDelta,
    monthlyProjection: effectiveMonthly,
    yearlyProjection: effectiveYearly,
    createdAt: now,
  });

  const goal = state.goals.find((g) => g.id === goalId);
  if (goal) {
    goal.currentAmount += effectiveDelta;
    goal.updatedAt = now;
  }

  persistStore(state);
  return buildSummary(currentRange);
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
