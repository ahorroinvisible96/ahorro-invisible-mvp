"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import type { SidebarNavigationProps, SidebarRoute, NavItem } from './SidebarNavigationWidget.types';
import styles from './SidebarNavigationWidget.module.css';

const NAV_ITEMS: NavItem[] = [
  { route: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { route: 'daily', label: 'Decisión Diaria', href: '/daily' },
  { route: 'historial', label: 'Historial', href: '/history' },
  { route: 'perfil', label: 'Perfil', href: '/profile' },
  { route: 'ajustes', label: 'Ajustes', href: '/settings' },
];

export function SidebarNavigationWidget({
  userName,
  activeRoute,
  onNavigate,
  onLogout,
}: SidebarNavigationProps): React.ReactElement {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await onLogout();
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoMark}>AI</div>
        <div>
          <div className={styles.logoText}>Ahorro</div>
          <div className={styles.logoSub}>Invisible</div>
        </div>
      </div>

      <div className={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.route}
            href={item.href}
            className={`${styles.navItem} ${activeRoute === item.route ? styles.navItemActive : ''}`}
            onClick={() => {
              onNavigate(item.route as SidebarRoute);
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.userRow}>
          <div className={styles.avatar}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <span className={styles.userName}>{userName}</span>
        </div>
        <button
          className={styles.logoutBtn}
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? 'Saliendo...' : 'Cerrar sesión'}
        </button>
      </div>
    </nav>
  );
}

export default SidebarNavigationWidget;
