"use client";

import React from 'react';
import type { SettingsSessionWidgetProps } from './SettingsSessionWidget.types';
import styles from './SettingsSessionWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';
import { LockIcon, LogoutIcon } from '@/components/ui/AppIcons';

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
            <LockIcon size={16} />
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
                <LogoutIcon size={14} />
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
