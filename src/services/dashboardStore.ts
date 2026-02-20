import type {
  IncomeRange,
  Goal,
  DailyDecision,
  DailyDecisionRule,
  DashboardSummary,
  SavingsEvolutionPoint,
} from '@/types/Dashboard';

// ─── Clave de persistencia ───────────────────────────────────────────────────
const STORAGE_KEY = 'ahorro_invisible_dashboard_v1';

// ─── Motor económico ─────────────────────────────────────────────────────────
export const DAILY_DECISION_RULES: DailyDecisionRule[] = [
  { category: 'consumo',      questionId: 'coffee',       answerKey: 'no',        immediateDelta: 3,  monthlyProjection: 60,  yearlyProjection: 720,  impactType: 'avoided' },
  { category: 'consumo',      questionId: 'coffee',       answerKey: 'yes',       immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  { category: 'food',         questionId: 'delivery',     answerKey: 'no',        immediateDelta: 8,  monthlyProjection: 120, yearlyProjection: 1440, impactType: 'avoided' },
  { category: 'food',         questionId: 'delivery',     answerKey: 'yes',       immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  { category: 'transport',    questionId: 'transport',    answerKey: 'public',    immediateDelta: 5,  monthlyProjection: 80,  yearlyProjection: 960,  impactType: 'optimization' },
  { category: 'transport',    questionId: 'transport',    answerKey: 'car',       immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  { category: 'consumo',      questionId: 'impulse',      answerKey: 'avoided',   immediateDelta: 15, monthlyProjection: 150, yearlyProjection: 1800, impactType: 'avoided' },
  { category: 'consumo',      questionId: 'impulse',      answerKey: 'bought',    immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
  { category: 'subscription', questionId: 'subscription', answerKey: 'cancelled', immediateDelta: 0,  monthlyProjection: 12,  yearlyProjection: 144,  impactType: 'optimization' },
  { category: 'subscription', questionId: 'subscription', answerKey: 'kept',      immediateDelta: 0,  monthlyProjection: 0,   yearlyProjection: 0,    impactType: 'real' },
];

// ─── Preguntas diarias ────────────────────────────────────────────────────────
export type DailyQuestion = {
  questionId: string;
  text: string;
  answers: { key: string; label: string; savingsHint?: string }[];
};

export const DAILY_QUESTIONS: DailyQuestion[] = [
  {
    questionId: 'coffee',
    text: '¿Compraste café o bebida fuera de casa hoy?',
    answers: [
      { key: 'no',  label: 'No, ahorré',   savingsHint: '+3€' },
      { key: 'yes', label: 'Sí, lo compré' },
    ],
  },
  {
    questionId: 'delivery',
    text: '¿Pediste comida a domicilio hoy?',
    answers: [
      { key: 'no',  label: 'No, cociné en casa', savingsHint: '+8€' },
      { key: 'yes', label: 'Sí, lo pedí' },
    ],
  },
  {
    questionId: 'transport',
    text: '¿Cómo te movilizaste hoy?',
    answers: [
      { key: 'public', label: 'Transporte público', savingsHint: '+5€' },
      { key: 'car',    label: 'Coche / taxi' },
    ],
  },
  {
    questionId: 'impulse',
    text: '¿Evitaste una compra impulsiva hoy?',
    answers: [
      { key: 'avoided', label: 'Sí, lo evité', savingsHint: '+15€' },
      { key: 'bought',  label: 'No, compré' },
    ],
  },
  {
    questionId: 'subscription',
    text: '¿Revisaste tus suscripciones activas?',
    answers: [
      { key: 'cancelled', label: 'Cancelé una sin uso', savingsHint: '+12€/mes' },
      { key: 'kept',      label: 'Las mantuve todas' },
    ],
  },
];

// Pregunta del día determinista (basada en día del año)
export function getTodayQuestion(): DailyQuestion {
  const dayIndex = Math.floor(Date.now() / 86_400_000) % DAILY_QUESTIONS.length;
  return DAILY_QUESTIONS[dayIndex];
}

// ─── Forma interna del store ──────────────────────────────────────────────────
type StoreState = {
  userName: string;
  incomeRange: IncomeRange | null;
  goals: Goal[];
  decisions: DailyDecision[];
};

const SEED: StoreState = {
  userName: 'Usuario',
  incomeRange: null,
  goals: [],
  decisions: [],
};

// ─── I/O localStorage ─────────────────────────────────────────────────────────
function loadStore(): StoreState {
  if (typeof window === 'undefined') return structuredClone(SEED);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StoreState;
  } catch { /* fallthrough */ }
  const state = structuredClone(SEED);
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

// ─── API pública: lectura ─────────────────────────────────────────────────────
export function buildSummary(range: '7d' | '30d' | '90d' = '30d'): DashboardSummary {
  const state = loadStore();
  const today = new Date().toISOString().split('T')[0];
  const activeGoals = state.goals.filter((g) => !g.archived);
  const primaryGoal =
    activeGoals.find((g) => g.isPrimary) ?? activeGoals[0] ?? null;

  const todayDecision = state.decisions.find((d) => d.date === today) ?? null;
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

  return {
    userName: state.userName,
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
    intensity: computeIntensity(state.decisions),
    avgMonthlySavings,
    estimatedMonthsRemaining,
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
  data: Pick<Goal, 'title' | 'targetAmount' | 'currentAmount' | 'horizonMonths'> & { isPrimary?: boolean },
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  const now = new Date().toISOString();
  const activeGoals = state.goals.filter((g) => !g.archived);
  const shouldBePrimary = data.isPrimary === true || activeGoals.length === 0;
  if (shouldBePrimary) {
    state.goals = state.goals.map((g) => ({ ...g, isPrimary: false, updatedAt: now }));
  }
  state.goals.push({
    id: `goal_${Date.now()}`,
    title: data.title,
    targetAmount: data.targetAmount,
    currentAmount: data.currentAmount ?? 0,
    horizonMonths: data.horizonMonths,
    isPrimary: shouldBePrimary,
    archived: false,
    createdAt: now,
    updatedAt: now,
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
  persistStore(state);
  return buildSummary(currentRange);
}

export function storeResetAllData(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* fallthrough */ }
}

export function storeExportData(): string {
  const state = loadStore();
  return JSON.stringify(state, null, 2);
}

export function storeGetDailyForDate(date: string): { status: 'pending' | 'completed'; decisionId: string | null } {
  const state = loadStore();
  const found = state.decisions.find((d) => d.date === date) ?? null;
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

export function storeSubmitDecision(
  questionId: string,
  answerKey: string,
  goalId: string,
  currentRange: '7d' | '30d' | '90d' = '30d',
): DashboardSummary {
  const state = loadStore();
  const today = new Date().toISOString().split('T')[0];

  if (state.decisions.some((d) => d.date === today)) {
    return buildSummary(currentRange);
  }

  const rule = DAILY_DECISION_RULES.find(
    (r) => r.questionId === questionId && r.answerKey === answerKey,
  );
  if (!rule) {
    console.error(`[dashboardStore] No rule for ${questionId}/${answerKey}`);
    return buildSummary(currentRange);
  }

  const multiplier = incomeMultiplier(state.incomeRange);
  const effectiveDelta = Math.round(rule.immediateDelta * multiplier * 100) / 100;
  const effectiveMonthly = Math.round(rule.monthlyProjection * multiplier * 100) / 100;
  const effectiveYearly = Math.round(rule.yearlyProjection * multiplier * 100) / 100;

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
