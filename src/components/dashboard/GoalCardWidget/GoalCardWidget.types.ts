import type { Goal } from '@/types/Dashboard';

export type GoalCardWidgetProps = {
  goal: Goal;
  onOpenGoal: (goalId: string) => void;
  onArchiveGoal: (goalId: string) => Promise<void>;
  onEditGoal?: (goalId: string) => void;
};
