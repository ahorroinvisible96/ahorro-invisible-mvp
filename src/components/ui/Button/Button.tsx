import React from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Variante visual del botón
   */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dangerOutline' | 'cancel' | 'heroPrimary' | 'heroSecondary';
  
  /**
   * Tamaño del botón
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Botón de ancho completo
   */
  fullWidth?: boolean;
  
  /**
   * Icono para mostrar junto al texto
   */
  icon?: React.ReactNode;
  
  /**
   * Botón solo con icono (sin texto)
   */
  iconOnly?: boolean;

  /**
   * Estado de carga — muestra spinner
   */
  loading?: boolean;
  
  /**
   * Contenido del botón
   */
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      icon,
      iconOnly = false,
      loading = false,
      className = '',
      disabled = false,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const buttonClasses = [
      styles.button,
      styles[variant],
      styles[size],
      fullWidth ? styles.fullWidth : '',
      iconOnly ? styles.iconOnly : '',
      isDisabled ? styles.disabled : '',
      loading ? styles.loading : '',
      className
    ].filter(Boolean).join(' ');

    return (
      <button
        ref={ref}
        className={buttonClasses}
        disabled={isDisabled}
        {...props}
      >
        {loading && <span className={styles.spinner} />}
        {icon}
        {!iconOnly && children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
