"use client";

import { useMemo } from 'react';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { ImpactSummaryWidgetProps } from './ImpactSummaryWidget.types';
import { determineWidgetState, formatCurrency } from './ImpactSummaryWidget.logic';
import { analytics } from '@/services/analytics';

export const ImpactSummaryWidget: React.FC<ImpactSummaryWidgetProps> = ({
  decision,
  hasExtraSavingsAvailable = false,
  isLoading = false,
  error = null,
  onExtraSavingsClick,
  onHistoryClick
}) => {
  // Determine widget state
  const state = determineWidgetState(isLoading, error, decision);
  
  // Handle extra savings click
  const handleExtraSavingsClick = () => {
    if (!decision) return;
    
    // Track analytics event
    analytics.impactCtaExtraSavingsClicked(decision.id, decision.goal_id);
    
    // Call the provided callback
    if (onExtraSavingsClick) {
      onExtraSavingsClick();
    }
  };
  
  // Handle history click
  const handleHistoryClick = () => {
    // Track analytics event
    analytics.impactCtaHistoryClicked();
    
    // Call the provided callback
    if (onHistoryClick) {
      onHistoryClick();
    }
  };
  
  // Loading state
  if (state === 'loading') {
    return (
      <div className="w-full max-w-md">
        <div className="mb-6">
          <div className="h-8 w-36 bg-gray-200 animate-pulse rounded mb-2"></div>
          <div className="h-5 w-64 bg-gray-200 animate-pulse rounded"></div>
        </div>
        
        <Card className="p-6">
          <div className="space-y-4 mb-6">
            <div className="h-6 w-48 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-6 w-48 bg-gray-200 animate-pulse rounded"></div>
          </div>
          
          <div className="flex flex-col space-y-3">
            <div className="h-10 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-10 bg-gray-200 animate-pulse rounded"></div>
          </div>
        </Card>
      </div>
    );
  }
  
  // Error state
  if (state === 'error') {
    return (
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-text-primary mb-2">Impacto de hoy</h1>
          <p className="text-text-secondary">Esto es lo que suma tu constancia.</p>
        </div>
        
        <Card className="p-6">
          <div className="text-red-600 mb-4">
            No se pudo cargar la información de impacto. Intenta de nuevo.
          </div>
          <Button 
            variant="primary" 
            size="md"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </Button>
        </Card>
      </div>
    );
  }
  
  // No impact data available
  if (state === 'no_impact') {
    return (
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-text-primary mb-2">Impacto de hoy</h1>
          <p className="text-text-secondary">Esto es lo que suma tu constancia.</p>
        </div>
        
        <Card className="p-6">
          <div className="mb-6">
            <p className="text-text-primary font-medium mb-2">
              Aún no tenemos estimación para esta decisión.
            </p>
            <p className="text-text-secondary">
              Tu progreso sigue contando.
            </p>
          </div>
          
          <div className="flex flex-col space-y-3">
            <Button 
              variant="primary" 
              size="md"
              onClick={handleHistoryClick}
            >
              Ver historial
            </Button>
          </div>
          
          <p className="text-xs text-text-secondary text-center mt-4">
            Estimación educativa. No es asesoramiento financiero.
          </p>
        </Card>
      </div>
    );
  }
  
  // Active state with impact data
  return (
    <div className="w-full max-w-md">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Impacto de hoy</h1>
        <p className="text-text-secondary">Esto es lo que suma tu constancia.</p>
      </div>
      
      <Card className="p-6">
        <div className="space-y-4 mb-6">
          {decision?.impact.monthly_delta !== null && (
            <p className="text-text-primary font-medium">
              Estimación mensual: <span className="text-green-600">+{formatCurrency(decision?.impact.monthly_delta ?? 0)}</span>
            </p>
          )}
          
          {decision?.impact.yearly_delta !== null && (
            <p className="text-text-primary font-medium">
              Estimación anual: <span className="text-green-600">+{formatCurrency(decision?.impact.yearly_delta ?? 0)}</span>
            </p>
          )}
          
          {decision?.impact.label && (
            <p className="text-text-secondary italic">
              "{decision?.impact.label}"
            </p>
          )}
        </div>
        
        <div className="flex flex-col space-y-3">
          {hasExtraSavingsAvailable && (
            <Button 
              variant="primary" 
              size="md"
              onClick={handleExtraSavingsClick}
            >
              Registrar acción extra
            </Button>
          )}
          
          <Button 
            variant={hasExtraSavingsAvailable ? "outline" : "primary"}
            size="md"
            onClick={handleHistoryClick}
          >
            Ver historial
          </Button>
        </div>
        
        <p className="text-xs text-text-secondary text-center mt-4">
          Estimación educativa. No es asesoramiento financiero.
        </p>
      </Card>
    </div>
  );
};
