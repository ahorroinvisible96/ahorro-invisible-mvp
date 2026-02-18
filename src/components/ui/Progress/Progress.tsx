import React from 'react';
import styles from './Progress.module.css';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Valor actual del progreso (0-100)
   */
  value: number;
  
  /**
   * Valor máximo del progreso
   */
  max?: number;
  
  /**
   * Variante del progreso
   */
  variant?: 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'gradient';
  
  /**
   * Tamaño del progreso
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Mostrar patrón de rayas
   */
  striped?: boolean;
  
  /**
   * Animar el patrón de rayas
   */
  animated?: boolean;
  
  /**
   * Mostrar etiqueta con el valor
   */
  showLabel?: boolean;
  
  /**
   * Texto de la etiqueta
   */
  label?: string;
  
  /**
   * Formato para mostrar el valor
   */
  valueFormatter?: (value: number, max: number) => string;
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      value = 0,
      max = 100,
      variant = 'primary',
      size = 'md',
      striped = false,
      animated = false,
      showLabel = false,
      label,
      valueFormatter,
      className = '',
      ...props
    },
    ref
  ) => {
    // Asegurar que el valor esté entre 0 y max
    const clampedValue = Math.max(0, Math.min(value, max));
    const percentage = (clampedValue / max) * 100;
    
    // Formatear el valor para mostrar
    const formattedValue = valueFormatter 
      ? valueFormatter(clampedValue, max)
      : `${Math.round(percentage)}%`;
    
    const progressClasses = [
      styles.progressContainer,
      styles[variant],
      styles[size],
      striped ? styles.striped : '',
      animated ? styles.animated : '',
      className
    ].filter(Boolean).join(' ');

    return (
      <div>
        {showLabel && (
          <div className={styles.withLabel}>
            {label && <div className={styles.label}>{label}</div>}
            <div className={styles.value}>{formattedValue}</div>
          </div>
        )}
        <div
          ref={ref}
          className={progressClasses}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={max}
          {...props}
        >
          <div 
            className={styles.progressBar} 
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);

Progress.displayName = 'Progress';

export default Progress;
