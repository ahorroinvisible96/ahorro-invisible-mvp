"use client";

import React from 'react';
import type { SettingsSessionWidgetProps } from './SettingsSessionWidget.types';
import styles from './SettingsSessionWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';

export function SettingsSessionWidget({
  email,
  onLogout,
}: SettingsSessionWidgetProps): React.ReactElement {
  const { collapsed, toggle } = useWidgetCollapse('settings_session', false);
  return (
    <div className={styles.wrapper}>
      <div className={styles.bgGradient} />
      <div className={styles.glowGreen} />
      <div className={styles.borderLayer} />

      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h2 className={styles.title} style={{ flex: 1 }}>Sesión</h2>
          {collapsed && email && <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)', marginRight: 8 }}>{email}</span>}
          <CollapseChevron collapsed={collapsed} onToggle={toggle} />
        </div>

        {!collapsed && (
          <>
            <div className={styles.statusRow}>
              <span className={styles.statusDot} />
              <span className={styles.statusLabel}>Sesión activa</span>
              {email && <span className={styles.statusEmail}>{email}</span>}
            </div>
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
          </>
        )}
      </div>
    </div>
  );
}

export default SettingsSessionWidget;
