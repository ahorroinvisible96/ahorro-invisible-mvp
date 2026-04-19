/**
 * Profiling Service — Lógica de perfilado por avatar y subavatar
 *
 * Almacena y gestiona las respuestas de las preguntas extra de personalización.
 * Diseñado para ser extensible: se pueden añadir más preguntas sin cambiar la arquitectura.
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
  id:      string;  // EX1..EX16
  text:    string;
  options: [ProfilingOption, ProfilingOption, ProfilingOption, ProfilingOption];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 16 PREGUNTAS EXTRA — 4 por avatar, cada una desde un ángulo diferente
// ═══════════════════════════════════════════════════════════════════════════════
export const PROFILING_QUESTIONS: ProfilingQuestion[] = [

  // ─────────────────────────────────────────────────────────────────
  // BLOQUE 1 — Momento de vulnerabilidad (EX1-EX4 originales)
  // ─────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────
  // BLOQUE 2 — Relación emocional con el gasto (EX5-EX8)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'EX5',
    text: '¿Qué sientes justo después de un gasto que no tenías planeado?',
    options: [
      { text: 'Ni me doy cuenta, me parece normal', avatar: 'comodo', subavatar: 'conveniencia_inmediata' },
      { text: 'Algo de culpa, pero pienso que era inevitable por los demás', avatar: 'social', subavatar: 'fomo_social' },
      { text: 'Alivio primero y arrepentimiento después', avatar: 'impulsivo', subavatar: 'antojo_emocional' },
      { text: 'Nada especial, solo lo descubro cuando miro la cuenta', avatar: 'desordenado', subavatar: 'microfugas' },
    ],
  },
  {
    id: 'EX6',
    text: '¿Qué tipo de compra te cuesta más resistir?',
    options: [
      { text: 'Algo que me facilita la vida o me ahorra esfuerzo', avatar: 'comodo', subavatar: 'conveniencia_inmediata' },
      { text: 'Algo que todo el mundo tiene o hace', avatar: 'social', subavatar: 'fomo_social' },
      { text: 'Algo que me apetece mucho en ese momento', avatar: 'impulsivo', subavatar: 'antojo_emocional' },
      { text: 'Algo barato que no parece importante pero luego se repite', avatar: 'desordenado', subavatar: 'microfugas' },
    ],
  },
  {
    id: 'EX7',
    text: 'Si tuvieras que describir tu relación con el dinero en una frase sería…',
    options: [
      { text: 'No me gusta complicarme, prefiero pagar y ya está', avatar: 'comodo', subavatar: 'improvisador' },
      { text: 'Es difícil disfrutar sin gastar', avatar: 'social', subavatar: 'plan_que_se_alarga' },
      { text: 'Me cuesta controlarme cuando quiero algo', avatar: 'impulsivo', subavatar: 'cazador_de_ofertas' },
      { text: 'No sé bien en qué se me va, pero se me va', avatar: 'desordenado', subavatar: 'sin_sistema' },
    ],
  },
  {
    id: 'EX8',
    text: '¿Cuándo sueles darte cuenta de que has gastado demasiado?',
    options: [
      { text: 'Casi nunca, porque tampoco controlo mucho', avatar: 'comodo', subavatar: 'improvisador' },
      { text: 'El lunes, cuando repaso el fin de semana', avatar: 'social', subavatar: 'plan_que_se_alarga' },
      { text: 'Al momento, pero ya es tarde', avatar: 'impulsivo', subavatar: 'antojo_emocional' },
      { text: 'A final de mes, cuando el saldo no cuadra', avatar: 'desordenado', subavatar: 'sin_sistema' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // BLOQUE 3 — Reacción bajo presión / situación (EX9-EX12)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'EX9',
    text: '¿Qué pasa cuando llegas cansado a casa por la noche?',
    options: [
      { text: 'Pido comida a domicilio porque no me apetece cocinar', avatar: 'comodo', subavatar: 'conveniencia_inmediata' },
      { text: 'Miro si alguien ha propuesto plan y me apunto', avatar: 'social', subavatar: 'fomo_social' },
      { text: 'Acabo comprando algo online que no necesitaba', avatar: 'impulsivo', subavatar: 'antojo_emocional' },
      { text: 'No hago nada especial, pero tampoco controlo lo que gasto', avatar: 'desordenado', subavatar: 'microfugas' },
    ],
  },
  {
    id: 'EX10',
    text: 'Un amigo te propone un plan caro de último minuto. ¿Qué haces?',
    options: [
      { text: 'Voy sin pensarlo mucho, no me gusta complicarme', avatar: 'comodo', subavatar: 'improvisador' },
      { text: 'Voy porque no quiero perderme el plan', avatar: 'social', subavatar: 'fomo_social' },
      { text: 'Depende de cómo me sienta en ese momento', avatar: 'impulsivo', subavatar: 'antojo_emocional' },
      { text: 'Voy y luego no sé cuánto me he gastado exactamente', avatar: 'desordenado', subavatar: 'sin_sistema' },
    ],
  },
  {
    id: 'EX11',
    text: '¿Qué suele pasar los primeros días después de cobrar?',
    options: [
      { text: 'Gasto normal, pero no me preocupa porque acabo de cobrar', avatar: 'comodo', subavatar: 'improvisador' },
      { text: 'Aprovecho para planes o cenas que llevo posponiendo', avatar: 'social', subavatar: 'plan_que_se_alarga' },
      { text: 'Me permito caprichos que había estado aplazando', avatar: 'impulsivo', subavatar: 'cazador_de_ofertas' },
      { text: 'Gasto sin darme cuenta y a mitad de mes ya noto el bajón', avatar: 'desordenado', subavatar: 'microfugas' },
    ],
  },
  {
    id: 'EX12',
    text: '¿Qué haces cuando ves una oferta o descuento irresistible?',
    options: [
      { text: 'Lo compro si me facilita algo, me da pereza buscar alternativas', avatar: 'comodo', subavatar: 'conveniencia_inmediata' },
      { text: 'Lo compro si me sirve para algún plan social', avatar: 'social', subavatar: 'plan_que_se_alarga' },
      { text: 'Lo compro sin pensarlo, me encanta sentir que ahorro', avatar: 'impulsivo', subavatar: 'cazador_de_ofertas' },
      { text: 'Lo compro porque es barato, aunque luego no lo use mucho', avatar: 'desordenado', subavatar: 'microfugas' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // BLOQUE 4 — Autoconocimiento y cambio (EX13-EX16)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'EX13',
    text: '¿Qué crees que te haría ahorrar más a largo plazo?',
    options: [
      { text: 'Que fuera automático y no tuviera que pensarlo yo', avatar: 'comodo', subavatar: 'conveniencia_inmediata' },
      { text: 'Poder disfrutar sin sentir que me estoy privando', avatar: 'social', subavatar: 'fomo_social' },
      { text: 'Tener algo que me frene justo en el momento del gasto', avatar: 'impulsivo', subavatar: 'antojo_emocional' },
      { text: 'Ver de un vistazo todo lo que gasto y en qué', avatar: 'desordenado', subavatar: 'sin_sistema' },
    ],
  },
  {
    id: 'EX14',
    text: '¿Qué tipo de recordatorio te resultaría más útil?',
    options: [
      { text: 'Antes de pedir delivery o pagar algo por comodidad', avatar: 'comodo', subavatar: 'conveniencia_inmediata' },
      { text: 'Antes de salir de casa un viernes o sábado', avatar: 'social', subavatar: 'fomo_social' },
      { text: 'Cuando estoy a punto de abrir una app de compras', avatar: 'impulsivo', subavatar: 'cazador_de_ofertas' },
      { text: 'Un resumen semanal de lo que llevo gastado', avatar: 'desordenado', subavatar: 'sin_sistema' },
    ],
  },
  {
    id: 'EX15',
    text: '¿Cuál es el mayor obstáculo que le ves a ahorrar?',
    options: [
      { text: 'Me da pereza buscar alternativas más baratas', avatar: 'comodo', subavatar: 'improvisador' },
      { text: 'No quiero sacrificar mi vida social', avatar: 'social', subavatar: 'plan_que_se_alarga' },
      { text: 'Me resulta difícil decirme que no a mí mismo', avatar: 'impulsivo', subavatar: 'antojo_emocional' },
      { text: 'No tengo claro por dónde empezar a recortar', avatar: 'desordenado', subavatar: 'microfugas' },
    ],
  },
  {
    id: 'EX16',
    text: '¿Cómo reaccionas cuando revisas tus gastos del último mes?',
    options: [
      { text: 'Veo mucho delivery y servicios, pero me parece normal', avatar: 'comodo', subavatar: 'conveniencia_inmediata' },
      { text: 'Casi todo es ocio y planes, no sé cómo recortarlo', avatar: 'social', subavatar: 'fomo_social' },
      { text: 'Encuentro compras que ni recordaba haber hecho', avatar: 'impulsivo', subavatar: 'antojo_emocional' },
      { text: 'Hay muchas líneas pequeñas que juntas suman demasiado', avatar: 'desordenado', subavatar: 'microfugas' },
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

/**
 * Cada respuesta suma:
 *   +2 al avatar asociado
 *   +2 al subavatar asociado
 *
 * Alineado con PROFILE_SCORING del Excel (avatar_points=2, subavatar_points=2)
 */
export function computeProfilingResult(answers: ProfilingAnswer[]): ProfilingResult {
  const avatarScores    = emptyAvatarScores();
  const subavatarScores = emptySubavatarScores();

  for (const a of answers) {
    avatarScores[a.avatar]       += 2;
    subavatarScores[a.subavatar] += 2;
  }

  // Mayor score → primary (en caso de empate, el primero encontrado)
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
