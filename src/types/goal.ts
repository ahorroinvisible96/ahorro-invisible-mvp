export type GoalId = string;

export interface Goal {
  id: GoalId;
  title: string;
  target_amount: number;
  current_amount: number;
  time_horizon_months: number | null;
  is_primary: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface GoalProgress {
  goal_id: GoalId;
  progress_ratio: number;
  progress_percent: number;
  remaining_amount: number;
  current_amount: number;
  target_amount: number;
}
