"use client";

import React from 'react';
import type { WidgetCategory } from '@/types/WidgetCategory';
import styles from './WidgetWrapper.module.css';

export interface WidgetWrapperProps {
  /** Contenido del widget */
  children: React.ReactNode;
  /** Color del orbe glow superior-derecha */
  glowColor?: 'purple' | 'blue' | 'green' | 'red' | 'gold' | 'none';
  /** Color del segundo orbe glow inferior-izquierda */
  glowColorSecondary?: 'purple' | 'blue' | 'green' | 'gold' | 'none';
  /** Variante de radio: widget (20px) o hero (28px) */
  variant?: 'widget' | 'hero' | 'card';
  /** Categoría funcional del widget — aplica acento visual sutil */
  category?: WidgetCategory;
  /** Clases adicionales */
  className?: string;
  /** onClick handler */
  onClick?: () => void;
  /** Estilo adicional */
  style?: React.CSSProperties;
}

/**
 * Mapeo interno: categoría → defaults de glow.
 * Solo se usa cuando NO se pasa glowColor explícito.
 */
const CATEGORY_GLOW_MAP: Record<WidgetCategory, {
  glow1: WidgetWrapperProps['glowColor'];
  glow2: WidgetWrapperProps['glowColorSecondary'];
}> = {
  action:     { glow1: 'purple', glow2: 'blue' },
  progress:   { glow1: 'green',  glow2: 'blue' },
  decision:   { glow1: 'blue',   glow2: 'purple' },
  insight:    { glow1: 'blue',   glow2: 'none' },
  motivation: { glow1: 'purple', glow2: 'gold' },
  summary:    { glow1: 'none',   glow2: 'none' },
  system:     { glow1: 'none',   glow2: 'none' },
};

/**
 * WidgetWrapper — Componente base para todas las tarjetas/widgets
 * 
 * Reemplaza el patrón repetido de:
 *   wrapper > bgGradient + glowOverlay(glowPurple + glowBlue) + borderLayer + content
 * 
 * Usado por: GoalCard, MotivationCard, HistoryFilters, ProfileQuickAccess,
 *            SettingsDangerZone, IncomeRange, SavingsEvolution, etc.
 */
export function WidgetWrapper({
  children,
  glowColor,
  glowColorSecondary,
  variant = 'widget',
  category,
  className = '',
  onClick,
  style,
}: WidgetWrapperProps) {
  // Resolver glow colors: explícito > categoría > defaults
  const resolvedGlow1 = glowColor ?? (category ? CATEGORY_GLOW_MAP[category].glow1 : 'purple');
  const resolvedGlow2 = glowColorSecondary ?? (category ? CATEGORY_GLOW_MAP[category].glow2 : 'blue');

  const wrapperClasses = [
    styles.wrapper,
    styles[`variant_${variant}`],
    category ? styles[`cat_${category}`] : '',
    onClick ? styles.clickable : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={wrapperClasses}
      onClick={onClick}
      style={style}
      data-widget-cat={category}
    >
      {/* Layer 1: fondo */}
      <div className={styles.bgGradient} />

      {/* Layer 2: glow orbes */}
      {(resolvedGlow1 !== 'none' || resolvedGlow2 !== 'none') && (
        <div className={styles.glowOverlay}>
          {resolvedGlow1 !== 'none' && (
            <div className={`${styles.glow1} ${styles[`glow_${resolvedGlow1}`]}`} />
          )}
          {resolvedGlow2 !== 'none' && (
            <div className={`${styles.glow2} ${styles[`glow_${resolvedGlow2}`]}`} />
          )}
        </div>
      )}

      {/* Layer 3: borde + sombra */}
      <div className={styles.borderLayer} />

      {/* Layer 4: contenido */}
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
}

export default WidgetWrapper;
