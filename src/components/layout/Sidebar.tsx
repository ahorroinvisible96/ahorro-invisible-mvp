"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.css';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { 
  BrandIcon, 
  HomeIcon, 
  BoltIcon, 
  UserIcon, 
  BarChartIcon, 
  TargetIcon, 
  LogoutIcon 
} from '@/components/ui/AppIcons';



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
          <BrandIcon size={18} />
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
          <span className={`${styles.navIcon} ${isActive('/dashboard') ? styles.navIconActive : ''}`}><HomeIcon size={16} /></span>
          <span className={styles.navText}>Inicio</span>
          {isActive('/dashboard') && <span className={styles.activePip} />}
        </Link>

        {/* 2. Objetivos */}
        <Link href="/goals" className={`${styles.navItem} ${isActive('/goals') ? styles.navItemActive : ''}`}>
          <span className={`${styles.navIcon} ${isActive('/goals') ? styles.navIconActive : ''}`}><TargetIcon size={16} /></span>
          <span className={styles.navText}>Objetivos</span>
          {isActive('/goals') && <span className={styles.activePip} />}
        </Link>

        {/* 3. Decisión Diaria — abre modal */}
        <button className={`${styles.navItem} ${styles.navItemDailyBtn}`} onClick={onOpenDailyDecision}>
          <span className={`${styles.navIcon} ${styles.navIconDaily}`}><BoltIcon size={16} /></span>
          <span className={styles.navText}>Decisión Diaria</span>
        </button>

        {/* 4. Historial */}
        <Link href="/history" className={`${styles.navItem} ${isActive('/history') ? styles.navItemActive : ''}`}>
          <span className={`${styles.navIcon} ${isActive('/history') ? styles.navIconActive : ''}`}><BarChartIcon size={16} /></span>
          <span className={styles.navText}>Historial</span>
          {isActive('/history') && <span className={styles.activePip} />}
        </Link>

        {/* 5. Perfil */}
        <Link href="/profile" className={`${styles.navItem} ${isActive('/profile') ? styles.navItemActive : ''}`}>
          <span className={`${styles.navIcon} ${isActive('/profile') ? styles.navIconActive : ''}`}><UserIcon size={16} /></span>
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
            <LogoutIcon size={14} />
          </button>
        </div>
      </div>

    </aside>
  );
};

export default Sidebar;
