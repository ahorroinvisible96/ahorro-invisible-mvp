"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { storeResetAllData, storeExportData, buildSummary } from '@/services/dashboardStore';
import { authSignOut } from '@/services/authService';
import { resetUserDataInSupabase } from '@/services/syncService';
import { getTheme } from '@/styles/themes';
import { SettingsMyDataWidget } from '@/components/settings/SettingsMyDataWidget/SettingsMyDataWidget';
import { SettingsNotificationsWidget } from '@/components/settings/SettingsNotificationsWidget/SettingsNotificationsWidget';
import { SettingsSessionWidget } from '@/components/settings/SettingsSessionWidget/SettingsSessionWidget';
import { SettingsDangerZoneWidget } from '@/components/settings/SettingsDangerZoneWidget/SettingsDangerZoneWidget';
import { SettingsHelpWidget } from '@/components/settings/SettingsHelpWidget/SettingsHelpWidget';
import styles from './Settings.module.css';
import { SettingsIcon } from '@/components/ui/AppIcons';

// ── Helpers ───────────────────────────────────────────────────────────────────
function truncateEmail(email: string, max = 18): string {
  if (!email || email.length <= max) return email || '—';
  const [local, domain] = email.split('@');
  if (!domain) return email.slice(0, max) + '…';
  const localShort = local.length > 8 ? local.slice(0, 7) + '…' : local;
  return `${localShort}@${domain}`;
}

const THEME_LABELS: Record<string, string> = {
  dark:   'Oscuro',
  light:  'Claro',
  system: 'Sistema',
};

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading]           = useState(true);
  const [userEmail, setUserEmail]       = useState('');
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('dark');

  useEffect(() => {
    analytics.setScreen('settings');
    const isAuth = localStorage.getItem('isAuthenticated');
    if (isAuth !== 'true') { router.replace('/login'); return; }
    const summary = buildSummary('30d');
    setUserEmail(summary.userEmail);
    // Estado de notificaciones
    const notifPerm = typeof Notification !== 'undefined' ? Notification.permission : 'default';
    const notifSaved = localStorage.getItem('push_reminders_enabled');
    setNotifEnabled(notifPerm === 'granted' && notifSaved === 'true');
    // Tema actual
    setCurrentTheme(getTheme());
    analytics.settingsViewed();
    setLoading(false);
  }, [router]);

  const handleExport = useCallback(() => {
    const data = storeExportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ahorro-invisible-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleResetOnboarding = useCallback(() => {
    analytics.onboardingReset();
    localStorage.removeItem('hasCompletedOnboarding');
    localStorage.removeItem('onboarding_income_range');
    router.replace('/onboarding');
  }, [router]);

  const handleResetAll = useCallback(async () => {
    const userId = localStorage.getItem('supabaseUserId');
    if (userId) resetUserDataInSupabase(userId).catch(() => null);
    storeResetAllData();
    router.replace('/onboarding');
  }, [router]);

  const handleLogout = useCallback(async () => {
    await authSignOut();
    router.replace('/login');
  }, [router]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Cargando ajustes...</div>
      </div>
    );
  }

  const themeLabel = THEME_LABELS[currentTheme] ?? 'Oscuro';
  const themeColor = currentTheme === 'light' ? '#fbbf24' : currentTheme === 'system' ? '#60a5fa' : '#a78bfa';
  const notifLabel = notifEnabled ? 'Activas' : 'Inactivas';
  const notifColor = notifEnabled ? '#4ade80' : 'rgba(255,255,255,0.35)';
  const emailShort = truncateEmail(userEmail);

  return (
    <div className={styles.page}>

      {/* ══════════════════════════════════════════════════════════════════════
          ZONA 1 — HEADER PRINCIPAL (degradado azul)
          Contiene: icono + título → 3 métricas clave (cuenta, notifs, tema)
          ══════════════════════════════════════════════════════════════════════ */}
      <div className={styles.headerZone}>
        <div className={styles.zoneInner}>
          <div className={styles.headerContent}>

            {/* Icono + título */}
            <div className={styles.headerTop}>
              <div className={styles.headerIconWrap}>
                <SettingsIcon size={22} />
              </div>
              <div className={styles.headerTitles}>
                <span className={styles.headerSub}>Ajustes de la app</span>
                <h1 className={styles.headerTitle}>Configuración</h1>
              </div>
            </div>

            {/* Divisor */}
            <div className={styles.headerDivider} />

            {/* Tarjetas de métricas: cuenta · notificaciones · tema */}
            <div className={styles.metricsRow}>

              {/* Métrica 1: Cuenta activa */}
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Cuenta</span>
                <span className={styles.metricValue} title={userEmail}>
                  {emailShort}
                </span>
                <span className={styles.metricSub}>sesión activa</span>
              </div>

              {/* Métrica 2: Estado de notificaciones */}
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Notifs</span>
                <span className={styles.metricValueAccent} style={{ color: notifColor }}>
                  {notifLabel}
                </span>
                <span className={styles.metricSub}>recordatorio diario</span>
              </div>

              {/* Métrica 3: Tema actual */}
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Tema</span>
                <span className={styles.metricValueAccent} style={{ color: themeColor }}>
                  {themeLabel}
                </span>
                <span className={styles.metricSub}>modo de pantalla</span>
              </div>

            </div>

          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ZONA 2 — CONTENIDO SECUNDARIO (fondo oscuro sólido)
          Widgets de ajuste agrupados por categoría
          ══════════════════════════════════════════════════════════════════════ */}
      <div className={styles.contentZone}>
        <div className={styles.zoneInner}>
          <div className={styles.contentCol}>

            {/* ─── Mis datos y privacidad ─── */}
            <div className={styles.sectionGroup}>
              <p className={styles.sectionLabel}>MIS DATOS</p>
              <div className={styles.listCard}>
                <SettingsMyDataWidget
                  onExport={handleExport}
                  onResetOnboarding={handleResetOnboarding}
                />
              </div>
            </div>

            {/* ─── Notificaciones ─── */}
            <div className={styles.sectionGroup}>
              <p className={styles.sectionLabel}>NOTIFICACIONES</p>
              <div className={styles.listCard}>
                <SettingsNotificationsWidget />
              </div>
            </div>

            {/* ─── Sesión ─── */}
            <div className={styles.sectionGroup}>
              <p className={styles.sectionLabel}>SESIÓN</p>
              <div className={styles.listCard}>
                <SettingsSessionWidget email={userEmail} onLogout={handleLogout} />
              </div>
            </div>

            {/* ─── Zona de peligro ─── */}
            <div className={styles.sectionGroup}>
              <p className={styles.sectionLabel}>ZONA DE PELIGRO</p>
              <div className={styles.listCard}>
                <SettingsDangerZoneWidget onResetAll={handleResetAll} />
              </div>
            </div>

            {/* ─── Ayuda y soporte ─── */}
            <div className={styles.sectionGroup}>
              <p className={styles.sectionLabel}>AYUDA</p>
              <div className={styles.listCard}>
                <SettingsHelpWidget />
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}
