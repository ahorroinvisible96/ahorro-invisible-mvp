"use client";

import React, { useState, useEffect } from 'react';
import { analytics } from '@/services/analytics';
import { getTodayQuestion, DAILY_DECISION_RULES } from '@/services/dashboardStore';
import type { DailyDecisionWidgetProps } from './DailyDecisionWidget.types';
import styles from './DailyDecisionWidget.module.css';

function CoffeeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
      <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  );
}

function WidgetHeader({ completed }: { completed: boolean }) {
  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        <div className={styles.iconBadge}><CoffeeIcon /></div>
        <span className={styles.headerLabel}>DECISIÓN DIARIA</span>
      </div>
      {completed ? (
        <div className={styles.badgeCompleted}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Completado
        </div>
      ) : (
        <div className={styles.badgePending}>
          <span className={styles.badgeDot} /> Pendiente
        </div>
      )}
    </div>
  );
}

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
  const [selectedGoalId, setSelectedGoalId] = useState<string>(
    primaryGoal?.id ?? activeGoals[0]?.id ?? '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    analytics.dailyCtaCardViewed(daily.status);
  }, [daily.status]);

  useEffect(() => {
    const preferred = primaryGoal?.id ?? activeGoals[0]?.id ?? '';
    setSelectedGoalId(preferred);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryGoal?.id, activeGoals.length]);

  // Delta real desde DAILY_DECISION_RULES — nunca hardcodeado
  const selectedRule = selectedAnswer
    ? DAILY_DECISION_RULES.find(
        (r) => r.questionId === todayQuestion.questionId && r.answerKey === selectedAnswer,
      ) ?? null
    : null;

  if (selectedAnswer && !selectedRule) {
    console.error(`[DailyDecisionWidget] Sin regla para ${todayQuestion.questionId}/${selectedAnswer}`);
  }

  const savingsDelta = selectedRule?.immediateDelta ?? 0;
  const isSavingAnswer = savingsDelta > 0;

  // Confirmar solo si: respuesta + (si hay ahorro → objetivo) + no enviado
  const canConfirm =
    !!selectedAnswer &&
    (!isSavingAnswer || (isSavingAnswer && !!selectedGoalId && activeGoals.length > 0)) &&
    !submitting &&
    !confirmed;

  // ── Estado: completada hoy ───────────────────────────────────────────────
  if (daily.status === 'completed') {
    return (
      <div className={styles.wrapper}>
        <div className={styles.blurBlue} />
        <div className={styles.blurPurple} />
        <div className={styles.card}>
          <WidgetHeader completed />
          <h2 className={styles.title}>¡Decisión tomada hoy!</h2>
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

  // ── Handler único de confirmación ────────────────────────────────────────
  function handleConfirm() {
    if (!canConfirm) return;
    const goalId = isSavingAnswer ? selectedGoalId : (activeGoals[0]?.id ?? '');
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
    setTimeout(() => setSubmitting(false), 1800);
  }

  // ── Mensaje motivacional ─────────────────────────────────────────────────
  const motivationalMsg = selectedAnswer && !confirmed
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

        <WidgetHeader completed={confirmed} />

        <h2 className={styles.title}>{todayQuestion.text}</h2>

        {/* ── Opciones: precio SIEMPRE visible si delta > 0 ── */}
        <div className={styles.answers}>
          {todayQuestion.answers.map((a) => {
            const rule = DAILY_DECISION_RULES.find(
              (r) => r.questionId === todayQuestion.questionId && r.answerKey === a.key,
            );
            const delta = rule?.immediateDelta ?? 0;
            const isSelected = selectedAnswer === a.key;
            return (
              <button
                key={a.key}
                onClick={() => !submitting && !confirmed && setSelectedAnswer(a.key)}
                disabled={submitting || confirmed}
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
                {/* Precio siempre visible si la opción tiene ahorro */}
                {delta > 0 && (
                  <div className={`${styles.savingsBadge} ${isSelected ? styles.savingsBadgeActive : styles.savingsBadgeDim}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                      <polyline points="17 6 23 6 23 12"/>
                    </svg>
                    +{delta}€
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Selector de objetivo inline: solo si la respuesta tiene ahorro ── */}
        {isSavingAnswer && (
          <div className={styles.goalSection}>
            <p className={styles.goalSectionLabel}>
              Destinar <span className={styles.deltaHighlight}>+{savingsDelta}€</span> a:
            </p>

            {activeGoals.length === 0 ? (
              /* Sin objetivos: CTA inline dentro del mismo widget */
              <div className={styles.noGoalsBox}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.noGoalsIcon}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <div>
                  <p className={styles.noGoalsText}>No tienes objetivos creados.</p>
                  <button className={styles.noGoalsBtn} onClick={onCreateGoal}>
                    Crear objetivo →
                  </button>
                </div>
              </div>
            ) : (
              /* Lista real de objetivos activos */
              <div className={styles.goalList}>
                {activeGoals.map((g) => {
                  const isSelected = selectedGoalId === g.id;
                  const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
                  return (
                    <button
                      key={g.id}
                      onClick={() => !submitting && !confirmed && setSelectedGoalId(g.id)}
                      disabled={submitting || confirmed}
                      className={`${styles.goalBtn} ${isSelected ? styles.goalBtnSelected : ''} ${submitting ? styles.goalBtnDisabled : ''}`}
                    >
                      <div className={styles.goalBtnTop}>
                        <div className={`${styles.radio} ${isSelected ? styles.radioSelected : ''}`}>
                          {isSelected && <div className={styles.radioDot} />}
                        </div>
                        <div className={styles.goalBtnName}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#60a5fa', flexShrink: 0 }}>
                            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                          </svg>
                          <span className={styles.goalBtnTitle}>{g.title}</span>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          style={{ color: isSelected ? '#60a5fa' : 'rgba(148,163,184,0.4)', flexShrink: 0 }}>
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
            )}
          </div>
        )}

        {/* ── Mensaje motivacional ── */}
        {motivationalMsg && (
          <div className={styles.motivBox}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.motivIcon}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span className={styles.motivText}>{motivationalMsg}</span>
          </div>
        )}

        {/* ── Botón confirmar ── */}
        <button
          className={`${styles.btnPrimary} ${!canConfirm ? styles.btnDisabled : ''}`}
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          {confirmed ? (
            <span className={styles.confirmedContent}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Decisión Confirmada
            </span>
          ) : 'Confirmar decisión'}
        </button>

      </div>
    </div>
  );
}

export default DailyDecisionWidget;
