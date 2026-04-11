"use client";

import React from 'react';
import { analytics } from '@/services/analytics';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import type { GoalsSectionWidgetProps } from './GoalsSectionWidget.types';
import styles from './GoalsSectionWidget.module.css';
import { TargetIcon, PlusIcon, ChevronDownIcon } from '@/components/ui/AppIcons';


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
            <ChevronDownIcon size={16} />
          </span>
        </div>
      </div>

      {!collapsed && children}
    </div>
  );
}

export default GoalsSectionWidget;
