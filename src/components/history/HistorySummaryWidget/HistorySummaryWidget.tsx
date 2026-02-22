"use client";

import React from 'react';
import type { HistorySummaryWidgetProps } from './HistorySummaryWidget.types';
import styles from './HistorySummaryWidget.module.css';

function formatEUR(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function HistorySummaryWidget({
  count,
  totalSaved,
}: HistorySummaryWidgetProps): React.ReactElement {
  return (
    <div className={styles.wrapper}>
      <div className={styles.bgGradient} />
      <div className={styles.glowGreen} />
      <div className={styles.borderLayer} />

      <div className={styles.content}>
        <div className={styles.left}>
          <div className={styles.iconWrap}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
          </div>
          <div className={styles.texts}>
            <span className={styles.count}>
              <span className={styles.countNum}>{count}</span> decisiones registradas
            </span>
            <span className={styles.label}>en el periodo seleccionado</span>
          </div>
        </div>

        <div className={`${styles.totalSaved} ${totalSaved === 0 ? styles.totalSavedZero : ''}`}>
          {totalSaved > 0 ? '+' : ''}{formatEUR(totalSaved)}
        </div>
      </div>
    </div>
  );
}

export default HistorySummaryWidget;
