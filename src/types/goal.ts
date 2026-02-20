/**
 * Goal model representing a user's financial goal
 */
export interface Goal {
  /**
   * Unique identifier for the goal
   */
  id: string;
  
  /**
   * Title of the goal
   */
  title: string;
  
  /**
   * Target amount to save
   */
  target_amount: number;
  
  /**
   * Current amount saved
   */
  current_amount: number;
  
  /**
   * Time horizon in months (optional)
   */
  time_horizon_months: number | null;
  
  /**
   * Whether this is the primary goal
   */
  is_primary: boolean;
  
  /**
   * Whether the goal is archived
   */
  archived: boolean;
  
  /**
   * Creation timestamp
   */
  created_at: string;
  
  /**
   * Last update timestamp
   */
  updated_at: string;
}
