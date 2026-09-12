"use client";

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { DailyDecision, Goal } from '@/types/Dashboard';
import {
  storeDeleteDecision,
  storeEditDecision,
} from '@/services/dashboardStore';
import { QUESTIONS_BANK } from '@/services/dailyQuestionsBank';

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

/**
 * Resuelve el texto humano de una pregunta desde el banco v2.
 * NUNCA devuelve un ID técnico al usuario.
 */
function getQuestionText(questionId: string): string {
  if (questionId === 'extra_saving') return 'Ahorro añadido manualmente';
  if (questionId === 'grace_day') return 'Día de gracia';

  const bankQ = QUESTIONS_BANK.find((q) => q.id === questionId);
  if (bankQ) return bankQ.text.replace('[___]', '...');

  // Fallback humano: nunca mostrar IDs técnicos
  if (questionId.startsWith('Q_')) return 'Decisión de ahorro';
  return questionId;
}

/**
 * Resuelve la etiqueta de respuesta a un texto legible.
 */
function getAnswerLabel(_questionId: string, answerKey: string): string {
  if (answerKey === 'zero') return 'Sin ahorro';
  if (answerKey === 'saved') return 'Ahorrado';
  if (answerKey === 'skip') return 'Omitido';
  if (answerKey === 'grace_day') return 'Día de gracia';
  const num = Number(answerKey);
  if (!isNaN(num) && answerKey !== '') return `${num} €`;
  return answerKey;
}

function getCategory(questionId: string): string {
  if (questionId === 'extra_saving') return 'extra';
  if (questionId === 'grace_day') return 'otro';
  const bankQ = QUESTIONS_BANK.find((q) => q.id === questionId);
  if (bankQ) return bankQ.avatar; // avatar como proxy de categoría
  return 'otro';
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
    range: '30d',
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
            category: getCategory(d.questionId),
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
