import { DailyDecision } from '@/types/daily';

/**
 * Props for ImpactSummaryWidget
 */
export interface ImpactSummaryWidgetProps {
  /**
   * Decision data
   */
  decision: DailyDecision | null;
  
  /**
   * Whether the user has extra savings actions available
   */
  hasExtraSavingsAvailable?: boolean;
  
  /**
   * Loading state
   */
  isLoading?: boolean;
  
  /**
   * Error state
   */
  error?: Error | null;
  
  /**
   * Callback when extra savings button is clicked
   */
  onExtraSavingsClick?: () => void;
  
  /**
   * Callback when history button is clicked
   */
  onHistoryClick?: () => void;
}

/**
 * States for ImpactSummaryWidget
 */
export type ImpactSummaryWidgetState = 
  | 'loading'
  | 'error'
  | 'no_impact'
  | 'active';
