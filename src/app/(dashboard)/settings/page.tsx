"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { storeResetAllData, storeExportData, buildSummary } from '@/services/dashboardStore';
import { authSignOut } from '@/services/authService';
import { resetUserDataInSupabase } from '@/services/syncService';
import { SettingsMyDataWidget } from '@/components/settings/SettingsMyDataWidget/SettingsMyDataWidget';
import { SettingsNotificationsWidget } from '@/components/settings/SettingsNotificationsWidget/SettingsNotificationsWidget';
import { SettingsSessionWidget } from '@/components/settings/SettingsSessionWidget/SettingsSessionWidget';
import { SettingsDangerZoneWidget } from '@/components/settings/SettingsDangerZoneWidget/SettingsDangerZoneWidget';
import { SettingsHelpWidget } from '@/components/settings/SettingsHelpWidget/SettingsHelpWidget';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import styles from './Settings.module.css';
import { SettingsIcon } from '@/components/ui/AppIcons';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    analytics.setScreen('settings');
    const isAuth = localStorage.getItem('isAuthenticated');
    if (isAuth !== 'true') { router.replace('/login'); return; }
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

  return (
    <div className={styles.page}>

      {/* ══════════════════════════════════════════════════════════════════════
          ZONA 1 — HEADER PRINCIPAL (degradado azul, identidad de Configuración)
          Contiene: icono + título + email de cuenta activa
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
                <span className={styles.headerSub}>Ajustes</span>
                <h1 className={styles.headerTitle}>Configuración</h1>
              </div>
            </div>

            {/* Divisor */}
            <div className={styles.headerDivider} />

            {/* Estado: email de cuenta */}
            <div className={styles.headerStatusRow}>
              <span className={styles.headerStatusLabel}>Cuenta activa</span>
              <span className={styles.headerStatusValue}>{userEmail || '—'}</span>
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
