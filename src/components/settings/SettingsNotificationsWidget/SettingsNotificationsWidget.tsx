"use client";

import React from 'react';
import styles from './SettingsNotificationsWidget.module.css';

export function SettingsNotificationsWidget(): React.ReactElement {
  const items = [
    { label: 'Recordatorio diario', sub: 'Para no olvidar tu decisión del día' },
    { label: 'Resumen semanal', sub: 'Progreso de la semana' },
    { label: 'Alertas de objetivo', sub: 'Cuando te acerques a tu meta' },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.bgGradient} />
      <div className={styles.glowYellow} />
      <div className={styles.borderLayer} />

      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <h2 className={styles.title}>Notificaciones</h2>
        </div>

        {items.map((item) => (
          <div key={item.label} className={styles.row}>
            <div className={styles.rowTexts}>
              <p className={styles.rowLabel}>{item.label}</p>
              <p className={styles.rowSub}>{item.sub}</p>
            </div>
            <span className={styles.badge}>Próximamente</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SettingsNotificationsWidget;
