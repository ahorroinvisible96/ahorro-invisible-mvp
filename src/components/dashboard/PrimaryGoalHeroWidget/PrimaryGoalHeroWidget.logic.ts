import type { Goal, GoalProgress } from '@/types/Goal';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computeGoalProgress(goal: Goal): GoalProgress {
  const ratio = goal.target_amount > 0
    ? clamp(goal.current_amount / goal.target_amount, 0, 1)
    : 0;

  return {
    goal_id: goal.id,
    progress_ratio: ratio,
    progress_percent: Math.round(ratio * 100),
    remaining_amount: Math.max(goal.target_amount - goal.current_amount, 0),
    current_amount: goal.current_amount,
    target_amount: goal.target_amount,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}
