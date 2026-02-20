import type { SavingsEvolutionData, SavingsRange } from '@/types/Dashboard';
import type { WidgetState } from '@/types/WidgetState';
import type { DailyStatus } from '@/types/DailyQuestion';

export interface SavingsEvolutionWidgetProps {
  state: WidgetState<SavingsEvolutionData>;
  daily: DailyStatus | null;
  onRangeChange: (range: SavingsRange) => void;
  onCtaClick: (destination: 'daily_question' | 'impact') => void;
}

export interface RangeChangedPayload {
  range: SavingsRange;
  mode: 'demo' | 'live';
}
