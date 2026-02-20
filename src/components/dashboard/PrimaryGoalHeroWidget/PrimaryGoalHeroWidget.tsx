"use client";

import React from 'react';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { Progress } from '@/components/ui/Progress/Progress';
import { formatCurrency } from './PrimaryGoalHeroWidget.logic';
import type { PrimaryGoalHeroWidgetProps } from './PrimaryGoalHeroWidget.types';

function SkeletonState(): React.ReactElement {
  return (
    <Card variant="default" size="md" rounded2xl>
      <Card.Content>
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-32 bg-gray-200 rounded" />
          <div className="h-6 w-48 bg-gray-200 rounded" />
          <div className="h-3 w-full bg-gray-200 rounded" />
          <div className="h-3 w-24 bg-gray-200 rounded" />
        </div>
      </Card.Content>
    </Card>
  );
}

function EmptyState({ onCreateGoal }: { onCreateGoal: () => void }): React.ReactElement {
  return (
    <Card variant="default" size="md" rounded2xl>
      <Card.Content>
        <p className="text-sm text-gray-500 mb-4">Aún no tienes un objetivo principal.</p>
        <Button variant="primary" size="sm" onClick={onCreateGoal}>
          Crear objetivo
        </Button>
      </Card.Content>
    </Card>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return (
    <Card variant="default" size="md" rounded2xl>
      <Card.Content>
        <p className="text-sm text-gray-500 mb-4">No se pudo cargar el objetivo.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      </Card.Content>
    </Card>
  );
}

export function PrimaryGoalHeroWidget({
  state,
  onRetry,
  onCreateGoal,
}: PrimaryGoalHeroWidgetProps): React.ReactElement {
  if (state.status === 'loading') {
    return <SkeletonState />;
  }

  if (state.status === 'error') {
    return <ErrorState onRetry={onRetry} />;
  }

  if (state.status === 'empty' || state.data === null) {
    return <EmptyState onCreateGoal={onCreateGoal} />;
  }

  const { goal, progress, systemActive } = state.data;

  return (
    <Card variant="default" size="md" rounded2xl>
      <Card.Content>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wider font-medium text-gray-500">
            Objetivo principal
          </span>
          {systemActive && (
            <Badge variant="success" size="sm" withDot>
              Sistema activo
            </Badge>
          )}
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-4">{goal.title}</h2>

        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-bold text-gray-900">
            {formatCurrency(progress.current_amount)}
            <span className="text-sm font-normal text-gray-500 ml-1">
              / {formatCurrency(progress.target_amount)}
            </span>
          </span>
          <span className="text-lg font-bold text-blue-600">
            {progress.progress_percent}%
          </span>
        </div>

        <Progress
          value={progress.progress_percent}
          size="md"
          variant="primary"
          className="mb-3"
        />

        <p className="text-sm text-gray-500">
          Te faltan{' '}
          <span className="font-semibold text-gray-700">
            {formatCurrency(progress.remaining_amount)}
          </span>
          . Sigue así.
        </p>
      </Card.Content>
    </Card>
  );
}

export default PrimaryGoalHeroWidget;
