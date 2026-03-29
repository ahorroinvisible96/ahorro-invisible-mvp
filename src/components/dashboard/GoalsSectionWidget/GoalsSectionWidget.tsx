"use client";

import React from 'react';
import { analytics } from '@/services/analytics';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import type { GoalsSectionWidgetProps } from './GoalsSectionWidget.types';
import styles from './GoalsSectionWidget.module.css';

function TargetIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  );
}

function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

export function GoalsSectionWidget({
  goalsCount,
  onCreateGoal,
  children,
}: GoalsSectionWidgetProps): React.ReactElement {
  const { collapsed, toggle } = useWidgetCollapse('goals_section', true);

  return (
    <div>
      <div className={styles.header} onClick={toggle} style={{ cursor: 'pointer' }}>
        {/* Lado izquierdo: icono + título */}
        <div className={styles.left}>
          <div className={styles.iconWrap}>
            <TargetIcon size={20} />
          </div>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>Mis objetivos</h2>
            <span className={styles.counter}>({goalsCount})</span>
          </div>
        </div>

        {/* Derecha: botón nuevo + chevron */}
        <div className={styles.right}>
          <button
            className={styles.newBtn}
            onClick={(e) => {
              e.stopPropagation();
              analytics.goalCreateStarted('dashboard_goals_section');
              onCreateGoal();
            }}
          >
            Nuevo objetivo
            <span className={styles.plusIcon}><PlusIcon size={16} /></span>
          </button>
          <span className={`${styles.chevron} ${collapsed ? '' : styles.chevronOpen}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
      </div>

      {!collapsed && children}
    </div>
  );
}

export default GoalsSectionWidget;
