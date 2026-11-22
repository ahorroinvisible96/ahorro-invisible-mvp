"use client";

import React, { useEffect } from 'react';
import { analytics } from '@/services/analytics';
import type { HeaderStatusBarProps } from './HeaderStatusBarWidget.types';
import styles from './HeaderStatusBarWidget.module.css';
import {
  FlameIcon,
  SproutIcon,
  MedalIcon,
  DiamondIcon,
  CrownIcon,
  TrophyIcon,
} from '@/components/ui/AppIcons';

// ── Niveles de medalla (sincronizados con dashboard/page.tsx) ─────────────────
const MEDAL_TIERS = [
  { amount: 5000, Icon: CrownIcon,   color: '#FFD700', label: 'Corona' },
  { amount: 2000, Icon: TrophyIcon,  color: '#4ade80', label: 'Trofeo' },
  { amount: 1000, Icon: DiamondIcon, color: '#60a5fa', label: 'Diamante' },
  { amount: 500,  Icon: MedalIcon,   color: '#fbbf24', label: 'Oro' },
  { amount: 100,  Icon: MedalIcon,   color: '#cbd5e1', label: 'Plata' },
  { amount: 50,   Icon: MedalIcon,   color: '#cd7f32', label: 'Bronce' },
];

function getMedalConfig(totalSaved: number) {
  const tier = MEDAL_TIERS.find((t) => totalSaved >= t.amount);
  return tier ?? { amount: 0, Icon: SproutIcon, color: '#34d399', label: 'Semilla' };
}

export function HeaderStatusBarWidget({
  userName,
  userAvatar,
  streak = 0,
  totalSaved = 0,
  onOpenProfile,
  onOpenMedalDetail,
}: HeaderStatusBarProps): React.ReactElement {
  useEffect(() => {
    analytics.setScreen('dashboard');
  }, []);

  const initials = (userName.trim().charAt(0) || 'U').toUpperCase();
  const firstName = userName.trim().split(' ')[0] || 'Usuario';
  const medal = getMedalConfig(totalSaved);

  return (
    <header className={styles.header} data-widget-cat="summary">
      {/* ── Izquierda: avatar glass + píldora saludo ── */}
      <div className={styles.leftGroup}>
        <button
          type="button"
          className={styles.avatarBtn}
          onClick={onOpenProfile}
          aria-label="Ver perfil"
        >
          {userAvatar ? (
            <img src={userAvatar} alt={userName} className={styles.avatarImg} />
          ) : (
            initials
          )}
        </button>

        <button
          type="button"
          className={styles.greetingPill}
          onClick={onOpenProfile}
        >
          <h1 className={styles.greetingText}>Hola, {firstName}</h1>
        </button>
      </div>

      {/* ── Derecha: píldoras glass de racha y nivel (sin duplicidad en avatar) ── */}
      <div className={styles.actions}>
        {streak > 0 && (
          <button
            type="button"
            className={styles.glassPill}
            onClick={onOpenMedalDetail}
            aria-label={`${streak} días de racha`}
          >
            <FlameIcon size={14} className={styles.flameIcon} />
            <span className={styles.pillNum}>{streak}</span>
          </button>
        )}

        <button
          type="button"
          className={styles.glassPill}
          onClick={onOpenMedalDetail}
          aria-label={`Nivel ${medal.label}`}
        >
          <span className={styles.medalIconWrap}>
            <medal.Icon size={14} />
          </span>
          <span className={styles.pillLabel}>{medal.label}</span>
        </button>
      </div>
    </header>
  );
}

export default HeaderStatusBarWidget;
