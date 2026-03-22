"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { buildSummary, storeUpdateUserName, storeUpdateIncome } from '@/services/dashboardStore';
import { authSignOut } from '@/services/authService';
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
  const [totalSaved, setTotalSaved] = useState(0);

  useEffect(() => {
    analytics.setScreen('profile');
    const isAuth = localStorage.getItem('isAuthenticated');
    if (isAuth !== 'true') { router.replace('/login'); return; }
    const summary = buildSummary('30d');
    setUserName(summary.userName);
    setEmail(summary.userEmail);
    setIncomeRange(summary.incomeRange);
    setTotalSaved(summary.totalSaved);
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

        {/* Widget 0: Nivel de ahorro */}
        {(() => {
          const TIERS = [
            { amount: 50,   name: 'Bronce',    emoji: '🥉', color: '#cd7f32', bg: 'rgba(205,127,50,0.12)',  border: 'rgba(205,127,50,0.35)' },
            { amount: 100,  name: 'Plata',     emoji: '🥈', color: '#c0c0c0', bg: 'rgba(192,192,192,0.1)',  border: 'rgba(192,192,192,0.3)' },
            { amount: 500,  name: 'Oro',       emoji: '🥇', color: '#ffd700', bg: 'rgba(255,215,0,0.1)',    border: 'rgba(255,215,0,0.3)' },
            { amount: 1000, name: 'Platino',   emoji: '💎', color: '#e5e4e2', bg: 'rgba(229,228,226,0.1)',  border: 'rgba(229,228,226,0.3)' },
            { amount: 2000, name: 'Esmeralda', emoji: '💚', color: '#50c878', bg: 'rgba(80,200,120,0.1)',   border: 'rgba(80,200,120,0.3)' },
            { amount: 5000, name: 'Diamante',  emoji: '👑', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.3)' },
          ];
          const current = [...TIERS].reverse().find(t => totalSaved >= t.amount) ?? null;
          const next = TIERS.find(t => totalSaved < t.amount) ?? null;
          const pct = next ? Math.min(100, Math.round((totalSaved / next.amount) * 100)) : 100;
          const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
          return (
            <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 16, padding: '18px 20px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>Nivel de ahorro</p>
              {current ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ background: current.bg, border: `1px solid ${current.border}`, borderRadius: 12, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 22 }}>{current.emoji}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: current.color }}>{current.name}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', margin: '0 0 2px' }}>Total ahorrado</p>
                    <p style={{ fontSize: 18, fontWeight: 800, color: '#4ade80', margin: 0 }}>{fmt(totalSaved)}</p>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 14, color: 'rgba(148,163,184,0.7)', margin: '0 0 4px' }}>Aún sin nivel — necesitas <strong style={{ color: '#cd7f32' }}>50€</strong> para Bronce</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#4ade80', margin: 0 }}>{fmt(totalSaved)} ahorrados</p>
                </div>
              )}
              {next && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)' }}>Próximo nivel: <strong style={{ color: next.color }}>{next.emoji} {next.name}</strong></span>
                    <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)' }}>{fmt(totalSaved)} / {fmt(next.amount)}</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(51,65,85,0.6)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: 6, width: `${pct}%`, background: `linear-gradient(90deg, ${current?.color ?? '#a78bfa'}, ${next.color})`, borderRadius: 999, transition: 'width 0.4s' }} />
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', margin: '6px 0 0', textAlign: 'right' }}>Faltan {fmt(next.amount - totalSaved)}</p>
                </>
              )}
              {!next && current && (
                <p style={{ fontSize: 13, fontWeight: 700, color: current.color, margin: 0, textAlign: 'center' }}>{current.emoji} ¡Has alcanzado el nivel máximo! {current.emoji}</p>
              )}
            </div>
          );
        })()}

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
