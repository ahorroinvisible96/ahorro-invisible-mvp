"use client";

import React from 'react';
import type { ProfileQuickAccessWidgetProps } from './ProfileQuickAccessWidget.types';
import styles from './ProfileQuickAccessWidget.module.css';

export function ProfileQuickAccessWidget({
  onGoToSettings,
  onGoToGoals,
  onGoToHistory,
}: ProfileQuickAccessWidgetProps): React.ReactElement {
  const items = [
    {
      label: 'Mis objetivos',
      onClick: onGoToGoals,
      iconClass: styles.itemIconGreen,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
        </svg>
      ),
    },
    {
      label: 'Historial de ahorro',
      onClick: onGoToHistory,
      iconClass: styles.itemIconBlue,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ),
    },
    {
      label: 'Configuración avanzada',
      onClick: onGoToSettings,
      iconClass: styles.itemIconPurple,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
        </svg>
      ),
    },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.bgGradient} />
      <div className={styles.glowBlue} />
      <div className={styles.borderLayer} />

      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
              <polyline points="13 2 13 9 20 9"/>
            </svg>
          </div>
          <h2 className={styles.title}>Accesos rápidos</h2>
        </div>

        <div className={styles.list}>
          {items.map((item) => (
            <button key={item.label} className={styles.item} onClick={item.onClick}>
              <div className={styles.itemLeft}>
                <div className={`${styles.itemIconWrap} ${item.iconClass}`}>
                  {item.icon}
                </div>
                <span className={styles.itemLabel}>{item.label}</span>
              </div>
              <span className={styles.chevron}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProfileQuickAccessWidget;
