import { SavingsEvolution, DailyStatusInfo } from '@/types/dashboard';

/**
 * Range options for the savings evolution chart
 */
export type SavingsRange = '7d' | '30d' | '90d';

/**
 * Props for SavingsEvolutionWidget
 */
export interface SavingsEvolutionWidgetProps {
  /**
   * Savings evolution data
   */
  savingsEvolution: SavingsEvolution | null;
  
  /**
   * Daily status information for CTA
   */
  dailyStatus: DailyStatusInfo | null;
  
  /**
   * Loading state
   */
  isLoading?: boolean;
  
  /**
   * Error state
   */
  error?: Error | null;
  
  /**
   * Callback when range is changed
   */
  onRangeChange?: (range: SavingsRange) => void;
  
  /**
   * Callback when CTA is clicked
   */
  onCtaClick?: () => void;
}

/**
 * States for SavingsEvolutionWidget
 */
export type SavingsEvolutionWidgetState = 
  | 'loading'
  | 'empty'
  | 'error'
  | 'active';
