"use client";

import React, { useEffect, useState } from 'react';
import { analytics } from '@/services/analytics';
import { computeGoalDisplayData, formatEUR } from './PrimaryGoalHeroWidget.logic';
import type { PrimaryGoalHeroProps } from './PrimaryGoalHeroWidget.types';
import styles from './PrimaryGoalHeroWidget.module.css';
import { PlusIcon, BoltIcon, TargetIcon, EditIcon } from '@/components/ui/AppIcons';

function EmptyState({ onCreateGoal }: { onCreateGoal: () => void }): React.ReactElement {
  return (
    <div className={styles.wrapper} data-widget-cat="progress">
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>
          <TargetIcon size={26} />
        </div>
        <p className={styles.emptyTitle}>Sin objetivo principal</p>
        <p className={styles.emptySubtitle}>Define un objetivo para empezar a ahorrar.</p>
        <button type="button" className={styles.emptyBtn} onClick={onCreateGoal}>
          Crear objetivo
        </button>
      </div>
    </div>
  );
}

function formatNumberOnly(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 0,
  }).format(amount);
}

export function PrimaryGoalHeroWidget({
  goal,
  dailyCompleted,
  onCreateGoal,
  onOpenGoal,
  onOpenGoals,
  onGoToDailyDecision,
  onAddExtraSaving,
  onEditGoal,
  variant = 'default',
  phaseLabel,
}: PrimaryGoalHeroProps): React.ReactElement {
  const isHeader = variant === 'header';
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    analytics.goalPrimaryWidgetViewed();
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, [goal]);

  if (!goal) return <EmptyState onCreateGoal={onCreateGoal} />;

  const d = computeGoalDisplayData(goal);
  const progressWidth = mounted ? d.progressPct : 0;

  return (
    <div
      className={`${styles.wrapper} ${isHeader ? styles.wrapperHeader : styles.wrapperCard}`}
      data-widget-cat="progress"
    >
      {/* ── Hero abierto centrado sobre el degradado atmosférico ── */}
      <div className={styles.heroBody}>
        <button
          type="button"
          className={styles.eyebrowBtn}
          onClick={() => onOpenGoal(goal.id)}
          title={phaseLabel ?? goal.title}
        >
          <span className={styles.eyebrowTitle}>{goal.title}</span>
          <span className={styles.eyebrowDot} aria-hidden="true">·</span>
          <span className={styles.eyebrowPct}>{d.progressPct}%</span>
        </button>

        <div className={styles.balanceRow} aria-label={`Ahorrado ${formatEUR(goal.currentAmount)}`}>
          <span className={styles.balanceNum}>{formatNumberOnly(goal.currentAmount)}</span>
          <span className={styles.balanceCur}>€</span>
        </div>

        <button
          type="button"
          className={styles.metaPill}
          onClick={() => onOpenGoal(goal.id)}
        >
          {d.isCompleted
            ? 'Meta alcanzada'
            : `Meta ${formatEUR(goal.targetAmount)}`}
        </button>

        {goal.finalGoalAmount && goal.finalGoalAmount > goal.targetAmount && (
          <p className={styles.subGoalCaption}>
            Paso {(goal.subGoalIndex ?? 0) + 1} hacia {formatEUR(goal.finalGoalAmount)}
          </p>
        )}

        <div
          className={styles.progressSliver}
          role="progressbar"
          aria-valuenow={d.progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progreso de ${goal.title}`}
        >
          <div className={styles.progressSliverFill} style={{ width: `${progressWidth}%` }} />
        </div>
      </div>

      {/* ── 4 acciones circulares Liquid Glass (mapeadas 1:1 a handlers existentes) ── */}
      <div className={styles.actionsRow}>
        <button
          type="button"
          className={styles.actionItem}
          onClick={onAddExtraSaving}
          aria-label="Añadir ahorro extra"
        >
          <span className={styles.actionCircle}>
            <PlusIcon size={20} />
          </span>
          <span className={styles.actionLabel}>Añadir</span>
        </button>

        <button
          type="button"
          className={styles.actionItem}
          onClick={d.isCompleted ? onCreateGoal : onGoToDailyDecision}
          aria-label={d.isCompleted ? 'Crear nueva meta' : 'Ir a decisión diaria'}
        >
          <span className={`${styles.actionCircle} ${!dailyCompleted && !d.isCompleted ? styles.actionCircleActive : ''}`}>
            <BoltIcon size={19} />
          </span>
          <span className={styles.actionLabel}>{d.isCompleted ? 'Nueva' : 'Decidir'}</span>
        </button>

        <button
          type="button"
          className={styles.actionItem}
          onClick={onOpenGoals ?? (() => onOpenGoal(goal.id))}
          aria-label="Ver objetivos"
        >
          <span className={styles.actionCircle}>
            <TargetIcon size={19} />
          </span>
          <span className={styles.actionLabel}>Objetivos</span>
        </button>

        <button
          type="button"
          className={styles.actionItem}
          onClick={() => onEditGoal?.(goal.id)}
          aria-label="Editar objetivo"
        >
          <span className={styles.actionCircle}>
            <EditIcon size={18} />
          </span>
          <span className={styles.actionLabel}>Editar</span>
        </button>
      </div>
    </div>
  );
}

export default PrimaryGoalHeroWidget;
