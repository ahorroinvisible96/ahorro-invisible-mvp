"use client";

import React from 'react';
import type { HistoryEmptyStateWidgetProps } from './HistoryEmptyStateWidget.types';
import styles from './HistoryEmptyStateWidget.module.css';

export function HistoryEmptyStateWidget({
  hasFilters,
  onGoToDashboard,
}: HistoryEmptyStateWidgetProps): React.ReactElement {
  return (
    <div className={styles.wrapper}>
      <div className={styles.bgGradient} />
      <div className={styles.glowBlue} />
      <div className={styles.borderLayer} />

      <div className={styles.content}>
        <div className={styles.iconWrap}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>

        <h3 className={styles.title}>
          {hasFilters ? 'Sin resultados para este filtro' : 'Aún no hay decisiones'}
        </h3>
        <p className={styles.subtitle}>
          {hasFilters
            ? 'Prueba a cambiar el periodo, objetivo o categoría para ver más registros.'
            : 'Completa tu primera decisión diaria en el dashboard para empezar a construir tu historial de ahorro.'}
        </p>

        {!hasFilters && onGoToDashboard && (
          <button className={styles.btn} onClick={onGoToDashboard}>
            Ir al dashboard →
          </button>
        )}
      </div>
    </div>
  );
}

export default HistoryEmptyStateWidget;
