import type { Goal, GoalProgress } from '@/types/Goal';
import type { WidgetState } from '@/types/WidgetState';

export interface PrimaryGoalHeroWidgetProps {
  state: WidgetState<PrimaryGoalHeroData>;
  onRetry: () => void;
  onCreateGoal: () => void;
}

export interface PrimaryGoalHeroData {
  goal: Goal;
  progress: GoalProgress;
  systemActive: boolean;
}
