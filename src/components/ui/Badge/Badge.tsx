import React from 'react';
import styles from './Badge.module.css';

export interface BadgeProps {
  /** Variante de color */
  variant?: 'default' | 'primary' | 'blue' | 'success' | 'danger' | 'warning' | 'streak' | 'bronze' | 'silver' | 'gold' | 'diamond';
  /** Tamaño */
  size?: 'sm' | 'md' | 'lg';
  /** Forma pill (border-radius completo) */
  pill?: boolean;
  /** Texto en mayúsculas con letter-spacing */
  uppercase?: boolean;
  /** Peso bold (700) */
  bold?: boolean;
  /** Mostrar punto indicador */
  dot?: boolean;
  /** Animar punto con pulso */
  dotPulse?: boolean;
  /** Icono/emoji antes del texto */
  icon?: React.ReactNode;
  /** Contenido del badge */
  children: React.ReactNode;
  /** Clases adicionales */
  className?: string;
}

export function Badge({
  variant = 'default',
  size = 'md',
  pill = false,
  uppercase = false,
  bold = false,
  dot = false,
  dotPulse = false,
  icon,
  children,
  className = '',
}: BadgeProps) {
  const badgeClasses = [
    styles.badge,
    styles[variant],
    styles[size],
    pill ? styles.pill : '',
    uppercase ? styles.uppercase : '',
    bold ? styles.bold : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={badgeClasses}>
      {dot && <span className={`${styles.dot} ${dotPulse ? styles.dotPulse : ''}`} />}
      {icon}
      {children}
    </span>
  );
}

export default Badge;
