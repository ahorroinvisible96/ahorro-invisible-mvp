import type { IncomeRange } from '@/types/Dashboard';

export type IncomeRangeWidgetProps = {
  incomeRange: IncomeRange | null;
  onSaveIncomeRange: (range: IncomeRange) => void;
};

export type { IncomeRange };
