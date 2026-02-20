import type { DailyDecision } from '@/types/Impact';
import type { WidgetState } from '@/types/WidgetState';

export interface ImpactSummaryWidgetProps {
  state: WidgetState<DailyDecision>;
  onExtraSavingsClick: () => void;
  onHistoryClick: () => void;
  onRetry: () => void;
}

export interface ImpactViewedPayload {
  decision_id: string;
  question_id: string;
  answer_key: string;
  impact_available: boolean;
}
