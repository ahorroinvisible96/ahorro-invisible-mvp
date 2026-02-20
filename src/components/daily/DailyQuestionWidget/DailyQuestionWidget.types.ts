import { Goal } from '@/types/goal';
import { DailyQuestion, DailyDecision } from '@/types/daily';

/**
 * Props for DailyQuestionWidget
 */
export interface DailyQuestionWidgetProps {
  /**
   * Current date in YYYY-MM-DD format
   */
  date: string;
  
  /**
   * Question data
   */
  question: DailyQuestion | null;
  
  /**
   * Status of the daily question
   */
  status: 'pending' | 'completed';
  
  /**
   * Decision ID if status is completed
   */
  decisionId: string | null;
  
  /**
   * Available goals to assign the decision to
   */
  goals: Goal[];
  
  /**
   * Primary goal ID
   */
  primaryGoalId: string | null;
  
  /**
   * Loading state
   */
  isLoading?: boolean;
  
  /**
   * Error state
   */
  error?: Error | null;
  
  /**
   * Callback when answer is selected
   */
  onAnswerSelect?: (answerKey: string) => void;
  
  /**
   * Callback when goal is selected
   */
  onGoalSelect?: (goalId: string) => void;
  
  /**
   * Callback when form is submitted
   */
  onSubmit?: () => void;
  
  /**
   * Callback when view impact button is clicked
   */
  onViewImpact?: () => void;
}

/**
 * States for DailyQuestionWidget
 */
export type DailyQuestionWidgetState = 
  | 'loading'
  | 'error'
  | 'pending'
  | 'completed';

/**
 * Form data for DailyQuestionWidget
 */
export interface DailyQuestionFormData {
  /**
   * Selected answer key
   */
  answerKey: string | null;
  
  /**
   * Selected goal ID
   */
  goalId: string | null;
}
