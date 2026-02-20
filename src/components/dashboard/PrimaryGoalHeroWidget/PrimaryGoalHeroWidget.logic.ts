import type { Goal } from '@/types/Dashboard';
import type { GoalDisplayData } from './PrimaryGoalHeroWidget.types';

export function computeProgressRatio(goal: Goal): number {
  if (goal.targetAmount <= 0) return 0;
  return Math.min(goal.currentAmount / goal.targetAmount, 1);
}

export function computePctRounded(goal: Goal): number {
  return Math.round(computeProgressRatio(goal) * 100);
}

export function computeRemainingAmount(goal: Goal): number {
  return Math.max(goal.targetAmount - goal.currentAmount, 0);
}

export function computeGoalDisplayData(goal: Goal): GoalDisplayData {
  const ratio = computeProgressRatio(goal);
  return {
    progressRatio: ratio,
    progressPct: Math.round(ratio * 100),
    remainingAmount: computeRemainingAmount(goal),
    isCompleted: goal.currentAmount >= goal.targetAmount,
  };
}

export function formatEUR(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}
