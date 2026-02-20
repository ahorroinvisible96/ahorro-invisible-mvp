import { DailyDecision } from '@/types/daily';
import { ImpactSummaryWidgetState } from './ImpactSummaryWidget.types';

/**
 * Determine the widget state based on props
 * @param isLoading Loading state
 * @param error Error state
 * @param decision Decision data
 * @returns Widget state
 */
export const determineWidgetState = (
  isLoading: boolean,
  error: Error | null | undefined,
  decision: DailyDecision | null
): ImpactSummaryWidgetState => {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (!decision) return 'no_impact';
  
  // Check if impact data is available
  const hasImpact = decision.impact && 
    (decision.impact.monthly_delta !== null || 
     decision.impact.yearly_delta !== null);
  
  return hasImpact ? 'active' : 'no_impact';
};

/**
 * Format currency amount
 * @param amount Amount to format
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number | null): string => {
  if (amount === null) return '0 €';
  
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(amount);
};
