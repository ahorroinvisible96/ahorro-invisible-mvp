"use client";

import React, { useEffect } from 'react';
import { analytics } from '@/services/analytics';
import type { HeaderStatusBarProps } from './HeaderStatusBarWidget.types';
import styles from './HeaderStatusBarWidget.module.css';

function SettingsIcon() {
  return (
    <svg
      className={styles.settingsIcon}
      width="17" height="17" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function HeaderStatusBarWidget({
  userName,
  userAvatar,
  streak = 0,
  onOpenProfile,
  onOpenSettings,
}: HeaderStatusBarProps): React.ReactElement {
  useEffect(() => {
    analytics.setScreen('dashboard');
  }, []);

  const initials = userName.trim().charAt(0).toUpperCase();

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

        {/* Texto */}
        <div className={styles.infoGroup}>
          <h1 className={styles.greeting}>
            Hola, {userName}
            <span className={styles.waveEmoji} aria-hidden>👋</span>
          </h1>
          {streak > 0 && (
            <div className={styles.streakBadge}>
              <span className={styles.streakFlame}>🔥</span>
              <span className={styles.streakText}>{streak} {streak === 1 ? 'día' : 'días'} de racha</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: settings ── */}
      <div className={styles.actions}>
        {onOpenSettings && (
          <button
            className={styles.iconBtn}
            onClick={onOpenSettings}
            aria-label="Configuración"
          >
            <SettingsIcon />
          </button>
        )}
      </div>
    </div>
  );
}

export default HeaderStatusBarWidget;
