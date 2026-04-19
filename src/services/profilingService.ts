/**
 * Profiling Service — Lógica de perfilado por avatar y subavatar
 *
 * 4 preguntas extra óptimas para segmentar entre los 4 avatares y 8 subavatares.
 * Cada una ataca un ángulo diferente del comportamiento de gasto.
 *
 * Scoring alineado con el Excel QuestionBank (PROFILE_SCORING):
 *   +2 puntos al avatar asociado
 *   +2 puntos al subavatar asociado
 */

// ── Tipos ────────────────────────────────────────────────────────────────────
export type AvatarKey    = 'comodo' | 'social' | 'impulsivo' | 'desordenado';
export type SubavatarKey =
  | 'improvisador'
  | 'fomo_social'
  | 'antojo_emocional'
  | 'microfugas'
  | 'sin_sistema'
  | 'plan_que_se_alarga'
  | 'conveniencia_inmediata'
  | 'cazador_de_ofertas';

export interface ProfilingAnswer {
  questionIdx: number;
  optionIdx:   number;   // 0=A, 1=B, 2=C, 3=D
  avatar:      AvatarKey;
  subavatar:   SubavatarKey;
}

export interface ProfilingResult {
  primaryAvatar:    AvatarKey;
  primarySubavatar: SubavatarKey;
  avatarScores:     Record<AvatarKey, number>;
  subavatarScores:  Record<SubavatarKey, number>;
  answersRaw:       ProfilingAnswer[];
  completedAt:      string;  // ISO date
}

// ── Preguntas ────────────────────────────────────────────────────────────────
export interface ProfilingOption {
  text:      string;
  avatar:    AvatarKey;
  subavatar: SubavatarKey;
}

export interface ProfilingQuestion {
  id:      string;
  text:    string;
  options: [ProfilingOption, ProfilingOption, ProfilingOption, ProfilingOption];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4 PREGUNTAS EXTRA — las mejores para segmentar avatar + subavatar
//
//   EX1: Momento de vulnerabilidad   → improvisador / fomo_social / antojo_emocional / sin_sistema
//   EX2: Nivel real de planificación → improvisador / plan_que_se_alarga / antojo_emocional / sin_sistema
//   EX3: Tipo de intervención ideal  → conveniencia_inmediata / fomo_social / antojo_emocional / sin_sistema
//   EX4: Forma típica del error      → conveniencia_inmediata / plan_que_se_alarga / antojo_emocional / microfugas
//
// Cobertura: los 4 avatares en cada pregunta + 7 de 8 subavatares cubiertos
// (cazador_de_ofertas se refina con comportamiento real, no con preguntas)
// ═══════════════════════════════════════════════════════════════════════════════
export const PROFILING_QUESTIONS: ProfilingQuestion[] = [
  {
    id: 'EX1',
    text: '¿Cuándo te resulta más difícil gastar bien?',
    options: [
      { text: 'Cuando voy con prisa, cansado o sin ganas de pensar', avatar: 'comodo', subavatar: 'improvisador' },
      { text: 'Cuando hay un plan o gente de por medio', avatar: 'social', subavatar: 'fomo_social' },
      { text: 'Por la noche o cuando me da el antojo', avatar: 'impulsivo', subavatar: 'antojo_emocional' },
      { text: 'No es un momento concreto; se me va poco a poco', avatar: 'desordenado', subavatar: 'sin_sistema' },
    ],
  },
  {
    id: 'EX2',
    text: '¿Cómo te organizas normalmente con tus gastos del día a día?',
    options: [
      { text: 'Improviso bastante y eso me hace pagar de más', avatar: 'comodo', subavatar: 'improvisador' },
      { text: 'Más o menos bien, salvo cuando surgen planes', avatar: 'social', subavatar: 'plan_que_se_alarga' },
      { text: 'No planifico mucho mis compras o caprichos', avatar: 'impulsivo', subavatar: 'antojo_emocional' },
      { text: 'No llevo un sistema claro ni reviso mucho', avatar: 'desordenado', subavatar: 'sin_sistema' },
    ],
  },
  {
    id: 'EX3',
    text: '¿Qué te ayudaría más justo antes de gastar?',
    options: [
      { text: 'Una opción fácil para elegir mejor sin complicarme', avatar: 'comodo', subavatar: 'conveniencia_inmediata' },
      { text: 'Un aviso antes de un plan o una salida', avatar: 'social', subavatar: 'fomo_social' },
      { text: 'Algo que me haga parar unos segundos antes de comprar', avatar: 'impulsivo', subavatar: 'antojo_emocional' },
      { text: 'Ver claro cuánto llevo gastado y en qué', avatar: 'desordenado', subavatar: 'sin_sistema' },
    ],
  },
  {
    id: 'EX4',
    text: 'Cuando haces un gasto que luego te molesta, ¿cómo suele ser?',
    options: [
      { text: 'Uno repetido que hago por comodidad o rapidez', avatar: 'comodo', subavatar: 'conveniencia_inmediata' },
      { text: 'Uno social que acaba siendo más caro de lo que pensaba', avatar: 'social', subavatar: 'plan_que_se_alarga' },
      { text: 'Uno impulsivo que no tenía pensado hacer', avatar: 'impulsivo', subavatar: 'antojo_emocional' },
      { text: 'Uno pequeño que parecía poco, pero se suma a otros', avatar: 'desordenado', subavatar: 'microfugas' },
    ],
  },
];

// ── Cálculo de puntuaciones ──────────────────────────────────────────────────
const AVATAR_KEYS: AvatarKey[] = ['comodo', 'social', 'impulsivo', 'desordenado'];
const SUBAVATAR_KEYS: SubavatarKey[] = [
  'improvisador', 'fomo_social', 'antojo_emocional', 'microfugas',
  'sin_sistema', 'plan_que_se_alarga', 'conveniencia_inmediata', 'cazador_de_ofertas',
];

function emptyAvatarScores(): Record<AvatarKey, number> {
  return Object.fromEntries(AVATAR_KEYS.map((k) => [k, 0])) as Record<AvatarKey, number>;
}

function emptySubavatarScores(): Record<SubavatarKey, number> {
  return Object.fromEntries(SUBAVATAR_KEYS.map((k) => [k, 0])) as Record<SubavatarKey, number>;
}

export function computeProfilingResult(answers: ProfilingAnswer[]): ProfilingResult {
  const avatarScores    = emptyAvatarScores();
  const subavatarScores = emptySubavatarScores();

  for (const a of answers) {
    avatarScores[a.avatar]       += 2;
    subavatarScores[a.subavatar] += 2;
  }

  const primaryAvatar    = AVATAR_KEYS.reduce((max, k) => avatarScores[k] > avatarScores[max] ? k : max, AVATAR_KEYS[0]);
  const primarySubavatar = SUBAVATAR_KEYS.reduce((max, k) => subavatarScores[k] > subavatarScores[max] ? k : max, SUBAVATAR_KEYS[0]);

  return {
    primaryAvatar,
    primarySubavatar,
    avatarScores,
    subavatarScores,
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
