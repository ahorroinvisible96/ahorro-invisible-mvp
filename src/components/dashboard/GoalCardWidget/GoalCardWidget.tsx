"use client";

import React, { useState, useEffect } from 'react';
import { Card, Progress, Badge } from '@/components/ui';
import { analytics } from '@/services/analytics';
import { computeGoalPct, computeGoalRemaining, formatEUR } from './GoalCardWidget.logic';
import type { GoalCardWidgetProps } from './GoalCardWidget.types';
import styles from './GoalCardWidget.module.css';

export function GoalCardWidget({
  goal,
  onOpenGoal,
  onArchiveGoal,
  onSetPrimary,
  onEditGoal,
}: GoalCardWidgetProps): React.ReactElement {
  const [archiving, setArchiving] = useState(false);
  const pct = computeGoalPct(goal);
  const remaining = computeGoalRemaining(goal);
  const isCompleted = goal.currentAmount >= goal.targetAmount;

  useEffect(() => {
    analytics.goalPrimaryWidgetViewed();
  }, [goal.id]);

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`¿Archivar "${goal.title}"?`)) return;
    setArchiving(true);
    analytics.goalArchived(goal.id, goal.isPrimary);
    onArchiveGoal(goal.id);
  };

  const handleSetPrimary = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSetPrimary(goal.id);
  };

  return (
    <Card
      variant="default"
      size="sm"
      rounded2xl
      interactive
      className={`${styles.card} ${archiving ? styles.archiving : ''}`}
      onClick={() => {
        onOpenGoal(goal.id);
      }}
    >
      <Card.Content>
        <div className={styles.header}>
          <span className={styles.title}>{goal.title}</span>
          {goal.isPrimary && (
            <span className={styles.primaryBadge}>PRINCIPAL</span>
          )}
          {isCompleted && (
            <Badge variant="success" size="sm">Completado</Badge>
          )}
        </div>

        <div className={styles.amounts}>
          <span className={styles.current}>{formatEUR(goal.currentAmount)}</span>
          <span className={styles.target}>/ {formatEUR(goal.targetAmount)}</span>
          <span className={styles.pct}>{pct}%</span>
        </div>

        <div className={styles.progressRow}>
          <Progress
            value={pct}
            max={100}
            size="sm"
            variant={isCompleted ? 'success' : 'primary'}
          />
        </div>

        {!isCompleted && (
          <p className="text-xs text-gray-500 mb-2">
            Faltan <strong>{formatEUR(remaining)}</strong> · {goal.horizonMonths} meses
          </p>
        )}

        <div className={styles.actions}>
          {!goal.isPrimary && (
            <button className={styles.primaryBtn} onClick={handleSetPrimary}>
              Hacer principal
            </button>
          )}
          {onEditGoal && (
            <button className={styles.editBtn} onClick={(e) => { e.stopPropagation(); onEditGoal(goal.id); }}>
              Editar
            </button>
          )}
          <button
            className={styles.archiveBtn}
            onClick={handleArchive}
            disabled={archiving}
          >
            {archiving ? 'Archivando...' : 'Archivar'}
          </button>
        </div>
      </Card.Content>
    </Card>
  );
}

export default GoalCardWidget;
