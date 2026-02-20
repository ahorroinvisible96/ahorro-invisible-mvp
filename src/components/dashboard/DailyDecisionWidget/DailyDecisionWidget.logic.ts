import type { Goal } from '@/types/Dashboard';
import type { DailyWidgetState } from './DailyDecisionWidget.types';

type DailyInput = { status: 'pending' | 'completed'; decisionId: string | null };

export function resolveDailyWidgetState(
  daily: DailyInput,
  primaryGoal: Goal | null,
): DailyWidgetState {
  if (!primaryGoal) return 'disabled';
  if (daily.status === 'completed' && !daily.decisionId) return 'error';
  if (daily.status === 'completed') return 'completed';
  return 'pending';
}
