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

      {/* Inicio — cuadrado con tejado */}
      <Link href="/dashboard" className={`${styles.item} ${isActive('/dashboard') ? styles.itemActive : ''}`}>
        <span className={styles.icon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9.5z"/>
            <rect x="9" y="14" width="6" height="7" rx="0.5"/>
          </svg>
        </span>
        <span className={styles.label}>Inicio</span>
      </Link>

      {/* Objetivos — rombo con punto */}
      <Link href="/goals" className={`${styles.item} ${isActive('/goals') ? styles.itemActive : ''}`}>
        <span className={styles.icon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3L21 12L12 21L3 12Z"/>
            <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/>
          </svg>
        </span>
        <span className={styles.label}>Objetivos</span>
      </Link>

      {/* Botón central destacado — Decisión Diaria */}
      <button className={styles.dailyBtn} onClick={onOpenDailyDecision} aria-label="Decisión Diaria">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 3L5 13h7l-1 8 9-10h-7l1-8z"/>
        </svg>
      </button>

      {/* Historial — barras de actividad */}
      <Link href="/history" className={`${styles.item} ${isActive('/history') ? styles.itemActive : ''}`}>
        <span className={styles.icon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3"  y="13" width="4" height="8"  rx="1"/>
            <rect x="10" y="8"  width="4" height="13" rx="1"/>
            <rect x="17" y="3"  width="4" height="18" rx="1"/>
          </svg>
        </span>
        <span className={styles.label}>Historial</span>
      </Link>

      {/* Perfil — icono de persona simplificado */}
      <Link href="/profile" className={`${styles.item} ${isActive('/profile') ? styles.itemActive : ''}`}>
        <span className={styles.icon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="7" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </span>
        <span className={styles.label}>Perfil</span>
      </Link>

    </nav>
  );
};

export default BottomNav;
