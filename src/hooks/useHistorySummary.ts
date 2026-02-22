"use client";

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { DailyDecision, Goal } from '@/types/Dashboard';
import {
  DAILY_QUESTIONS,
  DAILY_DECISION_RULES,
  storeDeleteDecision,
  storeEditDecision,
} from '@/services/dashboardStore';

const STORAGE_KEY = 'ahorro_invisible_dashboard_v1';

export type HistoryRangeOption = 'all' | '7d' | '30d' | '90d';

export type HistoryFilters = {
  range: HistoryRangeOption;
  goalId: string;
  category: string;
};

export type HistoryDecisionItem = DailyDecision & {
  questionText: string;
  answerLabel: string;
  goalTitle: string;
  category: string;
  isExtra: boolean;
};

const CUTOFF_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

function getQuestionText(questionId: string): string {
  if (questionId === 'extra_saving') return 'Ahorro extra';
  return DAILY_QUESTIONS.find((q) => q.questionId === questionId)?.text ?? questionId;
}

function getAnswerLabel(questionId: string, answerKey: string): string {
  if (questionId === 'extra_saving') return answerKey;
  const q = DAILY_QUESTIONS.find((q) => q.questionId === questionId);
  return q?.answers.find((a) => a.key === answerKey)?.label ?? answerKey;
}

function getCategory(questionId: string, answerKey: string): string {
  if (questionId === 'extra_saving') return 'extra';
  return DAILY_DECISION_RULES.find(
    (r) => r.questionId === questionId && r.answerKey === answerKey,
  )?.category ?? 'otro';
}

type UseHistorySummaryReturn = {
  decisions: HistoryDecisionItem[];
  goals: Goal[];
  categories: string[];
  filters: HistoryFilters;
  setFilters: (f: Partial<HistoryFilters>) => void;
  filtered: HistoryDecisionItem[];
  totalSaved: number;
  loading: boolean;
  deleteDecision: (id: string) => void;
  editDecision: (id: string, newAmount: number) => void;
};

export function useHistorySummary(): UseHistorySummaryReturn {
  const [decisions, setDecisions] = useState<HistoryDecisionItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFiltersState] = useState<HistoryFilters>({
    range: 'all',
    goalId: 'all',
    category: 'all',
  });

  const loadData = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { decisions: DailyDecision[]; goals: Goal[] };
        const activeGoals = parsed.goals.filter((g) => !g.archived);
        const goalMap: Record<string, string> = {};
        activeGoals.forEach((g) => { goalMap[g.id] = g.title; });

        const items: HistoryDecisionItem[] = [...parsed.decisions]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((d) => ({
            ...d,
            questionText: getQuestionText(d.questionId),
            answerLabel: getAnswerLabel(d.questionId, d.answerKey),
            goalTitle: goalMap[d.goalId] ?? '',
            category: getCategory(d.questionId, d.answerKey),
            isExtra: d.questionId === 'extra_saving',
          }));

        setDecisions(items);
        setGoals(activeGoals);
      }
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const categories = useMemo(() => {
    const cats = new Set(decisions.map((d) => d.category));
    return Array.from(cats);
  }, [decisions]);

  const filtered = useMemo(() => {
    let result = decisions;
    if (filters.goalId !== 'all') result = result.filter((d) => d.goalId === filters.goalId);
    if (filters.range !== 'all') {
      const days = CUTOFF_DAYS[filters.range];
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0];
      result = result.filter((d) => d.date >= cutoff);
    }
    if (filters.category !== 'all') result = result.filter((d) => d.category === filters.category);
    return result;
  }, [decisions, filters]);

  const totalSaved = useMemo(() => filtered.reduce((s, d) => s + d.deltaAmount, 0), [filtered]);

  const setFilters = useCallback((patch: Partial<HistoryFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const deleteDecision = useCallback((id: string) => {
    storeDeleteDecision(id);
    loadData();
  }, [loadData]);

  const editDecision = useCallback((id: string, newAmount: number) => {
    storeEditDecision(id, newAmount);
    loadData();
  }, [loadData]);

  return {
    decisions,
    goals,
    categories,
    filters,
    setFilters,
    filtered,
    totalSaved,
    loading,
    deleteDecision,
    editDecision,
  };
}
