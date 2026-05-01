"use client";

import React, { useEffect, useState } from 'react';
import { analytics } from '@/services/analytics';
import { computeGoalDisplayData, formatEUR } from './PrimaryGoalHeroWidget.logic';
import type { PrimaryGoalHeroProps } from './PrimaryGoalHeroWidget.types';
import styles from './PrimaryGoalHeroWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapsibleWidget, CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';
import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { PlusIcon } from '@/components/ui/AppIcons';

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
          <Button variant="primary" fullWidth onClick={onCreateGoal}>
            Crear objetivo
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatEURCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k€`;
  return `${Math.round(n)}€`;
}

export function PrimaryGoalHeroWidget({
  goal,
  estimatedMonthsRemaining,
  avgMonthlySavings,
  dailyCompleted,
  onCreateGoal,
  onOpenGoal,
  onGoToDailyDecision,
  onAddExtraSaving,
  onGoToHistory,
  onEditGoal,
  variant = 'default',
  phaseLabel,
}: PrimaryGoalHeroProps): React.ReactElement {

  const isHeader = variant === 'header';
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

  return (
    <div className={`${styles.wrapper} ${isHeader ? styles.wrapperHeader : ''}`}>
      {!isHeader && <div className={styles.blurBlue} />}
      {!isHeader && <div className={styles.blurPurple} />}

      <div className={styles.card}>
        {/* Header — siempre visible, chevron a la derecha */}
        <div className={styles.headerRow}>
          <div className={styles.headerActions}>
            <button
              className={styles.horizonChip}
              onClick={() => onEditGoal?.(goal.id)}
            >
              Editar objetivo
            </button>
            <CollapseChevron collapsed={collapsed} onToggle={toggle} />
          </div>
        </div>

        {/* Resumen mínimo siempre visible al plegar */}
        <div
          className={styles.summaryRow}
          onClick={collapsed ? toggle : undefined}
        >
          <div>
            <h2 className={`${styles.title} ${collapsed ? styles.titleCollapsed : ''}`}>{goal.title}</h2>
            {phaseLabel && (
              <Badge variant="primary" size="sm" pill uppercase bold className={styles.phaseChip}>
                {phaseLabel}
              </Badge>
            )}
          </div>
          {collapsed && <span className={styles.collapsedPct}>{d.progressPct}%</span>}
        </div>

        {/* Cuerpo colapsable */}
        {!collapsed && (
          <>
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

            {/* Sub-goal context: hacia meta final */}
            {goal.finalGoalAmount && goal.finalGoalAmount > goal.targetAmount && (
              <div className={styles.subGoalContext}>
                <span className={styles.subGoalIcon}>🗺️</span>
                <p className={styles.subGoalText}>
                  Paso {(goal.subGoalIndex ?? 0) + 1} hacia tu objetivo final de{' '}
                  <strong>{formatEUR(goal.finalGoalAmount)}</strong>
                </p>
              </div>
            )}

            {/* Info box */}
            {!d.isCompleted ? (
              <div className={styles.infoBox}>
                <span className={styles.infoIcon}>✶</span>
                <div>
                  <p className={styles.infoText}>
                    Te faltan <strong>{formatEUR(d.remainingAmount)}</strong>.
                    {avgMonthlySavings != null && avgMonthlySavings > 0 ? (
                      <> A este ritmo (<strong>{formatEURCompact(avgMonthlySavings)}/mes</strong>) llegas en <strong>{estimatedMonthsRemaining ?? '?'} mes{estimatedMonthsRemaining !== 1 ? 'es' : ''}</strong>.</>
                    ) : estimatedMonthsRemaining != null ? (
                      <> ETA estimado: <strong>{estimatedMonthsRemaining} mes{estimatedMonthsRemaining !== 1 ? 'es' : ''}</strong>.</>
                    ) : null}
                  </p>
                </div>
              </div>
            ) : (
              <div className={styles.infoBox}>
                <span className={styles.infoIcon}>🏆</span>
                <p className={styles.infoText}>¡Meta alcanzada! ¿Cuál es tu próximo objetivo?</p>
              </div>
            )}

            {/* Button — solo CTA principal */}
            <div className={styles.buttonsRow}>
              {!d.isCompleted ? (
                dailyCompleted ? (
                  <Button
                    variant="primary"
                    fullWidth
                    icon={<PlusIcon size={14} />}
                    onClick={onAddExtraSaving}
                  >
                    Añadir Fondos
                  </Button>
                ) : (
                  <Button variant="primary" fullWidth onClick={onGoToDailyDecision}>
                    Ir a Decisión Diaria
                  </Button>
                )
              ) : (
                <Button variant="primary" fullWidth onClick={onCreateGoal}>
                  Crear nueva meta
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PrimaryGoalHeroWidget;
