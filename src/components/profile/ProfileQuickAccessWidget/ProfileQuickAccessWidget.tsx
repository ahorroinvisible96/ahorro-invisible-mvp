"use client";

import React from 'react';
import type { ProfileQuickAccessWidgetProps } from './ProfileQuickAccessWidget.types';
import styles from './ProfileQuickAccessWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';
import { TargetIcon, BarChartIcon, SettingsIcon, ChevronRightIcon, FileIcon } from '@/components/ui/AppIcons';

export function ProfileQuickAccessWidget({
  onGoToSettings,
  onGoToGoals,
  onGoToHistory,
}: ProfileQuickAccessWidgetProps): React.ReactElement {
  const { collapsed, toggle } = useWidgetCollapse('profile_quick_access', false);
  const items = [
    {
      label: 'Mis objetivos',
      onClick: onGoToGoals,
      iconClass: styles.itemIconGreen,
      icon: <TargetIcon size={16} />,
    },
    {
      label: 'Historial de ahorro',
      onClick: onGoToHistory,
      iconClass: styles.itemIconBlue,
      icon: <BarChartIcon size={16} />,
    },
    {
      label: 'Configuración avanzada',
      onClick: onGoToSettings,
      iconClass: styles.itemIconPurple,
      icon: <SettingsIcon size={16} />,
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
            <FileIcon size={16} />
          </div>
          <h2 className={styles.title} style={{ flex: 1 }}>Accesos rápidos</h2>
          <CollapseChevron collapsed={collapsed} onToggle={toggle} />
        </div>

        {!collapsed && <div className={styles.list}>
          {items.map((item) => (
            <button key={item.label} className={styles.item} onClick={item.onClick}>
              <div className={styles.itemLeft}>
                <div className={`${styles.itemIconWrap} ${item.iconClass}`}>
                  {item.icon}
                </div>
                <span className={styles.itemLabel}>{item.label}</span>
              </div>
              <span className={styles.chevron}>
                <ChevronRightIcon size={16} />
              </span>
            </button>
          ))}
        </div>}
      </div>
    </div>
  );
}

export default ProfileQuickAccessWidget;
