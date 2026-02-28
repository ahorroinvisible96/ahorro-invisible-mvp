"use client";

import React, { useState, useEffect } from 'react';
import { analytics } from '@/services/analytics';
import { computeGoalPct, computeGoalRemaining, formatEUR } from './GoalCardWidget.logic';
import type { GoalCardWidgetProps } from './GoalCardWidget.types';
import styles from './GoalCardWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';

// ── Iconos SVG inline ────────────────────────────────────────────────────────
function TargetIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}

function TrendingUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

function Edit2Icon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8"/>
      <rect x="1" y="3" width="22" height="5"/>
      <line x1="10" y1="12" x2="14" y2="12"/>
    </svg>
  );
}

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

        {/* ── Sección 3: Info y acciones (solo desplegado) ── */}
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

          <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
            {!goal.isPrimary && (
              <button className={styles.makePrimaryBtn} onClick={handleSetPrimary}>
                Hacer principal
              </button>
            )}

            {onEditGoal && (
              <button
                className={styles.editBtn}
                onClick={(e) => { e.stopPropagation(); onEditGoal(goal.id); }}
                title="Editar"
              >
                <span className={styles.editIcon}><Edit2Icon /></span>
              </button>
            )}

            <button
              className={styles.archiveBtn}
              onClick={handleArchive}
              title="Archivar"
            >
              <span className={styles.archiveIcon}><ArchiveIcon /></span>
            </button>
          </div>
        </div>}

      </div>
    </div>
  );
}

export default GoalCardWidget;
