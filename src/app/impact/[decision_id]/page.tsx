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

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <span style={{ color: '#9ca3af', fontSize: 14 }}>Cargando impacto...</span>
      </div>
    );
  }

  if (error || !decision) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', padding: 24 }}>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>No se encontró esta decisión.</p>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>
          Volver al dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Header */}
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', marginBottom: 20, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Volver al dashboard
        </button>

        {/* Título */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 1px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4, textTransform: 'capitalize' }}>{formatDate(decision.date)}</p>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Impacto de hoy</h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 0 }}>Esto es lo que suma tu constancia.</p>
        </div>

        {/* Decisión tomada */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 1px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Decisión tomada</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 6 }}>{q?.text ?? decision.questionId}</p>
          <div style={{ display: 'inline-flex', alignItems: 'center', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '5px 12px' }}>
            <span style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>{answerLabel}</span>
          </div>
        </div>

        {/* Impacto económico */}
        {(decision.deltaAmount > 0 || decision.monthlyProjection > 0) && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: '20px 24px', boxShadow: '0 1px 8px rgba(0,0,0,0.04)', marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#166534', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Impacto económico</p>
            {decision.deltaAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 14, color: '#374151' }}>Ahorro inmediato</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>+{formatEUR(decision.deltaAmount)}</span>
              </div>
            )}
            {decision.monthlyProjection > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: '#374151' }}>Proyección mensual</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#16a34a' }}>+{formatEUR(decision.monthlyProjection)}</span>
              </div>
            )}
            {decision.yearlyProjection > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: '#374151' }}>Proyección anual</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#16a34a' }}>+{formatEUR(decision.yearlyProjection)}</span>
              </div>
            )}
          </div>
        )}

        {/* Progreso del objetivo */}
        {goal && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 1px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Objetivo</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{goal.title}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#2563eb' }}>{goalPct}%</span>
            </div>
            <div style={{ background: '#e5e7eb', borderRadius: 999, height: 8, overflow: 'hidden' }}>
              <div style={{ width: `${goalPct}%`, height: 8, background: 'linear-gradient(90deg, #60a5fa, #2563eb)', borderRadius: 999, transition: 'width 0.4s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{formatEUR(goal.currentAmount)}</span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{formatEUR(goal.targetAmount)}</span>
            </div>
          </div>
        )}

        <p style={{ fontSize: 11, color: '#d1d5db', textAlign: 'center', marginBottom: 20 }}>
          Estimación educativa. No es asesoramiento financiero.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => { analytics.impactCtaExtraSavingsClicked(decision.id, decision.goalId); router.push('/extra-saving'); }}
            style={{ padding: '13px 0', background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Registrar acción extra
          </button>
          <button
            onClick={() => { analytics.impactCtaHistoryClicked(); router.push('/history'); }}
            style={{ padding: '13px 0', background: 'transparent', border: 'none', color: '#9ca3af', fontSize: 14, cursor: 'pointer' }}
          >
            Ver historial completo
          </button>
        </div>
      </div>
    </div>
  );
}
