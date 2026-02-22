import type { Goal } from '@/types/Dashboard';

export type PrimaryGoalHeroProps = {
  goal: Goal | null;
  estimatedMonthsRemaining?: number | null;
  dailyCompleted: boolean;
  onCreateGoal: () => void;
  onOpenGoal: (goalId: string) => void;
  onGoToDailyDecision: () => void;
  onAddExtraSaving: () => void;
  onGoToHistory: () => void;
};

export type GoalDisplayData = {
  progressRatio: number;
  progressPct: number;
  remainingAmount: number;
  isCompleted: boolean;
};
