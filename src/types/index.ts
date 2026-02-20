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
export type { DecisionImpact, DailyDecision, DailyDecisionCreateResponse } from './Impact';
export type {
  DailyStatus as DashboardDailyStatus,
  Goal as DashboardGoal,
  DailySummary,
  SavingsEvolutionPoint,
  SavingsEvolution,
  DashboardSummary,
} from './Dashboard';
export type { WidgetStatus, WidgetState } from './WidgetState';
export { widgetLoading, widgetError, widgetEmpty, widgetActive, widgetCompleted } from './WidgetState';
