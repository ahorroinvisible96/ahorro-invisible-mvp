import { Goal } from './goal';

/**
 * Daily status information
 */
export interface DailyStatusInfo {
  /**
   * Current date in YYYY-MM-DD format
   */
  date: string;
  
  /**
   * Status of the daily decision
   */
  status: 'pending' | 'completed';
  
  /**
   * Decision ID if status is completed
   */
  decision_id: string | null;
}

/**
 * Savings evolution data point
 */
export interface SavingsDataPoint {
  /**
   * Date in YYYY-MM-DD format
   */
  date: string;
  
  /**
   * Amount saved on this date
   */
  amount: number;
}

/**
 * Savings evolution data
 */
export interface SavingsEvolution {
  /**
   * Data points for the chart
   */
  points: SavingsDataPoint[];
  
  /**
   * Whether the data is in demo mode
   */
  mode: 'demo' | 'live';
  
  /**
   * Current range being displayed
   */
  range: '7d' | '30d' | '90d';
}

/**
 * Dashboard summary response from API
 */
export interface DashboardSummaryResponse {
  /**
   * Primary goal information
   */
  primary_goal: Goal | null;
  
  /**
   * List of all active goals
   */
  goals: Goal[];
  
  /**
   * Daily decision status
   */
  daily: DailyStatusInfo;
  
  /**
   * Savings evolution data
   */
  savings_evolution: SavingsEvolution;
  
  /**
   * User's income range from onboarding
   */
  income_range: string | null;
  
  /**
   * Count of active goals
   */
  goals_count_active: number;
  
  /**
   * Whether the system is active
   */
  system_active: boolean;
}
