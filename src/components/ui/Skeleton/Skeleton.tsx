import React from 'react';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  /** Ancho del skeleton */
  width?: string | number;
  /** Alto del skeleton */
  height?: string | number;
  /** Forma circular */
  circle?: boolean;
  /** Líneas múltiples */
  lines?: number;
  /** Clases adicionales */
  className?: string;
}

export function Skeleton({
  width = '100%',
  height = 16,
  circle = false,
  lines,
  className = '',
}: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className={`${styles.group} ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={styles.skeleton}
            style={{
              width: i === lines - 1 ? '70%' : '100%',
              height,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${styles.skeleton} ${circle ? styles.circle : ''} ${className}`}
      style={{
        width: circle ? height : width,
        height,
      }}
    />
  );
}

/** Skeleton preconfigurado para un widget completo */
export function WidgetSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`${styles.widgetSkeleton} ${className}`}>
      <div className={styles.widgetHeader}>
        <Skeleton circle height={34} />
        <Skeleton width={120} height={12} />
      </div>
      <Skeleton height={20} width="80%" />
      <Skeleton lines={2} height={14} />
      <Skeleton height={44} />
    </div>
  );
}

export default Skeleton;
