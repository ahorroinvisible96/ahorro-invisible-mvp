"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { storeResetAllData, storeExportData, buildSummary } from '@/services/dashboardStore';
import { SettingsMyDataWidget } from '@/components/settings/SettingsMyDataWidget/SettingsMyDataWidget';
import { SettingsNotificationsWidget } from '@/components/settings/SettingsNotificationsWidget/SettingsNotificationsWidget';
import { SettingsSessionWidget } from '@/components/settings/SettingsSessionWidget/SettingsSessionWidget';
import { SettingsDangerZoneWidget } from '@/components/settings/SettingsDangerZoneWidget/SettingsDangerZoneWidget';
import { SettingsHelpWidget } from '@/components/settings/SettingsHelpWidget/SettingsHelpWidget';
import styles from './Settings.module.css';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    analytics.setScreen('settings');
    const isAuth = localStorage.getItem('isAuthenticated');
    if (isAuth !== 'true') { router.replace('/signup'); return; }
    const summary = buildSummary('30d');
    setUserEmail(summary.userEmail);
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

  const handleResetAll = useCallback(() => {
    storeResetAllData();
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('hasCompletedOnboarding');
    router.replace('/signup');
  }, [router]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('hasCompletedOnboarding');
    router.replace('/signup');
  }, [router]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Cargando ajustes...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderGlow} />
        <div className={styles.pageHeaderInner}>
          <div className={styles.pageIconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
          </div>
          <div className={styles.pageTitles}>
            <h1 className={styles.pageTitle}>Configuración</h1>
            <p className={styles.pageSubtitle}>Personaliza tu experiencia</p>
          </div>
        </div>
      </div>

      {/* ── Widgets ── */}
      <div className={styles.widgetsStack}>

        {/* Widget 1: Mis datos */}
        <SettingsMyDataWidget
          onExport={handleExport}
          onResetOnboarding={handleResetOnboarding}
        />

        {/* Widget 2: Notificaciones */}
        <SettingsNotificationsWidget />

        {/* Widget 3: Sesión */}
        <SettingsSessionWidget email={userEmail} onLogout={handleLogout} />

        {/* Widget 4: Zona de peligro */}
        <SettingsDangerZoneWidget onResetAll={handleResetAll} />

        {/* Widget 5: Ayuda y FAQs */}
        <SettingsHelpWidget />

      </div>
    </div>
  );
}
