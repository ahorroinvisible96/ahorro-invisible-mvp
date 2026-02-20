import { DailyDecision } from './daily';

/**
 * Response from getting impact details
 */
export interface ImpactDetailsResponse {
  /**
   * Decision data
   */
  decision: DailyDecision;
  
  /**
   * Whether the user has extra savings actions available
   */
  has_extra_savings_available: boolean;
}
