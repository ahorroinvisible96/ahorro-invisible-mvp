/**
 * geminiService.ts — Servicio Gemini AI (solo servidor)
 * Conecta con Google AI Studio usando datos del usuario desde Supabase.
 * NUNCA importar esto desde componentes cliente ("use client").
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// ── Inicializar Gemini ─────────────────────────────────────────────────────
function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');
  return new GoogleGenerativeAI(apiKey);
}

// ── Inicializar Supabase (con service role si disponible, si no con anon) ──
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

// ── Tipos ──────────────────────────────────────────────────────────────────
export interface GeminiInsightResult {
  insight: string;
  error?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// 1. INSIGHT SEMANAL PERSONALIZADO
//    Lee decisiones + objetivos del usuario y genera un mensaje motivador.
// ──────────────────────────────────────────────────────────────────────────
export async function generateWeeklyInsight(
  userId: string,
): Promise<GeminiInsightResult> {
  try {
    const supabase = getSupabase();

    // Obtener datos del usuario
    const [profileRes, goalsRes, decisionsRes] = await Promise.all([
      supabase.from('user_profiles').select('name, income_range, money_feeling').eq('id', userId).single(),
      supabase.from('goals').select('title, current_amount, target_amount, horizon_months').eq('user_id', userId).eq('archived', false),
      supabase.from('decisions').select('date, question_id, delta_amount').eq('user_id', userId).order('date', { ascending: false }).limit(14),
    ]);

    const profile = profileRes.data;
    const goals = goalsRes.data ?? [];
    const decisions = decisionsRes.data ?? [];

    // Calcular métricas rápidas
    const totalSavedThisWeek = decisions
      .filter(d => {
        const daysAgo = (Date.now() - new Date(d.date).getTime()) / (1000 * 60 * 60 * 24);
        return daysAgo <= 7;
      })
      .reduce((s, d) => s + Number(d.delta_amount ?? 0), 0);

    const activeDays = new Set(decisions.slice(0, 7).map(d => d.date)).size;

    // Construir contexto para Gemini (sin datos sensibles)
    const context = `
Eres el asistente financiero de Ahorro Invisible, una app de ahorro por hábitos. 
Tu tono es cercano, motivador y directo. Máximo 3 frases. Sin listas. Sin markdown.

Datos del usuario esta semana:
- Nombre: ${profile?.name ?? 'usuario'}
- Dinero ahorrado esta semana: ${totalSavedThisWeek.toFixed(2)}€
- Días activos de 7: ${activeDays}
- Objetivos activos: ${goals.length}
- Objetivo principal: ${goals[0]?.title ?? 'sin objetivo'} (${Math.round((goals[0]?.current_amount / goals[0]?.target_amount) * 100) || 0}% completado)

Genera un mensaje de insight personalizado y motivador para esta semana.
`.trim();

    const gemini = getGemini();
    const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(context);
    const text = result.response.text().trim();

    return { insight: text };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gemini] generateWeeklyInsight error:', msg);
    return { insight: '', error: msg };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 2. RECOMENDACIÓN DE OBJETIVO
//    Sugiere una meta de ahorro basada en perfil + historial.
// ──────────────────────────────────────────────────────────────────────────
export async function suggestGoal(
  userId: string,
): Promise<GeminiInsightResult> {
  try {
    const supabase = getSupabase();

    const [profileRes, goalsRes] = await Promise.all([
      supabase.from('user_profiles').select('income_range, money_feeling, total_saved, streak_current').eq('id', userId).single(),
      supabase.from('goals').select('title').eq('user_id', userId).eq('archived', false),
    ]);

    const profile = profileRes.data;
    const existingGoals = (goalsRes.data ?? []).map(g => g.title).join(', ');

    const context = `
Eres el asistente financiero de Ahorro Invisible.
Recomienda UN solo objetivo de ahorro concreto, con nombre, cantidad en euros y horizonte en meses.
Máximo 2 frases. Sin listas. Sin markdown. Responde en español.

Perfil del usuario:
- Rango de ingresos: ${JSON.stringify(profile?.income_range ?? {})}
- Relación con el dinero: ${profile?.money_feeling ?? 'neutral'}
- Total ahorrado hasta hoy: ${profile?.total_saved ?? 0}€
- Racha actual: ${profile?.streak_current ?? 0} días
- Objetivos actuales: ${existingGoals || 'ninguno aún'}
`.trim();

    const gemini = getGemini();
    const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(context);

    return { insight: result.response.text().trim() };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gemini] suggestGoal error:', msg);
    return { insight: '', error: msg };
  }
}
