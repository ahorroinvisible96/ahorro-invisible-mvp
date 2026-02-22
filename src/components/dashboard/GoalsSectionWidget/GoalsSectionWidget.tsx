"use client";

import React from 'react';
import { analytics } from '@/services/analytics';
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
}: GoalsSectionWidgetProps): React.ReactElement {
  return (
    <div className={styles.header}>
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

      {/* Botón nuevo objetivo */}
      <button
        className={styles.newBtn}
        onClick={() => {
          analytics.goalCreateStarted('dashboard_goals_section');
          onCreateGoal();
        }}
      >
        Nuevo objetivo
        <span className={styles.plusIcon}><PlusIcon size={16} /></span>
      </button>
    </div>
  );
}

export default GoalsSectionWidget;
