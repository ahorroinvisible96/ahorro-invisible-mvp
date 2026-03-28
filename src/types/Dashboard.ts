export type IncomeRange = { min: number; max: number; currency: 'EUR' };

export type SavingsProfile = 'low' | 'medium' | 'high';

export type AdaptiveEvaluation = {
  type: 'increase' | 'maintain' | 'decrease';
  newPercent: number;
  message: string;
};

export type Goal = {
  id: string;
  title: string;
  targetAmount: number;
  finalGoalAmount?: number;
  currentAmount: number;
  horizonMonths: number;
  isPrimary: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  source?: 'onboarding' | 'dashboard';
  completedAt?: string | null;
  startDate?: string;
  targetDate?: string;
  isUnrealistic?: boolean;
  subGoalIndex?: number;
};

export type DailyStatus = 'pending' | 'completed';

export type DailyDecisionRule = {
  questionId: string;
  answerKey: string;
  immediateDelta: number;
  monthlyProjection: number;
  yearlyProjection: number;
  category: string;
  impactType: 'real' | 'avoided' | 'optimization';
  allowCustomAmount?: boolean;
};

export type DailyDecision = {
  id: string;
  date: string;
  questionId: string;
  answerKey: string;
  goalId: string;
  deltaAmount: number;
  monthlyProjection: number;
  yearlyProjection: number;
  createdAt: string;
};

export type SavingsEvolutionPoint = {
  date: string;
  value: number;
};

export type Hucha = {
  balance: number;
  entries: { amount: number; fromGoalId: string; fromGoalTitle: string; date: string }[];
};

export type DashboardSummary = {
  userName: string;
  userEmail: string;
  moneyFeeling: string | null;
  systemActive: boolean;
  incomeRange: IncomeRange | null;
  goals: Goal[];
  primaryGoal: Goal | null;
  daily: { date: string; status: DailyStatus; decisionId: string | null };
  savingsEvolution: {
    range: '7d' | '30d' | '90d';
    mode: 'demo' | 'live';
    points: SavingsEvolutionPoint[];
  };
  intensity: 'low' | 'medium' | 'high' | 'unknown';
  avgMonthlySavings: number;
  estimatedMonthsRemaining: number | null;
  streak: number;
  totalSaved: number;
  hucha: Hucha;
  newMilestone: number | null;
  streakBrokeYesterday: boolean;
  graceAvailable: boolean;
  savingsProfile: SavingsProfile | null;
  savingsPercent: number;
  goalPercentMilestone: { goalId: string; goalTitle: string; percent: 25 | 50 | 75 | 100 } | null;
  adaptiveEvaluation: AdaptiveEvaluation | null;
  lowActivityAlert: boolean;
};
