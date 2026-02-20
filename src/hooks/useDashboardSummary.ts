"use client";

import { useState, useCallback, useEffect } from 'react';
import type { DashboardSummary, IncomeRange } from '@/types/Dashboard';
import {
  buildSummary,
  storeUpdateIncome,
  storeCreateGoal,
  storeArchiveGoal,
  storeSetPrimaryGoal,
  storeSubmitDecision,
} from '@/services/dashboardStore';

type CreateGoalInput = {
  title: string;
  targetAmount: number;
  currentAmount: number;
  horizonMonths: number;
  isPrimary: boolean;
};

type UseDashboardSummaryReturn = {
  summary: DashboardSummary | null;
  loading: boolean;
  error: string | null;
  range: '7d' | '30d' | '90d';
  changeRange: (r: '7d' | '30d' | '90d') => void;
  refresh: () => void;
  updateIncome: (range: IncomeRange) => void;
  createGoal: (data: CreateGoalInput) => void;
  archiveGoal: (goalId: string) => void;
  setPrimaryGoal: (goalId: string) => void;
  submitDecision: (questionId: string, answerKey: string, goalId: string) => void;
};

export function useDashboardSummary(): UseDashboardSummaryReturn {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    setSummary(buildSummary(range));
    setLoading(false);
  }, [range]);

  const changeRange = useCallback((r: '7d' | '30d' | '90d') => {
    setRange(r);
    setSummary(buildSummary(r));
  }, []);

  const refresh = useCallback(() => {
    setSummary(buildSummary(range));
  }, [range]);

  const updateIncome = useCallback((incomeRange: IncomeRange) => {
    setSummary(storeUpdateIncome(incomeRange, range));
  }, [range]);

  const createGoal = useCallback((data: CreateGoalInput) => {
    setSummary(storeCreateGoal(data, range));
  }, [range]);

  const archiveGoal = useCallback((goalId: string) => {
    setSummary(storeArchiveGoal(goalId, range));
  }, [range]);

  const setPrimaryGoal = useCallback((goalId: string) => {
    setSummary(storeSetPrimaryGoal(goalId, range));
  }, [range]);

  const submitDecision = useCallback((questionId: string, answerKey: string, goalId: string) => {
    setSummary(storeSubmitDecision(questionId, answerKey, goalId, range));
  }, [range]);

  return {
    summary,
    loading,
    error,
    range,
    changeRange,
    refresh,
    updateIncome,
    createGoal,
    archiveGoal,
    setPrimaryGoal,
    submitDecision,
  };
}
