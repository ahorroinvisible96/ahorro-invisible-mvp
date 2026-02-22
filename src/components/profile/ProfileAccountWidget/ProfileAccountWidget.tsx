"use client";

import React from 'react';
import type { ProfileAccountWidgetProps } from './ProfileAccountWidget.types';
import styles from './ProfileAccountWidget.module.css';

export function ProfileAccountWidget({
  email,
  onLogout,
}: ProfileAccountWidgetProps): React.ReactElement {
  return (
    <div className={styles.wrapper}>
      <div className={styles.bgGradient} />
      <div className={styles.glowRed} />
      <div className={styles.borderLayer} />

      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <h2 className={styles.title}>Cuenta</h2>
        </div>

        {/* Estado activo */}
        <div className={styles.statusRow}>
          <span className={styles.statusDot} />
          <span className={styles.statusLabel}>Cuenta activa</span>
          {email && <span className={styles.statusEmail}>{email}</span>}
        </div>

        <div className={styles.divider} />

        {/* Cerrar sesión */}
        <button className={styles.logoutBtn} onClick={onLogout}>
          <span className={styles.logoutIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </span>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export default ProfileAccountWidget;
