import type { Goal, DailySummary } from '@/types/Dashboard';
import type { DailyWidgetState } from './DailyDecisionWidget.types';

export function resolveDailyWidgetState(
  daily: DailySummary,
  primaryGoal: Goal | null
): DailyWidgetState {
  if (!primaryGoal) return 'disabled';
  if (daily.status === 'completed' && !daily.decisionId) return 'error';
  if (daily.status === 'completed') return 'completed';
  return 'pending';
}
