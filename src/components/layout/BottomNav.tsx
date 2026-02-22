"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './BottomNav.module.css';

interface BottomNavProps {
  onOpenDailyDecision?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenDailyDecision }) => {
  const pathname = usePathname();

  const isActive = (path: string) =>
    pathname === path || (path === '/dashboard' && pathname === '/');

  return (
    <nav className={styles.nav}>

      <Link href="/dashboard" className={`${styles.item} ${isActive('/dashboard') ? styles.itemActive : ''}`}>
        <span className={styles.icon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </span>
        <span className={styles.label}>Inicio</span>
      </Link>

      <Link href="/history" className={`${styles.item} ${isActive('/history') ? styles.itemActive : ''}`}>
        <span className={styles.icon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </span>
        <span className={styles.label}>Historial</span>
      </Link>

      {/* Botón central destacado — Decisión Diaria */}
      <button className={styles.dailyBtn} onClick={onOpenDailyDecision} aria-label="Decisión Diaria">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      </button>

      <Link href="/profile" className={`${styles.item} ${isActive('/profile') ? styles.itemActive : ''}`}>
        <span className={styles.icon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </span>
        <span className={styles.label}>Perfil</span>
      </Link>

      <Link href="/settings" className={`${styles.item} ${isActive('/settings') ? styles.itemActive : ''}`}>
        <span className={styles.icon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
          </svg>
        </span>
        <span className={styles.label}>Ajustes</span>
      </Link>

    </nav>
  );
};

export default BottomNav;
