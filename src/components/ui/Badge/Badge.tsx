import React from 'react';
import styles from './Badge.module.css';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Variante del badge
   */
  variant?: 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'solid';
  
  /**
   * Tamaño del badge
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Forma del badge
   */
  shape?: 'rounded' | 'pill';
  
  /**
   * Icono para mostrar junto al texto
   */
  icon?: React.ReactNode;
  
  /**
   * Mostrar un punto indicador
   */
  withDot?: boolean;
  
  /**
   * Animar el punto con efecto de pulso
   */
  pulse?: boolean;
  
  /**
   * Texto en mayúsculas
   */
  uppercase?: boolean;
  
  /**
   * Texto en negrita
   */
  bold?: boolean;
  
  /**
   * Contenido del badge
   */
  children?: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = 'default',
      size = 'md',
      shape = 'pill',
      icon,
      withDot = false,
      pulse = false,
      uppercase = false,
      bold = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const badgeClasses = [
      styles.badge,
      styles[variant],
      styles[size],
      styles[shape],
      icon ? styles.withIcon : '',
      withDot ? styles.withDot : '',
      pulse ? styles.pulse : '',
      uppercase ? styles.uppercase : '',
      bold ? styles.bold : '',
      className
    ].filter(Boolean).join(' ');

    return (
      <span
        ref={ref}
        className={badgeClasses}
        {...props}
      >
        {icon}
        {withDot && <span className={styles.dot} />}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;
