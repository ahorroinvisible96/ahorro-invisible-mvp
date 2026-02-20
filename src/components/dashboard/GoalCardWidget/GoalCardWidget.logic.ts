import type { Goal } from '@/types/Dashboard';

export function computeGoalPct(goal: Goal): number {
  if (goal.targetAmount <= 0) return 0;
  return Math.round(Math.min(goal.currentAmount / goal.targetAmount, 1) * 100);
}

export function computeGoalRemaining(goal: Goal): number {
  return Math.max(goal.targetAmount - goal.currentAmount, 0);
}

export function formatEUR(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}
