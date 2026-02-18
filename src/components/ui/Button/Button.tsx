import React from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Variante del botón
   */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  
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
      className = '',
      disabled = false,
      children,
      ...props
    },
    ref
  ) => {
    const buttonClasses = [
      styles.button,
      styles[variant],
      styles[size],
      fullWidth ? styles.fullWidth : '',
      icon && !iconOnly ? styles.withIcon : '',
      iconOnly ? styles.iconOnly : '',
      disabled ? styles.disabled : '',
      className
    ].filter(Boolean).join(' ');

    return (
      <button
        ref={ref}
        className={buttonClasses}
        disabled={disabled}
        {...props}
      >
        {icon}
        {!iconOnly && children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
