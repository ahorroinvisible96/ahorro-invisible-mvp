"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { storeResetAllData, storeExportData, buildSummary } from '@/services/dashboardStore';
import { authSignOut } from '@/services/authService';
import { resetUserDataInSupabase } from '@/services/syncService';
import { getTheme } from '@/styles/themes';
import { QUESTIONS_BANK } from '@/services/dailyQuestionsBank';
import { SettingsMyDataWidget } from '@/components/settings/SettingsMyDataWidget/SettingsMyDataWidget';
import { SettingsNotificationsWidget } from '@/components/settings/SettingsNotificationsWidget/SettingsNotificationsWidget';
import { SettingsSessionWidget } from '@/components/settings/SettingsSessionWidget/SettingsSessionWidget';
import { SettingsDangerZoneWidget } from '@/components/settings/SettingsDangerZoneWidget/SettingsDangerZoneWidget';
import { SettingsHelpWidget } from '@/components/settings/SettingsHelpWidget/SettingsHelpWidget';
import styles from './Settings.module.css';
import { WidgetSkeleton } from '@/components/ui/Skeleton/Skeleton';
import { useToast } from '@/components/ui/Toast/Toast';

function truncateEmail(email: string, max = 26): string {
  if (!email || email.length <= max) return email || 'Sesión local';
  const [local, domain] = email.split('@');
  if (!domain) return email.slice(0, max) + '…';
  const localShort = local.length > 10 ? local.slice(0, 9) + '…' : local;
  return `${localShort}@${domain}`;
}

const THEME_LABELS: Record<string, string> = {
  dark: 'Modo oscuro',
  light: 'Modo claro',
  system: 'Sistema',
};

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('dark');

  useEffect(() => {
    analytics.setScreen('settings');
    const isAuth = localStorage.getItem('isAuthenticated');
    if (isAuth !== 'true') { router.replace('/login'); return; }
    const summary = buildSummary('30d');
    setUserEmail(summary.userEmail);
    const notifPerm = typeof Notification !== 'undefined' ? Notification.permission : 'default';
    const notifSaved = localStorage.getItem('push_reminders_enabled');
    setNotifEnabled(notifPerm === 'granted' && notifSaved === 'true');
    setCurrentTheme(getTheme());
    analytics.settingsViewed();
    setLoading(false);
  }, [router]);

  const { addToast } = useToast();

  const handleExport = useCallback(() => {
    const data = storeExportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ahorro-invisible-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Datos exportados correctamente', 'success');
  }, [addToast]);

  const handleDownloadQuestions = useCallback(() => {
    const escapeCSV = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      str = str.replace(/\r?\n|\r/g, ' ');
      if (str.includes('"') || str.includes(',') || str.includes(';') || str.includes('\t')) {
        str = `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = ['ID', 'Texto', 'Avatar', 'Franja Horaria', 'Opción 1', 'Opción 2', 'Opción 3'];
    const rows = QUESTIONS_BANK.map(q => [
      q.id, q.text, q.avatar, q.timeSlot,
      q.options[0] ?? '', q.options[1] ?? '', q.options[2] ?? '',
    ]);

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map((row: (string | number | undefined)[]) => row.map(escapeCSV).join(','))
    ].join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `banco_de_preguntas_ahorro_invisible.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Banco de preguntas descargado correctamente', 'success');
  }, [addToast]);

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
        <div style={{ padding: '40px 16px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480, margin: '0 auto', width: '100%' }}>
          <WidgetSkeleton />
          <WidgetSkeleton />
        </div>
      </div>
    );
  }

  const themeLabel = THEME_LABELS[currentTheme] ?? 'Modo oscuro';
  const notifLabel = notifEnabled ? 'Notificaciones activas' : 'Notificaciones inactivas';
  const emailShort = truncateEmail(userEmail);

  return (
    <div className={styles.page}>
      <div className={styles.headerZone}>
        <div className={styles.zoneInner}>
          <div className={styles.topBar}>
            <button type="button" className={styles.glassBtn} onClick={() => router.push('/profile')} aria-label="Volver a perfil">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className={styles.topBarLabel}>Configuración</span>
            <div style={{ width: 36 }} />
          </div>

          <h1 className={styles.headerTitle}>Ajustes</h1>
          <p className={styles.headerMeta}>
            {emailShort} · {notifLabel} · {themeLabel}
          </p>
        </div>
      </div>

      <div className={styles.contentZone}>
        <div className={styles.zoneInner}>
          <div className={styles.contentGrid}>
            <div className={styles.colStack}>
              <SettingsNotificationsWidget />
              <SettingsMyDataWidget
                onExport={handleExport}
                onResetOnboarding={handleResetOnboarding}
                onDownloadQuestions={handleDownloadQuestions}
              />
            </div>

            <div className={styles.colStack}>
              <SettingsHelpWidget />
              <SettingsSessionWidget email={userEmail} onLogout={handleLogout} />
              <SettingsDangerZoneWidget onResetAll={handleResetAll} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
