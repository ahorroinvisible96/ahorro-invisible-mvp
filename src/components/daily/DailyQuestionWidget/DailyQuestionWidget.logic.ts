import { DailyQuestionWidgetState, DailyQuestionFormData } from './DailyQuestionWidget.types';
import { Goal } from '@/types/goal';
import { DailyQuestion } from '@/types/daily';

/**
 * Determine the widget state based on props
 * @param isLoading Loading state
 * @param error Error state
 * @param status Daily status
 * @returns Widget state
 */
export const determineWidgetState = (
  isLoading: boolean,
  error: Error | null | undefined,
  status: 'pending' | 'completed'
): DailyQuestionWidgetState => {
  if (isLoading) return 'loading';
  if (error) return 'error';
  return status;
};

/**
 * Validate the form data before submission
 * @param formData Form data to validate
 * @returns Error message or null if valid
 */
export const validateForm = (formData: DailyQuestionFormData): string | null => {
  if (!formData.answerKey) {
    return 'Elige una opción.';
  }
  
  if (!formData.goalId) {
    return 'Selecciona un objetivo.';
  }
  
  return null;
};

/**
 * Find the primary goal from the goals list
 * @param goals List of goals
 * @returns Primary goal or first goal if no primary goal exists
 */
export const findPrimaryGoal = (goals: Goal[]): Goal | null => {
  if (goals.length === 0) return null;
  
  const primaryGoal = goals.find(goal => goal.is_primary);
  return primaryGoal || goals[0];
};

/**
 * Find the option label by answer key
 * @param question Daily question
 * @param answerKey Answer key to find
 * @returns Option label or null if not found
 */
export const findOptionLabel = (
  question: DailyQuestion | null, 
  answerKey: string | null
): string | null => {
  if (!question || !answerKey) return null;
  
  const option = question.options.find(opt => opt.answer_key === answerKey);
  return option?.label || null;
};
