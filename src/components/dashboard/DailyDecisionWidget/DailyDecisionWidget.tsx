"use client";

import React, { useEffect } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { analytics } from '@/services/analytics';
import { resolveDailyWidgetState } from './DailyDecisionWidget.logic';
import type { DailyDecisionWidgetProps } from './DailyDecisionWidget.types';
import styles from './DailyDecisionWidget.module.css';

export function DailyDecisionWidget({
  daily,
  primaryGoal,
  onGoToDailyQuestion,
  onGoToImpact,
  onCreateGoal,
}: DailyDecisionWidgetProps): React.ReactElement {
  const widgetState = resolveDailyWidgetState(daily, primaryGoal);

  useEffect(() => {
    analytics.dailyCtaCardViewed(daily.status);
    if (widgetState === 'disabled') {
      analytics.dailyCtaCardViewed('pending');
    }
  }, [daily.status, widgetState]);

  const dotClass =
    widgetState === 'pending' ? styles.dotPending :
    widgetState === 'completed' ? styles.dotCompleted :
    widgetState === 'error' ? styles.dotError :
    styles.dotDisabled;

  if (widgetState === 'disabled') {
    return (
      <Card variant="default" size="md" rounded2xl className={styles.disabledCard}>
        <Card.Content>
          <div className={styles.statusRow}>
            <span className={`${styles.dot} ${styles.dotDisabled}`} />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Decisión diaria
            </span>
          </div>
          <p className={styles.headline}>Sin objetivo activo</p>
          <p className={styles.sub}>Crea un objetivo para empezar a tomar decisiones diarias.</p>
          <Button variant="primary" size="sm" onClick={onCreateGoal}>
            Crear objetivo
          </Button>
        </Card.Content>
      </Card>
    );
  }

  if (widgetState === 'error') {
    return (
      <Card variant="default" size="md" rounded2xl>
        <Card.Content>
          <div className={styles.statusRow}>
            <span className={`${styles.dot} ${styles.dotError}`} />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Decisión diaria
            </span>
          </div>
          <p className={styles.headline}>Algo salió mal</p>
          <p className={styles.errorNote}>
            La decisión fue registrada pero no se encontró el identificador. Recarga la página.
          </p>
        </Card.Content>
      </Card>
    );
  }

  const isCompleted = widgetState === 'completed';

  return (
    <Card variant="default" size="md" rounded2xl className={styles.widget}>
      <Card.Content>
        <div className={styles.statusRow}>
          <span className={`${styles.dot} ${dotClass}`} />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Decisión diaria
          </span>
          <Badge
            variant={isCompleted ? 'success' : 'warning'}
            size="sm"
            withDot={isCompleted}
          >
            {isCompleted ? 'Completada' : 'Pendiente'}
          </Badge>
        </div>

        <p className={styles.headline}>
          {isCompleted ? '¡Decisión tomada hoy!' : 'Tu decisión de hoy'}
        </p>
        <p className={styles.sub}>
          {isCompleted
            ? 'Ya tomaste tu decisión de ahorro. Consulta el impacto acumulado.'
            : 'Una pequeña decisión diaria construye un gran resultado. ¿Cómo decides hoy?'}
        </p>

        <div className={styles.ctaRow}>
          {isCompleted ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                analytics.dailyCtaClicked('completed', 'impact');
                if (daily.decisionId) onGoToImpact(daily.decisionId);
              }}
            >
              Ver impacto →
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                analytics.dailyCtaClicked('pending', 'daily_question');
                onGoToDailyQuestion();
              }}
            >
              Responder ahora
            </Button>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}

export default DailyDecisionWidget;
