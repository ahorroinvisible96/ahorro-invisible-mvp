"use client";

import React, { useEffect } from 'react';
import { analytics } from '@/services/analytics';
import type { HeaderStatusBarProps } from './HeaderStatusBarWidget.types';
import styles from './HeaderStatusBarWidget.module.css';

// ── Niveles de medalla (sincronizados con dashboard/page.tsx) ─────────────────
const MEDAL_TIERS = [
  { amount: 5000, emoji: '👑' },
  { amount: 2000, emoji: '💚' },
  { amount: 1000, emoji: '💎' },
  { amount: 500,  emoji: '🥇' },
  { amount: 100,  emoji: '🥈' },
  { amount: 50,   emoji: '🥉' },
];

function getMedalEmoji(totalSaved: number): string {
  const tier = MEDAL_TIERS.find(t => totalSaved >= t.amount);
  return tier?.emoji ?? '🌱';
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
  const medalEmoji = getMedalEmoji(totalSaved);

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
          className={styles.iconBtn}
          onClick={onOpenMedalDetail}
          aria-label={`Nivel ${medalEmoji} · ${streak} días de racha`}
          title={`Nivel ${medalEmoji} · ${streak} días de racha`}
        >
          <span className={styles.medalStreakContent}>
            <span className={styles.medalEmoji}>{medalEmoji}</span>
            {streak > 0 && (
              <span className={styles.streakCount}>🔥{streak}</span>
            )}
          </span>
        </button>
      </div>
    </div>
  );
}

export default HeaderStatusBarWidget;
