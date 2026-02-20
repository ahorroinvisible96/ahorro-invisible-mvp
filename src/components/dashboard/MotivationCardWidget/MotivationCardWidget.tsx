"use client";

import React from 'react';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import type { MotivationCardWidgetProps } from './MotivationCardWidget.types';

export function MotivationCardWidget({
  dailyState,
  onCtaClick,
  onCreateGoal,
  hasGoals,
}: MotivationCardWidgetProps): React.ReactElement {
  if (!hasGoals) {
    return (
      <Card variant="gradient" size="md" rounded2xl shadowBlue>
        <Card.Content>
          <h3 className="text-2xl font-bold mb-2 leading-tight text-white">
            Tu ahorro es imparable.
          </h3>
          <p className="text-white/80 mb-6 text-sm">
            Intensidad: Medium. Vas por buen camino.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="bg-white/20 border-white/30 text-white hover:bg-white/30"
            onClick={onCreateGoal}
          >
            Crear objetivo
          </Button>
        </Card.Content>
      </Card>
    );
  }

  const isPending =
    dailyState.status === 'loading' ||
    dailyState.status === 'empty' ||
    !dailyState.data ||
    dailyState.data.status === 'pending';

  const ctaLabel = isPending ? 'Responder ahora' : 'Ver impacto';
  const destination = isPending ? 'daily_question' : 'impact';

  return (
    <Card variant="gradient" size="md" rounded2xl shadowBlue>
      <Card.Content>
        <h3 className="text-2xl font-bold mb-2 leading-tight text-white">
          Tu ahorro es imparable.
        </h3>
        <p className="text-white/80 mb-1 text-sm">Intensidad:</p>
        <p className="text-white font-medium mb-6 text-sm leading-snug">
          Medium. Vas por buen camino.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="bg-white/20 border-white/30 text-white hover:bg-white/30"
          onClick={() => onCtaClick(destination)}
        >
          {ctaLabel}
        </Button>
      </Card.Content>
    </Card>
  );
}

export default MotivationCardWidget;
