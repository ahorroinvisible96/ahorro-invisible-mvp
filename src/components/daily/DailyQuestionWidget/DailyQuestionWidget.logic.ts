import type { DailyQuestionResponse } from '@/types/DailyQuestion';

export function isQuestionCompleted(response: DailyQuestionResponse): boolean {
  return response.status === 'completed';
}

export function getDecisionIdIfCompleted(response: DailyQuestionResponse): string | null {
  if (response.status === 'completed') {
    return response.decision_id;
  }
  return null;
}

export function isConflictError(status: number): boolean {
  return status === 409;
}
