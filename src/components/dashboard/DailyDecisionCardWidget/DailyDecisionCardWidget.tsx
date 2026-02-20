"use client";

import React from 'react';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import type { DailyDecisionCardWidgetProps } from './DailyDecisionCardWidget.types';

function SkeletonState(): React.ReactElement {
  return (
    <Card variant="default" size="md" rounded2xl>
      <Card.Content>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="h-3 w-40 bg-gray-200 rounded" />
          <div className="h-9 w-28 bg-gray-200 rounded-lg mt-4" />
        </div>
      </Card.Content>
    </Card>
  );
}

function DisabledState({ onCreateGoal }: { onCreateGoal: () => void }): React.ReactElement {
  return (
    <Card variant="default" size="md" rounded2xl>
      <Card.Content>
        <p className="text-sm font-medium text-gray-900 mb-1">Tu decisión de hoy</p>
        <p className="text-sm text-gray-500 mb-4">Crea un objetivo para continuar.</p>
        <Button variant="primary" size="sm" onClick={onCreateGoal}>
          Crear objetivo
        </Button>
      </Card.Content>
    </Card>
  );
}

export function DailyDecisionCardWidget({
  state,
  onCtaClick,
  onCreateGoal,
}: DailyDecisionCardWidgetProps): React.ReactElement {
  if (state.status === 'loading') return <SkeletonState />;

  if (state.status === 'disabled' || state.status === 'empty') {
    return <DisabledState onCreateGoal={onCreateGoal} />;
  }

  if (state.status === 'error') {
    return (
      <Card variant="default" size="md" rounded2xl>
        <Card.Content>
          <p className="text-sm text-gray-500">No se pudo cargar la decisión del día.</p>
        </Card.Content>
      </Card>
    );
  }

  const daily = state.data;
  const isPending = daily === null || daily.status === 'pending';

  const title = isPending ? 'Tu decisión de hoy' : 'Hoy ya está';
  const text = isPending ? '1 minuto. Un paso más.' : 'Mira tu impacto.';
  const ctaLabel = isPending ? 'Responder ahora' : 'Ver impacto';
  const destination = isPending ? 'daily_question' : 'impact';

  return (
    <Card variant="default" size="md" rounded2xl interactive>
      <Card.Content>
        <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
        <p className="text-sm text-gray-500 mb-4">{text}</p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onCtaClick(destination)}
        >
          {ctaLabel}
        </Button>
      </Card.Content>
    </Card>
  );
}

export default DailyDecisionCardWidget;
