import { Goal } from '@/types/goal';
import { PrimaryGoalHeroWidgetState } from './PrimaryGoalHeroWidget.types';

/**
 * Calculate the progress ratio for a goal
 * @param currentAmount Current amount saved
 * @param targetAmount Target amount to save
 * @returns Progress ratio clamped between 0 and 1
 */
export const calculateProgressRatio = (currentAmount: number, targetAmount: number): number => {
  if (targetAmount <= 0) return 0;
  const ratio = currentAmount / targetAmount;
  return Math.max(0, Math.min(1, ratio));
};

/**
 * Calculate the remaining amount to save
 * @param currentAmount Current amount saved
 * @param targetAmount Target amount to save
 * @returns Remaining amount, always >= 0
 */
export const calculateRemainingAmount = (currentAmount: number, targetAmount: number): number => {
  return Math.max(0, targetAmount - currentAmount);
};

/**
 * Determine the widget state based on props
 * @param isLoading Loading state
 * @param error Error state
 * @param primaryGoal Primary goal data
 * @returns Widget state
 */
export const determineWidgetState = (
  isLoading: boolean,
  error: Error | null | undefined,
  primaryGoal: Goal | null
): PrimaryGoalHeroWidgetState => {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (!primaryGoal) return 'empty';
  return 'active';
};

/**
 * Format currency amount
 * @param amount Amount to format
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(amount);
};
