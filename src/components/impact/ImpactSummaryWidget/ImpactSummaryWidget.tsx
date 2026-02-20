"use client";

import React from 'react';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import type { ImpactSummaryWidgetProps } from './ImpactSummaryWidget.types';

function formatDelta(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)}`;
}

function SkeletonState(): React.ReactElement {
  return (
    <Card variant="default" size="md" rounded2xl>
      <Card.Content>
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-32 bg-gray-200 rounded" />
          <div className="h-3 w-56 bg-gray-200 rounded" />
          <div className="h-16 w-full bg-gray-100 rounded-xl" />
        </div>
      </Card.Content>
    </Card>
  );
}

export function ImpactSummaryWidget({
  state,
  onExtraSavingsClick,
  onHistoryClick,
  onRetry,
}: ImpactSummaryWidgetProps): React.ReactElement {
  if (state.status === 'loading') return <SkeletonState />;

  if (state.status === 'error') {
    return (
      <Card variant="default" size="md" rounded2xl>
        <Card.Content>
          <p className="text-sm text-gray-500 mb-4">No se pudo cargar el impacto.</p>
          <Button variant="outline" size="sm" onClick={onRetry}>Reintentar</Button>
        </Card.Content>
      </Card>
    );
  }

  if (state.status === 'empty' || !state.data) {
    return (
      <Card variant="default" size="md" rounded2xl>
        <Card.Content>
          <p className="text-sm text-gray-500 mb-2">Aún no tenemos estimación para esta decisión.</p>
          <p className="text-sm text-gray-400 mb-4">Tu progreso sigue contando.</p>
          <Button variant="outline" size="sm" onClick={onHistoryClick}>Ver historial</Button>
        </Card.Content>
      </Card>
    );
  }

  const { impact } = state.data;
  const hasImpact =
    impact.monthly_delta !== null || impact.yearly_delta !== null;

  return (
    <Card variant="default" size="md" rounded2xl>
      <Card.Content>
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Impacto de hoy</h1>
        <p className="text-sm text-gray-500 mb-6">Esto es lo que suma tu constancia.</p>

        {hasImpact ? (
          <div className="bg-blue-50 rounded-xl p-4 mb-6 space-y-2">
            {impact.monthly_delta !== null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Estimación mensual</span>
                <span className={`text-sm font-semibold ${impact.monthly_delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatDelta(impact.monthly_delta)}
                </span>
              </div>
            )}
            {impact.yearly_delta !== null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Estimación anual</span>
                <span className={`text-sm font-semibold ${impact.yearly_delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatDelta(impact.yearly_delta)}
                </span>
              </div>
            )}
            {impact.label && (
              <p className="text-xs text-blue-600 pt-1">{impact.label}</p>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-500">Aún no tenemos estimación para esta decisión.</p>
            <p className="text-sm text-gray-400 mt-1">Tu progreso sigue contando.</p>
          </div>
        )}

        <p className="text-xs text-gray-400 mb-6">
          Estimación educativa. No es asesoramiento financiero.
        </p>

        <div className="flex flex-col gap-2">
          <Button variant="outline" size="md" fullWidth onClick={onExtraSavingsClick}>
            Registrar acción extra
          </Button>
          <Button variant="ghost" size="md" fullWidth onClick={onHistoryClick}>
            Ver historial
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}

export default ImpactSummaryWidget;
