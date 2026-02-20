import type { DailyStatus } from '@/types/DailyQuestion';
import type { WidgetState } from '@/types/WidgetState';

export interface MotivationCardWidgetProps {
  dailyState: WidgetState<DailyStatus>;
  onCtaClick: (destination: 'daily_question' | 'impact') => void;
  onCreateGoal: () => void;
  hasGoals: boolean;
}

export interface MotivationCtaClickedPayload {
  daily_status: 'pending' | 'completed';
  destination: 'daily_question' | 'impact';
}
