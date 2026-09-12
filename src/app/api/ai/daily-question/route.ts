/**
 * POST /api/ai/daily-question
 *
 * Endpoint de selección de pregunta diaria.
 * Mantiene el contrato de respuesta JSON para compatibilidad de clientes.
 *
 * Flujo simplificado (sin IA):
 *   1. Si el usuario ya respondió hoy → devolver la misma pregunta
 *   2. Si ya hay impresión en esta franja → devolver la misma
 *   3. Si se superaron los 3 intentos → skip
 *   4. Selección directa: avatar del usuario + franja horaria actual
 *   5. Registrar impresión (sin datos de IA)
 *   6. Devolver pregunta
 *
 * Body: { userId: string, avatar?: string, timeSlot?: string, localDate?: string, recentIds?: string[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { logQuestionImpression, getTodayInteractions } from '@/services/tracking/questionInteractionLogger';
import { getQuestionById } from '@/services/dailyQuestionsBank';
import { selectDailyQuestion, getCurrentTimeWindow, getTemporalContext } from '@/services/questionSelectionEngine';
import type { AvatarKey, TimeWindow } from '@/services/questionSelectionEngine';

// ── Helpers ─────────────────────────────────────────────────────────────────

function resolveAvatar(raw: string | null | undefined): AvatarKey {
  if (raw === 'comodo' || raw === 'social' || raw === 'impulsivo') return raw;
  if (raw === 'desordenado') return 'impulsivo'; // migración legacy
  return 'comodo';
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body.userId as string;

    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
    }

    const ctx = getTemporalContext();
    const timeSlot: TimeWindow = (body.timeSlot as TimeWindow) || ctx.timeWindow;
    const localDate: string    = (body.localDate as string)   || ctx.date;
    const avatar = resolveAvatar(body.avatar as string | undefined);

    // IDs de preguntas recientes (últimos 7 días) para evitar repetición
    const recentIds: string[] = Array.isArray(body.recentIds)
      ? (body.recentIds as string[]).slice(0, 20)
      : [];

    // ── 1. Verificar estado del día (via tracking) ──────────────────────
    const { interactions, hasRespondedToday, currentAttempt } =
      await getTodayInteractions(userId, localDate);

    // Si ya respondió hoy → devolver la pregunta respondida
    if (hasRespondedToday) {
      const respondedInteraction = interactions.find(i => i.responded);
      if (respondedInteraction) {
        const answeredQ = getQuestionById(respondedInteraction.question_id);
        if (answeredQ) {
          return NextResponse.json({
            question_id:     answeredQ.id,
            text:            answeredQ.text,
            options:         answeredQ.options,
            avatar:          answeredQ.avatar,
            time_slot:       timeSlot,
            is_retry:        false,
            attempt_number:  respondedInteraction.attempt_number,
            already_answered: true,
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
          question_id:     existingQ.id,
          text:            existingQ.text,
          options:         existingQ.options,
          avatar:          existingQ.avatar,
          time_slot:       timeSlot,
          is_retry:        sameSlotInteraction.attempt_number > 1,
          attempt_number:  sameSlotInteraction.attempt_number,
          already_answered: false,
        });
      }
    }

    // Si se superaron los 3 intentos → skip
    if (currentAttempt > 3) {
      return NextResponse.json({
        question_id:     null,
        text:            null,
        time_slot:       timeSlot,
        is_retry:        false,
        attempt_number:  3,
        already_answered: false,
        skip_today:      true,
        reason:          'Se alcanzó el máximo de 3 intentos diarios',
      });
    }

    // ── 2. Selección directa: avatar + franja ───────────────────────────
    const todayQuestionIds = interactions.map(i => i.question_id);
    const excludeIds = [...new Set([...todayQuestionIds, ...recentIds])];

    const selected = selectDailyQuestion(avatar, localDate, timeSlot, excludeIds);

    // ── 3. Registrar impresión ──────────────────────────────────────────
    await logQuestionImpression({
      userId,
      questionId:       selected.id,
      localDate,
      timeSlot,
      attemptNumber:    currentAttempt,
      avatarDominant:   avatar,
      avatarConfidence: 1.0,
      // Campos legacy de IA rellenados con valores neutros
      aiDecision: {
        decision_type:        'select_question',
        question_intent:      'ahorro_general',
        target_category:      selected.avatar,
        target_avatar:        [avatar],
        habit_principle:      'easy',
        tone:                 'motivador',
        difficulty:           'low',
        suggested_amount_eur: 5,
        should_change_question: false,
        reason:               'seleccion_directa_sin_ia',
        risk_flags:           [],
        confidence:           1.0,
      },
      fromAI: false,
    }).catch(err => {
      console.warn('[daily-question] impression log failed (non-blocking):', err);
    });

    // ── 4. Devolver respuesta ───────────────────────────────────────────
    return NextResponse.json({
      question_id:     selected.id,
      text:            selected.text,
      options:         selected.options,
      avatar:          selected.avatar,
      time_slot:       timeSlot,
      is_retry:        currentAttempt > 1,
      attempt_number:  currentAttempt,
      already_answered: false,
    });
  } catch (err) {
    console.error('[daily-question] unhandled error:', err);
    return NextResponse.json(
      { error: 'Error interno al generar pregunta diaria' },
      { status: 500 },
    );
  }
}
