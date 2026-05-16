/**
 * questionInteractionLogger.ts — Logger de impresiones e interacciones
 *
 * Registra en Supabase (tabla `question_interactions`) cada vez que:
 *   1. Se muestra una pregunta al usuario (impresión)
 *   2. El usuario responde (o no responde)
 *
 * Zona horaria: Europe/Madrid
 */

import { getSupabase } from '../geminiService';
import type { AIQuestionDecision } from '../ai/questionOutputSchema';

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface QuestionInteraction {
  user_id: string;
  question_id: string;
  local_date: string;         // YYYY-MM-DD (Madrid)
  time_slot: string;          // Mañana | Tarde | Noche
  attempt_number: number;     // 1, 2, o 3
  responded: boolean;
  answer_key: string | null;
  saved_amount: number;
  avatar_dominant: string | null;
  avatar_secondary: string | null;
  avatar_confidence: number;
  ai_decision_type: string;
  ai_decision_reason: string;
  ai_from_model: boolean;     // true = Gemini respondió, false = fallback
  should_change_question: boolean;
  created_at: string;         // ISO timestamp
}

// ── Logger ─────────────────────────────────────────────────────────────────

/**
 * Registra una impresión de pregunta (se mostró al usuario).
 * Esto se llama cuando el backend selecciona y devuelve una pregunta.
 */
export async function logQuestionImpression(params: {
  userId: string;
  questionId: string;
  localDate: string;
  timeSlot: string;
  attemptNumber: number;
  avatarDominant: string | null;
  avatarSecondary: string | null;
  avatarConfidence: number;
  aiDecision: AIQuestionDecision;
  fromAI: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = getSupabase();

    const row: QuestionInteraction = {
      user_id: params.userId,
      question_id: params.questionId,
      local_date: params.localDate,
      time_slot: params.timeSlot,
      attempt_number: params.attemptNumber,
      responded: false,         // Se actualizará cuando responda
      answer_key: null,
      saved_amount: 0,
      avatar_dominant: params.avatarDominant,
      avatar_secondary: params.avatarSecondary,
      avatar_confidence: params.avatarConfidence,
      ai_decision_type: params.aiDecision.decision_type,
      ai_decision_reason: params.aiDecision.reason,
      ai_from_model: params.fromAI,
      should_change_question: params.aiDecision.should_change_question,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('question_interactions').insert(row);

    if (error) {
      console.error('[tracking] logQuestionImpression error:', error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[tracking] logQuestionImpression exception:', msg);
    return { ok: false, error: msg };
  }
}

/**
 * Registra una respuesta del usuario a la pregunta del día.
 * Actualiza el registro de impresión existente o crea uno nuevo si no existe.
 */
export async function logQuestionAnswer(params: {
  userId: string;
  questionId: string;
  answerKey: string;
  localDate: string;
  timeSlot: string;
  savedAmount: number;
  attemptNumber: number;
  avatarDominant: string | null;
  avatarSecondary: string | null;
  avatarConfidence: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = getSupabase();

    // Intentar actualizar la impresión existente (del mismo día + slot + question)
    const { data: existing, error: fetchErr } = await supabase
      .from('question_interactions')
      .select('id')
      .eq('user_id', params.userId)
      .eq('question_id', params.questionId)
      .eq('local_date', params.localDate)
      .eq('time_slot', params.timeSlot)
      .limit(1)
      .single();

    if (existing && !fetchErr) {
      // Actualizar el registro existente
      const { error: updateErr } = await supabase
        .from('question_interactions')
        .update({
          responded: true,
          answer_key: params.answerKey,
          saved_amount: params.savedAmount,
        })
        .eq('id', existing.id);

      if (updateErr) {
        console.error('[tracking] logQuestionAnswer update error:', updateErr.message);
        return { ok: false, error: updateErr.message };
      }
    } else {
      // No existía impresión previa, crear registro completo
      const { error: insertErr } = await supabase.from('question_interactions').insert({
        user_id: params.userId,
        question_id: params.questionId,
        local_date: params.localDate,
        time_slot: params.timeSlot,
        attempt_number: params.attemptNumber,
        responded: true,
        answer_key: params.answerKey,
        saved_amount: params.savedAmount,
        avatar_dominant: params.avatarDominant,
        avatar_secondary: params.avatarSecondary,
        avatar_confidence: params.avatarConfidence,
        ai_decision_type: 'select_question',
        ai_decision_reason: 'respuesta directa sin impresión previa',
        ai_from_model: false,
        should_change_question: false,
        created_at: new Date().toISOString(),
      });

      if (insertErr) {
        console.error('[tracking] logQuestionAnswer insert error:', insertErr.message);
        return { ok: false, error: insertErr.message };
      }
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[tracking] logQuestionAnswer exception:', msg);
    return { ok: false, error: msg };
  }
}

/**
 * Consulta cuántas interacciones hay hoy y en qué franjas,
 * para saber si hay que generar reintento o si ya respondió.
 */
export async function getTodayInteractions(
  userId: string,
  localDate: string,
): Promise<{
  interactions: Array<{
    question_id: string;
    time_slot: string;
    attempt_number: number;
    responded: boolean;
  }>;
  hasRespondedToday: boolean;
  currentAttempt: number;
}> {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('question_interactions')
      .select('question_id, time_slot, attempt_number, responded')
      .eq('user_id', userId)
      .eq('local_date', localDate)
      .order('attempt_number', { ascending: true });

    if (error) {
      console.error('[tracking] getTodayInteractions error:', error.message);
      return { interactions: [], hasRespondedToday: false, currentAttempt: 1 };
    }

    const interactions = data ?? [];
    const hasRespondedToday = interactions.some(i => i.responded);
    const currentAttempt = interactions.length > 0
      ? Math.max(...interactions.map(i => i.attempt_number)) + 1
      : 1;

    return {
      interactions,
      hasRespondedToday,
      currentAttempt: Math.min(currentAttempt, 3), // Máximo 3 intentos
    };
  } catch {
    return { interactions: [], hasRespondedToday: false, currentAttempt: 1 };
  }
}
