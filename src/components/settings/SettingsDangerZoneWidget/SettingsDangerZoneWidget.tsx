"use client";

import React, { useState } from 'react';
import type { SettingsDangerZoneWidgetProps } from './SettingsDangerZoneWidget.types';
import styles from './SettingsDangerZoneWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';

export function SettingsDangerZoneWidget({
  onResetAll,
}: SettingsDangerZoneWidgetProps): React.ReactElement {
  const { collapsed, toggle } = useWidgetCollapse('settings_danger_zone', false);
  const [step, setStep] = useState<'idle' | 'confirm1' | 'confirm2'>('idle');

  function handleClick() {
    if (step === 'idle') {
      setStep('confirm1');
      setTimeout(() => setStep('idle'), 5000);
    } else if (step === 'confirm1') {
      setStep('confirm2');
    } else {
      setStep('idle');
      onResetAll();
    }
  }

  const btnLabel =
    step === 'idle'    ? 'Borrar todos los datos' :
    step === 'confirm1' ? '⚠️ ¿Estás seguro? Pulsa para confirmar' :
                         '🔴 Última confirmación — pulsa para borrar';

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
          <h2 className={styles.title} style={{ flex: 1 }}>Zona de peligro</h2>
          <CollapseChevron collapsed={collapsed} onToggle={toggle} />
        </div>

        {!collapsed && (
          <>
            <p className={styles.description}>
              Esto reiniciará todo tu progreso: objetivos, historial de decisiones y configuración.{' '}
              <strong style={{ color: '#86efac' }}>Tu cuenta (email y contraseña) no se elimina</strong> — volverás a entrar como usuario nuevo.
            </p>
            <button className={styles.resetBtn} onClick={handleClick}
              style={step === 'confirm2' ? { background: 'rgba(239,68,68,0.25)', borderColor: 'rgba(239,68,68,0.6)' } : undefined}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              {btnLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default SettingsDangerZoneWidget;
