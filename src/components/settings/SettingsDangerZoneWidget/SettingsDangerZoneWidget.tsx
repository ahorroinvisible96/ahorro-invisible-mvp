"use client";

import React, { useState } from 'react';
import type { SettingsDangerZoneWidgetProps } from './SettingsDangerZoneWidget.types';
import styles from './SettingsDangerZoneWidget.module.css';

export function SettingsDangerZoneWidget({
  onResetAll,
}: SettingsDangerZoneWidgetProps): React.ReactElement {
  const [confirming, setConfirming] = useState(false);

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 4000);
      return;
    }
    setConfirming(false);
    onResetAll();
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.bgGradient} />
      <div className={styles.glowRed} />
      <div className={styles.borderLayer} />

      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h2 className={styles.title}>Zona de peligro</h2>
        </div>

        <p className={styles.description}>
          Esta acción borrará <strong style={{ color: '#fca5a5' }}>todos</strong> tus datos permanentemente: objetivos, historial y configuración. Esta acción no se puede deshacer.
        </p>

        <button className={styles.resetBtn} onClick={handleClick}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
          {confirming ? '⚠️ Pulsa de nuevo para confirmar' : 'Borrar todos los datos'}
        </button>
      </div>
    </div>
  );
}

export default SettingsDangerZoneWidget;
