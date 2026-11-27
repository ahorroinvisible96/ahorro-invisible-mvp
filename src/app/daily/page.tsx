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
  recordPromptImpressionShown,
} from "@/services/dashboardStore";
import { localDateStr } from "@/lib/dates";
import { pushLocalDataToSupabase, syncDecisionToSupabase, syncGoalToSupabase } from "@/services/syncService";
import type { Goal } from "@/types/Dashboard";
import { FillBlankInput } from "@/components/daily/FillBlankInput/FillBlankInput";
import { CheckIcon, TargetIcon } from "@/components/ui/AppIcons";
import styles from "./Daily.module.css";

type Phase = 'loading' | 'no-goals' | 'completed' | 'pending' | 'confirming' | 'error';

function formatEUR(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
}

export default function DailyPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [question, setQuestion] = useState<ReturnType<typeof getTodayQuestion> | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [savedAmount, setSavedAmount] = useState<string>('');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [completedDecisionId, setCompletedDecisionId] = useState<string | null>(null);
  const [currentTimeWindow, setCurrentTimeWindow] = useState<string>('Mañana');
  const [signalValue, setSignalValue] = useState<string | null>(null);
  const [customText, setCustomText] = useState<string>('');
  const [amountTouched, setAmountTouched] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const today = localDateStr();

  useEffect(() => {
    analytics.setScreen('daily_question');
    setCurrentTimeWindow(getCurrentTimeWindow());
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
      recordPromptImpressionShown(q, 'daily_page', 'answered_fallback');
    } else {
      setPhase('pending');
      analytics.dailyQuestionViewed(today, q.questionId, 'pending');
      recordPromptImpressionShown(q, 'daily_page', 'initial');
    }
  }, [router, today]);

  useEffect(() => {
    if (phase !== 'pending') return;
    const interval = setInterval(() => {
      const newWindow = getCurrentTimeWindow();
      if (newWindow !== currentTimeWindow) {
        setCurrentTimeWindow(newWindow);
        const prevQuestionId = question?.questionId ?? null;
        const q = getTodayQuestion();
        setQuestion(q);
        analytics.dailyQuestionViewed(today, q.questionId, 'pending');
        recordPromptImpressionShown(q, 'daily_page', 'slot_change', prevQuestionId);
        setSavedAmount('');
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [phase, currentTimeWindow, today, question?.questionId]);

  useEffect(() => {
    if (phase === 'pending' && inputRef.current) {
      const t = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [phase, question]);

  const parsedAmount = (() => {
    if (!amountTouched || savedAmount === '') return null;
    const n = parseFloat(savedAmount);
    return isNaN(n) || n < 0 ? null : n;
  })();

  const hasValidAmount = parsedAmount !== null;
  const savingAmount = parsedAmount ?? 0;
  const hasSaving = hasValidAmount && parsedAmount! > 0;

  const handleConfirm = async () => {
    if (!question || !selectedGoalId) return;
    setPhase('confirming');

    const signalKey = signalValue === '__custom__'
      ? `custom:${customText}`
      : signalValue ?? '';
    const answerKey = signalKey
      ? (hasSaving ? `saved|${signalKey}` : `zero|${signalKey}`)
      : (hasSaving ? 'saved' : 'zero');
    analytics.dailyAnswerSubmitted(today, question.questionId, answerKey, goals.find(g => g.id === selectedGoalId)?.isPrimary ?? false, 'daily_page');

    const summary = storeSubmitDecision(
      question.questionId,
      answerKey,
      selectedGoalId,
      '30d',
      hasSaving ? parsedAmount! : undefined,
      { surface: 'daily_page' },
    );
    const dec = summary.daily.decisionId;
    setCompletedDecisionId(dec);

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

  if (phase === 'loading') {
    return (
      <div className={styles.statusScreen}>
        <span className={styles.statusSubtitle}>Cargando...</span>
      </div>
    );
  }

  if (phase === 'no-goals') {
    return (
      <div className={styles.statusScreen}>
        <div className={`${styles.statusMedallion} ${styles.statusMedallionCobalt}`}>
          <TargetIcon size={24} />
        </div>
        <h2 className={styles.statusTitle}>Crea un objetivo primero</h2>
        <p className={styles.statusSubtitle}>Necesitas al menos un objetivo activo para registrar tu decisión diaria.</p>
        <div className={styles.statusActions}>
          <button type="button" onClick={() => router.push('/dashboard')} className={styles.btnPrimary}>
            Ir al dashboard
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'completed' || phase === 'confirming') {
    return (
      <div className={styles.statusScreen}>
        <div className={styles.statusMedallion}>
          <CheckIcon size={26} />
        </div>
        <h2 className={styles.statusTitle}>Decisión registrada</h2>
        <p className={styles.statusSubtitle}>Ya tomaste tu decisión de hoy. Vuelve mañana para seguir sumando.</p>
        <div className={styles.statusActions}>
          {completedDecisionId && (
            <button type="button" onClick={() => router.push(`/impact/${completedDecisionId}`)} className={styles.btnPrimary}>
              Ver impacto
            </button>
          )}
          <button type="button" onClick={() => router.push('/dashboard')} className={styles.btnSecondary}>
            Volver al dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className={styles.page}>
      <div className={styles.sky}>
        <div className={styles.inner}>
          <div className={styles.topBar}>
            <button type="button" onClick={handleSkip} className={styles.glassBackBtn} aria-label="Volver al dashboard">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className={styles.windowPill}>Decisión de hoy · {currentTimeWindow}</span>
            <div style={{ width: 38 }} />
          </div>

          <div className={styles.heroQuestion}>
            {question.options && question.options.length > 0 ? (
              <FillBlankInput
                sentence={question.text}
                options={(question.options ?? []).map((o: string) => ({ label: o, value: o }))}
                value={signalValue}
                customText={customText}
                onSelect={setSignalValue}
                onCustomTextChange={setCustomText}
              />
            ) : (
              <h1 className={styles.questionTitle}>{question.text}</h1>
            )}
          </div>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.card}>
          <div className={`${styles.unifiedBar} ${hasSaving ? styles.unifiedBarActive : ''}`}>
            <div className={styles.amountBlock}>
              <label htmlFor="daily-amount" className={styles.amountLabel}>Importe ahorrado</label>
              <div className={styles.amountInputRow}>
                <input
                  id="daily-amount"
                  ref={inputRef}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  value={savedAmount}
                  onChange={(e) => {
                    setSavedAmount(e.target.value);
                    setAmountTouched(true);
                  }}
                  placeholder="0"
                  className={styles.amountInput}
                />
                <span className={styles.amountUnit}>€</span>
              </div>
            </div>

            {goals.length > 1 && (
              <select
                aria-label="Asignar a objetivo"
                value={selectedGoalId}
                onChange={(e) => setSelectedGoalId(e.target.value)}
                className={styles.goalSelect}
              >
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}{g.isPrimary ? ' ★' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className={styles.metaRow}>
            {hasSaving ? (
              <span className={styles.savingsPositive}>+{formatEUR(savingAmount)} hacia tu objetivo</span>
            ) : (
              <span className={styles.amountHint}>
                {!amountTouched
                  ? 'Introduce un importe (0 si no ahorraste)'
                  : parsedAmount === null
                  ? 'Introduce un número válido (mínimo 0)'
                  : 'Registrado como 0 €'}
              </span>
            )}
          </div>
        </div>

        <div className={styles.bottomCta}>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedGoalId || !hasValidAmount}
            className={`${styles.btnConfirm} ${hasValidAmount && !hasSaving ? styles.btnConfirmZero : ''}`}
          >
            {!hasValidAmount
              ? 'Introduce un importe para continuar'
              : hasSaving
              ? `Confirmar ${formatEUR(savingAmount)}`
              : 'Hoy no he ahorrado (0 €)'}
          </button>

          <p className={styles.hint}>
            Cualquier respuesta cuenta. Lo importante es ser consciente.
          </p>
        </div>
      </div>
    </div>
  );
}
