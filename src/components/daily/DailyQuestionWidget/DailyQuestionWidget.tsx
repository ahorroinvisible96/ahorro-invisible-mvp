"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { 
  DailyQuestionWidgetProps, 
  DailyQuestionWidgetState,
  DailyQuestionFormData
} from './DailyQuestionWidget.types';
import { 
  determineWidgetState, 
  validateForm,
  findPrimaryGoal,
  findOptionLabel
} from './DailyQuestionWidget.logic';
import { analytics } from '@/services/analytics';

export const DailyQuestionWidget: React.FC<DailyQuestionWidgetProps> = ({
  date,
  question,
  status,
  decisionId,
  goals,
  primaryGoalId,
  isLoading = false,
  error = null,
  onAnswerSelect,
  onGoalSelect,
  onSubmit,
  onViewImpact
}) => {
  // Determine widget state
  const state: DailyQuestionWidgetState = determineWidgetState(isLoading, error, status);
  
  // Form data state
  const [formData, setFormData] = useState<DailyQuestionFormData>({
    answerKey: null,
    goalId: primaryGoalId
  });
  
  // Form validation error
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Update form when primaryGoalId changes
  useEffect(() => {
    if (primaryGoalId && state === 'pending') {
      setFormData(prev => ({
        ...prev,
        goalId: primaryGoalId
      }));
    }
  }, [primaryGoalId, state]);
  
  // Handle answer selection
  const handleAnswerSelect = (answerKey: string) => {
    setFormData(prev => ({
      ...prev,
      answerKey
    }));
    
    // Clear validation error if present
    if (validationError) {
      setValidationError(null);
    }
    
    // Call the provided callback
    if (onAnswerSelect) {
      onAnswerSelect(answerKey);
    }
    
    // Track analytics event
    if (question) {
      analytics.dailyAnswerSelected(date, question.question_id, answerKey);
    }
  };
  
  // Handle goal selection
  const handleGoalSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const goalId = e.target.value;
    
    setFormData(prev => ({
      ...prev,
      goalId
    }));
    
    // Call the provided callback
    if (onGoalSelect) {
      onGoalSelect(goalId);
    }
  };
  
  // Handle form submission
  const handleSubmit = () => {
    // Validate form
    const error = validateForm(formData);
    
    if (error) {
      setValidationError(error);
      return;
    }
    
    // Call the provided callback
    if (onSubmit) {
      onSubmit();
    }
  };
  
  // Handle view impact click
  const handleViewImpact = () => {
    if (onViewImpact) {
      onViewImpact();
    }
  };
  
  // Loading state
  if (state === 'loading') {
    return (
      <div className="w-full max-w-md">
        <div className="mb-6">
          <div className="h-8 w-48 bg-gray-200 animate-pulse rounded mb-2"></div>
          <div className="h-5 w-64 bg-gray-200 animate-pulse rounded"></div>
        </div>
        
        <Card className="p-6">
          <div className="mb-6">
            <div className="h-6 w-56 bg-gray-200 animate-pulse rounded mb-4"></div>
            
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="w-full h-12 bg-gray-200 animate-pulse rounded-lg"
                ></div>
              ))}
            </div>
          </div>
          
          <div className="mb-6">
            <div className="h-5 w-32 bg-gray-200 animate-pulse rounded mb-2"></div>
            <div className="w-full h-12 bg-gray-200 animate-pulse rounded-lg"></div>
          </div>
          
          <div className="h-12 w-full bg-gray-200 animate-pulse rounded-lg"></div>
        </Card>
      </div>
    );
  }
  
  // Error state
  if (state === 'error') {
    return (
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-text-primary mb-2">Decisión del día</h1>
          <p className="text-text-secondary">Una pequeña decisión diaria puede generar un gran impacto en tus finanzas.</p>
        </div>
        
        <Card className="p-6">
          <div className="text-red-600 mb-4">
            No se pudo cargar la pregunta del día. Intenta de nuevo.
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
  
  // Completed state
  if (state === 'completed') {
    return (
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-text-primary mb-2">Decisión del día</h1>
          <p className="text-text-secondary">Una pequeña decisión diaria puede generar un gran impacto en tus finanzas.</p>
        </div>
        
        <Card className="p-6">
          <h1 className="text-xl font-semibold text-text-primary mb-2">
            Ya completaste la decisión de hoy
          </h1>
          <p className="text-text-secondary mb-6">
            Vuelve mañana para una nueva decisión o revisa el impacto de tu elección de hoy.
          </p>
          <Button 
            variant="primary" 
            size="md"
            onClick={handleViewImpact}
          >
            Ver impacto
          </Button>
        </Card>
      </div>
    );
  }
  
  // Pending state
  return (
    <div className="w-full max-w-md">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Tu decisión de hoy</h1>
        <p className="text-text-secondary">Elige una opción y guarda.</p>
      </div>
      
      {validationError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
          {validationError}
        </div>
      )}
      
      {question && (
        <Card className="p-6">
          <div className="mb-6">
            <h2 className="text-lg font-medium text-text-primary mb-4">
              {question.text}
            </h2>
            
            <div className="space-y-3">
              {question.options.map((option) => (
                <button
                  key={option.answer_key}
                  onClick={() => handleAnswerSelect(option.answer_key)}
                  className={`w-full py-3 px-4 rounded-lg border text-left ${
                    formData.answerKey === option.answer_key
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-gray-200 text-text-primary hover:bg-gray-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-text-primary mb-2">
              Asignar a objetivo
            </label>
            <select
              value={formData.goalId || ''}
              onChange={handleGoalSelect}
              className="w-full rounded-lg border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {goals.length === 0 ? (
                <option value="" disabled>Crea un objetivo para continuar</option>
              ) : (
                goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title} {goal.is_primary ? "(Principal)" : ""}
                  </option>
                ))
              )}
            </select>
          </div>
          
          <Button
            variant="primary"
            size="md"
            fullWidth
            disabled={!formData.answerKey || !formData.goalId}
            onClick={handleSubmit}
          >
            Guardar decisión
          </Button>
          
          <p className="text-xs text-text-secondary text-center mt-4">
            Estimación educativa. No es asesoramiento financiero.
          </p>
        </Card>
      )}
    </div>
  );
};
