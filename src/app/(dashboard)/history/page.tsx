"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { analytics } from '@/services/analytics';
import { DAILY_QUESTIONS } from '@/services/dashboardStore';
import type { DailyDecision, Goal } from '@/types/Dashboard';

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

  const filtered = useMemo(() =>
    filterGoalId === 'all' ? decisions : decisions.filter((d) => d.goalId === filterGoalId),
    [decisions, filterGoalId],
  );

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

        {/* Filtro por objetivo */}
        {goals.length > 1 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>Objetivo:</span>
            <button
              onClick={() => setFilterGoalId('all')}
              style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '1.5px solid', borderColor: filterGoalId === 'all' ? '#2563eb' : '#e5e7eb', background: filterGoalId === 'all' ? '#eff6ff' : 'transparent', color: filterGoalId === 'all' ? '#1d4ed8' : '#6b7280', cursor: 'pointer', fontWeight: 600 }}
            >
              Todos
            </button>
            {goals.map((g) => (
              <button
                key={g.id}
                onClick={() => setFilterGoalId(g.id)}
                style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '1.5px solid', borderColor: filterGoalId === g.id ? '#2563eb' : '#e5e7eb', background: filterGoalId === g.id ? '#eff6ff' : 'transparent', color: filterGoalId === g.id ? '#1d4ed8' : '#6b7280', cursor: 'pointer', fontWeight: 500 }}
              >
                {g.title}
              </button>
            ))}
          </div>
        )}

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
