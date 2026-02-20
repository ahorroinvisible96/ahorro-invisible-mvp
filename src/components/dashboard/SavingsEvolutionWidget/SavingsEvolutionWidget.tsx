"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card/Card';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import type { SavingsRange } from '@/types/Dashboard';
import type { SavingsEvolutionWidgetProps } from './SavingsEvolutionWidget.types';

const RANGES: SavingsRange[] = ['7d', '30d', '90d'];
const RANGE_LABELS: Record<SavingsRange, string> = { '7d': '7D', '30d': '30D', '90d': '90D' };

function SkeletonState(): React.ReactElement {
  return (
    <Card variant="default" size="md" rounded2xl>
      <Card.Content>
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-40 bg-gray-200 rounded" />
          <div className="h-36 w-full bg-gray-100 rounded-lg" />
        </div>
      </Card.Content>
    </Card>
  );
}

export function SavingsEvolutionWidget({
  state,
  daily,
  onRangeChange,
  onCtaClick,
}: SavingsEvolutionWidgetProps): React.ReactElement {
  const [activeRange, setActiveRange] = useState<SavingsRange>('30d');

  if (state.status === 'loading') return <SkeletonState />;

  const handleRangeClick = (range: SavingsRange) => {
    setActiveRange(range);
    onRangeChange(range);
  };

  const isEmpty =
    state.status === 'empty' ||
    state.status === 'error' ||
    !state.data ||
    state.data.points.length === 0;

  const isDemo = state.data?.mode === 'demo';
  const points = state.data?.points ?? [];
  const maxAmount = points.length > 0 ? Math.max(...points.map((p) => p.amount)) : 1;

  const dailyPending = !daily || daily.status === 'pending';
  const ctaLabel = dailyPending ? 'Responder ahora' : 'Ver impacto';
  const ctaDest = dailyPending ? 'daily_question' : 'impact';

  return (
    <Card variant="default" size="md" rounded2xl>
      <Card.Content>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Evolución del ahorro</h3>
          <div className="flex items-center gap-2">
            {isDemo && <Badge variant="default" size="sm">Modo demo</Badge>}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => handleRangeClick(r)}
                  className={`text-xs px-2 py-1 rounded-md transition-colors ${
                    activeRange === r
                      ? 'bg-white text-gray-900 shadow-sm font-medium'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {RANGE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-36 gap-3">
            <p className="text-sm text-gray-400">Aún no hay datos.</p>
            <Button variant="primary" size="sm" onClick={() => onCtaClick(ctaDest)}>
              {ctaLabel}
            </Button>
          </div>
        ) : (
          <div className="flex items-end justify-between h-36 gap-1">
            {points.map((point, index) => {
              const heightPct = maxAmount > 0 ? (point.amount / maxAmount) * 100 : 0;
              return (
                <div key={index} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className="w-full rounded-t-sm bg-blue-500"
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                    title={`${point.date}: ${point.amount}€`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

export default SavingsEvolutionWidget;
