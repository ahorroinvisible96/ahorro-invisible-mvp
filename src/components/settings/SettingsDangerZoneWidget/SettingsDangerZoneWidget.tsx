"use client";

import React, { useState } from 'react';
import type { SettingsDangerZoneWidgetProps } from './SettingsDangerZoneWidget.types';
import styles from './SettingsDangerZoneWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';
import { AlertIcon, TrashIcon } from '@/components/ui/AppIcons';

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
            <AlertIcon size={16} />
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
              <TrashIcon size={14} />
              {btnLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default SettingsDangerZoneWidget;
