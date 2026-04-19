"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { analytics } from "@/services/analytics";
import {
  getTodayQuestion,
  storeSubmitDecision,
  storeGetDailyForDate,
  storeListActiveGoals,
  getCurrentTimeWindow,
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
  const [savedAmount, setSavedAmount] = useState<string>('');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [completedDecisionId, setCompletedDecisionId] = useState<string | null>(null);
  const [currentTimeWindow, setCurrentTimeWindow] = useState<string>(() =>
    typeof window !== 'undefined' ? getCurrentTimeWindow() : 'Mañana'
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    analytics.setScreen('daily_question');
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (isAuthenticated !== 'true') { router.replace('/login'); return; }
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

  // ── Auto-refresh: si cambia la franja horaria y no se respondió ──────────
  useEffect(() => {
    if (phase !== 'pending') return;

    const interval = setInterval(() => {
      const newWindow = getCurrentTimeWindow();
      if (newWindow !== currentTimeWindow) {
        setCurrentTimeWindow(newWindow);
        const q = getTodayQuestion();
        setQuestion(q);
        analytics.dailyQuestionViewed(today, q.questionId, 'pending');
        setSavedAmount('');
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [phase, currentTimeWindow, today]);

  // Focus en el input cuando se muestra la pregunta
  useEffect(() => {
    if (phase === 'pending' && inputRef.current) {
      // Delay para que el render se complete
      const t = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [phase, question]);

  const parsedAmount = savedAmount ? parseFloat(savedAmount) : 0;
  const hasAmount = parsedAmount > 0;

  const handleConfirm = async () => {
    if (!question || !selectedGoalId) return;
    setPhase('confirming');

    const answerKey = hasAmount ? 'saved' : 'zero';
    analytics.dailyAnswerSubmitted(today, question.questionId, answerKey, selectedGoalId, goals.find(g => g.id === selectedGoalId)?.isPrimary ?? false);

    const isFirstDecision = (() => {
      try {
        const raw = localStorage.getItem('ahorro_invisible_dashboard_v1');
        if (!raw) return true;
        const s = JSON.parse(raw);
        return (s.decisions?.length ?? 0) === 0;
      } catch { return false; }
    })();

    const summary = storeSubmitDecision(
      question.questionId,
      answerKey,
      selectedGoalId,
      '30d',
      hasAmount ? parsedAmount : undefined,
    );
    const dec = summary.daily.decisionId;
    setCompletedDecisionId(dec);
    analytics.dailyCompleted(today, dec ?? '', question.questionId, answerKey, selectedGoalId, true, undefined, undefined, goals.find(g => g.id === selectedGoalId)?.isPrimary ?? false);
    if (isFirstDecision) analytics.firstDailyCompleted(today, dec ?? '', question.questionId, answerKey, selectedGoalId);

    // Sync directo
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
    const userId = localStorage.getItem('supabaseUserId');
    if (userId) pushLocalDataToSupabase(userId).catch(() => null);
  };

  const handleSkip = () => {
    if (question) analytics.dailySkipped(today, question.questionId);
    router.push('/dashboard');
  };

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
    green: { bg: 'rgba(22,163,74,0.12)', border: 'rgba(22,163,74,0.3)', text: '#4ade80', label: '#86efac' },
    accent: '#2563eb',
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

        {/* Pregunta / Escenario */}
        <div style={{
          background: DARK.card,
          borderRadius: 20,
          padding: '28px 24px',
          border: `1px solid ${DARK.cardBorder}`,
          marginBottom: 20,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: DARK.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
            Decisión del día
          </p>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: DARK.textPrimary, lineHeight: 1.4, marginBottom: 0 }}>
            {question.text}
          </h1>
        </div>

        {/* Input de importe */}
        <div style={{
          background: DARK.card,
          borderRadius: 18,
          padding: '24px 20px',
          border: `2px solid ${hasAmount ? DARK.green.border : DARK.cardBorder}`,
          marginBottom: 16,
          transition: 'border-color 0.2s',
        }}>
          <p style={{
            fontSize: 12, fontWeight: 700,
            color: hasAmount ? DARK.green.label : DARK.textMuted,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            marginBottom: 14, transition: 'color 0.2s',
          }}>
            ¿Cuánto te has ahorrado?
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              position: 'relative', flex: 1, display: 'flex', alignItems: 'center',
            }}>
              <input
                ref={inputRef}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={savedAmount}
                onChange={(e) => setSavedAmount(e.target.value)}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '14px 50px 14px 16px',
                  background: 'rgba(15,23,42,0.6)',
                  border: `1.5px solid ${hasAmount ? 'rgba(74,222,128,0.4)' : 'rgba(51,65,85,0.5)'}`,
                  borderRadius: 14,
                  color: hasAmount ? '#4ade80' : DARK.textPrimary,
                  fontSize: 28,
                  fontWeight: 800,
                  outline: 'none',
                  textAlign: 'right',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                }}
              />
              <span style={{
                position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                fontSize: 20, fontWeight: 700,
                color: hasAmount ? 'rgba(74,222,128,0.7)' : 'rgba(148,163,184,0.4)',
                pointerEvents: 'none', transition: 'color 0.2s',
              }}>€</span>
            </div>
          </div>

          {/* Sugerencia */}
          <p style={{
            fontSize: 12, color: DARK.textMuted, marginTop: 10, marginBottom: 0,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{
              display: 'inline-block', padding: '2px 8px',
              background: 'rgba(37,99,235,0.12)', borderRadius: 8,
              fontSize: 11, fontWeight: 700, color: 'rgba(147,197,253,0.8)',
            }}>💡 Típico: {question.suggestedAmount} €</span>
            <span>· Si no ahorraste nada, deja 0</span>
          </p>
        </div>

        {/* Impacto estimado (se muestra cuando hay importe) */}
        {hasAmount && (
          <div style={{
            background: DARK.green.bg,
            border: `1px solid ${DARK.green.border}`,
            borderRadius: 14,
            padding: '16px 20px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            animation: 'fadeIn 0.3s ease',
          }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: DARK.green.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                ¡Genial! Has ahorrado hoy
              </p>
              <p style={{ fontSize: 13, color: DARK.textSecondary, margin: 0 }}>
                {question.labelImpact}
              </p>
            </div>
            <span style={{ fontSize: 24, fontWeight: 800, color: DARK.green.text }}>
              +{formatEUR(parsedAmount)}
            </span>
          </div>
        )}

        {/* Info cuando es 0 */}
        {!hasAmount && (
          <div style={{
            background: 'rgba(37,99,235,0.06)',
            border: '1px solid rgba(37,99,235,0.15)',
            borderRadius: 14,
            padding: '14px 18px',
            marginBottom: 16,
          }}>
            <p style={{ fontSize: 13, color: 'rgba(147,197,253,0.7)', margin: 0, lineHeight: 1.5 }}>
              📊 Si repites este hábito, podrías ahorrar <strong style={{ color: '#93c5fd' }}>{formatEUR(question.monthlyDelta)}/mes</strong> · <strong style={{ color: '#93c5fd' }}>{formatEUR(question.yearlyDelta)}/año</strong>
            </p>
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
          disabled={!selectedGoalId}
          style={{
            width: '100%',
            padding: '16px 0',
            background: hasAmount
              ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
              : DARK.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 14,
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s',
            boxShadow: hasAmount ? '0 4px 20px rgba(34,197,94,0.25)' : 'none',
          }}
        >
          {hasAmount ? `Registrar ahorro de ${formatEUR(parsedAmount)}` : 'Hoy no he ahorrado (0 €)'}
        </button>

        <p style={{
          fontSize: 11, color: DARK.textMuted, textAlign: 'center', marginTop: 12,
        }}>
          Cualquier respuesta es válida. Lo importante es ser consciente.
        </p>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
