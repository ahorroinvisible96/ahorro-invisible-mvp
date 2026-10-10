/**
 * questionInteractionLogger.ts — Logger de impresiones e interacciones
 *
 * Data Model V2 (Fase 5B.7): la tabla V1 `question_interactions` está retirada
 * (read-only, congelada). Las impresiones y decisiones se registran desde el
 * cliente vía RPC V2 (daily_prompt_impressions / daily_decisions, con
 * auth.uid()). Este módulo conserva la API pública:
 *   - logQuestionImpression / logQuestionAnswer → no-op (sin escritura V1)
 *   - getTodayInteractions → lee de las tablas V2
 *
 * Zona horaria: Europe/Madrid
 */

import { getSupabase } from '../geminiService';

// Tipo inline — el schema de IA ya no existe como módulo separado
interface AIQuestionDecisionLike {
  decision_type: string;
  reason: string;
  should_change_question: boolean;
  question_intent?: string;
  target_category?: string;
  target_avatar?: string[];
  habit_principle?: string;
  tone?: string;
  difficulty?: string;
  suggested_amount_eur?: number;
  risk_flags?: string[];
  confidence?: number;
}

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
  avatar_confidence: number;
  ai_decision_type: string;
  ai_decision_reason: string;
  ai_from_model: boolean;     // true = Gemini respondió, false = fallback
  should_change_question: boolean;
  created_at: string;         // ISO timestamp
}

/**
 * Impresión de pregunta. V2: la registra el cliente (RPC con auth.uid()).
 * Se mantiene la firma por compatibilidad; no escribe en tablas V1.
 */
export async function logQuestionImpression(params: {
  userId: string;
  questionId: string;
  localDate: string;
  timeSlot: string;
  attemptNumber: number;
  avatarDominant: string | null;
  avatarConfidence: number;
  aiDecision: AIQuestionDecisionLike;
  fromAI: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  void params;
  return { ok: true };
}

/**
 * Respuesta a la pregunta del día. V2: la decisión la registra el cliente
 * (record_daily_decision). No escribe en tablas V1.
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
  avatarConfidence: number;
}): Promise<{ ok: boolean; error?: string }> {
  void params;
  return { ok: true };
}

/**
 * Consulta las impresiones y la decisión de hoy (tablas V2)
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

    const [impRes, decRes] = await Promise.all([
      supabase
        .from('daily_prompt_impressions')
        .select('question_id, time_slot, shown_at')
        .eq('user_id', userId)
        .eq('local_date', localDate)
        .order('shown_at', { ascending: true }),
      supabase
        .from('daily_decisions')
        .select('question_id')
        .eq('user_id', userId)
        .eq('local_date', localDate)
        .eq('status', 'active')
        .limit(1),
    ]);

    if (impRes.error || decRes.error) {
      console.error('[tracking] getTodayInteractions error:', (impRes.error ?? decRes.error)?.message);
      return { interactions: [], hasRespondedToday: false, currentAttempt: 1 };
    }

    const answeredQ = decRes.data?.[0]?.question_id ?? null;
    const hasRespondedToday = (decRes.data?.length ?? 0) > 0;
    const interactions = (impRes.data ?? []).map((i, idx) => ({
      question_id: i.question_id as string,
      time_slot: i.time_slot as string,
      attempt_number: idx + 1,
      responded: hasRespondedToday && answeredQ === i.question_id,
    }));
    const currentAttempt = interactions.length + 1;

    return {
      interactions,
      hasRespondedToday,
      currentAttempt: Math.min(currentAttempt, 3), // Máximo 3 intentos
    };
  } catch {
    return { interactions: [], hasRespondedToday: false, currentAttempt: 1 };
  }
}

