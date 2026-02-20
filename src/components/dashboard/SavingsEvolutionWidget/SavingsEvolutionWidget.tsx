"use client";

import React, { useEffect } from 'react';
import { Card } from '@/components/ui';
import { analytics } from '@/services/analytics';
import type { SavingsEvolutionWidgetProps } from './SavingsEvolutionWidget.types';
import styles from './SavingsEvolutionWidget.module.css';

type Range = '7d' | '30d' | '90d';
const RANGES: Range[] = ['7d', '30d', '90d'];

export function SavingsEvolutionWidget({
  evolution,
  onChangeRange,
}: SavingsEvolutionWidgetProps): React.ReactElement {
  const { range, mode, points } = evolution;

  useEffect(() => {
    analytics.savingsEvolutionRangeChanged(range, mode);
  }, [range, mode]);

  const maxValue = points.length > 0 ? Math.max(...points.map((p) => p.value)) : 1;
  const total = points.length > 0 ? points[points.length - 1].value : 0;

  const handleRange = (r: Range) => {
    analytics.savingsEvolutionRangeChanged(r, mode);
    onChangeRange(r);
  };

  return (
    <Card variant="default" size="md" rounded2xl>
      <Card.Content>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900">Evolución del ahorro</h3>
          <div className="flex items-center gap-2">
            {mode === 'demo' && (
              <span className={styles.demoChip}>DEMO</span>
            )}
            <div className={styles.rangeSelector}>
              {RANGES.map((r) => (
                <button
                  key={r}
                  className={`${styles.rangeBtn} ${r === range ? styles.rangeBtnActive : ''}`}
                  onClick={() => handleRange(r)}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.totalValue}>{total.toLocaleString('es-ES')}€</div>
        <div className={styles.totalLabel}>Acumulado en {range}</div>

        {points.length === 0 ? (
          <div className={styles.emptyState}>Sin datos para este período</div>
        ) : (
          <div className={styles.chartArea}>
            {points.map((point, i) => {
              const heightPct = maxValue > 0 ? Math.max((point.value / maxValue) * 100, 5) : 5;
              const isLast = i === points.length - 1;
              return (
                <div
                  key={point.date}
                  className={`${styles.bar} ${isLast ? styles.barLast : ''}`}
                  style={{ height: `${heightPct}%` }}
                  title={`${point.date}: ${point.value}€`}
                />
              );
            })}
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

export default SavingsEvolutionWidget;
