/**
 * geminiService.ts — Servicio Gemini AI (solo servidor)
 * Conecta con Google AI Studio usando datos del usuario desde Supabase.
 * NUNCA importar esto desde componentes cliente ("use client").
 *
 * Variables de entorno:
 *   GEMINI_API_KEY  — clave de API (obligatoria)
 *   GEMINI_MODEL    — modelo a usar (default: gemini-2.5-flash-lite)
 *   AI_ENABLED      — "true" para activar IA, cualquier otro valor la desactiva
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// ── Constantes ────────────────────────────────────────────────────────────────
const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

// ── Helpers compartidos ──────────────────────────────────────────────────────

/** ¿Está la IA habilitada? */
export function isAIEnabled(): boolean {
  return process.env.AI_ENABLED === 'true';
}

/** Nombre del modelo a usar (configurable por env) */
export function getModelName(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

/** Inicializar cliente Gemini */
export function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');
  return new GoogleGenerativeAI(apiKey);
}

/** Inicializar Supabase (con service role si disponible, si no con anon) */
export function getSupabase() {
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
    if (!isAIEnabled()) {
      return { insight: '', error: 'AI desactivada (AI_ENABLED != true)' };
    }

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
    const model = gemini.getGenerativeModel({ model: getModelName() });
    const result = await model.generateContent(context);
    const text = result.response.text().trim();

    return { insight: text };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gemini] generateWeeklyInsight error:', msg);
    return { insight: '', error: msg };
  }
}
