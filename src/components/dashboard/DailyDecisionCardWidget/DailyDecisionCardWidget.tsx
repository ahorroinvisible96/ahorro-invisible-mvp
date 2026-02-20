"use client";

import { useMemo } from 'react';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { 
  DailyDecisionCardWidgetProps, 
  DailyDecisionCardWidgetState 
} from './DailyDecisionCardWidget.types';
import { analytics } from '@/services/analytics';

export const DailyDecisionCardWidget: React.FC<DailyDecisionCardWidgetProps> = ({
  status,
  decisionId,
  isLoading = false,
  isDisabled = false,
  onCtaClick,
  onCreateGoalClick
}) => {
  // Determine widget state
  const state: DailyDecisionCardWidgetState = useMemo(() => {
    if (isLoading) return 'loading';
    if (isDisabled) return 'disabled';
    return 'active';
  }, [isLoading, isDisabled]);

  // Handle CTA click with analytics
  const handleCtaClick = () => {
    // Track analytics event
    analytics.dailyCtaClicked(status, status === 'pending' ? 'daily_question' : 'impact');
    
    // Call the provided callback
    if (onCtaClick) {
      onCtaClick();
    }
  };

  // Handle create goal click
  const handleCreateGoalClick = () => {
    if (onCreateGoalClick) {
      onCreateGoalClick();
    }
  };

  // Loading state
  if (state === 'loading') {
    return (
      <Card variant="default" size="md">
        <Card.Content>
          <div className="h-6 w-40 bg-gray-200 animate-pulse rounded mb-3"></div>
          <div className="h-4 w-32 bg-gray-200 animate-pulse rounded mb-6"></div>
          <div className="h-10 bg-gray-200 animate-pulse rounded"></div>
        </Card.Content>
      </Card>
    );
  }

  // Disabled state (no primary goal)
  if (state === 'disabled') {
    return (
      <Card variant="default" size="md">
        <Card.Content>
          <h3 className="text-lg font-medium text-text-primary mb-2">
            Necesitas un objetivo
          </h3>
          <p className="text-text-secondary mb-4">
            Crea un objetivo para acceder a las decisiones diarias.
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={handleCreateGoalClick}
          >
            Crear objetivo
          </Button>
        </Card.Content>
      </Card>
    );
  }

  // Pending state
  if (status === 'pending') {
    return (
      <Card variant="default" size="md">
        <Card.Content>
          <h3 className="text-lg font-medium text-text-primary mb-2">
            Tu decisión de hoy
          </h3>
          <p className="text-text-secondary mb-4">
            1 minuto. Un paso más.
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={handleCtaClick}
          >
            Responder ahora
          </Button>
        </Card.Content>
      </Card>
    );
  }

  // Completed state
  return (
    <Card variant="default" size="md">
      <Card.Content>
        <h3 className="text-lg font-medium text-text-primary mb-2">
          Hoy ya está
        </h3>
        <p className="text-text-secondary mb-4">
          Mira tu impacto.
        </p>
        <Button
          variant="primary"
          size="md"
          onClick={handleCtaClick}
        >
          Ver impacto
        </Button>
      </Card.Content>
    </Card>
  );
};
