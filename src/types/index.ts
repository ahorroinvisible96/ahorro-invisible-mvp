export type { Goal, GoalId, GoalProgress } from './Goal';
export type {
  AnswerKey,
  QuestionId,
  DecisionId,
  DailyDate,
  DailyQuestionOption,
  DailyQuestion,
  DailyQuestionResponsePending,
  DailyQuestionResponseCompleted,
  DailyQuestionResponse,
  DailyDecisionCreateRequest,
  DailyStatus,
} from './DailyQuestion';
export type { DecisionImpact, DailyDecision as ImpactDailyDecision, DailyDecisionCreateResponse } from './Impact';
export type {
  IncomeRange,
  Goal as DashboardGoal,
  DailyDecisionRule,
  DailyDecision,
  SavingsEvolutionPoint,
  DashboardSummary,
} from './Dashboard';
export type { WidgetStatus, WidgetState } from './WidgetState';
export { widgetLoading, widgetError, widgetEmpty, widgetActive, widgetCompleted } from './WidgetState';
