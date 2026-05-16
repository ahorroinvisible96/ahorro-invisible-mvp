/**
 * geminiQuestionClient.ts — Wrapper Gemini para decisión de preguntas
 *
 * Envía el contexto anonimizado a Gemini y pide una decisión
 * estructurada en JSON sobre qué pregunta mostrar al usuario.
 */

import { getGemini, getModelName, isAIEnabled } from '../geminiService';
import type { AIContext } from './buildAIContext';
import { parseAIDecision, DEFAULT_AI_DECISION, type AIQuestionDecision } from './questionOutputSchema';

// ── Prompt del sistema ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres el motor de decisión de preguntas de Ahorro Invisible.
Tu tarea NO es dar asesoramiento financiero complejo ni hablar libremente con el usuario.
Tu tarea es decidir qué intervención conductual conviene AHORA para ayudar al usuario
a tomar una microdecisión financiera positiva.

Principios de comportamiento:
- Hacer la acción OBVIA (que sepa qué hacer)
- Hacerla ATRACTIVA (que quiera hacerlo)
- Hacerla FÁCIL (que pueda hacerlo sin esfuerzo)
- Hacerla SATISFACTORIA (que se sienta bien después)
- Reforzar la identidad: "soy una persona que controla su dinero"
- NUNCA generar culpa, miedo o presión
- NUNCA dar consejos financieros complejos
- Priorizar microacciones repetibles

Devuelve ÚNICAMENTE un JSON válido con este schema exacto (sin markdown, sin texto extra):
{
  "decision_type": "select_question" | "generate_experimental_question" | "skip_today",
  "question_intent": "string - intención de la pregunta",
  "target_category": "string - categoría de gasto objetivo",
  "target_avatar": ["string - avatares objetivo"],
  "habit_principle": "obvious" | "attractive" | "easy" | "satisfying",
  "tone": "string - tono del mensaje",
  "difficulty": "low" | "medium" | "high",
  "suggested_amount_eur": number,
  "should_change_question": boolean,
  "reason": "string - razonamiento breve de la decisión",
  "risk_flags": ["string - señales de riesgo detectadas"],
  "confidence": number entre 0 y 1
}`;

// ── Función principal ─────────────────────────────────────────────────────

export async function askGeminiForQuestionDecision(
  context: AIContext,
): Promise<{ decision: AIQuestionDecision; fromAI: boolean }> {
  // Si la IA está desactivada, devolver fallback
  if (!isAIEnabled()) {
    console.log('[ai] IA desactivada, usando fallback');
    return { decision: buildFallbackDecision(context), fromAI: false };
  }

  try {
    const gemini = getGemini();
    const model = gemini.getGenerativeModel({ model: getModelName() });

    const userPrompt = `Contexto del usuario (anonimizado):
${JSON.stringify(context, null, 2)}

Analiza el contexto y decide qué tipo de pregunta mostrar ahora.
Responde SOLO con el JSON.`;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }] },
      ],
    });

    const text = result.response.text().trim();
    const { decision, valid } = parseAIDecision(text);

    if (!valid) {
      console.warn('[ai] Gemini devolvió JSON inválido, usando fallback parcial');
    }

    return { decision, fromAI: valid };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ai] askGeminiForQuestionDecision error:', msg);
    return { decision: buildFallbackDecision(context), fromAI: false };
  }
}

// ── Fallback inteligente (sin IA) ─────────────────────────────────────────

function buildFallbackDecision(context: AIContext): AIQuestionDecision {
  // Usar avatar dominante y franja horaria para una decisión básica
  const targetAvatar = context.avatar_dominant
    ? [context.avatar_dominant]
    : DEFAULT_AI_DECISION.target_avatar;

  // Si hay fatiga, bajar dificultad
  const hasFatigue = context.consecutive_no_response >= 2 || context.days_since_last_response >= 3;
  const difficulty = hasFatigue ? 'low' : 'medium';

  // Categoría por defecto según franja horaria
  let targetCategory = 'Delivery';
  if (context.time_window === 'Mañana') targetCategory = 'Cafés';
  else if (context.time_window === 'Tarde') targetCategory = 'Compras';

  return {
    ...DEFAULT_AI_DECISION,
    target_avatar: targetAvatar,
    difficulty,
    target_category: targetCategory,
    tone: hasFatigue ? 'motivador' : 'neutral',
    reason: `fallback: avatar=${context.avatar_dominant}, franja=${context.time_window}, fatiga=${hasFatigue}`,
    confidence: 0.3,
  };
}
