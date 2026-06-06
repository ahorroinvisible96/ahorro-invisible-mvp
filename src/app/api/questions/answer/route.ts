/**
 * POST /api/questions/answer
 *
 * Registra la respuesta del usuario a la pregunta diaria.
 *
 * Body: {
 *   userId: string,
 *   question_id: string,
 *   answer_key: string,        // "saved" | "skip" | importe como string
 *   saved_amount: number,       // euros ahorrados (0 si no ahorró)
 *   timeSlot?: string,          // Mañana | Tarde | Noche
 *   localDate?: string,         // YYYY-MM-DD
 *   attempt_number?: number,
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { logQuestionAnswer, getTodayInteractions } from '@/services/tracking/questionInteractionLogger';
import { getCurrentTimeWindow, getMadridDateString } from '@/services/ai/buildAIContext';
import { getSupabase } from '@/services/geminiService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body.userId as string;
    const questionId = body.question_id as string;
    const answerKey = (body.answer_key as string) || 'saved';
    const savedAmount = typeof body.saved_amount === 'number' ? body.saved_amount : 0;
    const timeSlot = (body.timeSlot as string) || getCurrentTimeWindow();
    const localDate = (body.localDate as string) || getMadridDateString();

    if (!userId || !questionId) {
      return NextResponse.json(
        { error: 'userId y question_id son requeridos' },
        { status: 400 },
      );
    }

    // Obtener intento actual
    const { currentAttempt } = await getTodayInteractions(userId, localDate);

    // Leer avatar del perfil (para contexto)
    const supabase = getSupabase();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('avatar, avatar_scores')
      .eq('id', userId)
      .single();

    // Calcular confianza del avatar
    let avatarConfidence = 0.5;
    if (profile?.avatar_scores) {
      const scores = profile.avatar_scores as Record<string, number>;
      const values = Object.values(scores);
      const max = Math.max(...values);
      const total = values.reduce((a, b) => a + b, 0);
      avatarConfidence = total > 0 ? max / total : 0.5;
    }

    // Registrar la respuesta
    const result = await logQuestionAnswer({
      userId,
      questionId,
      answerKey,
      localDate,
      timeSlot,
      savedAmount,
      attemptNumber: body.attempt_number ?? currentAttempt,
      avatarDominant: profile?.avatar ?? null,
      avatarConfidence,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? 'Error al guardar respuesta' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      saved_amount: savedAmount,
      question_id: questionId,
      time_slot: timeSlot,
      local_date: localDate,
    });
  } catch (err) {
    console.error('[questions/answer] unhandled error:', err);
    return NextResponse.json(
      { error: 'Error interno al guardar respuesta' },
      { status: 500 },
    );
  }
}
