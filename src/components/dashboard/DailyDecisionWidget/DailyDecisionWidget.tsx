"use client";

import React, { useState, useEffect } from 'react';
import { Card, Badge } from '@/components/ui';
import { analytics } from '@/services/analytics';
import { getTodayQuestion } from '@/services/dashboardStore';
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
  const [selectedGoalId, setSelectedGoalId] = useState<string>(
    primaryGoal?.id ?? activeGoals[0]?.id ?? '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    analytics.dailyCtaCardViewed(daily.status);
  }, [daily.status]);

  useEffect(() => {
    if (primaryGoal?.id) setSelectedGoalId(primaryGoal.id);
  }, [primaryGoal?.id]);

  // ── Estado: sin objetivos activos ────────────────────────────────────────
  if (activeGoals.length === 0) {
    return (
      <Card variant="default" size="md" rounded2xl className={styles.disabledCard}>
        <Card.Content>
          <div className={styles.statusRow}>
            <span className={`${styles.dot} ${styles.dotDisabled}`} />
            <span className={styles.sectionLabel}>Decisión diaria</span>
          </div>
          <p className={styles.headline}>Sin objetivo activo</p>
          <p className={styles.sub}>Crea un objetivo para empezar a tomar decisiones diarias.</p>
          <button className={styles.primaryBtn} onClick={onCreateGoal}>
            Crear objetivo
          </button>
        </Card.Content>
      </Card>
    );
  }

  // ── Estado: completada hoy ────────────────────────────────────────────────
  if (daily.status === 'completed') {
    return (
      <Card variant="default" size="md" rounded2xl className={styles.widget}>
        <Card.Content>
          <div className={styles.statusRow}>
            <span className={`${styles.dot} ${styles.dotCompleted}`} />
            <span className={styles.sectionLabel}>Decisión diaria</span>
            <Badge variant="success" size="sm" withDot>Completada</Badge>
          </div>
          <p className={styles.headline}>¡Decisión tomada hoy!</p>
          <p className={styles.sub}>
            Ya registraste tu ahorro de hoy. Tu objetivo avanza.
          </p>
          {daily.decisionId && (
            <button
              className={styles.outlineBtn}
              onClick={() => {
                analytics.dailyCtaClicked('completed', 'impact');
                onGoToImpact(daily.decisionId!);
              }}
            >
              Ver impacto →
            </button>
          )}
        </Card.Content>
      </Card>
    );
  }

  // ── Estado: pendiente — mostrar pregunta inline ───────────────────────────
  function handleSubmit() {
    if (!selectedAnswer || !selectedGoalId) return;
    setSubmitting(true);
    analytics.dailyAnswerSubmitted(
      daily.date,
      todayQuestion.questionId,
      selectedAnswer,
      selectedGoalId,
      primaryGoal?.id === selectedGoalId,
    );
    onSubmitDecision(todayQuestion.questionId, selectedAnswer, selectedGoalId);
    setSubmitting(false);
    setJustSaved(true);
  }

  return (
    <Card variant="default" size="md" rounded2xl className={styles.widget}>
      <Card.Content>
        <div className={styles.statusRow}>
          <span className={`${styles.dot} ${styles.dotPending}`} />
          <span className={styles.sectionLabel}>Decisión diaria</span>
          <Badge variant="warning" size="sm">Pendiente</Badge>
        </div>

        <p className={styles.headline}>{todayQuestion.text}</p>

        {activeGoals.length > 1 && (
          <div className={styles.goalSelector}>
            <span className={styles.goalSelectorLabel}>Objetivo:</span>
            <select
              className={styles.goalSelect}
              value={selectedGoalId}
              onChange={(e) => setSelectedGoalId(e.target.value)}
            >
              {activeGoals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}{g.isPrimary ? ' ★' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.answers}>
          {todayQuestion.answers.map((a) => (
            <button
              key={a.key}
              className={`${styles.answerBtn} ${selectedAnswer === a.key ? styles.answerBtnSelected : ''}`}
              onClick={() => setSelectedAnswer(a.key)}
              disabled={submitting}
            >
              <span className={styles.answerLabel}>{a.label}</span>
              {a.savingsHint && (
                <span className={styles.savingsHint}>{a.savingsHint}</span>
              )}
            </button>
          ))}
        </div>

        {justSaved && (
          <p className={styles.savedNote}>✓ Guardado</p>
        )}

        <button
          className={styles.primaryBtn}
          onClick={handleSubmit}
          disabled={!selectedAnswer || !selectedGoalId || submitting}
        >
          {submitting ? 'Guardando...' : 'Confirmar decisión'}
        </button>
      </Card.Content>
    </Card>
  );
}

export default DailyDecisionWidget;
