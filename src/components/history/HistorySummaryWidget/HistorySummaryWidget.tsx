"use client";

import React from 'react';
import type { HistorySummaryWidgetProps } from './HistorySummaryWidget.types';
import styles from './HistorySummaryWidget.module.css';
import { TrendingUpIcon } from '@/components/ui/AppIcons';

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
            <TrendingUpIcon size={18} />
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
