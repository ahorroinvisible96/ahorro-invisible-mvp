"use client";

import React, { useState, useEffect } from 'react';
import { analytics } from '@/services/analytics';
import { computeGoalPct, computeGoalRemaining, formatEUR } from './GoalCardWidget.logic';
import type { GoalCardWidgetProps } from './GoalCardWidget.types';
import styles from './GoalCardWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';

import { TargetIcon, StarIcon, TrendingUpIcon, CalendarIcon, ArchiveIcon, EditIcon } from '@/components/ui/AppIcons';

// ── Componente principal ─────────────────────────────────────────────────────
export function GoalCardWidget({
  goal,
  onOpenGoal,
  onArchiveGoal,
  onSetPrimary,
  onEditGoal,
}: GoalCardWidgetProps): React.ReactElement {
  const pct = computeGoalPct(goal);
  const remaining = computeGoalRemaining(goal);
  const isCompleted = goal.currentAmount >= goal.targetAmount;
  const { collapsed, toggle } = useWidgetCollapse(`goal_card_${goal.id}`, !goal.isPrimary);

  useEffect(() => {
    analytics.goalCardViewed(goal.id, goal.isPrimary, pct);
  }, [goal.id]);

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    onArchiveGoal(goal.id);
  };

  const handleSetPrimary = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSetPrimary(goal.id);
  };

  return (
    <div
      className={styles.card}
      onClick={() => onOpenGoal(goal.id)}
    >
      {/* Layer 1: fondo gradiente */}
      <div className={styles.bgGradient} />

      {/* Layer 2: overlay con glows animados */}
      <div className={styles.glowOverlay}>
        <div className={styles.glowPurple} />
        <div className={styles.glowBlue} />
      </div>

      {/* Layer 3: borde */}
      <div className={styles.borderLayer} />

      {/* Layer 4: contenido */}
      <div className={styles.content}>

        {/* ── Sección 1: Título, badge y chevron ── */}
        <div className={styles.topRow}>
          <div className={styles.topLeft}>
            <div className={styles.goalIconWrap}><TargetIcon size={20} /></div>
            <span className={styles.goalTitle}>{goal.title}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
            {goal.isUnrealistic && goal.finalGoalAmount && (
              <div style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.05em' }}>
                PASO {(goal.subGoalIndex ?? 0) + 1}
              </div>
            )}
            {goal.isPrimary && (
              <div className={styles.primaryBadge}><StarIcon /><span>PRINCIPAL</span></div>
            )}
            {isCompleted && !goal.isPrimary && (
              <div className={styles.completedBadge}>Completado</div>
            )}
            <CollapseChevron collapsed={collapsed} onToggle={toggle} />
          </div>
        </div>

        {/* Resumen mínimo plegado: barra + % */}
        {collapsed && (
          <div className={styles.progressSection} style={{ marginBottom: 0 }}>
            <div className={styles.amountsRow}>
              <div className={styles.amountsLeft}>
                <span className={styles.currentAmount}>{formatEUR(goal.currentAmount)}</span>
                <span className={styles.amountSep}>/</span>
                <span className={styles.targetAmount}>{formatEUR(goal.targetAmount)}</span>
              </div>
              <div className={styles.pctWrap}>
                <TrendingUpIcon />
                <span className={pct > 0 ? styles.pctActive : styles.pctZero}>{pct}%</span>
              </div>
            </div>
            <div className={styles.progressTrack}>
              <div
                className={`${styles.progressFill} ${pct > 0 ? styles.progressFillActive : styles.progressFillZero}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Sección 2: Montos y barra de progreso (solo desplegado) ── */}
        {!collapsed && <div className={styles.progressSection}>
          <div className={styles.amountsRow}>
            <div className={styles.amountsLeft}>
              <span className={styles.currentAmount}>{formatEUR(goal.currentAmount)}</span>
              <span className={styles.amountSep}>/</span>
              <span className={styles.targetAmount}>{formatEUR(goal.targetAmount)}</span>
            </div>
            <div className={styles.pctWrap}>
              <TrendingUpIcon />
              <span className={pct > 0 ? styles.pctActive : styles.pctZero}>{pct}%</span>
            </div>
          </div>

          <div className={styles.progressTrack}>
            <div
              className={`${styles.progressFill} ${pct > 0 ? styles.progressFillActive : styles.progressFillZero}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>}

        {/* ── Sección 3: Info (solo desplegado) ── */}
        {!collapsed && <div className={styles.bottomRow}>
          <div className={styles.infoLeft}>
            {!isCompleted && (
              <>
                <span className={styles.infoItem}>
                  Faltan <span className={styles.infoValue}>{formatEUR(remaining)}</span>
                </span>
                <span className={styles.infoDot} />
                <span className={styles.infoItem}>
                  <CalendarIcon />
                  {goal.horizonMonths} meses
                </span>
              </>
            )}
            {isCompleted && (
              <span className={styles.infoCompleted}>¡Objetivo alcanzado!</span>
            )}
          </div>
        </div>}

      </div>
    </div>
  );
}

export default GoalCardWidget;
