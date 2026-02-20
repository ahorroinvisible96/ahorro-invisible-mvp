import type { SavingsEvolutionPoint } from '@/types/Dashboard';

export type SavingsEvolutionData = {
  range: '7d' | '30d' | '90d';
  mode: 'demo' | 'live';
  points: SavingsEvolutionPoint[];
};

export type SavingsEvolutionWidgetProps = {
  evolution: SavingsEvolutionData;
  onChangeRange: (range: '7d' | '30d' | '90d') => void;
};
