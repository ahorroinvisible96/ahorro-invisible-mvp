import type { HistoryDecisionItem } from '@/hooks/useHistorySummary';

export type HistoryDecisionsListWidgetProps = {
  decisions: HistoryDecisionItem[];
  onOpenDecision: (decisionId: string) => void;
  onDeleteDecision: (decisionId: string) => void;
  onEditDecision: (decisionId: string, newAmount: number) => void;
};
