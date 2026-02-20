"use client";

import { useMemo } from 'react';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { SavingsEvolutionWidgetProps, SavingsRange } from './SavingsEvolutionWidget.types';
import { determineWidgetState, getCtaDestination, getCtaText } from './SavingsEvolutionWidget.logic';
import { analytics } from '@/services/analytics';

export const SavingsEvolutionWidget: React.FC<SavingsEvolutionWidgetProps> = ({
  savingsEvolution,
  dailyStatus,
  isLoading = false,
  error = null,
  onRangeChange,
  onCtaClick
}) => {
  const state = determineWidgetState(isLoading, error, savingsEvolution);
  
  // Available ranges for the chart
  const ranges: SavingsRange[] = ['7d', '30d', '90d'];
  
  // Current range
  const currentRange = useMemo(() => {
    return savingsEvolution?.range || '30d';
  }, [savingsEvolution]);
  
  // Handle range change
  const handleRangeChange = (range: SavingsRange) => {
    if (range === currentRange) return;
    
    // Track analytics event
    analytics.savingsEvolutionRangeChanged(
      range, 
      savingsEvolution?.mode || 'demo'
    );
    
    // Call the provided callback
    if (onRangeChange) {
      onRangeChange(range);
    }
  };
  
  // Handle CTA click
  const handleCtaClick = () => {
    if (onCtaClick) {
      onCtaClick();
    }
  };
  
  // Loading state
  if (state === 'loading') {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-48 bg-gray-200 animate-pulse rounded"></div>
          <div className="h-8 w-40 bg-gray-200 animate-pulse rounded"></div>
        </div>
        <Card variant="default" size="md">
          <Card.Content>
            <div className="flex items-center justify-center h-48">
              <div className="w-full">
                <div className="flex justify-center items-end h-40 space-x-2">
                  {Array(11).fill(0).map((_, index) => (
                    <div
                      key={index}
                      className="rounded-t-md w-6 bg-gray-200 animate-pulse"
                      style={{ height: `${20 + Math.random() * 50}%` }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          </Card.Content>
        </Card>
      </div>
    );
  }
  
  // Error state
  if (state === 'error') {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-text-primary">Evolución del Ahorro</h2>
        </div>
        <Card variant="default" size="md">
          <Card.Content className="flex flex-col items-center justify-center py-8">
            <div className="text-red-600 mb-4">
              No se pudieron cargar los datos de evolución.
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
      </div>
    );
  }
  
  // Empty state
  if (state === 'empty') {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-text-primary">Evolución del Ahorro</h2>
        </div>
        <Card variant="default" size="md">
          <Card.Content className="flex flex-col items-center justify-center py-8">
            <p className="text-text-secondary mb-6">
              Aún no hay datos.
            </p>
            {dailyStatus && (
              <Button
                variant="primary"
                size="md"
                onClick={handleCtaClick}
              >
                {getCtaText(dailyStatus.status)}
              </Button>
            )}
          </Card.Content>
        </Card>
      </div>
    );
  }
  
  // Active state
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text-primary">Evolución del Ahorro</h2>
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {ranges.map((range) => (
            <button
              key={range}
              className={`text-xs px-3 py-1 rounded-lg ${currentRange === range ? 'bg-primary-600 text-white' : 'text-text-secondary'}`}
              onClick={() => handleRangeChange(range)}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      
      <Card variant="default" size="md">
        <Card.Content>
          <div className="flex items-center justify-center h-48">
            <div className="w-full">
              <div className="flex justify-center items-end h-40 space-x-2">
                {savingsEvolution?.points.map((point, index) => (
                  <div
                    key={index}
                    className="rounded-t-md w-6"
                    style={{ 
                      height: `${point.amount}%`, 
                      background: 'var(--color-primary-500)' 
                    }}
                  ></div>
                ))}
              </div>
            </div>
          </div>
          {savingsEvolution?.mode === 'demo' && (
            <div className="text-xs text-gray-500 text-center mt-2">
              <Badge variant="default" size="sm">Modo demo</Badge>
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
};
