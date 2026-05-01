import React from 'react';
import styles from './EmptyState.module.css';
import { Button } from '@/components/ui/Button/Button';

export interface EmptyStateProps {
  /** Icono/emoji a mostrar */
  icon?: React.ReactNode;
  /** Título principal */
  title: string;
  /** Descripción secundaria */
  description?: string;
  /** Acción con botón */
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'outline' | 'ghost';
  };
  /** Clases adicionales */
  className?: string;
}

export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.iconWrap}>{icon}</div>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && (
        <Button
          variant={action.variant ?? 'outline'}
          size="sm"
          onClick={action.onClick}
          className={styles.action}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
