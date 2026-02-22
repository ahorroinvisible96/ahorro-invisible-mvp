import type { Goal } from '@/types/Dashboard';

export type ExtraSaving = {
  name: string;
  amount: number;
  goalId: string;
};

export type DailyDecisionWidgetProps = {
  daily: { date: string; status: 'pending' | 'completed'; decisionId: string | null };
  primaryGoal: Goal | null;
  allGoals: Goal[];
  onSubmitDecision: (questionId: string, answerKey: string, goalId: string, customAmount?: number) => void;
  onGoToImpact: (decisionId: string) => void;
  onCreateGoal: () => void;
  onResetDecision?: () => void;
  onAddExtraSaving?: (saving: ExtraSaving) => void;
  onGoToHistory?: () => void;
};

export type DailyWidgetState = 'disabled' | 'pending' | 'completed' | 'error';
