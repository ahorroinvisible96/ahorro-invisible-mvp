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
  LogoutIcon,
} from '@/components/ui/AppIcons';

interface SidebarProps {
  userName?: string;
  onLogout?: () => void;
  onOpenDailyDecision?: () => void;
}

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
          <BrandIcon size={17} />
        </div>
        <span className={styles.logoName}>Ahorro Invisible</span>
      </div>

      {/* ── Navegación ── */}
      <nav className={styles.nav} aria-label="Navegación lateral">
        <Link href="/dashboard" className={`${styles.navItem} ${isActive('/dashboard') ? styles.navItemActive : ''}`}>
          <span className={styles.navIcon}><HomeIcon size={18} /></span>
          <span className={styles.navText}>Inicio</span>
        </Link>

        <Link href="/goals" className={`${styles.navItem} ${isActive('/goals') ? styles.navItemActive : ''}`}>
          <span className={styles.navIcon}><TargetIcon size={18} /></span>
          <span className={styles.navText}>Objetivos</span>
        </Link>

        <button type="button" className={styles.navItem} onClick={onOpenDailyDecision}>
          <span className={styles.navIcon}><BoltIcon size={18} /></span>
          <span className={styles.navText}>Decisión diaria</span>
        </button>

        <Link href="/history" className={`${styles.navItem} ${isActive('/history') ? styles.navItemActive : ''}`}>
          <span className={styles.navIcon}><BarChartIcon size={18} /></span>
          <span className={styles.navText}>Historial</span>
        </Link>

        <Link href="/profile" className={`${styles.navItem} ${isActive('/profile') ? styles.navItemActive : ''}`}>
          <span className={styles.navIcon}><UserIcon size={18} /></span>
          <span className={styles.navText}>Perfil</span>
        </Link>
      </nav>

      <div className={styles.spacer} />

      {/* ── Footer usuario ── */}
      <div className={styles.footer}>
        <div className={styles.themeRow}>
          <span className={styles.themeLabel}>Tema</span>
          <ThemeToggle />
        </div>
        <div className={styles.userRow}>
          <div className={styles.avatar}>
            {(userName.charAt(0) || 'U').toUpperCase()}
          </div>
          <div className={styles.userTexts}>
            <span className={styles.userName}>{userName}</span>
            <span className={styles.userRole}>Cuenta activa</span>
          </div>
          <button type="button" className={styles.logoutBtn} onClick={onLogout} title="Cerrar sesión" aria-label="Cerrar sesión">
            <LogoutIcon size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
