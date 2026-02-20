import { SavingsEvolution } from '@/types/dashboard';
import { SavingsEvolutionWidgetState } from './SavingsEvolutionWidget.types';

/**
 * Determine the widget state based on props
 * @param isLoading Loading state
 * @param error Error state
 * @param savingsEvolution Savings evolution data
 * @returns Widget state
 */
export const determineWidgetState = (
  isLoading: boolean,
  error: Error | null | undefined,
  savingsEvolution: SavingsEvolution | null
): SavingsEvolutionWidgetState => {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (!savingsEvolution || savingsEvolution.points.length === 0) return 'empty';
  return 'active';
};

/**
 * Get the destination for the CTA based on daily status
 * @param status Daily status
 * @returns Destination path
 */
export const getCtaDestination = (status: 'pending' | 'completed'): string => {
  return status === 'pending' ? '/daily' : '/impact';
};

/**
 * Get the CTA text based on daily status
 * @param status Daily status
 * @returns CTA text
 */
export const getCtaText = (status: 'pending' | 'completed'): string => {
  return status === 'pending' ? 'Responder ahora' : 'Ver impacto';
};
