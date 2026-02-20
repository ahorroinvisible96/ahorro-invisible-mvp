import type { DecisionId, QuestionId, AnswerKey, DailyDate } from './DailyQuestion';
import type { GoalId } from './Goal';

export interface DecisionImpact {
  question_id: QuestionId;
  answer_key: AnswerKey;
  monthly_delta: number | null;
  yearly_delta: number | null;
  label: string | null;
}

export interface DailyDecision {
  id: DecisionId;
  date: DailyDate;
  question_id: QuestionId;
  answer_key: AnswerKey;
  goal_id: GoalId;
  impact: DecisionImpact;
  created_at: string;
}

export interface DailyDecisionCreateResponse {
  decision: DailyDecision;
}
