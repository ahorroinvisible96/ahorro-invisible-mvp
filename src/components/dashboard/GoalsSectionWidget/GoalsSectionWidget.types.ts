import type { ReactNode } from 'react';

export type GoalsSectionWidgetProps = {
  goalsCount: number;
  onCreateGoal: () => void;
  children?: ReactNode;
};
