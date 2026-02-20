import type { Goal, DailySummary } from '@/types/Dashboard';

export type DailyDecisionWidgetProps = {
  daily: DailySummary;
  primaryGoal: Goal | null;
  onGoToDailyQuestion: () => void;
  onGoToImpact: (decisionId: string) => void;
  onCreateGoal: () => void;
};

export type DailyWidgetState =
  | 'disabled'
  | 'pending'
  | 'completed'
  | 'error';
