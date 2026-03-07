"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { analytics } from "@/services/analytics";
import {
  getTodayQuestion,
  storeSubmitDecision,
  storeGetDailyForDate,
  storeListActiveGoals,
  DAILY_DECISION_RULES,
} from "@/services/dashboardStore";
import { pushLocalDataToSupabase, syncDecisionToSupabase, syncGoalToSupabase } from "@/services/syncService";
import type { Goal } from "@/types/Dashboard";

type Phase = 'loading' | 'no-goals' | 'completed' | 'pending' | 'confirming' | 'error';

function formatEUR(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export default function DailyPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [question, setQuestion] = useState<ReturnType<typeof getTodayQuestion> | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [completedDecisionId, setCompletedDecisionId] = useState<string | null>(null);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    analytics.setScreen('daily_question');
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (isAuthenticated !== 'true') { router.replace('/signup'); return; }
    const hasOnboarding = localStorage.getItem('hasCompletedOnboarding');
    if (hasOnboarding !== 'true') { router.replace('/onboarding'); return; }

    const active = storeListActiveGoals();
    if (active.length === 0) { setPhase('no-goals'); return; }

    setGoals(active);
    const primary = active.find((g) => g.isPrimary) ?? active[0];
    setSelectedGoalId(primary.id);

    const todayStatus = storeGetDailyForDate(today);
    const q = getTodayQuestion();
    setQuestion(q);

    if (todayStatus.status === 'completed') {
      setCompletedDecisionId(todayStatus.decisionId);
      setPhase('completed');
      analytics.dailyQuestionViewed(today, q.questionId, 'completed');
    } else {
      setPhase('pending');
      analytics.dailyQuestionViewed(today, q.questionId, 'pending');
    }
  }, [router, today]);

  const handleSelectAnswer = (key: string) => {
    if (phase !== 'pending') return;
    setSelectedAnswer(key);
    analytics.dailyAnswerSelected(today, question?.questionId ?? '', key);
  };

  const handleConfirm = async () => {
    if (!question || !selectedAnswer || !selectedGoalId) return;
    setPhase('confirming');
    analytics.dailyAnswerSubmitted(today, question.questionId, selectedAnswer, selectedGoalId, goals.find(g => g.id === selectedGoalId)?.isPrimary ?? false);
    const isFirstDecision = (() => {
      try {
        const raw = localStorage.getItem('ahorro_invisible_dashboard_v1');
        if (!raw) return true;
        const s = JSON.parse(raw);
        return (s.decisions?.length ?? 0) === 0;
      } catch { return false; }
    })();
    const summary = storeSubmitDecision(question.questionId, selectedAnswer, selectedGoalId);
    const dec = summary.daily.decisionId;
    setCompletedDecisionId(dec);
    analytics.dailyCompleted(today, dec ?? '', question.questionId, selectedAnswer, selectedGoalId, true, undefined, undefined, goals.find(g => g.id === selectedGoalId)?.isPrimary ?? false);
    if (isFirstDecision) analytics.firstDailyCompleted(today, dec ?? '', question.questionId, selectedAnswer, selectedGoalId);

    // Sync directo e inmediato: solo el registro nuevo (1-2 llamadas, ~400ms)
    try {
      const raw = localStorage.getItem('ahorro_invisible_dashboard_v1');
      if (raw) {
        const store = JSON.parse(raw);
        const newDec = store.decisions?.find((d: Record<string, unknown>) => d.id === dec);
        const updatedGoal = store.goals?.find((g: Record<string, unknown>) => g.id === selectedGoalId);
        await Promise.all([
          newDec ? syncDecisionToSupabase(newDec) : Promise.resolve(),
          updatedGoal ? syncGoalToSupabase(updatedGoal) : Promise.resolve(),
        ]);
      }
    } catch { /* no bloquear navegación */ }

    router.push(`/impact/${dec}`);
    // Full sync en background como catch-all
    const userId = localStorage.getItem('supabaseUserId');
    if (userId) pushLocalDataToSupabase(userId).catch(() => null);
  };

  const handleSkip = () => {
    if (question && !selectedAnswer) analytics.dailySkipped(today, question.questionId);
    router.push('/dashboard');
  };

  const rule = question && selectedAnswer
    ? DAILY_DECISION_RULES.find(r => r.questionId === question.questionId && r.answerKey === selectedAnswer)
    : null;

  const DARK = {
    page: '#0f172a',
    card: '#1e293b',
    cardBorder: 'rgba(51,65,85,0.6)',
    textPrimary: '#f1f5f9',
    textSecondary: 'rgba(148,163,184,0.85)',
    textMuted: 'rgba(148,163,184,0.5)',
    border: 'rgba(51,65,85,0.55)',
    selectedBg: 'rgba(37,99,235,0.18)',
    selectedBorder: '#2563eb',
    progressTrack: 'rgba(51,65,85,0.6)',
    green: { bg: 'rgba(22,163,74,0.12)', border: 'rgba(22,163,74,0.3)', text: '#4ade80', label: '#86efac' },
  };

  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: DARK.page }}>
        <span style={{ color: DARK.textMuted, fontSize: 14 }}>Cargando...</span>
      </div>
    );
  }

  if (phase === 'no-goals') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: DARK.page, padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: DARK.textPrimary, marginBottom: 8, textAlign: 'center' }}>Crea un objetivo primero</h2>
        <p style={{ fontSize: 14, color: DARK.textSecondary, marginBottom: 24, textAlign: 'center' }}>Necesitas al menos un objetivo activo para registrar tu decisión diaria.</p>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '12px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          Ir al dashboard
        </button>
      </div>
    );
  }

  if (phase === 'completed' || phase === 'confirming') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: DARK.page, padding: 24 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: DARK.textPrimary, marginBottom: 8, textAlign: 'center' }}>¡Decisión registrada!</h2>
        <p style={{ fontSize: 14, color: DARK.textSecondary, marginBottom: 24, textAlign: 'center' }}>Ya tomaste tu decisión de hoy. Vuelve mañana.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300 }}>
          {completedDecisionId && (
            <button onClick={() => router.push(`/impact/${completedDecisionId}`)} style={{ padding: '12px 0', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
              Ver impacto
            </button>
          )}
          <button onClick={() => router.push('/dashboard')} style={{ padding: '12px 0', background: 'transparent', border: `1.5px solid ${DARK.border}`, borderRadius: 12, cursor: 'pointer', fontWeight: 500, fontSize: 14, color: DARK.textSecondary }}>
            Volver al dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div style={{ minHeight: '100vh', background: DARK.page, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <button onClick={handleSkip} style={{ background: 'none', border: 'none', color: DARK.textSecondary, fontSize: 13, cursor: 'pointer', marginBottom: 24, padding: 0 }}>
          ← Dashboard
        </button>

        {/* Pregunta */}
        <div style={{ background: DARK.card, borderRadius: 20, padding: '28px 24px', border: `1px solid ${DARK.cardBorder}`, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: DARK.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Decisión del día</p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: DARK.textPrimary, lineHeight: 1.35, marginBottom: 0 }}>{question.text}</h1>
        </div>

        {/* Respuestas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {question.answers.map((ans) => {
            const r = DAILY_DECISION_RULES.find(r => r.questionId === question.questionId && r.answerKey === ans.key);
            const isSelected = selectedAnswer === ans.key;
            return (
              <button
                key={ans.key}
                onClick={() => handleSelectAnswer(ans.key)}
                style={{
                  background: isSelected ? DARK.selectedBg : DARK.card,
                  border: `2px solid ${isSelected ? DARK.selectedBorder : DARK.cardBorder}`,
                  borderRadius: 14,
                  padding: '16px 20px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.12s',
                  boxShadow: isSelected ? '0 0 0 3px rgba(37,99,235,0.15)' : 'none',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: isSelected ? '#93c5fd' : DARK.textPrimary }}>{ans.label}</span>
                {ans.savingsHint && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: DARK.green.text, background: DARK.green.bg, padding: '3px 8px', borderRadius: 20, flexShrink: 0, marginLeft: 12 }}>
                    {ans.savingsHint}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Impacto estimado */}
        {rule && rule.immediateDelta > 0 && (
          <div style={{ background: DARK.green.bg, border: `1px solid ${DARK.green.border}`, borderRadius: 14, padding: '14px 20px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: DARK.green.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Impacto estimado</p>
              <p style={{ fontSize: 13, color: DARK.textSecondary }}>Mensual: <strong style={{ color: DARK.green.text }}>{formatEUR(rule.monthlyProjection)}</strong> · Anual: <strong style={{ color: DARK.green.text }}>{formatEUR(rule.yearlyProjection)}</strong></p>
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, color: DARK.green.text }}>+{formatEUR(rule.immediateDelta)}</span>
          </div>
        )}

        {/* Selector de objetivo */}
        {goals.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: DARK.textSecondary, marginBottom: 8, display: 'block' }}>Asignar a objetivo</label>
            <select
              value={selectedGoalId}
              onChange={(e) => setSelectedGoalId(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${DARK.border}`, borderRadius: 10, fontSize: 14, color: DARK.textPrimary, background: DARK.card, cursor: 'pointer' }}
            >
              {goals.map((g) => (
                <option key={g.id} value={g.id}>{g.title}{g.isPrimary ? ' (principal)' : ''}</option>
              ))}
            </select>
          </div>
        )}

        {/* Botón confirmar */}
        <button
          onClick={handleConfirm}
          disabled={!selectedAnswer || !selectedGoalId}
          style={{
            width: '100%',
            padding: '15px 0',
            background: selectedAnswer ? '#2563eb' : 'rgba(51,65,85,0.5)',
            color: selectedAnswer ? '#fff' : DARK.textMuted,
            border: 'none',
            borderRadius: 14,
            fontSize: 15,
            fontWeight: 700,
            cursor: selectedAnswer ? 'pointer' : 'not-allowed',
            transition: 'background 0.12s',
          }}
        >
          Confirmar decisión
        </button>
      </div>
    </div>
  );
}
