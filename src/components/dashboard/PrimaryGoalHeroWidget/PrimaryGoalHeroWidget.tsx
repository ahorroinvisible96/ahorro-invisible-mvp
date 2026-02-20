"use client";

import { useMemo } from 'react';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { Progress } from '@/components/ui/Progress/Progress';
import { PrimaryGoalHeroWidgetProps } from './PrimaryGoalHeroWidget.types';
import { 
  calculateProgressRatio, 
  calculateRemainingAmount, 
  determineWidgetState,
  formatCurrency
} from './PrimaryGoalHeroWidget.logic';

export const PrimaryGoalHeroWidget: React.FC<PrimaryGoalHeroWidgetProps> = ({
  primaryGoal,
  isLoading = false,
  error = null,
  isSystemActive = false,
  onCreateGoalClick
}) => {
  const state = determineWidgetState(isLoading, error, primaryGoal);
  
  const progressRatio = useMemo(() => {
    if (state !== 'active' || !primaryGoal) return 0;
    return calculateProgressRatio(primaryGoal.current_amount, primaryGoal.target_amount);
  }, [state, primaryGoal]);
  
  const progressPercentage = useMemo(() => {
    return Math.round(progressRatio * 100);
  }, [progressRatio]);
  
  const remainingAmount = useMemo(() => {
    if (state !== 'active' || !primaryGoal) return 0;
    return calculateRemainingAmount(primaryGoal.current_amount, primaryGoal.target_amount);
  }, [state, primaryGoal]);
  
  if (state === 'loading') {
    return (
      <Card variant="default" size="md">
        <Card.Content>
          <div className="flex items-center justify-between mb-2">
            <div className="h-5 w-32 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-5 w-20 bg-gray-200 animate-pulse rounded"></div>
          </div>
          <div className="h-8 w-48 bg-gray-200 animate-pulse rounded mb-4"></div>
          <div className="flex items-center justify-between mb-2">
            <div className="h-6 w-24 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-6 w-16 bg-gray-200 animate-pulse rounded"></div>
          </div>
          <div className="h-4 bg-gray-200 animate-pulse rounded mb-4"></div>
          <div className="h-5 w-64 bg-gray-200 animate-pulse rounded"></div>
        </Card.Content>
      </Card>
    );
  }
  
  if (state === 'error') {
    return (
      <Card variant="default" size="md">
        <Card.Content>
          <div className="text-red-600 mb-4">
            No se pudieron cargar los datos del objetivo. Intenta de nuevo.
          </div>
          <Button 
            variant="primary" 
            size="sm"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </Button>
        </Card.Content>
      </Card>
    );
  }
  
  if (state === 'empty') {
    return (
      <Card variant="default" size="md">
        <Card.Content>
          <h2 className="text-xl font-semibold text-text-primary mb-4">
            Crea tu primer objetivo
          </h2>
          <p className="text-text-secondary mb-6">
            Define un objetivo financiero para empezar a ahorrar.
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={onCreateGoalClick}
          >
            Crear objetivo
          </Button>
        </Card.Content>
      </Card>
    );
  }
  
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
          </svg>
          <span className="text-xs uppercase tracking-wider text-primary-600 font-medium">OBJETIVO PRINCIPAL</span>
        </div>
        {primaryGoal?.time_horizon_months && (
          <div className="bg-primary-600 text-white text-xs font-medium px-3 py-1 rounded-full">
            {primaryGoal.time_horizon_months} MESES
          </div>
        )}
        {isSystemActive && (
          <Badge variant="success" size="md" withDot>
            SISTEMA ACTIVO
          </Badge>
        )}
      </div>
      
      <div className="flex flex-col">
        <h2 className="text-2xl font-semibold text-text-primary mb-4">{primaryGoal?.title}</h2>
        
        <div className="flex items-center justify-between mb-2">
          <div className="text-2xl font-bold">
            {formatCurrency(primaryGoal?.current_amount || 0)}
            <span className="text-text-secondary text-sm font-normal ml-1">/ {formatCurrency(primaryGoal?.target_amount || 0)}</span>
          </div>
          <div className="text-primary-600 text-xl font-bold">
            {progressPercentage}%
          </div>
        </div>
        
        <Progress 
          value={progressPercentage} 
          className="mb-4" 
          size="md" 
          color="blue" 
        />
        
        <p className="text-text-secondary text-sm">
          Te faltan <span className="font-semibold">{formatCurrency(remainingAmount)}</span> para completar tu meta. ¡Sigue así!
        </p>
      </div>
    </div>
  );
};
