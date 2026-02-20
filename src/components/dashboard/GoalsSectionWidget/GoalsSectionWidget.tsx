"use client";

import React from 'react';
import { analytics } from '@/services/analytics';
import type { GoalsSectionWidgetProps } from './GoalsSectionWidget.types';
import styles from './GoalsSectionWidget.module.css';

export function GoalsSectionWidget({
  goalsCount,
  onCreateGoal,
}: GoalsSectionWidgetProps): React.ReactElement {
  return (
    <div className={styles.header}>
      <h2 className={styles.title}>
        Mis objetivos
        <span className={styles.counter}>({goalsCount})</span>
      </h2>
      <button
        className={styles.newBtn}
        onClick={() => {
          analytics.goalCreateStarted('dashboard_goals_section');
          onCreateGoal();
        }}
      >
        + Nuevo objetivo
      </button>
    </div>
  );
}

export default GoalsSectionWidget;
