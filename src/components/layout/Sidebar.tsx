"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.css';

// ── Iconos SVG inline (16×16 stroke) ─────────────────────────────────────────

const HomeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const BoltIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const GearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
  </svg>
);

const LogoutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface SidebarProps {
  userName?: string;
  onLogout?: () => void;
  onOpenDailyDecision?: () => void;
}

// ── Componente ────────────────────────────────────────────────────────────────

export const Sidebar: React.FC<SidebarProps> = ({
  userName = 'Usuario',
  onLogout,
  onOpenDailyDecision,
}) => {
  const pathname = usePathname();

  const isActive = (path: string) =>
    pathname === path || (path === '/dashboard' && pathname === '/');

  const navLinks = [
    { href: '/dashboard',  label: 'Dashboard', Icon: HomeIcon },
    { href: '/profile',    label: 'Perfil',     Icon: UserIcon },
    { href: '/history',    label: 'Historial',  Icon: ClockIcon },
    { href: '/settings',   label: 'Ajustes',    Icon: GearIcon },
  ];

  return (
    <aside className={styles.sidebar}>

      {/* ── Logo ── */}
      <div className={styles.logo}>
        <div className={styles.logoMark}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div className={styles.logoTexts}>
          <span className={styles.logoName}>Ahorro</span>
          <span className={styles.logoSub}>INVISIBLE</span>
        </div>
      </div>

      {/* ── Separador ── */}
      <div className={styles.divider} />

      {/* ── Navegación ── */}
      <nav className={styles.nav}>
        <span className={styles.navLabel}>NAVEGACIÓN</span>

        {/* 1. Dashboard */}
        <Link
          href="/dashboard"
          className={`${styles.navItem} ${isActive('/dashboard') ? styles.navItemActive : ''}`}
        >
          <span className={`${styles.navIcon} ${isActive('/dashboard') ? styles.navIconActive : ''}`}>
            <HomeIcon />
          </span>
          <span className={styles.navText}>Dashboard</span>
          {isActive('/dashboard') && <span className={styles.activePip} />}
        </Link>

        {/* 2. Decisión Diaria — abre modal */}
        <button
          className={`${styles.navItem} ${styles.navItemDailyBtn}`}
          onClick={onOpenDailyDecision}
        >
          <span className={`${styles.navIcon} ${styles.navIconDaily}`}>
            <BoltIcon />
          </span>
          <span className={styles.navText}>Decisión Diaria</span>
        </button>

        {/* 3-5. Resto de links */}
        {navLinks.slice(1).map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
            >
              <span className={`${styles.navIcon} ${active ? styles.navIconActive : ''}`}>
                <Icon />
              </span>
              <span className={styles.navText}>{label}</span>
              {active && <span className={styles.activePip} />}
            </Link>
          );
        })}
      </nav>

      {/* ── Spacer ── */}
      <div className={styles.spacer} />

      {/* ── Footer usuario ── */}
      <div className={styles.footer}>
        <div className={styles.divider} />
        <div className={styles.userRow}>
          <div className={styles.avatar}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className={styles.userTexts}>
            <span className={styles.userName}>{userName}</span>
            <span className={styles.userRole}>Cuenta activa</span>
          </div>
          <button className={styles.logoutBtn} onClick={onLogout} title="Cerrar sesión">
            <LogoutIcon />
          </button>
        </div>
      </div>

    </aside>
  );
};

export default Sidebar;
