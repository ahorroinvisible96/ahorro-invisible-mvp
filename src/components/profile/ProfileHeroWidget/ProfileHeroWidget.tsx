"use client";

import React from 'react';
import styles from './ProfileHeroWidget.module.css';

interface ProfileHeroWidgetProps {
  userName: string;
  email: string;
}

/** Genera iniciales de hasta 2 caracteres desde el nombre o email */
function getInitials(name: string, email: string): string {
  const src = name.trim() || email;
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}

export function ProfileHeroWidget({ userName, email }: ProfileHeroWidgetProps): React.ReactElement {
  const initials = getInitials(userName, email);
  const displayName = userName.trim() || 'Usuario';

  return (
    <div className={styles.wrapper}>
      {/* Orbes de profundidad — igual que PrimaryGoalHeroWidget */}
      <div className={styles.blurBlue} />
      <div className={styles.blurPurple} />

      <div className={styles.card}>
        {/* Avatar */}
        <div className={styles.avatarRing}>
          <div className={styles.avatar}>
            <span className={styles.avatarInitials}>{initials}</span>
          </div>
        </div>

        {/* Nombre */}
        <h2 className={styles.name}>{displayName}</h2>

        {/* ID / email */}
        <p className={styles.email}>{email}</p>
      </div>
    </div>
  );
}

export default ProfileHeroWidget;
