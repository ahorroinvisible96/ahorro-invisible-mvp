"use client";

import React, { useEffect, useState } from 'react';
import { analytics } from '@/services/analytics';
import { computeGoalDisplayData, formatEUR } from './PrimaryGoalHeroWidget.logic';
import type { PrimaryGoalHeroProps } from './PrimaryGoalHeroWidget.types';
import styles from './PrimaryGoalHeroWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapsibleWidget } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';

function EmptyState({ onCreateGoal }: { onCreateGoal: () => void }): React.ReactElement {
  return (
    <div className={styles.wrapper}>
      <div className={styles.blurBlue} />
      <div className={styles.blurPurple} />
      <div className={styles.card}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎯</div>
          <p className={styles.emptyTitle}>Sin objetivo principal</p>
          <p className={styles.emptySubtitle}>Define un objetivo para empezar a ahorrar.</p>
          <button className={styles.btnPrimary} onClick={onCreateGoal}>
            Crear objetivo
          </button>
        </div>
      </div>
    </div>
  );
}

export function PrimaryGoalHeroWidget({
  goal,
  estimatedMonthsRemaining,
  dailyCompleted,
  onCreateGoal,
  onOpenGoal,
  onGoToDailyDecision,
  onAddExtraSaving,
  onGoToHistory,
}: PrimaryGoalHeroProps): React.ReactElement {
  const [mounted, setMounted] = useState(false);
  const { collapsed, toggle } = useWidgetCollapse('primary_goal', false);

  useEffect(() => {
    analytics.goalPrimaryWidgetViewed();
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, [goal]);

  if (!goal) return <EmptyState onCreateGoal={onCreateGoal} />;

  const d = computeGoalDisplayData(goal);
  const progressWidth = mounted ? d.progressPct : 0;

  const collapsedSummary = (
    <div className={styles.wrapper}>
      <div className={styles.blurBlue} />
      <div className={styles.blurPurple} />
      <div className={styles.card}>
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            <div className={styles.iconBadge}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
              </svg>
            </div>
            <span className={styles.headerLabel}>OBJETIVO PRINCIPAL</span>
          </div>
          <div className={styles.horizonChip}>{goal.horizonMonths} MESES</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 40 }}>
          <h2 className={styles.title} style={{ margin: 0 }}>{goal.title}</h2>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#60a5fa' }}>{d.progressPct}%</span>
        </div>
      </div>
    </div>
  );

  return (
    <CollapsibleWidget id="primary_goal" collapsed={collapsed} onToggle={toggle} summary={collapsedSummary}>
    <div className={styles.wrapper}>
      <div className={styles.blurBlue} />
      <div className={styles.blurPurple} />

      <div className={styles.card}>
        {/* Header */}
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            <div className={styles.iconBadge}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
              </svg>
            </div>
            <span className={styles.headerLabel}>OBJETIVO PRINCIPAL</span>
          </div>
          <div className={styles.horizonChip}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {goal.horizonMonths} MESES
          </div>
        </div>

        {/* Title */}
        <h2 className={styles.title}>{goal.title}</h2>

        {/* Amounts */}
        <div className={styles.amountsRow}>
          <div className={styles.amountsLeft}>
            <span className={styles.currentAmount}>{formatEUR(goal.currentAmount)}</span>
            <span className={styles.targetAmount}>/ {formatEUR(goal.targetAmount)}</span>
          </div>
          <div className={styles.pctChip}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
            </svg>
            {d.progressPct}%
          </div>
        </div>

        {/* Progress bar */}
        <div className={styles.progressTrack}>
          {d.progressPct === 0 && (
            <span className={styles.progressLabel}>Comienza tu ahorro</span>
          )}
          <div className={styles.progressFill} style={{ width: `${progressWidth}%` }}>
            {d.progressPct > 0 && <div className={styles.shimmer} />}
          </div>
        </div>

        {/* Info box */}
        {!d.isCompleted ? (
          <div className={styles.infoBox}>
            <span className={styles.infoIcon}>✦</span>
            <div>
              <p className={styles.infoText}>
                Te faltan <strong>{formatEUR(d.remainingAmount)}</strong>.
                {estimatedMonthsRemaining != null && (
                  <> ETA: <strong>{estimatedMonthsRemaining} mes{estimatedMonthsRemaining !== 1 ? 'es' : ''}</strong>.</>
                )}
              </p>
              <p className={styles.infoSub}>¡Sigue así! Cada pequeño paso cuenta.</p>
            </div>
          </div>
        ) : (
          <div className={styles.infoBox}>
            <span className={styles.infoIcon}>🏆</span>
            <p className={styles.infoText}>¡Meta alcanzada! ¿Cuál es tu próximo objetivo?</p>
          </div>
        )}

        {/* Buttons */}
        <div className={styles.buttonsRow}>
          {!d.isCompleted ? (
            dailyCompleted ? (
              <button
                className={styles.btnAddFunds}
                onClick={onAddExtraSaving}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Añadir Fondos
              </button>
            ) : (
              <button
                className={styles.btnPrimary}
                onClick={onGoToDailyDecision}
              >
                Ir a Decisión Diaria
              </button>
            )
          ) : (
            <button className={styles.btnPrimary} onClick={onCreateGoal}>
              Crear nueva meta
            </button>
          )}
          <button className={styles.btnSecondary} onClick={onGoToHistory}>
            Ver Detalles
          </button>
        </div>
      </div>
    </div>
    </CollapsibleWidget>
  );
}

export default PrimaryGoalHeroWidget;
