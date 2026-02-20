import type { Goal } from '@/types/Dashboard';

export type GoalCardWidgetProps = {
  goal: Goal;
  onOpenGoal: (goalId: string) => void;
  onArchiveGoal: (goalId: string) => void;
  onSetPrimary: (goalId: string) => void;
  onEditGoal?: (goalId: string) => void;
};
