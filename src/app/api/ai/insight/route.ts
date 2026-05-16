/**
 * POST /api/ai/insight
 * Genera un insight semanal personalizado con Gemini usando datos de Supabase.
 * Body: { userId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateWeeklyInsight } from '@/services/geminiService';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
    }

    const result = await generateWeeklyInsight(userId);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ insight: result.insight });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
