"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './BottomNav.module.css';
import { 
  HomeIcon, 
  TargetIcon, 
  BoltIcon, 
  BarChartIcon, 
  UserIcon 
} from '@/components/ui/AppIcons';

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
          <HomeIcon size={22} />
        </span>
        <span className={styles.label}>Inicio</span>
      </Link>

      {/* Objetivos — rombo con punto */}
      <Link href="/goals" className={`${styles.item} ${isActive('/goals') ? styles.itemActive : ''}`}>
        <span className={styles.icon}>
          <TargetIcon size={22} />
        </span>
        <span className={styles.label}>Objetivos</span>
      </Link>

      {/* Botón central destacado — Decisión Diaria */}
      <button className={styles.dailyBtn} onClick={onOpenDailyDecision} aria-label="Decisión Diaria">
        <BoltIcon size={22} />
      </button>

      {/* Historial — barras de actividad */}
      <Link href="/history" className={`${styles.item} ${isActive('/history') ? styles.itemActive : ''}`}>
        <span className={styles.icon}>
          <BarChartIcon size={22} />
        </span>
        <span className={styles.label}>Historial</span>
      </Link>

      {/* Perfil — icono de persona simplificado */}
      <Link href="/profile" className={`${styles.item} ${isActive('/profile') ? styles.itemActive : ''}`}>
        <span className={styles.icon}>
          <UserIcon size={22} />
        </span>
        <span className={styles.label}>Perfil</span>
      </Link>

    </nav>
  );
};

export default BottomNav;
