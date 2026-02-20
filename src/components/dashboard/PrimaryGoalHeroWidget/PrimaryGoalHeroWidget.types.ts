import type { Goal } from '@/types/Dashboard';

export type PrimaryGoalHeroProps = {
  goal: Goal | null;
  estimatedMonthsRemaining?: number | null;
  onCreateGoal: () => void;
  onOpenGoal: (goalId: string) => void;
};

export type GoalDisplayData = {
  progressRatio: number;
  progressPct: number;
  remainingAmount: number;
  isCompleted: boolean;
};
