"use client";

import React from 'react';
import styles from './WidgetWrapper.module.css';

export interface WidgetWrapperProps {
  /** Contenido del widget */
  children: React.ReactNode;
  /** Color del orbe glow superior-derecha */
  glowColor?: 'purple' | 'blue' | 'green' | 'red' | 'none';
  /** Color del segundo orbe glow inferior-izquierda */
  glowColorSecondary?: 'purple' | 'blue' | 'green' | 'none';
  /** Variante de radio: widget (20px) o hero (28px) */
  variant?: 'widget' | 'hero' | 'card';
  /** Clases adicionales */
  className?: string;
  /** onClick handler */
  onClick?: () => void;
  /** Estilo adicional */
  style?: React.CSSProperties;
}

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
  glowColor = 'purple',
  glowColorSecondary = 'blue',
  variant = 'widget',
  className = '',
  onClick,
  style,
}: WidgetWrapperProps) {
  const wrapperClasses = [
    styles.wrapper,
    styles[`variant_${variant}`],
    onClick ? styles.clickable : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClasses} onClick={onClick} style={style}>
      {/* Layer 1: fondo */}
      <div className={styles.bgGradient} />

      {/* Layer 2: glow orbes */}
      {(glowColor !== 'none' || glowColorSecondary !== 'none') && (
        <div className={styles.glowOverlay}>
          {glowColor !== 'none' && (
            <div className={`${styles.glow1} ${styles[`glow_${glowColor}`]}`} />
          )}
          {glowColorSecondary !== 'none' && (
            <div className={`${styles.glow2} ${styles[`glow_${glowColorSecondary}`]}`} />
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
