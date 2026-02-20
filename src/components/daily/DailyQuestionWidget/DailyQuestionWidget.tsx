"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { OptionButton } from '@/components/ui/OptionButton';
import type { DailyDecisionCreateRequest } from '@/types/DailyQuestion';
import { isQuestionCompleted, getDecisionIdIfCompleted } from './DailyQuestionWidget.logic';
import type { DailyQuestionWidgetProps, DailyFormState } from './DailyQuestionWidget.types';

function SkeletonState(): React.ReactElement {
  return (
    <Card variant="default" size="md" rounded2xl>
      <Card.Content>
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-48 bg-gray-200 rounded" />
          <div className="h-3 w-64 bg-gray-200 rounded" />
          <div className="h-12 w-full bg-gray-100 rounded-xl mt-4" />
          <div className="h-12 w-full bg-gray-100 rounded-xl" />
        </div>
      </Card.Content>
    </Card>
  );
}

export function DailyQuestionWidget({
  questionState,
  goals,
  primaryGoalId,
  onSubmit,
  onAnswerSelected,
  onCompleted,
  onRetry,
  onCreateGoal,
}: DailyQuestionWidgetProps): React.ReactElement {
  const [form, setForm] = useState<DailyFormState>({
    selectedAnswer: null,
    selectedGoalId: primaryGoalId,
    isSubmitting: false,
    submitError: null,
  });

  if (questionState.status === 'loading') return <SkeletonState />;

  if (questionState.status === 'error') {
    return (
      <Card variant="default" size="md" rounded2xl>
        <Card.Content>
          <p className="text-sm text-gray-500 mb-4">No se pudo cargar la pregunta del día.</p>
          <Button variant="outline" size="sm" onClick={onRetry}>Reintentar</Button>
        </Card.Content>
      </Card>
    );
  }

  if (questionState.status === 'empty' || !questionState.data) {
    return (
      <Card variant="default" size="md" rounded2xl>
        <Card.Content>
          <p className="text-sm text-gray-500 mb-4">Crea un objetivo para continuar.</p>
          <Button variant="primary" size="sm" onClick={onCreateGoal}>Crear objetivo</Button>
        </Card.Content>
      </Card>
    );
  }

  const response = questionState.data;

  if (isQuestionCompleted(response)) {
    const decisionId = getDecisionIdIfCompleted(response);
    return (
      <Card variant="default" size="md" rounded2xl>
        <Card.Content>
          <p className="text-base font-semibold text-gray-900 mb-2">Ya completaste la decisión de hoy.</p>
          {decisionId && (
            <Button variant="primary" size="sm" onClick={() => onCompleted(decisionId)}>
              Ver impacto
            </Button>
          )}
        </Card.Content>
      </Card>
    );
  }

  const { question } = response;
  const today = response.date;

  const handleAnswerSelect = (answerKey: string) => {
    setForm((prev) => ({ ...prev, selectedAnswer: answerKey, submitError: null }));
    onAnswerSelected({ date: today, question_id: question.question_id, answer_key: answerKey });
  };

  const handleGoalChange = (goalId: string) => {
    setForm((prev) => ({ ...prev, selectedGoalId: goalId }));
  };

  const handleSubmit = async () => {
    if (!form.selectedAnswer) {
      setForm((prev) => ({ ...prev, submitError: 'Elige una opción.' }));
      return;
    }
    if (!form.selectedGoalId) {
      setForm((prev) => ({ ...prev, submitError: 'Selecciona un objetivo.' }));
      return;
    }

    setForm((prev) => ({ ...prev, isSubmitting: true, submitError: null }));

    const request: DailyDecisionCreateRequest = {
      date: today,
      question_id: question.question_id,
      answer_key: form.selectedAnswer,
      goal_id: form.selectedGoalId,
    };

    try {
      const decision = await onSubmit(request);
      onCompleted(decision.id);
    } catch {
      setForm((prev) => ({
        ...prev,
        isSubmitting: false,
        submitError: 'No se pudo guardar. Reintenta.',
      }));
    }
  };

  return (
    <Card variant="default" size="md" rounded2xl>
      <Card.Content>
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Tu decisión de hoy</h1>
        <p className="text-sm text-gray-500 mb-6">Elige una opción y guarda.</p>

        <h2 className="text-base font-medium text-gray-900 mb-3">{question.text}</h2>

        <div className="space-y-2 mb-6">
          {question.options.map((option) => (
            <OptionButton
              key={option.answer_key}
              value={option.answer_key}
              label={option.label}
              selected={form.selectedAnswer === option.answer_key}
              onClick={() => handleAnswerSelect(option.answer_key)}
            />
          ))}
        </div>

        {goals.length > 1 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Asignar a objetivo
            </label>
            <select
              value={form.selectedGoalId ?? ''}
              onChange={(e) => handleGoalChange(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}{goal.is_primary ? ' (Principal)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {form.submitError && (
          <p className="text-sm text-red-500 mb-3">{form.submitError}</p>
        )}

        <Button
          variant="primary"
          size="md"
          fullWidth
          disabled={!form.selectedAnswer || form.isSubmitting}
          onClick={handleSubmit}
        >
          {form.isSubmitting ? 'Guardando...' : 'Guardar decisión'}
        </Button>

        <p className="text-xs text-gray-400 text-center mt-4">Estimación educativa.</p>
      </Card.Content>
    </Card>
  );
}

export default DailyQuestionWidget;
