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
    <div className={styles.wrapper} data-widget-cat="progress">
      <div className={styles.blurBlue} />
      <div className={styles.blurPurple} />
      <div className={styles.card}>
        <div className={styles.emptyState}>
          {/* SVG target — igual que TargetIcon del Design System */}
          <div className={styles.emptyIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(148,163,184,0.40)' }}>
              <circle cx="12" cy="12" r="8.5"/>
              <circle cx="12" cy="12" r="3.5"/>
              <circle cx="12" cy="12" r="1" strokeWidth="0" fill="currentColor"/>
            </svg>
          </div>
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
    <div className={`${styles.wrapper} ${isHeader ? styles.wrapperHeader : ''}`} data-widget-cat="progress">
      {!isHeader && <div className={styles.blurBlue} />}
      {!isHeader && <div className={styles.blurPurple} />}

        <div className={styles.card}>
        {/* Header — siempre visible, chevron a la derecha */}
        <div className={styles.headerRow}>
          <div className={styles.headerActions}>
            {/* Lápiz discreto — solo icono, tooltip descriptivo */}
            <button
              className={styles.editIconBtn}
              onClick={() => onEditGoal?.(goal.id)}
              title="Editar objetivo"
              aria-label="Editar objetivo"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
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
            {/* Amounts — solo importe, sin chip % duplicado */}
            <div className={styles.amountsRow}>
              <div className={styles.amountsLeft}>
                <span className={styles.currentAmount}>{formatEUR(goal.currentAmount)}</span>
                <span className={styles.targetAmount}>/ {formatEUR(goal.targetAmount)}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className={styles.progressBarArea}>
              {/* % label visualmente conectado a la barra */}
              <div className={styles.progressBarLabel}>
                <span className={styles.progressBarLabelPct}>{d.progressPct}% conseguido</span>
                <span className={styles.progressBarLabelTarget}>{formatEUR(goal.targetAmount)}</span>
              </div>
              <div className={styles.progressTrack}>
                {d.progressPct === 0 && (
                  <span className={styles.progressLabel}>Comienza tu ahorro</span>
                )}
                <div className={styles.progressFill} style={{ width: `${progressWidth}%` }}>
                  {d.progressPct > 0 && <div className={styles.shimmer} />}
                </div>
              </div>
            </div>

            {/* Sub-goal context: hacia meta final */}
            {goal.finalGoalAmount && goal.finalGoalAmount > goal.targetAmount && (
              <div className={styles.subGoalContext}>
                {/* SVG ruta — sin emoji */}
                <svg className={styles.subGoalIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 17l4-4 4 4 4-6 4 2"/>
                  <line x1="3" y1="21" x2="21" y2="21"/>
                </svg>
                <p className={styles.subGoalText}>
                  Paso {(goal.subGoalIndex ?? 0) + 1} hacia tu objetivo final de{' '}
                  <strong>{formatEUR(goal.finalGoalAmount)}</strong>
                </p>
              </div>
            )}

            {/* Info box */}
            {!d.isCompleted ? (
              <div className={styles.infoBox}>
                {/* SVG info icon — coherente con el Design System */}
                <svg className={styles.infoIconSvg} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
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
                <svg className={styles.infoIconSvg} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <p className={styles.infoText}>¡Meta alcanzada! ¿Cuál es tu próximo objetivo?</p>
              </div>
            )}

            {/* Button — solo CTA principal */}
            <div className={styles.buttonsRow}>
              {!d.isCompleted ? (
                dailyCompleted ? (
                  <Button
                    variant="heroPrimary"
                    fullWidth
                    icon={<PlusIcon size={14} />}
                    onClick={onAddExtraSaving}
                  >
                    Añadir Fondos
                  </Button>
                ) : (
                  <Button variant="heroPrimary" fullWidth onClick={onGoToDailyDecision}>
                    Ir a Decisión Diaria
                  </Button>
                )
              ) : (
                <Button variant="heroPrimary" fullWidth onClick={onCreateGoal}>
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
