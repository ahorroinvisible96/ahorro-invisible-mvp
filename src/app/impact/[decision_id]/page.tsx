"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { analytics } from "@/services/analytics";
import { DAILY_QUESTIONS } from "@/services/dashboardStore";
import type { DailyDecision, Goal } from "@/types/Dashboard";

type StoreShape = { decisions: DailyDecision[]; goals: Goal[] };

function formatEUR(n: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
}

function formatDate(d: string): string {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d));
}

export default function ImpactPage({ params }: { params: { decision_id: string } }) {
  const router = useRouter();
  const [decision, setDecision] = useState<DailyDecision | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    try {
      const isAuthenticated = localStorage.getItem("isAuthenticated");
      if (isAuthenticated !== "true") { router.replace("/signup"); return; }

      const raw = localStorage.getItem("ahorro_invisible_dashboard_v1");
      if (!raw) { setError(true); setLoading(false); return; }

      const store = JSON.parse(raw) as StoreShape;
      const found = store.decisions.find((d) => d.id === params.decision_id) ?? null;
      if (!found) { setError(true); setLoading(false); return; }

      const foundGoal = store.goals.find((g) => g.id === found.goalId) ?? null;
      setDecision(found);
      setGoal(foundGoal);
      setLoading(false);

      analytics.impactViewed(
        found.date, found.id, found.questionId, found.answerKey, found.goalId,
        found.monthlyProjection > 0 || found.yearlyProjection > 0,
        found.monthlyProjection > 0 ? found.monthlyProjection : undefined,
        found.yearlyProjection > 0 ? found.yearlyProjection : undefined,
      );
    } catch {
      setError(true);
      setLoading(false);
    }
  }, [params.decision_id, router]);

  useEffect(() => {
    analytics.setScreen("impact");
    load();
  }, [load]);

  const q = decision ? DAILY_QUESTIONS.find((q) => q.questionId === decision.questionId) : null;
  const answerLabel = q?.answers.find((a) => a.key === decision?.answerKey)?.label ?? decision?.answerKey ?? '';
  const goalPct = goal ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;

  const DARK = {
    page: '#0f172a',
    card: '#1e293b',
    cardBorder: 'rgba(51,65,85,0.6)',
    textPrimary: '#f1f5f9',
    textSecondary: 'rgba(148,163,184,0.85)',
    textMuted: 'rgba(148,163,184,0.5)',
    border: 'rgba(51,65,85,0.55)',
    green: { bg: 'rgba(22,163,74,0.12)', border: 'rgba(22,163,74,0.3)', text: '#4ade80', label: '#86efac' },
    amber: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', text: '#fcd34d', label: '#fde68a' },
    blue: { bg: 'rgba(37,99,235,0.12)', border: 'rgba(37,99,235,0.3)' },
  };

  const NEGATIVE_TIPS: Record<string, string> = {
    coffee:       'Mañana tienes otra oportunidad. El hábito se construye con la tendencia, no con cada día.',
    delivery:     'Cocinar en casa suma poco a poco. La próxima vez que lo evites, habrás compensado hoy.',
    transport:    'El transporte tiene días inevitables. Lo que cuenta es la tendencia semanal.',
    impulse:      'Haberlo registrado ya es un acto de consciencia. La próxima vez el freno llegará antes.',
    subscription: 'Las suscripciones se optimizan una vez y ahorran para siempre. Anótatela para revisarla.',
  };

  const isNegativeDecision = (decision?.deltaAmount ?? -1) === 0 && (decision?.monthlyProjection ?? -1) === 0;
  const negativeTip = isNegativeDecision && decision
    ? (NEGATIVE_TIPS[decision.questionId] ?? 'Registrar tu decisión, sea cual sea, es el hábito más poderoso.')
    : null;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: DARK.page }}>
        <span style={{ color: DARK.textMuted, fontSize: 14 }}>Cargando impacto...</span>
      </div>
    );
  }

  if (error || !decision) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: DARK.page, padding: 24 }}>
        <p style={{ color: DARK.textSecondary, fontSize: 14, marginBottom: 16 }}>No se encontró esta decisión.</p>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>
          Volver al dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: DARK.page, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Header */}
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: DARK.textSecondary, fontSize: 13, cursor: 'pointer', marginBottom: 20, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Volver al dashboard
        </button>

        {/* Título */}
        <div style={{ background: DARK.card, borderRadius: 16, padding: '24px', border: `1px solid ${DARK.cardBorder}`, marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: DARK.textMuted, marginBottom: 4, textTransform: 'capitalize' }}>{formatDate(decision.date)}</p>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: DARK.textPrimary, marginBottom: 8 }}>
            {isNegativeDecision ? 'Decisión registrada' : 'Impacto de hoy'}
          </h1>
          <p style={{ fontSize: 14, color: DARK.textSecondary, marginBottom: 0 }}>
            {isNegativeDecision ? 'La constancia importa más que cada día individual.' : 'Esto es lo que suma tu constancia.'}
          </p>
        </div>

        {/* Decisión tomada */}
        <div style={{ background: DARK.card, borderRadius: 16, padding: '20px 24px', border: `1px solid ${DARK.cardBorder}`, marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: DARK.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Decisión tomada</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: DARK.textPrimary, marginBottom: 6 }}>{q?.text ?? decision.questionId}</p>
          <div style={{ display: 'inline-flex', alignItems: 'center', background: DARK.blue.bg, border: `1px solid ${DARK.blue.border}`, borderRadius: 8, padding: '5px 12px' }}>
            <span style={{ fontSize: 13, color: '#93c5fd', fontWeight: 600 }}>{answerLabel}</span>
          </div>
        </div>

        {/* Feedback negativo (delta = 0) */}
        {isNegativeDecision && negativeTip && (
          <div style={{ background: DARK.amber.bg, border: `1px solid ${DARK.amber.border}`, borderRadius: 16, padding: '20px 24px', marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: DARK.amber.label, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>💡 Para la próxima</p>
            <p style={{ fontSize: 14, color: DARK.textSecondary, lineHeight: 1.6, margin: 0 }}>{negativeTip}</p>
          </div>
        )}

        {/* Impacto económico */}
        {(decision.deltaAmount > 0 || decision.monthlyProjection > 0) && (
          <div style={{ background: DARK.green.bg, border: `1px solid ${DARK.green.border}`, borderRadius: 16, padding: '20px 24px', marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: DARK.green.label, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Impacto económico</p>
            {decision.deltaAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 14, color: DARK.textSecondary }}>Ahorro inmediato</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: DARK.green.text }}>+{formatEUR(decision.deltaAmount)}</span>
              </div>
            )}
            {decision.monthlyProjection > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: DARK.textSecondary }}>Proyección mensual</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: DARK.green.text }}>+{formatEUR(decision.monthlyProjection)}</span>
              </div>
            )}
            {decision.yearlyProjection > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: DARK.textSecondary }}>Proyección anual</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: DARK.green.text }}>+{formatEUR(decision.yearlyProjection)}</span>
              </div>
            )}
          </div>
        )}

        {/* Progreso del objetivo */}
        {goal && (
          <div style={{ background: DARK.card, borderRadius: 16, padding: '20px 24px', border: `1px solid ${DARK.cardBorder}`, marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: DARK.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Objetivo</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: DARK.textPrimary }}>{goal.title}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#60a5fa' }}>{goalPct}%</span>
            </div>
            <div style={{ background: 'rgba(51,65,85,0.6)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
              <div style={{ width: `${goalPct}%`, height: 8, background: 'linear-gradient(90deg, #60a5fa, #2563eb)', borderRadius: 999, transition: 'width 0.4s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 12, color: DARK.textMuted }}>{formatEUR(goal.currentAmount)}</span>
              <span style={{ fontSize: 12, color: DARK.textMuted }}>{formatEUR(goal.targetAmount)}</span>
            </div>
          </div>
        )}

        <p style={{ fontSize: 11, color: 'rgba(51,65,85,0.8)', textAlign: 'center', marginBottom: 20 }}>
          Estimación educativa. No es asesoramiento financiero.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => { analytics.impactCtaExtraSavingsClicked(decision.id, decision.goalId); router.push('/extra-saving'); }}
            style={{ padding: '13px 0', background: DARK.card, border: `1.5px solid ${DARK.border}`, borderRadius: 12, color: DARK.textPrimary, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Registrar acción extra
          </button>
          <button
            onClick={() => { analytics.impactCtaHistoryClicked(); router.push('/history'); }}
            style={{ padding: '13px 0', background: 'transparent', border: 'none', color: DARK.textMuted, fontSize: 14, cursor: 'pointer' }}
          >
            Ver historial completo
          </button>
        </div>
      </div>
    </div>
  );
}
