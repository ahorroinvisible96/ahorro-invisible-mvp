"use client";

import { useState, useCallback, useEffect } from 'react';
import type { DashboardSummary, IncomeRange } from '@/types/Dashboard';
import {
  buildSummary,
  storeUpdateIncome,
  storeUpdateUserName,
  storeCreateGoal,
  storeUpdateGoal,
  storeArchiveGoal,
  storeSetPrimaryGoal,
  storeSubmitDecision,
  storeResetDecision,
  storeAddExtraSaving,
} from '@/services/dashboardStore';

type CreateGoalInput = {
  title: string;
  targetAmount: number;
  currentAmount?: number;
  horizonMonths: number;
  isPrimary?: boolean;
};

type UpdateGoalInput = Partial<Pick<CreateGoalInput, 'title' | 'targetAmount' | 'currentAmount' | 'horizonMonths' | 'isPrimary'>>;

type UseDashboardSummaryReturn = {
  summary: DashboardSummary | null;
  loading: boolean;
  error: string | null;
  range: '7d' | '30d' | '90d';
  changeRange: (r: '7d' | '30d' | '90d') => void;
  refresh: () => void;
  updateUserName: (name: string) => void;
  updateIncome: (range: IncomeRange) => void;
  createGoal: (data: CreateGoalInput) => void;
  updateGoal: (goalId: string, patch: UpdateGoalInput) => void;
  archiveGoal: (goalId: string) => void;
  setPrimaryGoal: (goalId: string) => void;
  submitDecision: (questionId: string, answerKey: string, goalId: string, customAmount?: number) => void;
  resetDecision: () => void;
  addExtraSaving: (saving: { name: string; amount: number; goalId: string }) => void;
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

  const updateUserName = useCallback((name: string) => {
    setSummary(storeUpdateUserName(name, range));
  }, [range]);

  const updateIncome = useCallback((incomeRange: IncomeRange) => {
    setSummary(storeUpdateIncome(incomeRange, range));
  }, [range]);

  const createGoal = useCallback((data: CreateGoalInput) => {
    setSummary(storeCreateGoal({ ...data, currentAmount: data.currentAmount ?? 0 }, range));
  }, [range]);

  const updateGoal = useCallback((goalId: string, patch: UpdateGoalInput) => {
    setSummary(storeUpdateGoal(goalId, patch, range));
  }, [range]);

  const archiveGoal = useCallback((goalId: string) => {
    setSummary(storeArchiveGoal(goalId, range));
  }, [range]);

  const setPrimaryGoal = useCallback((goalId: string) => {
    setSummary(storeSetPrimaryGoal(goalId, range));
  }, [range]);

  const submitDecision = useCallback((questionId: string, answerKey: string, goalId: string, customAmount?: number) => {
    setSummary(storeSubmitDecision(questionId, answerKey, goalId, range, customAmount));
  }, [range]);

  const resetDecision = useCallback(() => {
    setSummary(storeResetDecision(range));
  }, [range]);

  const addExtraSaving = useCallback((saving: { name: string; amount: number; goalId: string }) => {
    setSummary(storeAddExtraSaving(saving.name, saving.amount, saving.goalId, range));
  }, [range]);

  return {
    summary,
    loading,
    error,
    range,
    changeRange,
    refresh,
    updateUserName,
    updateIncome,
    createGoal,
    updateGoal,
    archiveGoal,
    setPrimaryGoal,
    submitDecision,
    resetDecision,
    addExtraSaving,
  };
}
