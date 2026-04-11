"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.css';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

// ── Iconos SVG inline — sistema visual coherente (strokeWidth 1.5) ────────────

// Inicio: tejado + cuerpo rectangular
const HomeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9.5z"/>
    <rect x="9" y="14" width="6" height="7" rx="0.5"/>
  </svg>
);

// Decisión: relámpago refinado
const BoltIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 3L5 13h7l-1 8 9-10h-7l1-8z"/>
  </svg>
);

// Perfil: persona simplificada
const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="7" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);

// Historial: barras de actividad crecientes
const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3"  y="13" width="4" height="8"  rx="1"/>
    <rect x="10" y="8"  width="4" height="13" rx="1"/>
    <rect x="17" y="3"  width="4" height="18" rx="1"/>
  </svg>
);

// Objetivos: rombo con punto central
const TargetIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3L21 12L12 21L3 12Z"/>
    <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/>
  </svg>
);

// Logout: puerta con flecha
const LogoutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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

        {/* 1. Inicio */}
        <Link href="/dashboard" className={`${styles.navItem} ${isActive('/dashboard') ? styles.navItemActive : ''}`}>
          <span className={`${styles.navIcon} ${isActive('/dashboard') ? styles.navIconActive : ''}`}><HomeIcon /></span>
          <span className={styles.navText}>Inicio</span>
          {isActive('/dashboard') && <span className={styles.activePip} />}
        </Link>

        {/* 2. Objetivos */}
        <Link href="/goals" className={`${styles.navItem} ${isActive('/goals') ? styles.navItemActive : ''}`}>
          <span className={`${styles.navIcon} ${isActive('/goals') ? styles.navIconActive : ''}`}><TargetIcon /></span>
          <span className={styles.navText}>Objetivos</span>
          {isActive('/goals') && <span className={styles.activePip} />}
        </Link>

        {/* 3. Decisión Diaria — abre modal */}
        <button className={`${styles.navItem} ${styles.navItemDailyBtn}`} onClick={onOpenDailyDecision}>
          <span className={`${styles.navIcon} ${styles.navIconDaily}`}><BoltIcon /></span>
          <span className={styles.navText}>Decisión Diaria</span>
        </button>

        {/* 4. Historial */}
        <Link href="/history" className={`${styles.navItem} ${isActive('/history') ? styles.navItemActive : ''}`}>
          <span className={`${styles.navIcon} ${isActive('/history') ? styles.navIconActive : ''}`}><ClockIcon /></span>
          <span className={styles.navText}>Historial</span>
          {isActive('/history') && <span className={styles.activePip} />}
        </Link>

        {/* 5. Perfil */}
        <Link href="/profile" className={`${styles.navItem} ${isActive('/profile') ? styles.navItemActive : ''}`}>
          <span className={`${styles.navIcon} ${isActive('/profile') ? styles.navIconActive : ''}`}><UserIcon /></span>
          <span className={styles.navText}>Perfil</span>
          {isActive('/profile') && <span className={styles.activePip} />}
        </Link>
      </nav>

      {/* ── Spacer ── */}
      <div className={styles.spacer} />

      {/* ── Footer usuario ── */}
      <div className={styles.footer}>
        <div className={styles.divider} />
        <div className={styles.themeRow}>
          <span className={styles.themeLabel}>Tema</span>
          <ThemeToggle />
        </div>
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
