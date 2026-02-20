import type { SavingsEvolution } from '@/types/Dashboard';

export type SavingsEvolutionWidgetProps = {
  evolution: SavingsEvolution;
  onChangeRange: (range: '7d' | '30d' | '90d') => void;
};
