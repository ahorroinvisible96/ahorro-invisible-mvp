"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { analytics } from '@/services/analytics';
import { DAILY_QUESTIONS, DAILY_DECISION_RULES } from '@/services/dashboardStore';
import type { DailyDecision, Goal } from '@/types/Dashboard';

const RANGE_OPTIONS = [
  { label: 'Todo', value: 'all' },
  { label: '7 días', value: '7d' },
  { label: '30 días', value: '30d' },
  { label: '90 días', value: '90d' },
] as const;

type RangeOption = 'all' | '7d' | '30d' | '90d';

function getCategoryForDecision(questionId: string, answerKey: string): string {
  return DAILY_DECISION_RULES.find(r => r.questionId === questionId && r.answerKey === answerKey)?.category ?? 'otro';
}

const CUTOFF_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };


function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(dateString));
}

function formatEUR(amount: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(amount);
}

function getQuestionText(questionId: string): string {
  return DAILY_QUESTIONS.find((q) => q.questionId === questionId)?.text ?? questionId;
}

function getAnswerLabel(questionId: string, answerKey: string): string {
  const q = DAILY_QUESTIONS.find((q) => q.questionId === questionId);
  return q?.answers.find((a) => a.key === answerKey)?.label ?? answerKey;
}

export default function HistoryPage() {
  const router = useRouter();
  const [decisions, setDecisions] = useState<DailyDecision[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterGoalId, setFilterGoalId] = useState<string>('all');
  const [filterRange, setFilterRange] = useState<RangeOption>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    analytics.setScreen('history');
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (isAuthenticated !== 'true') { router.replace('/signup'); return; }

    try {
      const raw = localStorage.getItem('ahorro_invisible_dashboard_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as { decisions: DailyDecision[]; goals: Goal[] };
        const sorted = [...parsed.decisions].sort((a, b) => b.date.localeCompare(a.date));
        setDecisions(sorted);
        setGoals(parsed.goals.filter((g) => !g.archived));
      }
      analytics.historyViewed('sidebar');
    } catch {
      /* silencioso */
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const goalMap = useMemo(() => {
    const m: Record<string, string> = {};
    goals.forEach((g) => { m[g.id] = g.title; });
    return m;
  }, [goals]);

  const categories = useMemo(() => {
    const cats = new Set(decisions.map(d => getCategoryForDecision(d.questionId, d.answerKey)));
    return Array.from(cats);
  }, [decisions]);

  const filtered = useMemo(() => {
    let result = decisions;
    if (filterGoalId !== 'all') result = result.filter(d => d.goalId === filterGoalId);
    if (filterRange !== 'all') {
      const days = CUTOFF_DAYS[filterRange];
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0];
      result = result.filter(d => d.date >= cutoff);
    }
    if (filterCategory !== 'all') {
      result = result.filter(d => getCategoryForDecision(d.questionId, d.answerKey) === filterCategory);
    }
    return result;
  }, [decisions, filterGoalId, filterRange, filterCategory]);

  const totalSaved = useMemo(() => filtered.reduce((s, d) => s + d.deltaAmount, 0), [filtered]);

  if (isLoading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
          <span style={{ color: '#9ca3af', fontSize: 14 }}>Cargando historial...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Historial" subtitle="Todas tus decisiones de ahorro">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Filtros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#fff', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          {/* Rango temporal */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, minWidth: 60 }}>Periodo:</span>
            {RANGE_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setFilterRange(opt.value as RangeOption)}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: '1.5px solid', borderColor: filterRange === opt.value ? '#2563eb' : '#e5e7eb', background: filterRange === opt.value ? '#eff6ff' : 'transparent', color: filterRange === opt.value ? '#1d4ed8' : '#6b7280', cursor: 'pointer', fontWeight: filterRange === opt.value ? 700 : 400 }}>
                {opt.label}
              </button>
            ))}
          </div>
          {/* Objetivo */}
          {goals.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, minWidth: 60 }}>Objetivo:</span>
              <button onClick={() => setFilterGoalId('all')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: '1.5px solid', borderColor: filterGoalId === 'all' ? '#2563eb' : '#e5e7eb', background: filterGoalId === 'all' ? '#eff6ff' : 'transparent', color: filterGoalId === 'all' ? '#1d4ed8' : '#6b7280', cursor: 'pointer', fontWeight: filterGoalId === 'all' ? 700 : 400 }}>Todos</button>
              {goals.map(g => (
                <button key={g.id} onClick={() => setFilterGoalId(g.id)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: '1.5px solid', borderColor: filterGoalId === g.id ? '#2563eb' : '#e5e7eb', background: filterGoalId === g.id ? '#eff6ff' : 'transparent', color: filterGoalId === g.id ? '#1d4ed8' : '#6b7280', cursor: 'pointer', fontWeight: filterGoalId === g.id ? 700 : 400 }}>{g.title}</button>
              ))}
            </div>
          )}
          {/* Categoría */}
          {categories.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, minWidth: 60 }}>Categoría:</span>
              <button onClick={() => setFilterCategory('all')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: '1.5px solid', borderColor: filterCategory === 'all' ? '#2563eb' : '#e5e7eb', background: filterCategory === 'all' ? '#eff6ff' : 'transparent', color: filterCategory === 'all' ? '#1d4ed8' : '#6b7280', cursor: 'pointer', fontWeight: filterCategory === 'all' ? 700 : 400 }}>Todas</button>
              {categories.map(cat => (
                <button key={cat} onClick={() => setFilterCategory(cat)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: '1.5px solid', borderColor: filterCategory === cat ? '#2563eb' : '#e5e7eb', background: filterCategory === cat ? '#eff6ff' : 'transparent', color: filterCategory === cat ? '#1d4ed8' : '#6b7280', cursor: 'pointer', fontWeight: filterCategory === cat ? 700 : 400 }}>{cat}</button>
              ))}
            </div>
          )}
        </div>

        {/* Resumen total */}
        {filtered.length > 0 && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>{filtered.length} decisiones registradas</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#15803d' }}>+{formatEUR(totalSaved)} ahorrados</span>
          </div>
        )}

        {/* Lista de decisiones */}
        {filtered.length > 0 ? (
          filtered.map((d) => (
            <Card key={d.id} variant="default" size="sm" rounded2xl interactive onClick={() => router.push(`/impact/${d.id}`)}>
              <Card.Content>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <Badge variant="default" size="sm">{formatDate(d.date)}</Badge>
                      {goalMap[d.goalId] && (
                        <Badge variant="primary" size="sm">{goalMap[d.goalId]}</Badge>
                      )}
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getQuestionText(d.questionId)}
                    </p>
                    <p style={{ fontSize: 13, color: '#6b7280' }}>
                      {getAnswerLabel(d.questionId, d.answerKey)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {d.deltaAmount > 0 && (
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>+{formatEUR(d.deltaAmount)}</div>
                    )}
                    {d.monthlyProjection > 0 && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{formatEUR(d.monthlyProjection)}/mes</div>
                    )}
                  </div>
                </div>
              </Card.Content>
            </Card>
          ))
        ) : (
          <Card variant="default" size="md" rounded2xl>
            <Card.Content>
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 6 }}>Aún no has tomado ninguna decisión de ahorro.</p>
                <p style={{ color: '#9ca3af', fontSize: 13 }}>Completa tu primera decisión diaria para ver el historial.</p>
              </div>
            </Card.Content>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
