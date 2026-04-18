import type { Goal } from '@/types/Dashboard';

export type PrimaryGoalHeroProps = {
  goal: Goal | null;
  estimatedMonthsRemaining?: number | null;
  avgMonthlySavings?: number;
  dailyCompleted: boolean;
  onCreateGoal: () => void;
  onOpenGoal: (goalId: string) => void;
  onGoToDailyDecision: () => void;
  onAddExtraSaving: () => void;
  onGoToHistory: () => void;
  onEditGoal?: (goalId: string) => void;
  variant?: 'default' | 'header';
  phaseLabel?: string | null; // ej. "Fase 1 de 5 · Semana 1"
};

export type GoalDisplayData = {
  progressRatio: number;
  progressPct: number;
  remainingAmount: number;
  isCompleted: boolean;
};
