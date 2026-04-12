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
  TrophyIcon 
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
  const tier = MEDAL_TIERS.find(t => totalSaved >= t.amount);
  return tier ?? { amount: 0, Icon: SproutIcon, color: '#22c55e', label: 'Semilla' };
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

  const initials = userName.trim().charAt(0).toUpperCase();
  const firstName = userName.trim().split(' ')[0];
  const medal = getMedalConfig(totalSaved);

  return (
    <div className={styles.header}>

      {/* ── Left: avatar + saludo ── */}
      <div className={styles.leftGroup}>

        {/* Avatar */}
        <div className={styles.avatarWrap} onClick={onOpenProfile} role="button" aria-label="Ver perfil">
          <div className={styles.avatarRing}>
            <div className={styles.avatarInner}>
              {userAvatar
                ? <img src={userAvatar} alt={userName} className={styles.avatarImg} />
                : initials
              }
            </div>
          </div>
        </div>

        {/* Texto: solo saludo, sin racha */}
        <div className={styles.infoGroup}>
          <h1 className={styles.greeting}>
            Hola, {firstName}
            <span className={styles.waveEmoji} aria-hidden>👋</span>
          </h1>
        </div>
      </div>

      {/* ── Right: medalla + racha ── */}
      <div className={styles.actions}>
        <button
          className={styles.medalBtn}
          onClick={onOpenMedalDetail}
        >
          <span className={styles.medalStreakContent}>
            <span className={styles.medalIconWrap} style={{ color: medal.color }}>
              <medal.Icon size={18} />
            </span>
            {streak > 0 && (
              <span className={styles.streakWrap}>
                <FlameIcon size={14} className={styles.flameIcon} />
                <span className={styles.streakCount}>{streak}</span>
              </span>
            )}
          </span>
        </button>
      </div>
    </div>
  );
}

export default HeaderStatusBarWidget;
