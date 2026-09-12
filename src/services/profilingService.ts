/**
 * Profiling Service — Lógica de perfilado por avatar
 *
 * 3 preguntas de personalización para determinar el avatar del usuario:
 *
 *   P1 (Sistema):      2 puntos — Nivel real de organización
 *   P2 (Fricción):     2 puntos — Tipo de intervención ideal
 *   P3 (Aspiracional): 1 punto  — Tipo de ayuda deseada
 *
 * Avatares posibles: Cómodo | Social | Impulsivo
 *
 * IMPORTANTE: Las puntuaciones se conservan únicamente como información.
 * No cambian el avatar posterior, no alimentan ningún motor de scoring.
 */

// ── Tipos ────────────────────────────────────────────────────────────────────
export type AvatarKey = 'comodo' | 'social' | 'impulsivo';

export interface ProfilingAnswer {
  questionIdx: number;
  optionIdx:   number;   // 0=A, 1=B, 2=C
  avatar:      AvatarKey;
}

export interface ProfilingResult {
  primaryAvatar:    AvatarKey;
  avatarScores:     Record<AvatarKey, number>;
  answersRaw:       ProfilingAnswer[];
  completedAt:      string;  // ISO date
}

// ── Preguntas ────────────────────────────────────────────────────────────────
export interface ProfilingOption {
  text:      string;
  sub?:      string;   // Subtexto (voz interior del usuario)
  avatar:    AvatarKey;
}

export interface ProfilingQuestion {
  id:      string;
  text:    string;
  weight:  number;     // Peso informativo de la pregunta
  options: [ProfilingOption, ProfilingOption, ProfilingOption];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3 PREGUNTAS DE PERSONALIZACIÓN (A, B, C — sin opción D)
//
//   P1: Sistema — ¿Cómo te organizas? (2 pts)
//   P2: Fricción — ¿Qué te ayudaría antes de gastar? (2 pts)
//   P3: Aspiracional — ¿Qué tipo de ayuda necesitas? (1 pt)
// ═══════════════════════════════════════════════════════════════════════════════
export const PROFILING_QUESTIONS: ProfilingQuestion[] = [
  {
    id: 'P1',
    text: '¿Cómo te organizas normalmente con tus gastos del día a día?',
    weight: 2,
    options: [
      { text: 'Tiro de lo que me resulta más fácil; rara vez comparo opciones', avatar: 'comodo' },
      { text: 'Más o menos bien, pero cuando surge un plan se me descontrola', avatar: 'social' },
      { text: 'Voy comprando según lo que me apetece en cada momento', avatar: 'impulsivo' },
    ],
  },
  {
    id: 'P2',
    text: '¿Qué te ayudaría más justo antes de gastar?',
    weight: 2,
    options: [
      { text: 'Tener una alternativa fácil y lista para elegir mejor sin esfuerzo', avatar: 'comodo' },
      { text: 'Que me avise antes de una salida o un plan para ir preparado', avatar: 'social' },
      { text: 'Algo que me haga parar 5 segundos antes de darle a "comprar"', avatar: 'impulsivo' },
    ],
  },
  {
    id: 'P3',
    text: '¿Qué tipo de ayuda te vendría mejor para empezar a ahorrar?',
    weight: 1,
    options: [
      { text: 'Ideas prácticas y sencillas para gastar menos sin complicarme la vida', sub: 'Quiero soluciones que no requieran esfuerzo', avatar: 'comodo' },
      { text: 'Estrategias para controlarme en salidas sin dejar de disfrutar', sub: 'Quiero seguir haciendo planes pero gastando menos', avatar: 'social' },
      { text: 'Un freno que me ayude a no comprar lo primero que me llama la atención', sub: 'Necesito esa pausa antes de actuar', avatar: 'impulsivo' },
    ],
  },
];

// ── Cálculo de puntuaciones ──────────────────────────────────────────────────
const AVATAR_KEYS: AvatarKey[] = ['comodo', 'social', 'impulsivo'];

function emptyAvatarScores(): Record<AvatarKey, number> {
  return Object.fromEntries(AVATAR_KEYS.map((k) => [k, 0])) as Record<AvatarKey, number>;
}

export function computeProfilingResult(answers: ProfilingAnswer[]): ProfilingResult {
  const avatarScores = emptyAvatarScores();

  for (const a of answers) {
    const question = PROFILING_QUESTIONS[a.questionIdx];
    const weight = question ? question.weight : 2;
    avatarScores[a.avatar] += weight;
  }

  // Tiebreak: impulsivo > social > comodo (más diagnóstico primero)
  const tieBreak: AvatarKey[] = ['impulsivo', 'social', 'comodo'];
  const max = Math.max(...Object.values(avatarScores));
  const winners = AVATAR_KEYS.filter(k => avatarScores[k] === max);
  const primaryAvatar = winners.length === 1
    ? winners[0]
    : tieBreak.find(k => winners.includes(k)) ?? 'comodo';

  return {
    primaryAvatar,
    avatarScores,
    answersRaw: answers,
    completedAt: new Date().toISOString(),
  };
}

// ── Persistencia (localStorage) ──────────────────────────────────────────────
const STORAGE_KEY = 'profiling_result';

export function saveProfilingResult(result: ProfilingResult): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
}

export function loadProfilingResult(): ProfilingResult | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProfilingResult;
  } catch {
    return null;
  }
}

export function hasCompletedProfiling(): boolean {
  return loadProfilingResult() !== null;
}
