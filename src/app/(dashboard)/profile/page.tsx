"use client";

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { buildSummary, storeUpdateUserName, storeUpdateIncome } from '@/services/dashboardStore';
import { authSignOut } from '@/services/authService';
import type { IncomeRange } from '@/types/Dashboard';
import { IncomeRangeWidget } from '@/components/dashboard/IncomeRangeWidget';
import { ProfileHeroWidget } from '@/components/profile/ProfileHeroWidget/ProfileHeroWidget';
import { ProfileQuickAccessWidget } from '@/components/profile/ProfileQuickAccessWidget/ProfileQuickAccessWidget';
import { MotivationCardWidget } from '@/components/dashboard/MotivationCardWidget';
import { ProfileAccountWidget } from '@/components/profile/ProfileAccountWidget/ProfileAccountWidget';
import { ProfileInfoWidget } from '@/components/profile/ProfileInfoWidget/ProfileInfoWidget';
import styles from './Profile.module.css';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';
import { SettingsIcon, ChevronRightIcon } from '@/components/ui/AppIcons';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

// ── Componente auxiliar: lee ?section= y abre el widget correspondiente ────────
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
  const [open, setOpen] = useState({ info: false, cuenta: false, ajustes: false });
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
      {/* Auto-abre widget según ?section= */}
      <Suspense fallback={null}>
        <SectionOpener onOpen={handleSectionOpen} />
      </Suspense>

      {/* ── PARTE SUPERIOR: Hero widget — igual que PrimaryGoalHeroWidget en goals ── */}
      <ProfileHeroWidget userName={userName} email={email} />

      {/* ── PARTE INFERIOR: grid 2 columnas ── */}
      <div className={styles.secondaryGrid}>

        {/* Widget izquierdo: Ingresos mensuales */}
        <div className={styles.secondaryCard}>
          <IncomeRangeWidget
            incomeRange={incomeRange}
            onSaveIncomeRange={handleSaveIncomeRange}
          />
        </div>

        {/* Widget derecho: Accesos rápidos */}
        <div className={styles.secondaryCard}>
          <ProfileQuickAccessWidget
            onGoToGoals={() => router.push('/goals')}
            onGoToHistory={() => router.push('/history')}
            onGoToSettings={() => router.push('/settings')}
          />
        </div>

      </div>

      {/* ── WIDGETS OPCIONALES ADICIONALES ── */}
      <div className={styles.widgetsStack}>

        {/* Motivación */}
        <MotivationCardWidget
          intensity={intensity}
          streak={streak}
          totalSaved={totalSaved}
          moneyFeeling={moneyFeeling}
          onAdjustRules={() => router.push('/settings')}
        />

        {/* Información personal */}
        <div>
          <div
            onClick={() => toggle('info')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 14, cursor: 'pointer', userSelect: 'none' }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(241,245,249,0.9)' }}>👤 Información personal</span>
            <CollapseChevron collapsed={!open.info} onToggle={() => toggle('info')} />
          </div>
          {open.info && <ProfileInfoWidget userName={userName} email={email} onSaveUserName={handleSaveUserName} />}
        </div>

        {/* Mi cuenta */}
        <div>
          <div
            onClick={() => toggle('cuenta')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 14, cursor: 'pointer', userSelect: 'none' }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(241,245,249,0.9)' }}>🔐 Mi cuenta</span>
            <CollapseChevron collapsed={!open.cuenta} onToggle={() => toggle('cuenta')} />
          </div>
          {open.cuenta && <ProfileAccountWidget email={email} onLogout={handleLogout} />}
        </div>

        {/* Ajustes */}
        <button
          onClick={() => router.push('/settings')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '13px 16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 14, cursor: 'pointer', textAlign: 'left' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'rgba(241,245,249,0.9)' }}>
            <SettingsIcon size={16} />
            Ajustes
          </span>
          <ChevronRightIcon size={16} style={{ color: 'rgba(148,163,184,0.5)' }} />
        </button>

        {/* Tema */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(241,245,249,0.9)' }}>🌙 Tema</span>
          <ThemeToggle />
        </div>

      </div>
    </div>
  );
}
