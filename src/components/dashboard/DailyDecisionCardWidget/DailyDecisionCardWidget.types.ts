/**
 * Daily decision status
 */
export type DailyStatus = 'pending' | 'completed';

/**
 * Props for DailyDecisionCardWidget
 */
export interface DailyDecisionCardWidgetProps {
  /**
   * Current status of the daily decision
   */
  status: DailyStatus;
  
  /**
   * Decision ID if status is completed
   */
  decisionId: string | null;
  
  /**
   * Whether the widget is in loading state
   */
  isLoading?: boolean;
  
  /**
   * Whether the widget is disabled (no primary goal)
   */
  isDisabled?: boolean;
  
  /**
   * Callback when CTA button is clicked
   */
  onCtaClick?: () => void;
  
  /**
   * Callback when create goal button is clicked (for disabled state)
   */
  onCreateGoalClick?: () => void;
}

/**
 * States for DailyDecisionCardWidget
 */
export type DailyDecisionCardWidgetState = 
  | 'loading'
  | 'active'
  | 'disabled';
