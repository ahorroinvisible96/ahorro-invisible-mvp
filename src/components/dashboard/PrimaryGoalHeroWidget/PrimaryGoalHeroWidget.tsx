"use client";

import React, { useEffect } from 'react';
import { Card, Button, Progress } from '@/components/ui';
import { analytics } from '@/services/analytics';
import { computeGoalDisplayData, formatEUR } from './PrimaryGoalHeroWidget.logic';
import type { PrimaryGoalHeroProps } from './PrimaryGoalHeroWidget.types';
import styles from './PrimaryGoalHeroWidget.module.css';

function EmptyState({ onCreateGoal }: { onCreateGoal: () => void }): React.ReactElement {
  return (
    <Card variant="default" size="md" rounded2xl>
      <Card.Content>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎯</div>
          <p className="text-sm font-medium text-gray-700">Sin objetivo principal</p>
          <p className="text-xs text-gray-500">Define un objetivo para empezar a ahorrar.</p>
          <Button variant="primary" size="sm" onClick={onCreateGoal}>
            Crear objetivo
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}

export function PrimaryGoalHeroWidget({
  goal,
  onCreateGoal,
  onOpenGoal,
}: PrimaryGoalHeroProps): React.ReactElement {
  useEffect(() => {
    analytics.goalPrimaryWidgetViewed();
  }, [goal]);

  if (!goal) return <EmptyState onCreateGoal={onCreateGoal} />;

  const d = computeGoalDisplayData(goal);

  return (
    <Card
      variant="default"
      size="md"
      rounded2xl
      interactive={!d.isCompleted}
      className={styles.hero}
      onClick={!d.isCompleted ? () => onOpenGoal(goal.id) : undefined}
    >
      <Card.Content>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Objetivo principal
          </span>
          <span className={styles.horizonChip}>
            {goal.horizonMonths} MESES
          </span>
        </div>

        <div className={styles.titleRow}>
          <h2 className="text-xl font-semibold text-gray-900 flex-1">{goal.title}</h2>
          {d.isCompleted && (
            <div className={styles.completedBadge}>
              <span>✓</span> Completado
            </div>
          )}
        </div>

        <div className={styles.amounts}>
          <span className={styles.currentAmount}>{formatEUR(goal.currentAmount)}</span>
          <span className={styles.targetAmount}>/ {formatEUR(goal.targetAmount)}</span>
          <span className={styles.pctLabel}>{d.progressPct}%</span>
        </div>

        <div className={styles.progressRow}>
          <Progress
            value={d.progressPct}
            max={100}
            size="md"
            variant={d.isCompleted ? 'success' : 'primary'}
          />
        </div>

        {!d.isCompleted ? (
          <p className={styles.remainingText}>
            Te faltan <strong>{formatEUR(d.remainingAmount)}</strong>. ¡Sigue así!
          </p>
        ) : (
          <div className={styles.completedCta}>
            <p className={styles.completedCtaText}>¡Meta alcanzada! ¿Cuál es tu próximo objetivo?</p>
            <Button variant="primary" size="sm" onClick={onCreateGoal}>
              Crear nueva meta
            </Button>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

export default PrimaryGoalHeroWidget;
