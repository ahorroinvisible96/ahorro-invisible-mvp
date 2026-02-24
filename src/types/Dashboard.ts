export type IncomeRange = { min: number; max: number; currency: 'EUR' };

export type Goal = {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  horizonMonths: number;
  isPrimary: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
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
};
