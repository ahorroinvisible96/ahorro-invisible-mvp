"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { buildSummary, storeUpdateUserName, storeUpdateIncome } from '@/services/dashboardStore';
import type { IncomeRange } from '@/types/Dashboard';
import { IncomeRangeWidget } from '@/components/dashboard/IncomeRangeWidget';
import { ProfileInfoWidget } from '@/components/profile/ProfileInfoWidget/ProfileInfoWidget';
import { ProfileQuickAccessWidget } from '@/components/profile/ProfileQuickAccessWidget/ProfileQuickAccessWidget';
import { ProfileAccountWidget } from '@/components/profile/ProfileAccountWidget/ProfileAccountWidget';
import styles from './Profile.module.css';

export default function ProfilePage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [incomeRange, setIncomeRange] = useState<IncomeRange | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analytics.setScreen('profile');
    const isAuth = localStorage.getItem('isAuthenticated');
    if (isAuth !== 'true') { router.replace('/signup'); return; }
    const summary = buildSummary('30d');
    setUserName(summary.userName);
    setEmail(summary.userEmail);
    setIncomeRange(summary.incomeRange);
    analytics.profileViewed();
    setLoading(false);
  }, [router]);

  const handleSaveUserName = useCallback((name: string) => {
    storeUpdateUserName(name);
    setUserName(name);
    analytics.profileUpdated(['userName']);
  }, []);

  const handleSaveIncomeRange = useCallback((range: IncomeRange) => {
    storeUpdateIncome(range);
    setIncomeRange(range);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('hasCompletedOnboarding');
    router.replace('/signup');
  }, [router]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Cargando perfil...</div>
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
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className={styles.pageTitles}>
            <h1 className={styles.pageTitle}>Mi Perfil</h1>
            <p className={styles.pageSubtitle}>Gestiona tu cuenta y preferencias</p>
          </div>
        </div>
      </div>

      {/* ── Widgets ── */}
      <div className={styles.widgetsStack}>

        {/* Widget 1: Ingresos mensuales */}
        <IncomeRangeWidget
          incomeRange={incomeRange}
          onSaveIncomeRange={handleSaveIncomeRange}
        />

        {/* Widget 2: Información personal */}
        <ProfileInfoWidget
          userName={userName}
          email={email}
          onSaveUserName={handleSaveUserName}
        />

        {/* Widget 3: Accesos rápidos */}
        <ProfileQuickAccessWidget
          onGoToGoals={() => router.push('/goals')}
          onGoToHistory={() => router.push('/history')}
          onGoToSettings={() => router.push('/settings')}
        />

        {/* Widget 4: Cuenta */}
        <ProfileAccountWidget
          email={email}
          onLogout={handleLogout}
        />

      </div>
    </div>
  );
}
