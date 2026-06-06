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
import { FillBlankInput } from "@/components/daily/FillBlankInput/FillBlankInput";
import { ChoiceQuestion } from "@/components/daily/ChoiceQuestion/ChoiceQuestion";
import styles from "./Daily.module.css";

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
  // ── Estado para señal de avatar (fill_blank / choice) ─────────────────
  const [signalValue, setSignalValue] = useState<string | null>(null);
  const [customText, setCustomText] = useState<string>('');
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
      const t = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [phase, question]);

  const parsedAmount = savedAmount ? parseFloat(savedAmount) : 0;
  const hasAmount = parsedAmount > 0;

  const handleConfirm = async () => {
    if (!question || !selectedGoalId) return;
    setPhase('confirming');

    const signalKey = signalValue === '__custom__'
      ? `custom:${customText}`
      : signalValue ?? '';
    const answerKey = signalKey
      ? (hasAmount ? `saved|${signalKey}` : `zero|${signalKey}`)
      : (hasAmount ? 'saved' : 'zero');
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

  // ── Loading ────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className={styles.statusScreen}>
        <span className={styles.statusSubtitle}>Cargando...</span>
      </div>
    );
  }

  // ── No goals ──────────────────────────────────────────────────────────
  if (phase === 'no-goals') {
    return (
      <div className={styles.statusScreen}>
        <div className={styles.statusEmoji}>🎯</div>
        <h2 className={styles.statusTitle}>Crea un objetivo primero</h2>
        <p className={styles.statusSubtitle}>Necesitas al menos un objetivo activo para registrar tu decisión diaria.</p>
        <button onClick={() => router.push('/dashboard')} className={styles.btnPrimary}>
          Ir al dashboard
        </button>
      </div>
    );
  }

  // ── Completed / Confirming ────────────────────────────────────────────
  if (phase === 'completed' || phase === 'confirming') {
    return (
      <div className={styles.statusScreen}>
        <div className={styles.statusEmoji}>✅</div>
        <h2 className={styles.statusTitle}>¡Decisión registrada!</h2>
        <p className={styles.statusSubtitle}>Ya tomaste tu decisión de hoy. Vuelve mañana.</p>
        <div className={styles.statusActions}>
          {completedDecisionId && (
            <button onClick={() => router.push(`/impact/${completedDecisionId}`)} className={styles.btnPrimary}>
              Ver impacto
            </button>
          )}
          <button onClick={() => router.push('/dashboard')} className={styles.btnSecondary}>
            Volver al dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!question) return null;

  // ── Pending: main question UI ─────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <button onClick={handleSkip} className={styles.backBtn}>
          ← Dashboard
        </button>

        {/* Pregunta / Escenario */}
        <div className={styles.questionCard}>
          <p className={styles.questionLabel}>Decisión del día</p>

          {/* Formato: fill_blank */}
          {question.format === 'fill_blank' && question.blankOptions && (
            <FillBlankInput
              sentence={question.text}
              options={question.blankOptions.map(o => ({ label: o.label, value: o.value }))}
              value={signalValue}
              customText={customText}
              onSelect={setSignalValue}
              onCustomTextChange={setCustomText}
            />
          )}

          {/* Formato: choice */}
          {question.format === 'choice' && question.choiceOptions && (
            <ChoiceQuestion
              question={question.text}
              options={question.choiceOptions.map(o => ({ label: o.label, value: o.value }))}
              value={signalValue}
              onSelect={setSignalValue}
            />
          )}

          {/* Formato: amount (solo texto) */}
          {(question.format === 'amount' || !question.format) && (
            <h1 className={styles.questionTitle}>{question.text}</h1>
          )}
        </div>

        {/* Input de importe */}
        <div className={`${styles.amountCard} ${hasAmount ? styles.amountCardActive : ''}`}>
          <p className={`${styles.amountLabel} ${hasAmount ? styles.amountLabelActive : ''}`}>
            ¿Cuánto te has ahorrado?
          </p>
          <div className={styles.amountRow}>
            <div className={styles.amountInputWrap}>
              <input
                ref={inputRef}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={savedAmount}
                onChange={(e) => setSavedAmount(e.target.value)}
                placeholder="0"
                className={`${styles.amountInput} ${hasAmount ? styles.amountInputActive : ''}`}
              />
              <span className={`${styles.amountUnit} ${hasAmount ? styles.amountUnitActive : ''}`}>€</span>
            </div>
          </div>
          <p className={styles.amountHint}>Si no ahorraste nada, deja 0</p>
        </div>

        {/* Banner de ahorro */}
        {hasAmount && (
          <div className={styles.savingsBanner}>
            <p className={styles.savingsLabel}>¡Genial! Has ahorrado hoy</p>
            <span className={styles.savingsAmount}>+{formatEUR(parsedAmount)}</span>
          </div>
        )}

        {/* Selector de objetivo */}
        {goals.length > 1 && (
          <div className={styles.goalSection}>
            <label className={styles.goalLabel}>Asignar a objetivo</label>
            <select
              value={selectedGoalId}
              onChange={(e) => setSelectedGoalId(e.target.value)}
              className={styles.goalSelect}
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
          className={`${styles.btnConfirm} ${hasAmount ? styles.btnConfirmSave : styles.btnConfirmZero}`}
        >
          {hasAmount ? `Registrar ahorro de ${formatEUR(parsedAmount)}` : 'Hoy no he ahorrado (0 €)'}
        </button>

        <p className={styles.hint}>
          Cualquier respuesta es válida. Lo importante es ser consciente.
        </p>
      </div>
    </div>
  );
}
