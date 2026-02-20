import type {
  DailyQuestionResponse,
  DailyDecisionCreateRequest,
  AnswerKey,
  QuestionId,
  DailyDate,
} from '@/types/DailyQuestion';
import type { Goal } from '@/types/Goal';
import type { DailyDecision } from '@/types/Impact';
import type { WidgetState } from '@/types/WidgetState';

export interface DailyQuestionWidgetProps {
  questionState: WidgetState<DailyQuestionResponse>;
  goals: Goal[];
  primaryGoalId: string | null;
  onSubmit: (request: DailyDecisionCreateRequest) => Promise<DailyDecision>;
  onAnswerSelected: (payload: DailyAnswerSelectedPayload) => void;
  onCompleted: (decisionId: string) => void;
  onRetry: () => void;
  onCreateGoal: () => void;
}

export interface DailyAnswerSelectedPayload {
  date: DailyDate;
  question_id: QuestionId;
  answer_key: AnswerKey;
}

export interface DailyAnswerSubmittedPayload {
  date: DailyDate;
  question_id: QuestionId;
  answer_key: AnswerKey;
  goal_id: string;
  is_primary_goal: boolean;
}

export interface DailySubmitErrorPayload {
  date: DailyDate;
  question_id: QuestionId;
  answer_key: AnswerKey | null;
  error_code: string;
  error_message: string;
}

export interface DailyFormState {
  selectedAnswer: AnswerKey | null;
  selectedGoalId: string | null;
  isSubmitting: boolean;
  submitError: string | null;
}
