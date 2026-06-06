/**
 * Profiling Service — Lógica de perfilado por avatar
 *
 * 4 preguntas extra óptimas para segmentar entre los 4 avatares.
 * Cada una ataca un ángulo diferente del comportamiento de gasto.
 *
 * Scoring:
 *   +2 puntos al avatar asociado
 */

// ── Tipos ────────────────────────────────────────────────────────────────────
export type AvatarKey    = 'comodo' | 'social' | 'impulsivo' | 'desordenado';

export interface ProfilingAnswer {
  questionIdx: number;
  optionIdx:   number;   // 0=A, 1=B, 2=C, 3=D
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
  avatar:    AvatarKey;
}

export interface ProfilingQuestion {
  id:      string;
  text:    string;
  options: [ProfilingOption, ProfilingOption, ProfilingOption, ProfilingOption];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4 PREGUNTAS EXTRA — las mejores para segmentar avatar
//
//   EX1: Momento de vulnerabilidad
//   EX2: Nivel real de planificación
//   EX3: Tipo de intervención ideal
//   EX4: Forma típica del error
//
// Cobertura: los 4 avatares en cada pregunta
// ═══════════════════════════════════════════════════════════════════════════════
export const PROFILING_QUESTIONS: ProfilingQuestion[] = [
  {
    id: 'EX1',
    text: '¿Cuándo te resulta más difícil gastar bien?',
    options: [
      { text: 'Cuando voy con prisa, cansado o sin ganas de pensar', avatar: 'comodo' },
      { text: 'Cuando hay un plan o gente de por medio', avatar: 'social' },
      { text: 'Por la noche o cuando me da el antojo', avatar: 'impulsivo' },
      { text: 'No es un momento concreto; se me va poco a poco', avatar: 'desordenado' },
    ],
  },
  {
    id: 'EX2',
    text: '¿Cómo te organizas normalmente con tus gastos del día a día?',
    options: [
      { text: 'Improviso bastante y eso me hace pagar de más', avatar: 'comodo' },
      { text: 'Más o menos bien, salvo cuando surgen planes', avatar: 'social' },
      { text: 'No planifico mucho mis compras o caprichos', avatar: 'impulsivo' },
      { text: 'No llevo un sistema claro ni reviso mucho', avatar: 'desordenado' },
    ],
  },
  {
    id: 'EX3',
    text: '¿Qué te ayudaría más justo antes de gastar?',
    options: [
      { text: 'Una opción fácil para elegir mejor sin complicarme', avatar: 'comodo' },
      { text: 'Un aviso antes de un plan o una salida', avatar: 'social' },
      { text: 'Algo que me haga parar unos segundos antes de comprar', avatar: 'impulsivo' },
      { text: 'Ver claro cuánto llevo gastado y en qué', avatar: 'desordenado' },
    ],
  },
  {
    id: 'EX4',
    text: 'Cuando haces un gasto que luego te molesta, ¿cómo suele ser?',
    options: [
      { text: 'Uno repetido que hago por comodidad o rapidez', avatar: 'comodo' },
      { text: 'Uno social que acaba siendo más caro de lo que pensaba', avatar: 'social' },
      { text: 'Uno impulsivo que no tenía pensado hacer', avatar: 'impulsivo' },
      { text: 'Uno pequeño que parecía poco, pero se suma a otros', avatar: 'desordenado' },
    ],
  },
];

// ── Cálculo de puntuaciones ──────────────────────────────────────────────────
const AVATAR_KEYS: AvatarKey[] = ['comodo', 'social', 'impulsivo', 'desordenado'];

function emptyAvatarScores(): Record<AvatarKey, number> {
  return Object.fromEntries(AVATAR_KEYS.map((k) => [k, 0])) as Record<AvatarKey, number>;
}

export function computeProfilingResult(answers: ProfilingAnswer[]): ProfilingResult {
  const avatarScores    = emptyAvatarScores();

  for (const a of answers) {
    avatarScores[a.avatar]       += 2;
  }

  const primaryAvatar    = AVATAR_KEYS.reduce((max, k) => avatarScores[k] > avatarScores[max] ? k : max, AVATAR_KEYS[0]);

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
