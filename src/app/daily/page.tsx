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

  const handleConfirm = () => {
    if (!question || !selectedAnswer || !selectedGoalId) return;
    setPhase('confirming');
    analytics.dailyAnswerSubmitted(today, question.questionId, selectedAnswer, selectedGoalId, goals.find(g => g.id === selectedGoalId)?.isPrimary ?? false);
    const summary = storeSubmitDecision(question.questionId, selectedAnswer, selectedGoalId);
    const dec = summary.daily.decisionId;
    setCompletedDecisionId(dec);
    analytics.dailyCompleted(today, dec ?? '', question.questionId, selectedAnswer, selectedGoalId, true, undefined, undefined, goals.find(g => g.id === selectedGoalId)?.isPrimary ?? false);
    router.push(`/impact/${dec}`);
  };

  const rule = question && selectedAnswer
    ? DAILY_DECISION_RULES.find(r => r.questionId === question.questionId && r.answerKey === selectedAnswer)
    : null;

  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <span style={{ color: '#9ca3af', fontSize: 14 }}>Cargando...</span>
      </div>
    );
  }

  if (phase === 'no-goals') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8, textAlign: 'center' }}>Crea un objetivo primero</h2>
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24, textAlign: 'center' }}>Necesitas al menos un objetivo activo para registrar tu decisión diaria.</p>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '12px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          Ir al dashboard
        </button>
      </div>
    );
  }

  if (phase === 'completed' || phase === 'confirming') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', padding: 24 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8, textAlign: 'center' }}>¡Decisión registrada!</h2>
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24, textAlign: 'center' }}>Ya tomaste tu decisión de hoy. Vuelve mañana.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300 }}>
          {completedDecisionId && (
            <button onClick={() => router.push(`/impact/${completedDecisionId}`)} style={{ padding: '12px 0', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
              Ver impacto
            </button>
          )}
          <button onClick={() => router.push('/dashboard')} style={{ padding: '12px 0', background: 'transparent', border: '1.5px solid #e5e7eb', borderRadius: 12, cursor: 'pointer', fontWeight: 500, fontSize: 14, color: '#374151' }}>
            Volver al dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', marginBottom: 24, padding: 0 }}>
          ← Dashboard
        </button>

        {/* Pregunta */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '28px 24px', boxShadow: '0 1px 10px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Decisión del día</p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', lineHeight: 1.35, marginBottom: 0 }}>{question.text}</h1>
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
                  background: isSelected ? '#eff6ff' : '#fff',
                  border: `2px solid ${isSelected ? '#2563eb' : '#e5e7eb'}`,
                  borderRadius: 14,
                  padding: '16px 20px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.12s',
                  boxShadow: isSelected ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: isSelected ? '#1d4ed8' : '#111827' }}>{ans.label}</span>
                {ans.savingsHint && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '3px 8px', borderRadius: 20, flexShrink: 0, marginLeft: 12 }}>
                    {ans.savingsHint}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Impacto estimado */}
        {rule && rule.immediateDelta > 0 && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '14px 20px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Impacto estimado</p>
              <p style={{ fontSize: 13, color: '#374151' }}>Mensual: <strong>{formatEUR(rule.monthlyProjection)}</strong> · Anual: <strong>{formatEUR(rule.yearlyProjection)}</strong></p>
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>+{formatEUR(rule.immediateDelta)}</span>
          </div>
        )}

        {/* Selector de objetivo */}
        {goals.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block' }}>Asignar a objetivo</label>
            <select
              value={selectedGoalId}
              onChange={(e) => setSelectedGoalId(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, color: '#111827', background: '#fff', cursor: 'pointer' }}
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
            background: selectedAnswer ? '#2563eb' : '#e5e7eb',
            color: selectedAnswer ? '#fff' : '#9ca3af',
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
