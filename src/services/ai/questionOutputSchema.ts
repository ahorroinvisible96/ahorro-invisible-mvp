/**
 * questionOutputSchema.ts — Schema y validación del JSON de Gemini
 *
 * Define la estructura exacta que Gemini debe devolver como decisión
 * y la valida para evitar que datos malformados rompan la app.
 */

// ── Tipos ──────────────────────────────────────────────────────────────────

export type DecisionType = 'select_question' | 'generate_experimental_question' | 'skip_today';
export type HabitPrincipleAI = 'obvious' | 'attractive' | 'easy' | 'satisfying';
export type DifficultyAI = 'low' | 'medium' | 'high';

export interface AIQuestionDecision {
  decision_type: DecisionType;
  question_intent: string;
  target_category: string;
  target_avatar: string[];
  habit_principle: HabitPrincipleAI;
  tone: string;
  difficulty: DifficultyAI;
  suggested_amount_eur: number;
  should_change_question: boolean;
  reason: string;
  risk_flags: string[];
  confidence: number;
}

// ── Default para fallback ─────────────────────────────────────────────────

export const DEFAULT_AI_DECISION: AIQuestionDecision = {
  decision_type: 'select_question',
  question_intent: 'ahorro_general',
  target_category: 'Delivery',
  target_avatar: ['comodo'],
  habit_principle: 'easy',
  tone: 'motivador',
  difficulty: 'low',
  suggested_amount_eur: 5,
  should_change_question: false,
  reason: 'fallback: IA no disponible',
  risk_flags: [],
  confidence: 0.3,
};

// ── Validador ──────────────────────────────────────────────────────────────

const VALID_DECISION_TYPES: DecisionType[] = ['select_question', 'generate_experimental_question', 'skip_today'];
const VALID_PRINCIPLES: HabitPrincipleAI[] = ['obvious', 'attractive', 'easy', 'satisfying'];
const VALID_DIFFICULTIES: DifficultyAI[] = ['low', 'medium', 'high'];

/**
 * Intenta parsear y validar el JSON de Gemini.
 * Si algo falla, devuelve el DEFAULT_AI_DECISION.
 */
export function parseAIDecision(raw: string): { decision: AIQuestionDecision; valid: boolean } {
  try {
    // Limpiar posibles wrappers de markdown (```json ... ```)
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleaned);

    // Validar campos obligatorios
    if (!parsed || typeof parsed !== 'object') {
      return { decision: DEFAULT_AI_DECISION, valid: false };
    }

    const decision: AIQuestionDecision = {
      decision_type: VALID_DECISION_TYPES.includes(parsed.decision_type)
        ? parsed.decision_type
        : 'select_question',
      question_intent: typeof parsed.question_intent === 'string'
        ? parsed.question_intent
        : DEFAULT_AI_DECISION.question_intent,
      target_category: typeof parsed.target_category === 'string'
        ? parsed.target_category
        : DEFAULT_AI_DECISION.target_category,
      target_avatar: Array.isArray(parsed.target_avatar)
        ? parsed.target_avatar.filter((a: unknown) => typeof a === 'string')
        : DEFAULT_AI_DECISION.target_avatar,
      habit_principle: VALID_PRINCIPLES.includes(parsed.habit_principle)
        ? parsed.habit_principle
        : DEFAULT_AI_DECISION.habit_principle,
      tone: typeof parsed.tone === 'string'
        ? parsed.tone
        : DEFAULT_AI_DECISION.tone,
      difficulty: VALID_DIFFICULTIES.includes(parsed.difficulty)
        ? parsed.difficulty
        : DEFAULT_AI_DECISION.difficulty,
      suggested_amount_eur: typeof parsed.suggested_amount_eur === 'number'
        ? parsed.suggested_amount_eur
        : DEFAULT_AI_DECISION.suggested_amount_eur,
      should_change_question: typeof parsed.should_change_question === 'boolean'
        ? parsed.should_change_question
        : DEFAULT_AI_DECISION.should_change_question,
      reason: typeof parsed.reason === 'string'
        ? parsed.reason
        : DEFAULT_AI_DECISION.reason,
      risk_flags: Array.isArray(parsed.risk_flags)
        ? parsed.risk_flags.filter((f: unknown) => typeof f === 'string')
        : [],
      confidence: typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1
        ? parsed.confidence
        : DEFAULT_AI_DECISION.confidence,
    };

    return { decision, valid: true };
  } catch {
    console.warn('[ai] parseAIDecision: JSON inválido, usando fallback');
    return { decision: DEFAULT_AI_DECISION, valid: false };
  }
}
