import { Goal } from '@/types/goal';

export type PrimaryGoalHeroWidgetProps = {
  /**
   * The primary goal to display
   */
  primaryGoal: Goal | null;
  
  /**
   * Loading state
   */
  isLoading?: boolean;
  
  /**
   * Error state
   */
  error?: Error | null;
  
  /**
   * Whether the system is active
   */
  isSystemActive?: boolean;
  
  /**
   * Callback when create goal button is clicked
   */
  onCreateGoalClick?: () => void;
};

export type PrimaryGoalHeroWidgetState = 
  | 'loading'
  | 'empty'
  | 'error'
  | 'active';
