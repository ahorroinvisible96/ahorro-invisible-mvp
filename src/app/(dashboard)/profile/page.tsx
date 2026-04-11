"use client";

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { buildSummary, storeUpdateUserName, storeUpdateIncome } from '@/services/dashboardStore';
import { authSignOut } from '@/services/authService';
import type { IncomeRange } from '@/types/Dashboard';
import { IncomeRangeWidget } from '@/components/dashboard/IncomeRangeWidget';
import { MotivationCardWidget } from '@/components/dashboard/MotivationCardWidget';
import { ProfileInfoWidget } from '@/components/profile/ProfileInfoWidget/ProfileInfoWidget';
import { ProfileQuickAccessWidget } from '@/components/profile/ProfileQuickAccessWidget/ProfileQuickAccessWidget';
import { ProfileAccountWidget } from '@/components/profile/ProfileAccountWidget/ProfileAccountWidget';
import styles from './Profile.module.css';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';

// ── Componente auxiliar: lee ?section= y abre el widget correspondiente ────────
// Debe estar en Suspense porque usa useSearchParams (Next.js 16 requisito)
function SectionOpener({ onOpen }: { onOpen: (section: string) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const section = searchParams.get('section');
    if (section) {
      onOpen(section);
      setTimeout(() => {
        document.getElementById(`${section}-ahorro-widget`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }, [searchParams, onOpen]);
  return null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [incomeRange, setIncomeRange] = useState<IncomeRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalSaved, setTotalSaved] = useState(0);
  const [open, setOpen] = useState({ ingresos: false, info: false, accesos: false, cuenta: false });
  const toggle = (k: keyof typeof open) => setOpen(p => ({ ...p, [k]: !p[k] }));
  const handleSectionOpen = useCallback((section: string) => {
    if (section in open) setOpen(p => ({ ...p, [section]: true }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [streak, setStreak] = useState(0);
  const [moneyFeeling, setMoneyFeeling] = useState<string | null | undefined>(undefined);
  const [intensity, setIntensity] = useState<'high' | 'medium' | 'low' | 'unknown'>('unknown');


  useEffect(() => {
    analytics.setScreen('profile');
    const isAuth = localStorage.getItem('isAuthenticated');
    if (isAuth !== 'true') { router.replace('/login'); return; }
    const summary = buildSummary('30d');
    setUserName(summary.userName);
    setEmail(summary.userEmail);
    setIncomeRange(summary.incomeRange);
    setTotalSaved(summary.totalSaved);
    setStreak(summary.streak ?? 0);
    setMoneyFeeling(summary.moneyFeeling ?? undefined);
    setIntensity(summary.intensity ?? 'unknown');
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

  const handleLogout = useCallback(async () => {
    await authSignOut();
    router.replace('/login');
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
      {/* Auto-abre widget según ?section= — requiere Suspense por useSearchParams */}
      <Suspense fallback={null}>
        <SectionOpener onOpen={handleSectionOpen} />
      </Suspense>

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

        {/* Widget 0: Motivación */}
        <MotivationCardWidget
          intensity={intensity}
          streak={streak}
          totalSaved={totalSaved}
          moneyFeeling={moneyFeeling}
          onAdjustRules={() => router.push('/settings')}
        />

        {/* Widget 1: Ingresos mensuales */}
        <div>
          <div onClick={() => toggle('ingresos')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 14, cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(241,245,249,0.9)' }}>💰 Ingresos mensuales</span>
            <CollapseChevron collapsed={!open.ingresos} onToggle={() => toggle('ingresos')} />
          </div>
          {open.ingresos && <IncomeRangeWidget incomeRange={incomeRange} onSaveIncomeRange={handleSaveIncomeRange} />}
        </div>

        {/* Widget 2: Información personal */}
        <div>
          <div onClick={() => toggle('info')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 14, cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(241,245,249,0.9)' }}>👤 Información personal</span>
            <CollapseChevron collapsed={!open.info} onToggle={() => toggle('info')} />
          </div>
          {open.info && <ProfileInfoWidget userName={userName} email={email} onSaveUserName={handleSaveUserName} />}
        </div>

        {/* Widget 3: Accesos rápidos */}
        <div>
          <div onClick={() => toggle('accesos')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 14, cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(241,245,249,0.9)' }}>⚡ Accesos rápidos</span>
            <CollapseChevron collapsed={!open.accesos} onToggle={() => toggle('accesos')} />
          </div>
          {open.accesos && <ProfileQuickAccessWidget onGoToGoals={() => router.push('/goals')} onGoToHistory={() => router.push('/history')} onGoToSettings={() => router.push('/settings')} />}
        </div>

        {/* Widget 4: Cuenta */}
        <div>
          <div onClick={() => toggle('cuenta')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 14, cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(241,245,249,0.9)' }}>🔐 Mi cuenta</span>
            <CollapseChevron collapsed={!open.cuenta} onToggle={() => toggle('cuenta')} />
          </div>
          {open.cuenta && <ProfileAccountWidget email={email} onLogout={handleLogout} />}
        </div>

        {/* Widget 5: Ajustes */}
        <button
          onClick={() => router.push('/settings')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '13px 16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 14, cursor: 'pointer', textAlign: 'left' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'rgba(241,245,249,0.9)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Ajustes
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        {/* Widget 6: Modo oscuro / claro */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(241,245,249,0.9)' }}>🌙 Tema</span>
          <ThemeToggle />
        </div>

      </div>
    </div>
  );
}
