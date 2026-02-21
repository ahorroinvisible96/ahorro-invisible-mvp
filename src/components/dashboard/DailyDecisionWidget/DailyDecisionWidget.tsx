"use client";

import React, { useState, useEffect } from 'react';
import { analytics } from '@/services/analytics';
import { getTodayQuestion, DAILY_DECISION_RULES } from '@/services/dashboardStore';
import type { DailyDecisionWidgetProps } from './DailyDecisionWidget.types';
import styles from './DailyDecisionWidget.module.css';

export function DailyDecisionWidget({
  daily,
  primaryGoal,
  allGoals,
  onSubmitDecision,
  onGoToImpact,
  onCreateGoal,
}: DailyDecisionWidgetProps): React.ReactElement {
  const activeGoals = allGoals.filter((g) => !g.archived);
  const todayQuestion = getTodayQuestion();

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showGoalSelection, setShowGoalSelection] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string>(
    primaryGoal?.id ?? activeGoals[0]?.id ?? '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    analytics.dailyCtaCardViewed(daily.status);
  }, [daily.status]);

  useEffect(() => {
    if (primaryGoal?.id) setSelectedGoalId(primaryGoal.id);
  }, [primaryGoal?.id]);

  // Calcular delta de la respuesta seleccionada
  const savingsDelta = selectedAnswer
    ? (DAILY_DECISION_RULES.find(
        (r) => r.questionId === todayQuestion.questionId && r.answerKey === selectedAnswer,
      )?.immediateDelta ?? 0)
    : 0;

  const isSavingAnswer = savingsDelta > 0;

  // ── Estado: sin objetivos ────────────────────────────────────────────────
  if (activeGoals.length === 0) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.blurBlue} />
        <div className={styles.blurPurple} />
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.iconBadge}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
                </svg>
              </div>
              <span className={styles.headerLabel}>DECISIÓN DIARIA</span>
            </div>
          </div>
          <p className={styles.title}>Sin objetivo activo</p>
          <p className={styles.subtitle}>Crea un objetivo para empezar a tomar decisiones diarias.</p>
          <button className={styles.btnPrimary} onClick={onCreateGoal}>Crear objetivo</button>
        </div>
      </div>
    );
  }

  // ── Estado: completada hoy ───────────────────────────────────────────────
  if (daily.status === 'completed') {
    return (
      <div className={styles.wrapper}>
        <div className={styles.blurBlue} />
        <div className={styles.blurPurple} />
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.iconBadge}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
                </svg>
              </div>
              <span className={styles.headerLabel}>DECISIÓN DIARIA</span>
            </div>
            <div className={styles.badgeCompleted}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Completado
            </div>
          </div>
          <p className={styles.title}>¡Decisión tomada hoy!</p>
          <p className={styles.subtitle}>Ya registraste tu ahorro de hoy. Tu objetivo avanza.</p>
          {daily.decisionId && (
            <button
              className={styles.btnOutline}
              onClick={() => { analytics.dailyCtaClicked('completed', 'impact'); onGoToImpact(daily.decisionId!); }}
            >
              Ver impacto →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleConfirm() {
    if (!selectedAnswer) return;
    if (isSavingAnswer) {
      setShowGoalSelection(true);
    } else {
      submitDecision(selectedGoalId);
    }
  }

  function handleGoalConfirm() {
    if (!selectedGoalId) return;
    submitDecision(selectedGoalId);
  }

  function submitDecision(goalId: string) {
    setSubmitting(true);
    analytics.dailyAnswerSubmitted(
      daily.date,
      todayQuestion.questionId,
      selectedAnswer!,
      goalId,
      primaryGoal?.id === goalId,
    );
    onSubmitDecision(todayQuestion.questionId, selectedAnswer!, goalId);
    setConfirmed(true);
    setTimeout(() => {
      setSubmitting(false);
      setConfirmed(false);
      setSelectedAnswer(null);
      setShowGoalSelection(false);
    }, 2000);
  }

  function handleBack() {
    setShowGoalSelection(false);
  }

  // ── Mensaje motivacional ─────────────────────────────────────────────────
  const motivationalMsg = selectedAnswer
    ? isSavingAnswer
      ? '¡Excelente! Estás construyendo buenos hábitos financieros y sumando a tu objetivo.'
      : 'No te preocupes, lo importante es ser consciente de tus decisiones financieras.'
    : null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.wrapper}>
      <div className={styles.blurBlue} />
      <div className={styles.blurPurple} />
      <div className={styles.card}>

        {/* Header — siempre visible */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconBadge}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
              </svg>
            </div>
            <span className={styles.headerLabel}>DECISIÓN DIARIA</span>
          </div>
          {!confirmed ? (
            <div className={styles.badgePending}>
              <span className={styles.badgeDot} />
              Pendiente
            </div>
          ) : (
            <div className={styles.badgeCompleted}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Completado
            </div>
          )}
        </div>

        {/* ── PANTALLA 1: Decisión ── */}
        {!showGoalSelection ? (
          <>
            <h2 className={styles.title}>{todayQuestion.text}</h2>

            <div className={styles.answers}>
              {todayQuestion.answers.map((a) => {
                const isSelected = selectedAnswer === a.key;
                const rule = DAILY_DECISION_RULES.find(
                  (r) => r.questionId === todayQuestion.questionId && r.answerKey === a.key,
                );
                const delta = rule?.immediateDelta ?? 0;
                return (
                  <button
                    key={a.key}
                    onClick={() => setSelectedAnswer(a.key)}
                    disabled={submitting}
                    className={`${styles.answerBtn} ${
                      isSelected && delta > 0
                        ? styles.answerBtnSaving
                        : isSelected
                        ? styles.answerBtnSelected
                        : ''
                    }`}
                  >
                    <div className={styles.answerLeft}>
                      <div className={`${styles.radio} ${isSelected ? styles.radioSelected : ''}`}>
                        {isSelected && <div className={styles.radioDot} />}
                      </div>
                      <span className={styles.answerLabel}>{a.label}</span>
                    </div>
                    {isSelected && delta > 0 && (
                      <div className={styles.savingsBadge}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                        </svg>
                        +{delta}€ ahorrado
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              className={`${styles.btnPrimary} ${!selectedAnswer || submitting ? styles.btnDisabled : ''}`}
              onClick={handleConfirm}
              disabled={!selectedAnswer || submitting}
            >
              {confirmed ? (
                <span className={styles.confirmedContent}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Decisión Confirmada
                </span>
              ) : 'Confirmar decisión'}
            </button>

            {motivationalMsg && !confirmed && (
              <div className={styles.motivBox}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.motivIcon}>
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span className={styles.motivText}>{motivationalMsg}</span>
              </div>
            )}
          </>
        ) : (
          /* ── PANTALLA 2: Selección de objetivo ── */
          <>
            <h2 className={styles.title}>Asignar ahorro a objetivo</h2>
            <p className={styles.subtitle}>
              Selecciona a qué objetivo quieres destinar los{' '}
              <span className={styles.deltaHighlight}>{savingsDelta}€</span>
            </p>

            <div className={styles.goalList}>
              {activeGoals.map((g) => {
                const isSelected = selectedGoalId === g.id;
                const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGoalId(g.id)}
                    disabled={submitting}
                    className={`${styles.goalBtn} ${isSelected ? styles.goalBtnSelected : ''} ${submitting ? styles.goalBtnDisabled : ''}`}
                  >
                    <div className={styles.goalBtnTop}>
                      <div className={`${styles.radio} ${isSelected ? styles.radioSelected : ''}`}>
                        {isSelected && <div className={styles.radioDot} />}
                      </div>
                      <div className={styles.goalBtnName}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#60a5fa', flexShrink: 0 }}>
                          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                        </svg>
                        <span className={styles.goalBtnTitle}>{g.title}</span>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        style={{ color: isSelected ? '#60a5fa' : 'rgba(148,163,184,0.5)', flexShrink: 0 }}>
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                    <div className={styles.goalProgress}>
                      <div className={styles.goalAmounts}>
                        <span>{g.currentAmount.toLocaleString('es-ES')}€</span>
                        <span>{g.targetAmount.toLocaleString('es-ES')}€</span>
                      </div>
                      <div className={styles.goalTrack}>
                        <div className={styles.goalFill} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className={styles.goalActions}>
              <button
                className={styles.btnBack}
                onClick={handleBack}
                disabled={submitting}
              >
                Volver
              </button>
              <button
                className={`${styles.btnPrimary} ${styles.btnPrimaryFlex} ${!selectedGoalId || submitting ? styles.btnDisabled : ''}`}
                onClick={handleGoalConfirm}
                disabled={!selectedGoalId || submitting}
              >
                {confirmed ? (
                  <span className={styles.confirmedContent}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Confirmado
                  </span>
                ) : 'Confirmar'}
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

export default DailyDecisionWidget;
