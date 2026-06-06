/**
 * Free Text Analyzer — Análisis de respuestas "Otro" por IA
 *
 * Cuando el usuario escribe una respuesta libre en una pregunta fill_blank,
 * este servicio analiza el texto usando Gemini para detectar señales de avatar.
 *
 * Reglas:
 *   - Si la respuesta es clara → devuelve avatar + confianza
 *   - Si la respuesta es ambigua/vacía/sin sentido → devuelve null (no suma puntos)
 *   - Nunca se muestra al usuario ningún scoring ni resultado interno
 */

import type { AvatarKey } from './profilingService';

interface FreeTextAnalysisResult {
  /** Avatar inferido, null si no se pudo interpretar */
  avatar: AvatarKey | null;
  /** Confianza de la inferencia (0-1). Solo se usa si avatar != null */
  confidence: number;
  /** Peso de la señal (1-3) */
  weight: number;
}

// ── Diccionario local de keywords como fallback rápido ───────────────────────
const AVATAR_KEYWORDS: Record<AvatarKey, string[]> = {
  comodo:      ['tranquilo', 'relax', 'cómodo', 'fácil', 'sin esfuerzo', 'chill', 'seguro', 'calma', 'rutina', 'casa', 'descanso', 'peli', 'sofá', 'dormir', 'relajante', 'paz'],
  social:      ['gente', 'amigos', 'quedar', 'plan', 'compartir', 'grupo', 'fiesta', 'salir', 'conocer', 'evento', 'charlar', 'risas', 'compañía', 'juntos', 'social'],
  impulsivo:   ['nuevo', 'diferente', 'probar', 'intenso', 'emocionante', 'aventura', 'loco', 'ya', 'ahora', 'riesgo', 'sorpresa', 'adrenalina', 'impulso', 'quiero', 'capricho'],
  desordenado: ['lo que surja', 'sin plan', 'da igual', 'cualquiera', 'no sé', 'tanto', 'depende', 'flexible', 'improvisando', 'aleatorio', 'desorden', 'caos', 'da lo mismo'],
};

// ── Análisis local rápido (sin IA) ──────────────────────────────────────────
function analyzeLocal(text: string): FreeTextAnalysisResult {
  const normalized = text.toLowerCase().trim();

  // Filtrar respuestas sin sentido
  if (normalized.length < 2) return { avatar: null, confidence: 0, weight: 0 };
  if (/^[0-9\s.,;:!?]+$/.test(normalized)) return { avatar: null, confidence: 0, weight: 0 };
  if (/^(no sé|nose|ns|nse|no se|asdf|qwer|test|hola|a|aa|aaa)/i.test(normalized)) {
    return { avatar: null, confidence: 0, weight: 0 };
  }

  // Contar matches por avatar
  const scores: Record<AvatarKey, number> = { comodo: 0, social: 0, impulsivo: 0, desordenado: 0 };
  for (const [avatar, keywords] of Object.entries(AVATAR_KEYWORDS) as [AvatarKey, string[]][]) {
    for (const kw of keywords) {
      if (normalized.includes(kw)) {
        scores[avatar] += 1;
      }
    }
  }

  const entries = (Object.entries(scores) as [AvatarKey, number][])
    .sort((a, b) => b[1] - a[1]);

  if (entries[0][1] === 0) {
    // No matches → no podemos inferir localmente
    return { avatar: null, confidence: 0, weight: 0 };
  }

  const top = entries[0];
  const runner = entries[1];
  const ratio = runner[1] > 0 ? top[1] / (top[1] + runner[1]) : 1;

  return {
    avatar: top[0],
    confidence: Math.min(ratio, 0.7), // Local nunca supera 0.7 de confianza
    weight: 1,
  };
}

// ── Análisis con IA (Gemini) ────────────────────────────────────────────────
async function analyzeWithAI(
  text: string,
  questionContext: string,
): Promise<FreeTextAnalysisResult> {
  try {
    const response = await fetch('/api/ai/analyze-signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, questionContext }),
    });

    if (!response.ok) {
      // Fallback a análisis local si la API falla
      return analyzeLocal(text);
    }

    const data = await response.json() as {
      avatar: AvatarKey | null;
      confidence: number;
      weight: number;
    };

    // Validar resultado
    if (!data.avatar || data.confidence < 0.3) {
      return { avatar: null, confidence: 0, weight: 0 };
    }

    return {
      avatar: data.avatar,
      confidence: Math.min(data.confidence, 1),
      weight: data.weight ?? 2,
    };
  } catch {
    // Fallback silencioso a análisis local
    return analyzeLocal(text);
  }
}

// ── API pública ─────────────────────────────────────────────────────────────

/**
 * Analiza una respuesta de texto libre para detectar señal de avatar.
 *
 * Prioriza IA si está disponible, con fallback local.
 * Devuelve null si el texto no aporta señal interpretable.
 */
export async function analyzeFreeText(
  text: string,
  questionContext: string,
): Promise<FreeTextAnalysisResult> {
  const normalized = text.trim();

  // Filtro rápido: si es basura, no gastar llamada a IA
  if (normalized.length < 3) return { avatar: null, confidence: 0, weight: 0 };
  if (/^[^a-záéíóúñ]+$/i.test(normalized)) return { avatar: null, confidence: 0, weight: 0 };

  // Intentar IA primero, fallback a local
  return analyzeWithAI(normalized, questionContext);
}

/**
 * Versión síncrona (solo análisis local) para uso inmediato.
 * Usar cuando no se puede esperar a la IA.
 */
export function analyzeFreeTextSync(text: string): FreeTextAnalysisResult {
  return analyzeLocal(text);
}
