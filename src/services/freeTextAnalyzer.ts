/**
 * freeTextAnalyzer.ts — Analizador de respuestas de texto libre
 *
 * Analiza respuestas escritas por el usuario para clasificarlas.
 * La IA NO interviene en el scoring ni en el cambio de avatar.
 * Este módulo solo clasifica el texto a efectos informativos.
 */

import type { AvatarKey } from './dailyQuestionsBank';

export interface FreeTextClassification {
  /** Avatar inferido, null si no se pudo interpretar */
  avatar: AvatarKey | null;
  /** Confianza de la inferencia (0-1) — solo informativo */
  confidence: number;
}

// ── Keywords por avatar ──────────────────────────────────────────────────────
const AVATAR_KEYWORDS: Record<AvatarKey, string[]> = {
  comodo:    ['tranquilo', 'relax', 'cómodo', 'fácil', 'sin esfuerzo', 'chill', 'seguro', 'calma', 'rutina', 'casa', 'descanso', 'sofá', 'dormir', 'relajante', 'paz'],
  social:    ['gente', 'amigos', 'quedar', 'plan', 'compartir', 'grupo', 'fiesta', 'salir', 'conocer', 'evento', 'charlar', 'risas', 'compañía', 'juntos', 'social'],
  impulsivo: ['nuevo', 'diferente', 'probar', 'intenso', 'emocionante', 'aventura', 'loco', 'ya', 'ahora', 'riesgo', 'sorpresa', 'adrenalina', 'impulso', 'quiero', 'capricho'],
};

/**
 * Clasifica una respuesta libre por keywords locales.
 * Solo para uso informativo — NO afecta al avatar ni al scoring del producto.
 */
export function classifyFreeText(text: string): FreeTextClassification {
  const normalized = text.toLowerCase().trim();

  if (normalized.length < 2) return { avatar: null, confidence: 0 };
  if (/^[0-9\s.,;:!?]+$/.test(normalized)) return { avatar: null, confidence: 0 };
  if (/^(no sé|nose|ns|nse|no se|asdf|qwer|test|hola|^a+$)/i.test(normalized)) {
    return { avatar: null, confidence: 0 };
  }

  const scores: Record<AvatarKey, number> = { comodo: 0, social: 0, impulsivo: 0 };
  for (const [avatar, keywords] of Object.entries(AVATAR_KEYWORDS) as [AvatarKey, string[]][]) {
    for (const kw of keywords) {
      if (normalized.includes(kw)) scores[avatar] += 1;
    }
  }

  const entries = (Object.entries(scores) as [AvatarKey, number][]).sort((a, b) => b[1] - a[1]);
  if (entries[0][1] === 0) return { avatar: null, confidence: 0 };

  const top    = entries[0];
  const runner = entries[1];
  const ratio  = runner[1] > 0 ? top[1] / (top[1] + runner[1]) : 1;

  return {
    avatar:     top[0],
    confidence: Math.min(ratio, 0.7), // máx 0.7 — solo informativo
  };
}
