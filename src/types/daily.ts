/**
 * Daily question option model
 */
export interface DailyQuestionOption {
  /**
   * Unique key for the answer
   */
  answer_key: string;
  
  /**
   * Display label for the option
   */
  label: string;
}

/**
 * Daily question model
 */
export interface DailyQuestion {
  /**
   * Unique identifier for the question
   */
  question_id: string;
  
  /**
   * Question text
   */
  text: string;
  
  /**
   * Available answer options
   */
  options: DailyQuestionOption[];
}

/**
 * Daily question response when status is pending
 */
export interface DailyQuestionResponsePending {
  /**
   * Date in YYYY-MM-DD format
   */
  date: string;
  
  /**
   * Question data
   */
  question: DailyQuestion;
  
  /**
   * Status indicator
   */
  status: 'pending';
}

/**
 * Daily question response when status is completed
 */
export interface DailyQuestionResponseCompleted {
  /**
   * Date in YYYY-MM-DD format
   */
  date: string;
  
  /**
   * Question data
   */
  question: DailyQuestion;
  
  /**
   * Status indicator
   */
  status: 'completed';
  
  /**
   * ID of the completed decision
   */
  decision_id: string;
}

/**
 * Combined daily question response type
 */
export type DailyQuestionResponse =
  | DailyQuestionResponsePending
  | DailyQuestionResponseCompleted;

/**
 * Decision impact model
 */
export interface DecisionImpact {
  /**
   * Question ID this impact relates to
   */
  question_id: string;
  
  /**
   * Answer key this impact relates to
   */
  answer_key: string;
  
  /**
   * Monthly financial impact
   */
  monthly_delta: number | null;
  
  /**
   * Yearly financial impact
   */
  yearly_delta: number | null;
  
  /**
   * Optional motivational label
   */
  label: string | null;
}

/**
 * Daily decision model
 */
export interface DailyDecision {
  /**
   * Unique identifier
   */
  id: string;
  
  /**
   * Date in YYYY-MM-DD format
   */
  date: string;
  
  /**
   * Question ID this decision relates to
   */
  question_id: string;
  
  /**
   * Selected answer key
   */
  answer_key: string;
  
  /**
   * Goal ID this decision is associated with
   */
  goal_id: string;
  
  /**
   * Impact data for this decision
   */
  impact: DecisionImpact;
  
  /**
   * Creation timestamp
   */
  created_at: string;
}

/**
 * Request to create a daily decision
 */
export interface DailyDecisionCreateRequest {
  /**
   * Date in YYYY-MM-DD format
   */
  date: string;
  
  /**
   * Question ID
   */
  question_id: string;
  
  /**
   * Selected answer key
   */
  answer_key: string;
  
  /**
   * Goal ID to associate with
   */
  goal_id: string;
}

/**
 * Response from creating a daily decision
 */
export interface DailyDecisionCreateResponse {
  /**
   * Created decision data
   */
  decision: DailyDecision;
}
