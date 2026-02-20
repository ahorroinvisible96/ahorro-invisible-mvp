import type { Goal } from '@/types/Dashboard';

export type DailyDecisionWidgetProps = {
  daily: { date: string; status: 'pending' | 'completed'; decisionId: string | null };
  primaryGoal: Goal | null;
  allGoals: Goal[];
  onSubmitDecision: (questionId: string, answerKey: string, goalId: string) => void;
  onGoToImpact: (decisionId: string) => void;
  onCreateGoal: () => void;
};

export type DailyWidgetState = 'disabled' | 'pending' | 'completed' | 'error';
