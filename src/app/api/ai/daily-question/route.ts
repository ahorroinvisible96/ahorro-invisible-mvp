/**
 * POST /api/ai/daily-question
 *
 * Endpoint principal de decisión de pregunta diaria con IA.
 *
 * Flujo:
 *   1. Verificar si el usuario ya respondió hoy → devolver la misma pregunta
 *   2. Verificar si ya hay una impresión en la misma franja → devolver la misma
 *   3. Verificar si se superaron los 3 intentos diarios → skip
 *   4. Construir contexto IA → enviar a Gemini → recibir decisión JSON
 *   5. Buscar pregunta compatible en el banco de 135
 *   6. Filtrar por active, avatar, categoría, franja, dificultad
 *   7. Excluir preguntas recientes (cooldown)
 *   8. Elegir la mejor pregunta por scoring
 *   9. Registrar impresión
 *   10. Devolver pregunta final + metadata
 *
 * Body: { userId: string, timeSlot?: string, localDate?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildAIContext, getCurrentTimeWindow, getMadridDateString } from '@/services/ai/buildAIContext';
import { askGeminiForQuestionDecision } from '@/services/ai/geminiQuestionClient';
import { logQuestionImpression, getTodayInteractions } from '@/services/tracking/questionInteractionLogger';
import {
  DAILY_QUESTIONS_BANK,
  getQuestionById,
  type DailyQuestion,
} from '@/services/dailyQuestionsBank';
import type { AIQuestionDecision } from '@/services/ai/questionOutputSchema';
import { getCurrentTimeSlot4 } from '@/services/ai/baseQuestionMatrix';

// ── Scoring de compatibilidad pregunta ↔ decisión IA ─────────────────────

function scoreQuestionForDecision(
  q: DailyQuestion,
  decision: AIQuestionDecision,
  recentIds: string[],
): number {
  let score = 0;

  // Coincidencia con avatar target
  for (const av of decision.target_avatar) {
    if (q.targetAvatarPrimary === av) score += 40;
    if (q.targetAvatarSecondary === av) score += 25;
  }

  // Coincidencia con categoría
  if (q.habitCategory.toLowerCase().includes(decision.target_category.toLowerCase())) {
    score += 20;
  }

  // Coincidencia con intención
  if (q.intent && q.intent.includes(decision.question_intent.toLowerCase())) {
    score += 15;
  }

  // Coincidencia con dificultad
  if (q.difficulty === decision.difficulty) score += 10;

  // Coincidencia con habit_principle
  if (q.habit_principle === decision.habit_principle) score += 10;

  // Pesos intrínsecos
  score += q.priorityBase;
  score += q.scenarioWeight * 2;

  // Penalización por repetición reciente
  if (recentIds.includes(q.id)) score -= 50;

  return score;
}

// ── Handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body.userId as string;

    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
    }

    const timeSlot = (body.timeSlot as string) || getCurrentTimeWindow();
    const localDate = (body.localDate as string) || getMadridDateString();

    // ── 1. Verificar estado del día ─────────────────────────────────────
    const { interactions, hasRespondedToday, currentAttempt } =
      await getTodayInteractions(userId, localDate);

    // Si ya respondió hoy → devolver la pregunta que respondió
    if (hasRespondedToday) {
      const respondedInteraction = interactions.find(i => i.responded);
      if (respondedInteraction) {
        const answeredQ = getQuestionById(respondedInteraction.question_id);
        if (answeredQ) {
          return NextResponse.json({
            question_id: answeredQ.id,
            text: answeredQ.text,
            suggested_amount: answeredQ.suggestedAmount,
            monthly_delta: answeredQ.monthlyDelta,
            yearly_delta: answeredQ.yearlyDelta,
            label_impact: answeredQ.labelImpact,
            time_slot: timeSlot,
            is_retry: false,
            attempt_number: respondedInteraction.attempt_number,
            already_answered: true,
            ai_decision: null,
            avatar_context: null,
          });
        }
      }
    }

    // Si ya hay impresión en esta franja y no respondió → devolver la misma
    const sameSlotInteraction = interactions.find(
      i => i.time_slot === timeSlot && !i.responded
    );
    if (sameSlotInteraction) {
      const existingQ = getQuestionById(sameSlotInteraction.question_id);
      if (existingQ) {
        return NextResponse.json({
          question_id: existingQ.id,
          text: existingQ.text,
          suggested_amount: existingQ.suggestedAmount,
          monthly_delta: existingQ.monthlyDelta,
          yearly_delta: existingQ.yearlyDelta,
          label_impact: existingQ.labelImpact,
          time_slot: timeSlot,
          is_retry: sameSlotInteraction.attempt_number > 1,
          attempt_number: sameSlotInteraction.attempt_number,
          already_answered: false,
          ai_decision: null,
          avatar_context: null,
        });
      }
    }

    // Si se superaron los 3 intentos → skip
    if (currentAttempt > 3) {
      return NextResponse.json({
        question_id: null,
        text: null,
        time_slot: timeSlot,
        is_retry: false,
        attempt_number: 3,
        already_answered: false,
        skip_today: true,
        reason: 'Se alcanzó el máximo de 3 intentos diarios',
      });
    }

    // ── 2. Construir contexto IA ────────────────────────────────────────
    const aiContext = await buildAIContext(userId);

    // ── 3. Pedir decisión a Gemini (incluye pregunta base de la matriz) ─
    const { decision, fromAI, baseQuestion } = await askGeminiForQuestionDecision(aiContext);

    // Si la IA dice skip_today → respetar
    if (decision.decision_type === 'skip_today') {
      return NextResponse.json({
        question_id: null,
        text: null,
        time_slot: timeSlot,
        is_retry: false,
        attempt_number: currentAttempt,
        already_answered: false,
        skip_today: true,
        reason: decision.reason,
      });
    }

    // ── 4. Seleccionar pregunta ──────────────────────────────────────────
    const todayQuestionIds = interactions.map(i => i.question_id);
    const recentIds = [
      ...todayQuestionIds,
      ...aiContext.recent_question_ids.slice(0, 10),
    ];

    let selected: DailyQuestion | undefined;

    // Si la IA dice mantener la pregunta base y no se ha mostrado hoy
    if (!decision.should_change_question && !todayQuestionIds.includes(baseQuestion.questionId)) {
      selected = getQuestionById(baseQuestion.questionId);
    }

    // Si hay que cambiar, o la base no estaba disponible → scoring
    if (!selected) {
      const candidates = DAILY_QUESTIONS_BANK
        .filter(q => q.active !== false)
        .filter(q => !todayQuestionIds.includes(q.id));

      const scored = candidates
        .map(q => ({
          question: q,
          score: scoreQuestionForDecision(q, decision, recentIds),
        }))
        .sort((a, b) => b.score - a.score);

      selected = scored[0]?.question;
    }

    if (!selected) {
      // Fallback absoluto: elegir aleatoria del banco
      const fallback = DAILY_QUESTIONS_BANK[
        Math.floor(Math.random() * DAILY_QUESTIONS_BANK.length)
      ];
      return NextResponse.json({
        question_id: fallback.id,
        text: fallback.text,
        suggested_amount: fallback.suggestedAmount,
        monthly_delta: fallback.monthlyDelta,
        yearly_delta: fallback.yearlyDelta,
        label_impact: fallback.labelImpact,
        time_slot: timeSlot,
        is_retry: currentAttempt > 1,
        attempt_number: currentAttempt,
        already_answered: false,
        ai_decision: { ...decision, reason: 'fallback: no candidates matched' },
        avatar_context: {
          dominant: aiContext.avatar_dominant,
          secondary: aiContext.avatar_secondary,
          confidence: aiContext.avatar_confidence,
        },
      });
    }

    // ── 5. Registrar impresión ──────────────────────────────────────────
    await logQuestionImpression({
      userId,
      questionId: selected.id,
      localDate,
      timeSlot,
      attemptNumber: currentAttempt,
      avatarDominant: aiContext.avatar_dominant,
      avatarSecondary: aiContext.avatar_secondary,
      avatarConfidence: aiContext.avatar_confidence,
      aiDecision: decision,
      fromAI,
    }).catch(err => {
      // No bloquear la respuesta si falla el logging
      console.error('[daily-question] impression log failed:', err);
    });

    // ── 6. Devolver respuesta ───────────────────────────────────────────
    return NextResponse.json({
      question_id: selected.id,
      text: selected.text,
      suggested_amount: selected.suggestedAmount,
      monthly_delta: selected.monthlyDelta,
      yearly_delta: selected.yearlyDelta,
      label_impact: selected.labelImpact,
      time_slot: timeSlot,
      time_slot_4: getCurrentTimeSlot4(),
      is_retry: currentAttempt > 1,
      attempt_number: currentAttempt,
      already_answered: false,
      used_base_question: selected.id === baseQuestion.questionId,
      base_question_id: baseQuestion.questionId,
      ai_decision: {
        decision_type: decision.decision_type,
        question_intent: decision.question_intent,
        target_category: decision.target_category,
        target_avatar: decision.target_avatar,
        habit_principle: decision.habit_principle,
        tone: decision.tone,
        difficulty: decision.difficulty,
        suggested_amount_eur: decision.suggested_amount_eur,
        should_change_question: decision.should_change_question,
        reason: decision.reason,
        risk_flags: decision.risk_flags,
        confidence: decision.confidence,
      },
      avatar_context: {
        dominant: aiContext.avatar_dominant,
        secondary: aiContext.avatar_secondary,
        confidence: aiContext.avatar_confidence,
      },
    });
  } catch (err) {
    console.error('[daily-question] unhandled error:', err);
    return NextResponse.json(
      { error: 'Error interno al generar pregunta diaria' },
      { status: 500 },
    );
  }
}
