"use client";

import React from 'react';
import type { SettingsMyDataWidgetProps } from './SettingsMyDataWidget.types';
import styles from './SettingsMyDataWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';
import { ShieldIcon, DownloadIcon } from '@/components/ui/AppIcons';

export function SettingsMyDataWidget({
  onExport,
  onResetOnboarding,
}: SettingsMyDataWidgetProps): React.ReactElement {
  const { collapsed, toggle } = useWidgetCollapse('settings_my_data', false);
  return (
    <div className={styles.wrapper}>
      <div className={styles.bgGradient} />
      <div className={styles.glowBlue} />
      <div className={styles.borderLayer} />

      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <ShieldIcon size={16} />
          </div>
          <h2 className={styles.title} style={{ flex: 1 }}>Mis datos</h2>
          <CollapseChevron collapsed={collapsed} onToggle={toggle} />
        </div>

        {!collapsed && (
          <>
            <div className={styles.row}>
              <div className={styles.rowTexts}>
                <p className={styles.rowLabel}>Exportar datos</p>
                <p className={styles.rowSub}>Descarga un JSON con todos tus datos</p>
              </div>
              <button className={styles.actionBtn} onClick={onExport}>
                <DownloadIcon size={13} />
                Exportar
              </button>
            </div>
            <div className={styles.row}>
              <div className={styles.rowTexts}>
                <p className={styles.rowLabel}>Reiniciar onboarding</p>
                <p className={styles.rowSub}>Vuelve al proceso de configuración inicial</p>
              </div>
              <button className={styles.actionBtn} onClick={onResetOnboarding}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
                </svg>
                Reiniciar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default SettingsMyDataWidget;
