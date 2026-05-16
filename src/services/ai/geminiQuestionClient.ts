/**
 * geminiQuestionClient.ts — Wrapper Gemini para decisión de preguntas
 *
 * Envía el contexto anonimizado a Gemini junto con la PREGUNTA BASE
 * de la matriz 4×4×7 y pide una decisión estructurada en JSON.
 *
 * La IA puede:
 *   - Mantener la pregunta base (should_change_question = false)
 *   - Proponer cambiarla (should_change_question = true) + nueva categoría/intent
 *   - Decidir skip_today si detecta fatiga extrema
 */

import { getGemini, getModelName, isAIEnabled } from '../geminiService';
import type { AIContext } from './buildAIContext';
import { parseAIDecision, DEFAULT_AI_DECISION, type AIQuestionDecision } from './questionOutputSchema';
import { getMatrixBaseQuestion, getCurrentDayName, getCurrentTimeSlot4, type MatrixSlot } from './baseQuestionMatrix';
import { getQuestionById } from '../dailyQuestionsBank';

// ── Prompt del sistema ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres el motor de decisión de preguntas de Ahorro Invisible.
Tu tarea NO es dar asesoramiento financiero complejo ni hablar libremente con el usuario.
Tu tarea es decidir si MANTENER la pregunta base propuesta por la matriz del sistema,
o CAMBIARLA por otra distinta basándote en el historial del usuario.

CONTEXTO DEL SISTEMA:
La app tiene una Matriz Base de 112 preguntas (7 días × 4 avatares × 4 franjas horarias).
La matriz propone una pregunta "por defecto" para cada momento.
TÚ decides si esa pregunta es la adecuada o si hay que cambiarla.

CUÁNDO CAMBIAR la pregunta base:
- El usuario ya la respondió recientemente (en los últimos 3-7 días)
- El usuario ignora sistemáticamente ese tipo de pregunta (fatiga)
- El usuario tiene mejores resultados con otra categoría (aprendizaje)
- El usuario lleva varias no-respuestas seguidas (probar algo diferente)

CUÁNDO MANTENER la pregunta base:
- Es la primera vez que se la muestra en este ciclo
- El usuario responde bien a esa categoría
- No hay señales de fatiga
- La pregunta encaja bien con el momento del día

Principios de comportamiento:
- Hacer la acción OBVIA (que sepa qué hacer)
- Hacerla ATRACTIVA (que quiera hacerlo)
- Hacerla FÁCIL (que pueda hacerlo sin esfuerzo)
- Hacerla SATISFACTORIA (que se sienta bien después)
- Reforzar la identidad: "soy una persona que controla su dinero"
- NUNCA generar culpa, miedo o presión
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

export interface GeminiQuestionResult {
  decision: AIQuestionDecision;
  fromAI: boolean;
  baseQuestion: MatrixSlot;
}

export async function askGeminiForQuestionDecision(
  context: AIContext,
): Promise<GeminiQuestionResult> {
  // Obtener la pregunta base de la matriz
  const day = getCurrentDayName();
  const timeSlot = getCurrentTimeSlot4();
  const baseQuestion = getMatrixBaseQuestion(day, context.avatar_dominant, timeSlot);

  // Leer texto de la pregunta base para dar contexto a la IA
  const baseQ = getQuestionById(baseQuestion.questionId);
  const baseQuestionText = baseQ?.text ?? 'Pregunta no encontrada';
  const baseQuestionCategory = baseQ?.habitCategory ?? 'General';

  // Si la IA está desactivada, devolver fallback con la pregunta base
  if (!isAIEnabled()) {
    console.log('[ai] IA desactivada, usando pregunta base de la matriz');
    return {
      decision: buildFallbackDecision(context, baseQuestion),
      fromAI: false,
      baseQuestion,
    };
  }

  try {
    const gemini = getGemini();
    const model = gemini.getGenerativeModel({ model: getModelName() });

    const userPrompt = `PREGUNTA BASE DE LA MATRIZ:
- ID: ${baseQuestion.questionId}
- Texto: "${baseQuestionText}"
- Categoría: ${baseQuestionCategory}
- Razón de asignación: ${baseQuestion.rationale}
- Día: ${day}
- Franja horaria: ${timeSlot}

CONTEXTO DEL USUARIO (anonimizado):
${JSON.stringify(context, null, 2)}

HISTORIAL DE PREGUNTAS RECIENTES DEL USUARIO:
- IDs recientes: ${context.recent_question_ids.slice(0, 7).join(', ') || 'ninguna'}
- ¿La pregunta base (${baseQuestion.questionId}) está en recientes? ${context.recent_question_ids.includes(baseQuestion.questionId) ? 'SÍ — considerar cambiarla' : 'NO — se puede usar'}
- No-respuestas consecutivas: ${context.consecutive_no_response}
- Días sin responder: ${context.days_since_last_response}
- Categorías que mejor funcionan: ${context.best_categories.join(', ') || 'sin datos aún'}

DECISIÓN:
¿Mantenemos la pregunta base "${baseQuestion.questionId}" o la cambiamos?
Si la cambias, indica en "target_category" y "question_intent" qué tipo de pregunta sería mejor.
Si la mantienes, pon "should_change_question": false.
Responde SOLO con el JSON.`;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }] },
      ],
    });

    const text = result.response.text().trim();
    const { decision, valid } = parseAIDecision(text);

    if (!valid) {
      console.warn('[ai] Gemini devolvió JSON inválido, usando pregunta base de la matriz');
    }

    return { decision, fromAI: valid, baseQuestion };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ai] askGeminiForQuestionDecision error:', msg);
    return {
      decision: buildFallbackDecision(context, baseQuestion),
      fromAI: false,
      baseQuestion,
    };
  }
}

// ── Fallback inteligente (sin IA) ─────────────────────────────────────────

function buildFallbackDecision(context: AIContext, baseQuestion: MatrixSlot): AIQuestionDecision {
  const targetAvatar = context.avatar_dominant
    ? [context.avatar_dominant]
    : DEFAULT_AI_DECISION.target_avatar;

  // Si la pregunta base ya fue respondida recientemente, marcar para cambio
  const baseWasRecent = context.recent_question_ids.includes(baseQuestion.questionId);

  // Si hay fatiga, bajar dificultad
  const hasFatigue = context.consecutive_no_response >= 2 || context.days_since_last_response >= 3;
  const difficulty = hasFatigue ? 'low' : 'medium';

  // Categoría por defecto según franja horaria
  let targetCategory = 'Delivery';
  if (context.time_window === 'Madrugada') targetCategory = 'Reflexión';
  else if (context.time_window === 'Mañana') targetCategory = 'Cafés';
  else if (context.time_window === 'Tarde') targetCategory = 'Compras';

  return {
    ...DEFAULT_AI_DECISION,
    target_avatar: targetAvatar,
    difficulty,
    target_category: targetCategory,
    should_change_question: baseWasRecent || hasFatigue,
    tone: hasFatigue ? 'motivador' : 'neutral',
    reason: `fallback: base=${baseQuestion.questionId}, avatar=${context.avatar_dominant}, franja=${context.time_window}, reciente=${baseWasRecent}, fatiga=${hasFatigue}`,
    confidence: 0.3,
  };
}
