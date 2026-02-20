export type DailyStatus = 'pending' | 'completed';

export type Goal = {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  horizonMonths: number;
  isPrimary: boolean;
  archived: boolean;
};

export type DailySummary = {
  date: string;
  status: DailyStatus;
  decisionId: string | null;
};

export type SavingsEvolutionPoint = {
  date: string;
  value: number;
};

export type SavingsEvolution = {
  range: '7d' | '30d' | '90d';
  mode: 'demo' | 'live';
  points: SavingsEvolutionPoint[];
};

export type DashboardSummary = {
  userName: string;
  systemActive: boolean;
  incomeRange: string | null;
  primaryGoal: Goal | null;
  goals: Goal[];
  daily: DailySummary;
  savingsEvolution: SavingsEvolution;
};
