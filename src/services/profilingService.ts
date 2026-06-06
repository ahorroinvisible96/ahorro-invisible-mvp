/**
 * Profiling Service — Lógica de perfilado por avatar
 *
 * 4 preguntas de personalización para refinar el avatar del usuario.
 * Cada pregunta tiene un peso distinto según su poder diagnóstico:
 *
 *   P1 (Sistema):      2 puntos — Nivel real de organización
 *   P2 (Fricción):     2 puntos — Tipo de intervención ideal
 *   P3 (Aspiracional): 1 punto  — Tipo de ayuda deseada (la más débil)
 *   P4 (Autopsia):     3 puntos — Análisis del error pasado real (la más fuerte)
 *
 * Total personalización: 8 puntos máx por avatar (54% del peso total)
 * Total onboarding:      6 puntos máx por avatar (46% del peso total)
 * Gran total (7 preguntas): 13 puntos máx por avatar
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
  sub?:      string;   // Subtexto (voz interior del usuario)
  avatar:    AvatarKey;
}

export interface ProfilingQuestion {
  id:      string;
  text:    string;
  weight:  number;     // Peso de la pregunta en el scoring
  options: [ProfilingOption, ProfilingOption, ProfilingOption, ProfilingOption];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4 PREGUNTAS DE PERSONALIZACIÓN
//
//   P1: Sistema — ¿Cómo te organizas? (2 pts)
//   P2: Fricción — ¿Qué te ayudaría antes de gastar? (2 pts)
//   P3: Aspiracional — ¿Qué tipo de ayuda necesitas? (1 pt)
//   P4: Autopsia — ¿Cómo fue tu último gasto que te molestó? (3 pts) ⭐
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
      { text: 'No llevo un control real; no sé cuánto gasto ni en qué exactamente', avatar: 'desordenado' },
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
      { text: 'Ver de un vistazo cuánto llevo gastado hoy, esta semana y este mes', avatar: 'desordenado' },
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
      { text: 'Visibilidad: saber a dónde va mi dinero y sentir que lo controlo', sub: 'Quiero dejar de sorprenderme a final de mes', avatar: 'desordenado' },
    ],
  },
  {
    id: 'P4',
    text: 'Cuando haces un gasto que luego te molesta, ¿cómo suele ser?',
    weight: 3,
    options: [
      { text: 'Algo que hago siempre por rutina o pereza: pido lo mismo sin buscar alternativa', avatar: 'comodo' },
      { text: 'Dije que sí a un plan y acabé gastando el doble de lo que esperaba', avatar: 'social' },
      { text: 'Vi algo, me gustó en el momento y lo compré sin haberlo pensado antes', avatar: 'impulsivo' },
      { text: 'Fueron varios gastos pequeños que por separado no parecían nada, pero al sumarlos…', avatar: 'desordenado' },
    ],
  },
];

// ── Cálculo de puntuaciones ──────────────────────────────────────────────────
const AVATAR_KEYS: AvatarKey[] = ['comodo', 'social', 'impulsivo', 'desordenado'];

function emptyAvatarScores(): Record<AvatarKey, number> {
  return Object.fromEntries(AVATAR_KEYS.map((k) => [k, 0])) as Record<AvatarKey, number>;
}

export function computeProfilingResult(answers: ProfilingAnswer[]): ProfilingResult {
  const avatarScores = emptyAvatarScores();

  for (const a of answers) {
    // Usar el peso de la pregunta correspondiente
    const question = PROFILING_QUESTIONS[a.questionIdx];
    const weight = question ? question.weight : 2;
    avatarScores[a.avatar] += weight;
  }

  const primaryAvatar = AVATAR_KEYS.reduce((max, k) => avatarScores[k] > avatarScores[max] ? k : max, AVATAR_KEYS[0]);

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
