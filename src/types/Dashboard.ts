import type { Goal } from './Goal';
import type { DailyStatus } from './DailyQuestion';

export type SavingsRange = '7d' | '30d' | '90d';
export type SavingsMode = 'demo' | 'live';

export interface SavingsDataPoint {
  date: string;
  amount: number;
}

export interface SavingsEvolutionData {
  range: SavingsRange;
  mode: SavingsMode;
  points: SavingsDataPoint[];
}

export interface DashboardSummaryResponse {
  primary_goal: Goal | null;
  goals_active: Goal[];
  goals_count_active: number;
  has_income_range: boolean;
  daily: DailyStatus;
  savings_evolution: SavingsEvolutionData;
}
