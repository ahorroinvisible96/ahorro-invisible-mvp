import type { Goal } from '@/types/Dashboard';
import type { HistoryFilters, HistoryRangeOption } from '@/hooks/useHistorySummary';

export type HistoryFiltersWidgetProps = {
  filters: HistoryFilters;
  goals: Goal[];
  categories: string[];
  onChange: (patch: Partial<HistoryFilters>) => void;
};

export type { HistoryRangeOption };
