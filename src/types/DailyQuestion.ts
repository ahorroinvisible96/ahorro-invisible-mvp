export type AnswerKey = string;
export type QuestionId = string;
export type DecisionId = string;
export type DailyDate = string; // YYYY-MM-DD

export interface DailyQuestionOption {
  answer_key: AnswerKey;
  label: string;
}

export interface DailyQuestion {
  question_id: QuestionId;
  text: string;
  options: DailyQuestionOption[];
}

export interface DailyQuestionResponsePending {
  date: DailyDate;
  question: DailyQuestion;
  status: 'pending';
}

export interface DailyQuestionResponseCompleted {
  date: DailyDate;
  question: DailyQuestion;
  status: 'completed';
  decision_id: DecisionId;
}

export type DailyQuestionResponse =
  | DailyQuestionResponsePending
  | DailyQuestionResponseCompleted;

export interface DailyDecisionCreateRequest {
  date: DailyDate;
  question_id: QuestionId;
  answer_key: AnswerKey;
  goal_id: string;
}

export interface DailyStatus {
  date: DailyDate;
  status: 'pending' | 'completed';
  decision_id: DecisionId | null;
}
