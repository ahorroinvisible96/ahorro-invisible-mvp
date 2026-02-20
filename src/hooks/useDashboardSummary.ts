"use client";

import { useState, useCallback } from 'react';
import type { DashboardSummary } from '@/types/Dashboard';
import { getMockDashboardSummary } from '@/services/dashboard.mock';

type UseDashboardSummaryReturn = {
  summary: DashboardSummary | null;
  loading: boolean;
  error: string | null;
  range: '7d' | '30d' | '90d';
  changeRange: (r: '7d' | '30d' | '90d') => void;
  refresh: () => void;
};

export function useDashboardSummary(): UseDashboardSummaryReturn {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [summary, setSummary] = useState<DashboardSummary | null>(() =>
    getMockDashboardSummary('30d')
  );
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  const changeRange = useCallback((r: '7d' | '30d' | '90d') => {
    setRange(r);
    setSummary(getMockDashboardSummary(r));
  }, []);

  const refresh = useCallback(() => {
    setSummary(getMockDashboardSummary(range));
  }, [range]);

  return { summary, loading, error, range, changeRange, refresh };
}
