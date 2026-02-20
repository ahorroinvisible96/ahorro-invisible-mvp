import type { DailyStatus } from '@/types/DailyQuestion';
import type { WidgetState } from '@/types/WidgetState';

export type DailyCardDestination = 'daily_question' | 'impact';

export interface DailyDecisionCardWidgetProps {
  state: WidgetState<DailyStatus>;
  onCtaClick: (destination: DailyCardDestination) => void;
  onCreateGoal: () => void;
}

export interface DailyCtaClickedPayload {
  daily_status: 'pending' | 'completed';
  destination: DailyCardDestination;
}
