"use client";

import React, { useEffect } from 'react';
import { analytics } from '@/services/analytics';
import type { HeaderStatusBarProps } from './HeaderStatusBarWidget.types';
import styles from './HeaderStatusBarWidget.module.css';

export function HeaderStatusBarWidget({
  userName,
  systemActive,
  onOpenProfile,
  onOpenNotifications,
}: HeaderStatusBarProps): React.ReactElement {
  useEffect(() => {
    analytics.dashboardViewed('pending', 0, false, false);
  }, [systemActive]);

  return (
    <div className={styles.header}>
      <div className={styles.titleGroup}>
        <h1 className={styles.greeting}>Hola, {userName} 👋</h1>
        <p className={styles.sub}>Tus ahorros crecen mientras brilla el día.</p>
      </div>

      <div className={styles.actions}>
        <div className={systemActive ? styles.systemPill : `${styles.systemPill} ${styles.systemPillInactive}`}>
          <span className={systemActive ? styles.systemDot : styles.systemDotInactive} />
          SISTEMA {systemActive ? 'ACTIVO' : 'INACTIVO'}
        </div>

        {onOpenNotifications && (
          <button
            className={styles.profileBtn}
            onClick={() => {
              onOpenNotifications();
            }}
            aria-label="Notificaciones"
          >
            🔔
          </button>
        )}

        <button
          className={styles.profileBtn}
          onClick={() => {
            onOpenProfile();
          }}
          aria-label="Perfil"
        >
          {userName.charAt(0).toUpperCase()}
        </button>
      </div>
    </div>
  );
}

export default HeaderStatusBarWidget;
