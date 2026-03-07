"use client";

import React, { useState, useEffect } from 'react';
import styles from './SettingsNotificationsWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';
import {
  getNotificationPermission,
  requestNotificationPermission,
  scheduleLocalReminder,
  cancelLocalReminder,
  registerServiceWorker,
  subscribeToPush,
  savePushSubscriptionToSupabase,
} from '@/services/pushNotifications';

export function SettingsNotificationsWidget(): React.ReactElement {
  const { collapsed, toggle } = useWidgetCollapse('settings_notifications', false);
  const [permission, setPermission] = useState<'unsupported' | NotificationPermission>('default');
  const [enabled, setEnabled]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [info, setInfo]           = useState('');

  useEffect(() => {
    const perm = getNotificationPermission();
    setPermission(perm);
    const saved = localStorage.getItem('push_reminders_enabled');
    setEnabled(perm === 'granted' && saved === 'true');
  }, []);

  async function handleToggle() {
    if (loading) return;
    setInfo('');

    if (enabled) {
      // Disable
      cancelLocalReminder();
      localStorage.setItem('push_reminders_enabled', 'false');
      setEnabled(false);
      setInfo('Recordatorios desactivados.');
      return;
    }

    // Enable: request permission first
    setLoading(true);
    const perm = await requestNotificationPermission();
    setPermission(perm);

    if (perm !== 'granted') {
      setLoading(false);
      setInfo('Permiso denegado. Actívalo manualmente en los ajustes del navegador.');
      return;
    }

    // Register SW and subscribe to push
    await registerServiceWorker();
    await subscribeToPush().catch(() => null);

    // Save subscription to Supabase if user is logged in
    const userId = localStorage.getItem('supabaseUserId');
    if (userId) {
      await savePushSubscriptionToSupabase(userId).catch(() => null);
    }

    // Schedule local daily reminder at 8pm
    scheduleLocalReminder();
    localStorage.setItem('push_reminders_enabled', 'true');
    setEnabled(true);
    setLoading(false);
    setInfo('✅ Recordatorio diario activado a las 20:00 h.');
  }

  const statusColor = enabled ? '#4ade80' : 'rgba(148,163,184,0.5)';

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
          <h2 className={styles.title} style={{ flex: 1 }}>Notificaciones</h2>
          <CollapseChevron collapsed={collapsed} onToggle={toggle} />
        </div>

        {!collapsed && (
          <>
            {permission === 'unsupported' ? (
              <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.6)', margin: '12px 0 0' }}>
                Tu navegador no soporta notificaciones web.
              </p>
            ) : (
              <>
                {/* Recordatorio diario — toggle real */}
                <div className={styles.row}>
                  <div className={styles.rowTexts}>
                    <p className={styles.rowLabel}>Recordatorio diario</p>
                    <p className={styles.rowSub}>Aviso a las 20:00 h si no has completado tu decisión</p>
                  </div>
                  <button
                    onClick={handleToggle}
                    disabled={loading}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                      background: enabled ? 'linear-gradient(90deg,#16a34a,#15803d)' : 'rgba(51,65,85,0.6)',
                      position: 'relative', transition: 'background 250ms', flexShrink: 0,
                    }}
                    aria-label={enabled ? 'Desactivar recordatorio' : 'Activar recordatorio'}
                  >
                    <span style={{
                      position: 'absolute', top: 3, left: enabled ? 22 : 3,
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#fff', transition: 'left 250ms',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    }} />
                  </button>
                </div>

                {/* Estado del permiso */}
                {permission === 'denied' && (
                  <p style={{ fontSize: 12, color: '#f87171', margin: '8px 0 0' }}>
                    Permiso denegado. Actívalo en Ajustes del navegador → Notificaciones.
                  </p>
                )}

                {info && (
                  <p style={{ fontSize: 12, color: statusColor, margin: '8px 0 0' }}>{info}</p>
                )}

                {/* Otros (próximamente) */}
                {[
                  { label: 'Resumen semanal', sub: 'Tu progreso de la semana cada domingo' },
                  { label: 'Alertas de hito', sub: 'Cuando alcances €50, €100, €500...' },
                ].map((item) => (
                  <div key={item.label} className={styles.row}>
                    <div className={styles.rowTexts}>
                      <p className={styles.rowLabel}>{item.label}</p>
                      <p className={styles.rowSub}>{item.sub}</p>
                    </div>
                    <span className={styles.badge}>Próximamente</span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SettingsNotificationsWidget;
