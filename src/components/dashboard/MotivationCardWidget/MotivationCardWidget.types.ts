import { DailyStatusInfo } from '@/types/dashboard';

/**
 * Props for MotivationCardWidget
 */
export interface MotivationCardWidgetProps {
  /**
   * Daily status information for CTA
   */
  dailyStatus: DailyStatusInfo | null;
  
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
 * States for MotivationCardWidget
 */
export type MotivationCardWidgetState = 
  | 'active'
  | 'disabled';
