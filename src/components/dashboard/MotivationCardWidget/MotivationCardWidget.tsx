"use client";

import { useMemo } from 'react';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { MotivationCardWidgetProps, MotivationCardWidgetState } from './MotivationCardWidget.types';
import { analytics } from '@/services/analytics';

export const MotivationCardWidget: React.FC<MotivationCardWidgetProps> = ({
  dailyStatus,
  isDisabled = false,
  onCtaClick,
  onCreateGoalClick
}) => {
  // Determine widget state
  const state: MotivationCardWidgetState = useMemo(() => {
    return isDisabled ? 'disabled' : 'active';
  }, [isDisabled]);

  // Handle CTA click with analytics
  const handleCtaClick = () => {
    // Track analytics event
    if (dailyStatus) {
      analytics.motivationCtaClicked(
        dailyStatus.status,
        dailyStatus.status === 'pending' ? 'daily_question' : 'impact'
      );
    }
    
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

  // Disabled state (no primary goal)
  if (state === 'disabled') {
    return (
      <Card variant="gradient" size="md" className="bg-primary-600 text-white">
        <Card.Content className="p-6">
          <h3 className="text-2xl font-bold mb-2">Crea tu objetivo.</h3>
          <p className="text-white/80 mb-6">Define tu meta para empezar a ahorrar.</p>
          
          <Button 
            variant="outline" 
            className="bg-white/20 border-white/30 text-white hover:bg-white/30"
            onClick={handleCreateGoalClick}
          >
            CREAR OBJETIVO
          </Button>
        </Card.Content>
      </Card>
    );
  }

  // Active state with dynamic CTA based on daily status
  return (
    <Card variant="gradient" size="md" className="bg-primary-600 text-white">
      <Card.Content className="p-6">
        <h3 className="text-2xl font-bold mb-2">Tu Ahorro es imparable.</h3>
        <p className="text-white/80 mb-1">Intensidad:</p>
        <p className="text-white font-medium mb-6 leading-snug">MEDIUM - ¡Vas por buen camino!</p>
        
        <Button 
          variant="outline" 
          className="bg-white/20 border-white/30 text-white hover:bg-white/30"
          onClick={handleCtaClick}
        >
          {dailyStatus?.status === 'pending' ? 'RESPONDER AHORA' : 'VER IMPACTO'}
        </Button>
      </Card.Content>
    </Card>
  );
};
