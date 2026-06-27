/**
 * Daily Questions Bank — Banco de preguntas diarias (formato AHORRO)
 *
 * Cada pregunta describe un escenario de ahorro concreto.
 * El usuario introduce cuánto se ha ahorrado (default: 0 €).
 *
 * Dos tipos de pregunta:
 *   - 'amount'     = pregunta cerrada directa sobre un ahorro
 *   - 'fill_blank' = pregunta con hueco/desplegable sobre un ahorro
 *
 * 7-8 preguntas × 8 combinaciones (amount) = 60:
 *   1. Cómodo   / conveniencia_inmediata  (Q_CI)
 *   2. Cómodo   / improvisador            (Q_IM)
 *   3. Social   / fomo_social             (Q_FS)
 *   4. Social   / plan_que_se_alarga      (Q_PA)
 *   5. Impulsivo / antojo_emocional       (Q_AE)
 *   6. Impulsivo / cazador_de_ofertas     (Q_CO)
 *   7. Desordenado / microfugas           (Q_MF)
 *   8. Desordenado / sin_sistema          (Q_SS)
 *
 * 60 preguntas fill_blank orientadas a ahorro (Q_FB_01 – Q_FB_92, sin las 20 podadas)
 */

import type { AvatarKey } from './profilingService';

// ── Tipos de metadatos IA ────────────────────────────────────────────────────
export type HabitPrinciple = 'obvious' | 'attractive' | 'easy' | 'satisfying';
export type QuestionDifficulty = 'low' | 'medium' | 'high';
export type QuestionTone = 'motivador' | 'reflexivo' | 'preventivo' | 'celebratorio' | 'neutral' | 'directo';
export type QuestionFormat = 'amount' | 'fill_blank';

export interface BlankOption {
  label: string;    // Texto visible: "me apetece", "no quiero perderme el plan"…
  value: string;    // ID interno
  /**
   * Scoring interno por opción. Cada clave es un avatar y el valor los puntos
   * que suma. Permite scoring multi-avatar: { social: 2, impulsivo: 1 }.
   * NUNCA se muestra al usuario.
   */
  scores: Partial<Record<AvatarKey, number>>;
  /** Si true, esta opción abre un input de texto libre (solo para 'Otro') */
  freeText?: boolean;
}

// ── Interface ────────────────────────────────────────────────────────────────
export interface DailyQuestion {
  id:                        string;
  /** Escenario de ahorro que se muestra al usuario */
  text:                      string;

  // ── Formato de la pregunta ───────────────────────────────────────────
  /**
   * 'amount'     = pregunta cerrada directa sobre un ahorro (el usuario introduce importe)
   * 'fill_blank' = frase con hueco + desplegable de 3 opciones orientadas a un gasto evitado.
   *                Opciones 1 y 2 refuerzan el avatar principal.
   *                Opción 3 puede apuntar a otro avatar como señal interna de scoring.
   *                La opción 'Otro' es libre y se analiza por IA.
   */
  format:                    QuestionFormat;
  /** Para fill_blank: 3 opciones de gasto evitado + 'Otro' implícito */
  blankOptions?:             BlankOption[];

  /** Importe sugerido como referencia (hint visual, no obligatorio) */
  suggestedAmount:           number;
  /** Categoría del hábito de gasto */
  habitCategory:             string;
  /** Días óptimos para mostrar esta pregunta */
  bestDays:                  string;
  /** Franja horaria óptima: Mañana | Tarde | Noche | Cualquiera */
  bestTimeWindow:            string;
  /** Fase del mes: Inicio | Mitad | Final | Cualquiera */
  monthPhase:                string;
  /** Avatar principal al que va dirigida */
  targetAvatarPrimary:       AvatarKey;
  /** Peso de scoring (1-3) */
  scenarioWeight:            number;
  /** Prioridad base para el scoring (1-10) */
  priorityBase:              number;
  /** Días de espera antes de repetir esta pregunta */
  cooldownDays:              number;
  /** Ahorro mensual estimado si se repite el hábito */
  monthlyDelta:              number;
  /** Ahorro anual estimado */
  yearlyDelta:               number;
  /** Descripción corta del impacto */
  labelImpact:               string;

  // ── Control de opción "Otro" y análisis IA ──────────────────────────────
  /** Si la pregunta permite la opción "Otro" con texto libre */
  allowOther?:               boolean;
  /** Si la respuesta libre de "Otro" debe analizarse con IA */
  otherRequiresAI?:          boolean;
  /**
   * Confianza mínima (0-1) requerida para que la IA sume puntos.
   * Si la IA no supera este umbral, la respuesta libre no suma a ningún avatar.
   * Default: 0.70
   */
  aiConfidenceThreshold?:    number;

  // ── Metadatos IA (auto-derivados) ──────────────────────────────────────
  /** Si la pregunta está activa (false = retirada sin eliminar) */
  active:                    boolean;
  /** Intención conductual de la pregunta */
  intent:                    string;
  /** Principio de hábito (Atomic Habits) */
  habit_principle:           HabitPrinciple;
  /** Tono del mensaje */
  tone:                      QuestionTone;
  /** Dificultad percibida para el usuario */
  difficulty:                QuestionDifficulty;
  /** Si es pregunta experimental (nueva, sin datos de rendimiento) */
  experimental:              boolean;
}

// Helper para construir preguntas de forma compacta
// Los metadatos de intent, habit_principle, tone y difficulty se derivan
// de los parámetros explícitos que vienen del Excel.
function q(
  id: string, text: string, suggestedAmount: number,
  habitCategory: string, bestDays: string, bestTimeWindow: string, monthPhase: string,
  ap: AvatarKey, _as2: AvatarKey | '',  // _as2 ignorado — avatar secundario eliminado
  scenarioWeight: number, priorityBase: number, cooldownDays: number,
  monthlyDelta: number, yearlyDelta: number, labelImpact: string,
  intent: string, habit_principle: HabitPrinciple, tone: QuestionTone, difficulty: QuestionDifficulty,
): DailyQuestion {
  return {
    id, text, suggestedAmount, habitCategory, bestDays, bestTimeWindow, monthPhase,
    targetAvatarPrimary: ap,
    scenarioWeight, priorityBase, cooldownDays, monthlyDelta, yearlyDelta, labelImpact,
    format: 'amount',
    active: true,
    intent,
    habit_principle,
    tone,
    difficulty,
    experimental: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CÓMODO / CONVENIENCIA INMEDIATA — 15 preguntas
//    Gasta más por comodidad: delivery, taxi, café fuera, opciones premium
//    Días: entre semana (rutina). Momentos: mañana (café/transporte), noche (delivery)
// ═══════════════════════════════════════════════════════════════════════════════

// ── CONVENIENCIA INMEDIATA (amount) ─────────────────────────────────────────────────
const Q_CONVENIENCIA: DailyQuestion[] = [
  q('Q_CI_01', 'Si hoy, estando cansado, has cocinado algo sencillo en vez de pedir delivery, ¿cuánto te has ahorrado?', 12,
    'Delivery', 'Lunes, Martes, Miércoles, Jueves', 'Noche', 'Cualquiera',
    'comodo', '', 3, 9, 2, 48, 576,
    'Evitar 1 pedido semanal ahorra ~48 €/mes',
    'delivery_conveniencia_inmediata', 'easy', 'motivador', 'medium'),
  q('Q_CI_04', 'Si hoy has llevado comida preparada en vez de comprar fuera por falta de tiempo, ¿cuánto te has ahorrado?', 8,
    'Comida', 'Lunes a Viernes', 'Mañana', 'Cualquiera',
    'comodo', '', 3, 8, 2, 64, 768,
    'Llevar táper 2 días más por semana ahorra ~64 €/mes',
    'comida_conveniencia_inmediata', 'easy', 'motivador', 'medium'),
  q('Q_CI_05', 'Si esta noche has evitado pedir comida solo por pereza y has cenado en casa, ¿cuánto te has ahorrado?', 10,
    'Delivery', 'Viernes, Sábado', 'Noche', 'Cualquiera',
    'comodo', '', 3, 8, 3, 40, 480,
    'Evitar delivery de fin de semana ahorra ~40 €/mes',
    'delivery_conveniencia_inmediata', 'easy', 'motivador', 'medium'),
  q('Q_CI_06', 'Si antes de abrir una app de delivery has revisado nevera o despensa y no has pedido, ¿cuánto te has ahorrado?', 12,
    'Delivery', 'Cualquier día', 'Noche', 'Cualquiera',
    'comodo', '', 3, 8, 3, 36, 432,
    'Revisar nevera antes de pedir evita ~3 pedidos/mes',
    'delivery_conveniencia_inmediata', 'satisfying', 'reflexivo', 'medium'),
  q('Q_CI_02', 'Si hoy has evitado el café comprado por rutina y te lo has preparado tú, ¿cuánto te has ahorrado?', 3,
    'Cafés', 'Lunes a Viernes', 'Mañana', 'Cualquiera',
    'comodo', '', 2, 7, 2, 45, 540,
    'Café en casa cada día laborable ahorra ~45 €/mes',
    'cafés_conveniencia_inmediata', 'easy', 'preventivo', 'low'),
  q('Q_CI_03', 'Si hoy has evitado taxi/VTC por comodidad y has elegido una opción más barata, ¿cuánto te has ahorrado?', 8,
    'Transporte', 'Lunes a Viernes', 'Mañana', 'Cualquiera',
    'comodo', '', 2, 7, 3, 32, 384,
    'Evitar 1 taxi semanal ahorra ~32 €/mes',
    'transporte_conveniencia_inmediata', 'easy', 'motivador', 'medium'),
  q('Q_CI_13', 'Si hoy has evitado pagar por comodidad inmediata —envío rápido, snack o extra—, ¿cuánto te has ahorrado?', 5,
    'Comodidad', 'Martes, Miércoles, Jueves', 'Tarde', 'Cualquiera',
    'comodo', '', 2, 7, 3, 20, 240,
    'Evitar gastos de comodidad ahorra ~20 €/mes',
    'comodidad_conveniencia_inmediata', 'obvious', 'preventivo', 'low'),
];

// ── IMPROVISADOR (amount) ─────────────────────────────────────────────────
const Q_IMPROVISADOR: DailyQuestion[] = [
  q('Q_IM_07', 'Si hoy has planificado comidas y con eso has evitado comprar fuera, ¿cuánto te has ahorrado?', 15,
    'Planificación', 'Domingo', 'Mañana', 'Cualquiera',
    'comodo', '', 3, 9, 7, 60, 720,
    'Meal prep semanal ahorra ~60 €/mes',
    'planificación_improvisador', 'easy', 'neutral', 'high'),
  q('Q_IM_14', 'Si hoy has cocinado para varios días y ya has evitado una compra de urgencia, ¿cuánto te has ahorrado?', 20,
    'Planificación', 'Domingo', 'Tarde', 'Cualquiera',
    'comodo', '', 3, 9, 7, 60, 720,
    'Batch cooking semanal ahorra ~60 €/mes',
    'planificación_improvisador', 'easy', 'neutral', 'high'),
  q('Q_IM_01', 'Si hoy has decidido la cena antes de tener hambre y has evitado delivery de última hora, ¿cuánto te has ahorrado?', 10,
    'Planificación', 'Lunes, Martes, Miércoles, Jueves', 'Tarde', 'Cualquiera',
    'comodo', '', 3, 8, 2, 40, 480,
    'Planificar cena evita delivery impulsivo',
    'planificación_improvisador', 'easy', 'motivador', 'medium'),
  q('Q_IM_02', 'Si hoy ya tenías comida prevista y no has improvisado comprando fuera, ¿cuánto te has ahorrado?', 8,
    'Planificación', 'Lunes a Viernes', 'Mañana', 'Cualquiera',
    'comodo', '', 3, 8, 2, 48, 576,
    'Planificar comida ahorra ~48 €/mes',
    'planificación_improvisador', 'easy', 'motivador', 'medium'),
  q('Q_IM_08', 'Si hoy has notado el impulso de pedir algo y lo has sustituido por comida rápida en casa, ¿cuánto te has ahorrado?', 10,
    'Delivery', 'Cualquier día', 'Noche', 'Cualquiera',
    'comodo', '', 3, 8, 3, 30, 360,
    'Parar y cocinar evita pedidos impulsivos',
    'delivery_improvisador', 'easy', 'preventivo', 'medium'),
  q('Q_IM_13', 'Si hoy te ha dado pereza cocinar pero aun así has resuelto la comida en casa, ¿cuánto te has ahorrado?', 10,
    'Delivery', 'Lunes, Martes, Miércoles', 'Noche', 'Cualquiera',
    'comodo', '', 3, 8, 3, 30, 360,
    'Algo rápido en casa siempre es más barato que delivery',
    'delivery_improvisador', 'easy', 'motivador', 'medium'),
  q('Q_IM_03', 'Si hoy has usado sobras antes de comprar comida nueva por impulso o desorden, ¿cuánto te has ahorrado?', 6,
    'Sobras', 'Cualquier día', 'Noche', 'Cualquiera',
    'comodo', '', 2, 7, 3, 24, 288,
    'Usar sobras evita ~6 compras innecesarias/mes',
    'sobras_improvisador', 'easy', 'preventivo', 'medium'),
];

// ── FOMO SOCIAL (amount) ─────────────────────────────────────────────────
const Q_FOMO_SOCIAL: DailyQuestion[] = [
  q('Q_FS_01', 'Si hoy has rechazado o abaratado un plan social que no encajaba con tu dinero, ¿cuánto te has ahorrado?', 15,
    'Planes sociales', 'Jueves, Viernes, Sábado', 'Tarde', 'Cualquiera',
    'social', '', 3, 9, 3, 60, 720,
    'Decir no a 1 plan caro al mes ahorra ~60 €',
    'planes sociales_fomo_social', 'attractive', 'motivador', 'high'),
  q('Q_FS_02', 'Si hoy has comido o cenado en casa antes de salir para no gastar de más fuera, ¿cuánto te has ahorrado?', 12,
    'Planes sociales', 'Viernes, Sábado', 'Tarde', 'Cualquiera',
    'social', '', 3, 9, 3, 48, 576,
    'Cenar antes de salir ahorra ~12 € por noche',
    'planes sociales_fomo_social', 'easy', 'motivador', 'medium'),
  q('Q_FS_06', 'Si hoy has dicho que no a un plan al que ibas solo por compromiso, ¿cuánto te has ahorrado?', 20,
    'FOMO', 'Jueves, Viernes, Sábado', 'Tarde', 'Cualquiera',
    'social', '', 3, 9, 4, 40, 480,
    'Decir no a planes por compromiso ahorra mucho',
    'fomo_fomo_social', 'easy', 'neutral', 'high'),
  q('Q_FS_03', 'Si hoy has propuesto un plan barato o gratis en vez de seguir el plan caro del grupo, ¿cuánto te has ahorrado?', 15,
    'Planes sociales', 'Viernes, Sábado, Domingo', 'Tarde', 'Cualquiera',
    'social', '', 3, 8, 4, 45, 540,
    'Proponer planes baratos ahorra ~45 €/mes',
    'planes sociales_fomo_social', 'attractive', 'motivador', 'high'),
  q('Q_FS_04', 'Si hoy has salido con un límite claro y no has gastado para seguir el ritmo del grupo, ¿cuánto te has ahorrado?', 10,
    'Control social', 'Viernes, Sábado', 'Tarde', 'Cualquiera',
    'social', '', 3, 8, 3, 40, 480,
    'Salir con presupuesto ahorra ~40 €/mes',
    'control social_fomo_social', 'easy', 'motivador', 'medium'),
  q('Q_FS_10', 'Si tras cobrar has evitado un plan caro por euforia o presión social, ¿cuánto te has ahorrado?', 20,
    'Post-cobro', 'Cualquier día', 'Tarde', 'Inicio',
    'social', '', 3, 8, 7, 30, 360,
    'Controlar post-cobro evita excesos',
    'post-cobro_fomo_social', 'obvious', 'preventivo', 'high'),
  q('Q_FS_12', 'Si hoy te has ido antes de que el plan se alargara y siguiera sumando gastos, ¿cuánto te has ahorrado?', 10,
    'Planes sociales', 'Viernes, Sábado', 'Noche', 'Cualquiera',
    'social', '', 3, 8, 3, 40, 480,
    'Irse a la hora prevista evita el gasto extra',
    'planes sociales_fomo_social', 'easy', 'motivador', 'medium'),
  q('Q_FS_05', 'Si hoy has elegido ocio gratis para no gastar solo por llenar el domingo, ¿cuánto te has ahorrado?', 12,
    'Ocio gratis', 'Sábado, Domingo', 'Mañana', 'Cualquiera',
    'social', '', 2, 7, 4, 36, 432,
    'Planes gratis de fin de semana ahorran ~36 €/mes',
    'ocio gratis_fomo_social', 'easy', 'motivador', 'medium'),
];

// ── PLAN QUE SE ALARGA (amount) ─────────────────────────────────────────────────
const Q_PLAN_ALARGA: DailyQuestion[] = [
  q('Q_PA_01', 'Si anoche te fuiste a tiempo en vez de caer en la “última más”, ¿cuánto te has ahorrado?', 12,
    'Escalada social', 'Sábado, Domingo', 'Mañana', 'Cualquiera',
    'social', '', 3, 9, 3, 48, 576,
    'Irse a la hora planeada evita 2-3 copas extra',
    'escalada social_plan_que_se_alarga', 'easy', 'motivador', 'medium'),
  q('Q_PA_02', 'Si anoche evitaste una ronda extra que no necesitabas pero el grupo pedía, ¿cuánto te has ahorrado?', 10,
    'Escalada social', 'Sábado, Domingo', 'Mañana', 'Cualquiera',
    'social', '', 3, 9, 3, 40, 480,
    'Saltarse la segunda ronda ahorra ~10 € por noche',
    'escalada social_plan_que_se_alarga', 'easy', 'motivador', 'medium'),
  q('Q_PA_12', 'Si anoche dijiste “yo me planto” cuando el grupo quería seguir gastando, ¿cuánto te has ahorrado?', 15,
    'Escalada social', 'Sábado, Domingo', 'Mañana', 'Cualquiera',
    'social', '', 3, 9, 3, 45, 540,
    'Saber decir "yo paso" es el mayor ahorro social',
    'escalada social_plan_que_se_alarga', 'easy', 'motivador', 'high'),
  q('Q_PA_04', 'Si anoche os quedasteis en un solo sitio y evitasteis traslados, copas y extras, ¿cuánto te has ahorrado?', 12,
    'Escalada social', 'Sábado, Domingo', 'Mañana', 'Cualquiera',
    'social', '', 3, 8, 3, 36, 432,
    'Cada cambio de bar suma ~10-15 € extra',
    'escalada social_plan_que_se_alarga', 'easy', 'motivador', 'medium'),
  q('Q_PA_05', 'Si antes de salir te marcaste un tope realista y lo respetaste, ¿cuánto te has ahorrado?', 10,
    'Control previo', 'Viernes, Sábado', 'Tarde', 'Cualquiera',
    'social', '', 3, 8, 3, 40, 480,
    'Ponerse un tope antes de salir funciona',
    'control previo_plan_que_se_alarga', 'easy', 'neutral', 'medium'),
  q('Q_PA_09', 'Si anoche pediste la cuenta antes de que el plan escalara a más rondas, ¿cuánto te has ahorrado?', 10,
    'Escalada social', 'Sábado, Domingo', 'Mañana', 'Cualquiera',
    'social', '', 3, 8, 3, 30, 360,
    'Pedir la cuenta a tiempo frena la escalada',
    'escalada social_plan_que_se_alarga', 'easy', 'motivador', 'medium'),
  q('Q_PA_14', 'Si anoche respetaste tu hora de vuelta y evitaste el gasto de seguir por inercia, ¿cuánto te has ahorrado?', 10,
    'Control previo', 'Viernes, Sábado', 'Tarde', 'Cualquiera',
    'social', '', 3, 8, 3, 40, 480,
    'Hora de vuelta definida = gasto controlado',
    'control previo_plan_que_se_alarga', 'easy', 'neutral', 'medium'),
  q('Q_PA_15', 'Si anoche evitaste cambiar de bar y convertir un plan simple en una noche cara, ¿cuánto te has ahorrado?', 15,
    'Escalada social', 'Sábado, Domingo', 'Mañana', 'Cualquiera',
    'social', '', 3, 8, 3, 45, 540,
    'Quedarse en un sitio vs bar-hopping ahorra mucho',
    'escalada social_plan_que_se_alarga', 'easy', 'motivador', 'high'),
];

// ── ANTOJO EMOCIONAL (amount) ─────────────────────────────────────────────────
const Q_ANTOJO_EMO: DailyQuestion[] = [
  q('Q_AE_01', 'Si hoy has cerrado una app de compras cuando ibas a comprar por impulso, ¿cuánto te has ahorrado?', 20,
    'Compra online', 'Cualquier día', 'Noche', 'Cualquiera',
    'impulsivo', '', 3, 9, 2, 40, 480,
    'Cerrar la app sin comprar ahorra ~40 €/mes',
    'compra online_antojo_emocional', 'obvious', 'motivador', 'high'),
  q('Q_AE_02', 'Si hoy has aplicado 24 horas de espera antes de comprar algo que querías ya, ¿cuánto te has ahorrado?', 25,
    'Impulso', 'Cualquier día', 'Noche', 'Cualquiera',
    'impulsivo', '', 3, 9, 3, 50, 600,
    'La regla de 24h evita el 70% de compras impulsivas',
    'impulso_antojo_emocional', 'easy', 'motivador', 'high'),
  q('Q_AE_04', 'Si hoy has sentido estrés, ansiedad o aburrimiento y no lo has convertido en compra, ¿cuánto te has ahorrado?', 15,
    'Emocional', 'Cualquier día', 'Noche', 'Cualquiera',
    'impulsivo', '', 3, 9, 3, 30, 360,
    'Reconocer compra emocional es el primer paso',
    'emocional_antojo_emocional', 'easy', 'neutral', 'high'),
  q('Q_AE_03', 'Si hoy has vaciado un carrito online al darte cuenta de que era impulso, ¿cuánto te has ahorrado?', 30,
    'Compra online', 'Cualquier día', 'Noche', 'Cualquiera',
    'impulsivo', '', 3, 8, 3, 60, 720,
    'Vaciar el carrito en vez de pagar ahorra mucho',
    'compra online_antojo_emocional', 'easy', 'motivador', 'high'),
  q('Q_AE_08', 'Si hoy has evitado abrir apps de compras en tu momento de debilidad, ¿cuánto te has ahorrado?', 15,
    'Compra online', 'Cualquier día', 'Mañana', 'Cualquiera',
    'impulsivo', '', 3, 8, 3, 30, 360,
    'No abrir apps de compras elimina la tentación',
    'compra online_antojo_emocional', 'easy', 'motivador', 'high'),
  q('Q_AE_13', 'Si hoy has dejado pasar una “oportunidad” que en realidad no necesitabas, ¿cuánto te has ahorrado?', 20,
    'Impulso', 'Cualquier día', 'Tarde', 'Cualquiera',
    'impulsivo', '', 3, 8, 4, 40, 480,
    'Dejar pasar "oportunidades" ahorra mucho a largo plazo',
    'impulso_antojo_emocional', 'easy', 'neutral', 'high'),
  q('Q_AE_05', 'Si hoy has evitado un capricho pequeño usado como recompensa automática, ¿cuánto te has ahorrado?', 4,
    'Caprichos', 'Cualquier día', 'Tarde', 'Cualquiera',
    'impulsivo', '', 2, 7, 2, 48, 576,
    'Los caprichos diarios suman mucho al mes',
    'caprichos_antojo_emocional', 'obvious', 'preventivo', 'low'),
  q('Q_AE_06', 'Si hoy has gestionado el mal día caminando, entrenando o saliendo sin comprar, ¿cuánto te has ahorrado?', 10,
    'Emocional', 'Cualquier día', 'Tarde', 'Cualquiera',
    'impulsivo', '', 2, 7, 4, 20, 240,
    'El deporte gratis sustituye al shopping emocional',
    'emocional_antojo_emocional', 'easy', 'neutral', 'medium'),
];

// ── CAZADOR DE OFERTAS (amount) ─────────────────────────────────────────────────
const Q_CAZADOR_OFERTAS: DailyQuestion[] = [
  q('Q_CO_01', 'Si hoy has visto una oferta tentadora y no has comprado porque no lo necesitabas, ¿cuánto te has ahorrado?', 15,
    'Ofertas', 'Cualquier día', 'Tarde', 'Cualquiera',
    'impulsivo', '', 3, 9, 2, 30, 360,
    'No picar en ofertas innecesarias ahorra ~30 €/mes',
    'ofertas_cazador_de_ofertas', 'easy', 'motivador', 'high'),
  q('Q_CO_08', 'Si hoy te has preguntado “¿lo compraría sin descuento?” y has dicho que no, ¿cuánto te has ahorrado?', 15,
    'Reflexión', 'Cualquier día', 'Tarde', 'Cualquiera',
    'impulsivo', '', 3, 9, 3, 30, 360,
    'Si no lo comprarías a precio normal, no lo necesitas',
    'reflexión_cazador_de_ofertas', 'easy', 'motivador', 'high'),
  q('Q_CO_04', 'Si hoy has evitado comprar en rebajas hasta comprobar si realmente lo querías, ¿cuánto te has ahorrado?', 20,
    'Ofertas', 'Cualquier día', 'Noche', 'Cualquiera',
    'impulsivo', '', 3, 8, 3, 40, 480,
    'Esperar 48h elimina el 80% de compras en rebajas',
    'ofertas_cazador_de_ofertas', 'easy', 'motivador', 'high'),
  q('Q_CO_05', 'Si hoy has ignorado una urgencia falsa tipo “últimas unidades” o “solo hoy”, ¿cuánto te has ahorrado?', 15,
    'Marketing', 'Cualquier día', 'Tarde', 'Cualquiera',
    'impulsivo', '', 2, 8, 3, 30, 360,
    'Las urgencias artificiales son manipulación pura',
    'marketing_cazador_de_ofertas', 'easy', 'motivador', 'high'),
  q('Q_CO_07', 'Si hoy has comprado con lista y no has añadido ofertas innecesarias, ¿cuánto te has ahorrado?', 10,
    'Compras', 'Sábado', 'Mañana', 'Cualquiera',
    'impulsivo', '', 3, 8, 7, 40, 480,
    'Solo con lista = sin extras innecesarios en oferta',
    'compras_cazador_de_ofertas', 'easy', 'neutral', 'medium'),
  q('Q_CO_12', 'Si hoy has respetado tu límite mensual para ofertas y caprichos rebajados, ¿cuánto te has ahorrado?', 20,
    'Control', 'Cualquier día', 'Mañana', 'Inicio',
    'impulsivo', '', 3, 8, 7, 40, 480,
    'Tope mensual de ofertas controla la hemorragia',
    'control_cazador_de_ofertas', 'easy', 'motivador', 'high'),
  q('Q_CO_02', 'Si hoy has ignorado emails o notificaciones de rebajas antes de caer en mirar, ¿cuánto te has ahorrado?', 10,
    'Marketing', 'Cualquier día', 'Mañana', 'Cualquiera',
    'impulsivo', '', 2, 7, 3, 20, 240,
    'No abrir emails de ofertas elimina la tentación',
    'marketing_cazador_de_ofertas', 'easy', 'motivador', 'medium'),
];

// ── MICROFUGAS (amount) ─────────────────────────────────────────────────
const Q_MICROFUGAS: DailyQuestion[] = [
  q('Q_MF_01', 'Si hoy has evitado el café de piloto automático y lo has preparado en casa, ¿cuánto te has ahorrado?', 2,
    'Cafés', 'Lunes a Viernes', 'Mañana', 'Cualquiera',
    'desordenado', '', 2, 8, 2, 40, 480,
    'El café diario fuera cuesta ~40 €/mes',
    'cafés_microfugas', 'easy', 'preventivo', 'low'),
  q('Q_MF_04', 'Si hoy has cancelado una suscripción que seguías pagando por inercia, ¿cuánto te ahorras al mes?', 8,
    'Suscripciones', 'Cualquier día', 'Mañana', 'Cualquiera',
    'desordenado', '', 3, 8, 14, 12, 144,
    'Las suscripciones olvidadas cuestan ~12 €/mes',
    'suscripciones_microfugas', 'satisfying', 'reflexivo', 'medium'),
  q('Q_MF_10', 'Si hoy has anotado gastos pequeños y evitado repetir una fuga detectada, ¿cuánto te has ahorrado?', 5,
    'Control', 'Cualquier día', 'Noche', 'Cualquiera',
    'desordenado', '', 3, 8, 3, 20, 240,
    'Anotar gastos pequeños da visibilidad real',
    'control_microfugas', 'obvious', 'preventivo', 'low'),
  q('Q_MF_15', 'Si hoy has eliminado o reducido un gasto invisible que repetías sin darte cuenta, ¿cuánto ahorras al mes?', 5,
    'Conciencia', 'Cualquier día', 'Noche', 'Cualquiera',
    'desordenado', '', 3, 8, 5, 20, 240,
    'Identificar microfugas es el primer paso para pararlas',
    'conciencia_microfugas', 'easy', 'neutral', 'low'),
  q('Q_MF_02', 'Si hoy has llevado snack o comida de casa y evitado compras sueltas, ¿cuánto te has ahorrado?', 4,
    'Snacks', 'Lunes a Viernes', 'Mañana', 'Cualquiera',
    'desordenado', '', 2, 7, 2, 48, 576,
    'Snacks sueltos cuestan ~48 €/mes',
    'snacks_microfugas', 'easy', 'motivador', 'low'),
  q('Q_MF_03', 'Si hoy has evitado la máquina, kiosco o cafetería automática por rutina, ¿cuánto te has ahorrado?', 2,
    'Vending', 'Lunes a Viernes', 'Tarde', 'Cualquiera',
    'desordenado', '', 2, 7, 2, 30, 360,
    'La máquina de vending cuesta ~30 €/mes',
    'vending_microfugas', 'obvious', 'preventivo', 'low'),
  q('Q_MF_06', 'Si hoy has pasado de entrar “solo a mirar” y evitaste una compra casual, ¿cuánto te has ahorrado?', 8,
    'Compras casuales', 'Cualquier día', 'Tarde', 'Cualquiera',
    'desordenado', '', 2, 7, 3, 24, 288,
    'Entrar "solo a mirar" casi nunca es gratis',
    'compras casuales_microfugas', 'easy', 'motivador', 'medium'),
];

// ── SIN SISTEMA (amount) ─────────────────────────────────────────────────
const Q_SIN_SISTEMA: DailyQuestion[] = [
  q('Q_SS_01', 'Si hoy has mirado tu saldo antes de gastar y eso te ha frenado, ¿cuánto te has ahorrado?', 10,
    'Control', 'Lunes', 'Mañana', 'Cualquiera',
    'desordenado', '', 3, 9, 7, 20, 240,
    'Mirar el saldo activa el control automático',
    'control_sin_sistema', 'obvious', 'preventivo', 'medium'),
  q('Q_SS_04', 'Si hoy has encontrado un cargo recurrente olvidado y lo has cancelado, ¿cuánto te ahorras al mes?', 10,
    'Suscripciones', 'Cualquier día', 'Mañana', 'Cualquiera',
    'desordenado', '', 3, 9, 14, 10, 120,
    'Los cargos olvidados roban dinero cada mes',
    'suscripciones_sin_sistema', 'easy', 'neutral', 'medium'),
  q('Q_SS_06', 'Si esta semana has usado un presupuesto y no has gastado a ciegas, ¿cuánto te has ahorrado?', 15,
    'Control', 'Lunes', 'Mañana', 'Cualquiera',
    'desordenado', '', 3, 9, 7, 30, 360,
    'Tener presupuesto semanal reduce el gasto un 15-20%',
    'control_sin_sistema', 'easy', 'motivador', 'high'),
  q('Q_SS_08', 'Si a final de mes has evitado un gasto para no quedarte justo, ¿cuánto te has ahorrado?', 10,
    'Fin de mes', 'Cualquier día', 'Tarde', 'Final',
    'desordenado', '', 3, 9, 5, 20, 240,
    'Controlar final de mes evita descubiertos',
    'fin de mes_sin_sistema', 'obvious', 'preventivo', 'medium'),
  q('Q_SS_02', 'Si hoy has puesto un límite diario antes de empezar a gastar y lo has respetado, ¿cuánto te has ahorrado?', 8,
    'Control', 'Lunes, Martes', 'Mañana', 'Cualquiera',
    'desordenado', '', 3, 8, 5, 32, 384,
    'Un límite diario evita derroches sin control',
    'control_sin_sistema', 'easy', 'motivador', 'medium'),
  q('Q_SS_03', 'Si hoy has revisado la semana y has eliminado un gasto repetido, ¿cuánto te has ahorrado?', 10,
    'Reflexión', 'Domingo', 'Mañana', 'Cualquiera',
    'desordenado', '', 3, 8, 7, 20, 240,
    'La revisión semanal reduce gastos innecesarios',
    'reflexión_sin_sistema', 'satisfying', 'reflexivo', 'medium'),
  q('Q_SS_09', 'Si este mes has separado gastos fijos y dinero variable antes de gastar, ¿cuánto te has ahorrado?', 15,
    'Organización', 'Cualquier día', 'Mañana', 'Inicio',
    'desordenado', '', 3, 8, 30, 30, 360,
    'Separar fijo de variable da claridad total',
    'organización_sin_sistema', 'easy', 'preventivo', 'high'),
  q('Q_SS_10', 'Si a mitad de mes has revisado lo que queda y has ajustado tus gastos, ¿cuánto te has ahorrado?', 10,
    'Control', 'Cualquier día', 'Mañana', 'Mitad',
    'desordenado', '', 3, 8, 14, 20, 240,
    'La revisión de mitad de mes evita sorpresas',
    'control_sin_sistema', 'satisfying', 'reflexivo', 'medium'),
];

// ── FILL BLANK ─────────────────────────────────────────────────────────────
const Q_FILL_BLANK: DailyQuestion[] = [
  {
    id: 'Q_FB_13', text: 'El gasto automático que hoy he evitado al salir de casa sin improvisar ha sido: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'he desayunado antes de salir', value: 'desayuno_casa', scores: { comodo: 2 } },
      { label: 'he llevado el café preparado en un termo', value: 'cafe_termo', scores: { comodo: 2 } },
      { label: 'he planificado la ruta para evitar tentaciones', value: 'ruta_plan', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 4, habitCategory: 'Rutina manana', bestDays: 'Lunes a Viernes', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 3, monthlyDelta: 48, yearlyDelta: 576,
    labelImpact: 'Salir de casa preparado ahorra ~48 EUR/mes',
    active: true, intent: 'gasto_evitado_manana', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_14', text: 'Cuando podía pagar por comodidad en transporte, hoy he elegido ahorrar con: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'transporte público en vez de taxi o Uber', value: 'transporte_pub', scores: { comodo: 2 } },
      { label: 'ir andando o en bicicleta', value: 'andar_bici', scores: { comodo: 2 } },
      { label: 'coordinarme con alguien para ir juntos', value: 'compartir_v', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 8, habitCategory: 'Transporte', bestDays: 'Lunes a Viernes', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 3, monthlyDelta: 64, yearlyDelta: 768,
    labelImpact: 'Evitar taxi ahorra ~64 EUR/mes',
    active: true, intent: 'gasto_evitado_transporte', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_15', text: 'Para no comprar en piloto automático en el supermercado, hoy he usado: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'con lista escrita, sin salirme de ella', value: 'lista_compra', scores: { comodo: 2 } },
      { label: 'en la tienda más barata del barrio', value: 'tienda_barata', scores: { comodo: 2 } },
      { label: 'revisando lo que ya tenía antes de ir', value: 'revisar_prev', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Compra supermercado', bestDays: 'Sabado, Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 5, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Comprar con lista ahorra ~30 EUR/mes',
    active: true, intent: 'gasto_evitado_compra_lista', habit_principle: 'obvious', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_17', text: 'Para evitar comprar comida fuera por falta de previsión, hoy he llevado: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'he calentado sobras del día anterior', value: 'sobras', scores: { comodo: 2 } },
      { label: 'he preparado algo rápido con lo que había', value: 'algo_rapido', scores: { comodo: 2 } },
      { label: 'he hecho batch cooking el finde para toda la semana', value: 'batch', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 7, habitCategory: 'Almuerzo', bestDays: 'Lunes a Viernes', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 3, monthlyDelta: 56, yearlyDelta: 672,
    labelImpact: 'Llevar almuerzo de casa ahorra ~56 EUR/mes',
    active: true, intent: 'gasto_evitado_almuerzo', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_20', text: 'Esta tarde-noche, el gasto por pereza que he cortado antes de caer ha sido: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'he cocinado en vez de pedir porque era lo fácil', value: 'cocinar_vs_pedir', scores: { comodo: 2 } },
      { label: 'he evitado el taxi tomando el metro o bus nocturno', value: 'metro_noche', scores: { comodo: 2 } },
      { label: 'he resistido el capricho de comprar algo para entretenerme', value: 'cap_entret', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Tarde-noche', bestDays: 'Lunes a Jueves', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 3, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Evitar la comodidad nocturna ahorra ~40 EUR/mes',
    active: true, intent: 'gasto_evitado_noche_comodo', habit_principle: 'obvious', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_21', text: 'Hoy he renunciado a la opción cómoda y he elegido la alternativa barata en: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'he cocinado en vez de pedir delivery o comida preparada', value: 'cocinar_vs_delivery', scores: { comodo: 2 } },
      { label: 'he usado transporte público en vez de taxi o Uber', value: 'tp_vs_taxi', scores: { comodo: 2 } },
      { label: 'he planificado la compra en vez de comprar sobre la marcha', value: 'planif_compra', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 8, habitCategory: 'Eleccion economica', bestDays: 'Lunes a Viernes', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 4, monthlyDelta: 48, yearlyDelta: 576,
    labelImpact: 'Elegir opciones economicas ahorra ~48 EUR/mes',
    active: true, intent: 'gasto_evitado_eleccion_econ', habit_principle: 'obvious', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_23', text: 'Para que la semana no me obligue a gastar por urgencia, hoy he preparado: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'he preparado los almuerzos del lunes al viernes', value: 'meal_prep', scores: { comodo: 2 } },
      { label: 'he tenido la ropa lista para no necesitar nada de urgencia', value: 'ropa_lista', scores: { comodo: 2 } },
      { label: 'he hecho el plan semanal para no improvisar gastos', value: 'plan_semanal', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Planificacion semanal', bestDays: 'Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 7, monthlyDelta: 60, yearlyDelta: 720,
    labelImpact: 'Preparar la semana ahorra ~60 EUR/mes',
    active: true, intent: 'gasto_evitado_prep_semana', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_24', text: 'Al salir de casa, he evitado el gasto rápido de conveniencia eligiendo: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'he comprado en el mercado en vez de en la gasolinera', value: 'mercado_vs_gas', scores: { comodo: 2 } },
      { label: 'he elegido el menú del día en vez de la carta', value: 'menu_dia', scores: { comodo: 2 } },
      { label: 'he comparado opciones antes de entrar al primer sitio', value: 'comparar_antes', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 5, habitCategory: 'Comida fuera economica', bestDays: 'Lunes a Viernes', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 4, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Menu del dia y mercado ahorra ~40 EUR/mes',
    active: true, intent: 'gasto_evitado_conveniencia_salida', habit_principle: 'obvious', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_25', text: 'Cuando el plan podía salir caro, he propuesto al grupo una alternativa más barata: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'quedar en casa de alguien en vez de ir al bar', value: 'casa_vs_bar', scores: { social: 2 } },
      { label: 'ir a una terraza más económica', value: 'terraza_eco', scores: { social: 2 } },
      { label: 'cocinar juntos en vez de ir a restaurante', value: 'cocinar_juntos', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Plan alternativo social', bestDays: 'Jueves, Viernes, Sabado', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Proponer plan economico ahorra ~30 EUR/mes',
    active: true, intent: 'gasto_evitado_plan_alternativo', habit_principle: 'attractive', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_26', text: 'En una comida o cena de grupo, he evitado pagar de más controlando: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'he pedido algo sencillo en vez del plato más caro', value: 'pedido_sencillo', scores: { social: 2 } },
      { label: 'he compartido entrantes en vez de pedir plato propio', value: 'compartir_plato', scores: { social: 2 } },
      { label: 'he decidido el tope de gasto antes de llegar y lo he cumplido', value: 'tope_previo', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 12, habitCategory: 'Cena de grupo', bestDays: 'Viernes, Sabado', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 5, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Controlar cena de grupo ahorra ~30 EUR/mes',
    active: true, intent: 'gasto_evitado_cena_grupo', habit_principle: 'obvious', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_27', text: 'He dicho que no a un plan caro que no quería de verdad y he elegido: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'me he quedado en casa sin gastar nada', value: 'quedado_casa', scores: { social: 2 } },
      { label: 'he propuesto otro plan más adelante más económico', value: 'plan_despues', scores: { social: 2 } },
      { label: 'he resistido la presión del grupo y salido ganando', value: 'resistir_grupo', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Decir no al plan', bestDays: 'Jueves, Viernes, Sabado', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Decir no a planes caros ahorra ~40 EUR/mes',
    active: true, intent: 'gasto_evitado_no_plan', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_28', text: 'Para que la vuelta de un plan nocturno no se comiera mi ahorro, he usado: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'he vuelto en metro o bus en vez de taxi', value: 'metro_vuelta', scores: { social: 2 } },
      { label: 'he coordinado con alguien para compartir transporte', value: 'compartir_taxi', scores: { social: 2 } },
      { label: 'he salido antes para coger el último metro', value: 'salir_antes', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Transporte nocturno', bestDays: 'Viernes, Sabado', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 5, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Metro vs taxi en la vuelta ahorra ~30 EUR/mes',
    active: true, intent: 'gasto_evitado_transporte_noche', habit_principle: 'obvious', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_29', text: 'En la última salida de fin de semana, el límite que me ayudó a no pasarme fue: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'he llevado efectivo limitado y no he sacado más', value: 'efectivo_lim', scores: { social: 2 } },
      { label: 'he pedido cuenta separada para no pagar de más', value: 'cuenta_sep', scores: { social: 2 } },
      { label: 'he decidido de antemano el tope de gasto del día', value: 'tope_dia', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Salida finde', bestDays: 'Lunes, Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 5, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Controlar el fin de semana ahorra ~40 EUR/mes',
    active: true, intent: 'gasto_evitado_control_finde', habit_principle: 'satisfying', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_31', text: 'En el último bar o restaurante, el gesto que evitó que gastara de más fue: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'he pedido agua o bebida sin alcohol parte de la noche', value: 'agua_noche', scores: { social: 2 } },
      { label: 'he evitado invitar rondas cuando no tocaba', value: 'no_ronda', scores: { social: 2 } },
      { label: 'he marcado un máximo de consumiciones y lo he cumplido', value: 'max_consumiciones', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Bar y restaurante', bestDays: 'Viernes, Sabado, Domingo', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Controlar consumiciones ahorra ~30 EUR/mes',
    active: true, intent: 'gasto_evitado_bar', habit_principle: 'obvious', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_33', text: 'La presión social que he resistido para no gastar de más ha sido: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'no unirme a la ronda cuando no me apetecía', value: 'no_ronda_presion', scores: { social: 2 } },
      { label: 'no participar en la compra colectiva del grupo', value: 'no_compra_grupo', scores: { social: 2 } },
      { label: 'no comprar lo que todos compraban solo por no quedar mal', value: 'no_presion_compra', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Presion social evitada', bestDays: 'Viernes, Sabado, Domingo', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Resistir presion de grupo ahorra ~30 EUR/mes',
    active: true, intent: 'gasto_evitado_presion_grupo', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_35', text: 'En una salida nocturna, he frenado la escalada de gasto evitando: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'no he seguido la escalada de bares y copas del grupo', value: 'no_escalada', scores: { social: 2 } },
      { label: 'me he ido a casa antes sin sentirme presionado/a', value: 'ido_antes', scores: { social: 2 } },
      { label: 'he rechazado el último local más caro al que iban', value: 'no_local_caro', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Escalada social nocturna', bestDays: 'Viernes, Sabado', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 5, monthlyDelta: 45, yearlyDelta: 540,
    labelImpact: 'Cortar la escalada nocturna ahorra ~45 EUR/mes',
    active: true, intent: 'gasto_evitado_escalada_nocturna', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_36', text: 'He liderado un plan social más económico proponiendo: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'una barbacoa o cena en casa del grupo', value: 'bbq_casa', scores: { social: 2 } },
      { label: 'una actividad gratuita: parque, mercado, ruta', value: 'activ_gratis', scores: { social: 2 } },
      { label: 'una tarde de juegos o películas en casa', value: 'juegos_casa', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 25, habitCategory: 'Plan social barato', bestDays: 'Viernes, Sabado, Domingo', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 7, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Liderar plan economico ahorra ~50 EUR/mes',
    active: true, intent: 'gasto_evitado_plan_liderado', habit_principle: 'attractive', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_37', text: 'He detectado que el carrito era impulso y lo he vaciado antes de comprar: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'ropa o moda que no necesitaba realmente', value: 'carrito_ropa', scores: { impulsivo: 2 } },
      { label: 'electrónica o tecnología que parecía imprescindible', value: 'carrito_tech', scores: { impulsivo: 2 } },
      { label: 'artículos de hogar o decoración que me gustaron', value: 'carrito_deco', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 35, habitCategory: 'Carrito abandonado', bestDays: 'Cualquier dia', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 70, yearlyDelta: 840,
    labelImpact: 'Abandonar carritos ahorra ~70 EUR/mes',
    active: true, intent: 'gasto_evitado_carrito', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_38', text: 'Tras esperar 24 horas, he decidido no comprar porque: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'porque ya no lo quería al día siguiente', value: 'ya_no_queria', scores: { impulsivo: 2 } },
      { label: 'porque he encontrado alternativa más barata', value: 'alternativa_24h', scores: { impulsivo: 2 } },
      { label: 'porque me he dado cuenta de que ya tenía algo similar', value: 'ya_tenia_similar', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 25, habitCategory: 'Regla 24h', bestDays: 'Cualquier dia', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 5, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'La regla de 24h ahorra ~50 EUR/mes',
    active: true, intent: 'gasto_evitado_24h', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_40', text: 'He visto algo en redes y he frenado la compra impulsiva relacionada con: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'un producto que vi en Instagram o TikTok', value: 'redes_producto', scores: { impulsivo: 2 } },
      { label: 'algo que promocionaba un influencer o anuncio', value: 'influencer', scores: { impulsivo: 2 } },
      { label: 'un plan o experiencia que parecía imprescindible', value: 'exp_social', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 25, habitCategory: 'Compra por redes sociales', bestDays: 'Cualquier dia', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 75, yearlyDelta: 900,
    labelImpact: 'Evitar compras de redes ahorra ~75 EUR/mes',
    active: true, intent: 'gasto_evitado_redes', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_42', text: 'Antes de comprar para compensar una emoción, he parado este impulso: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'cuando estaba aburrido o sin hacer nada', value: 'compra_aburrido', scores: { impulsivo: 2 } },
      { label: 'cuando estaba estresado y quería liberarme', value: 'compra_estres', scores: { impulsivo: 2 } },
      { label: 'cuando vi algo bonito sin tener ninguna necesidad', value: 'compra_capricho', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Compra emocional', bestDays: 'Cualquier dia', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 60, yearlyDelta: 720,
    labelImpact: 'Parar compras emocionales ahorra ~60 EUR/mes',
    active: true, intent: 'gasto_evitado_compra_emocional', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_43', text: 'He puesto fricción a una tentación digital eliminando o bloqueando: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'he desinstalado la app de compras del móvil', value: 'desinstalar_app', scores: { impulsivo: 2 } },
      { label: 'he borrado la tarjeta guardada en la web de tienda', value: 'borrar_tarjeta', scores: { impulsivo: 2 } },
      { label: 'he cancelado las notificaciones de ofertas', value: 'cancelar_noti', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 0, habitCategory: 'Friccion compra digital', bestDays: 'Cualquier dia', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 14, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Poner friccion digital ahorra ~30 EUR/mes',
    active: true, intent: 'gasto_evitado_friccion_digital', habit_principle: 'obvious', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_46', text: 'Antes de confirmar una compra grande, he esperado y he evitado: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'un artículo de más de 100€ que creía necesitar', value: 'espera_100', scores: { impulsivo: 2 } },
      { label: 'una suscripción o servicio de pago anual', value: 'espera_sub', scores: { impulsivo: 2 } },
      { label: 'algo que vi en feria, mercadillo o tienda pop-up', value: 'espera_feria', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 80, habitCategory: 'Compra grande evitada', bestDays: 'Cualquier dia', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 10, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Esperar antes de compra grande ahorra ~30 EUR/mes',
    active: true, intent: 'gasto_evitado_espera_grande', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_48', text: 'He reconocido que era una oferta, no una necesidad, y he evitado comprar: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'ropa o complementos con descuento que no necesitaba', value: 'oferta_ropa', scores: { impulsivo: 2 } },
      { label: 'tecnología o gadget rebajado que me pareció ganga', value: 'oferta_tech', scores: { impulsivo: 2 } },
      { label: 'algo de hogar o decoración en rebajas', value: 'oferta_hogar', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 30, habitCategory: 'Oferta resistida', bestDays: 'Cualquier dia', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 5, monthlyDelta: 45, yearlyDelta: 540,
    labelImpact: 'Resistir ofertas sin necesidad ahorra ~45 EUR/mes',
    active: true, intent: 'gasto_evitado_oferta_resistida', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_49', text: 'Esta semana he cortado una fuga mensual cancelando o reduciendo: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'de streaming o entretenimiento digital', value: 'cancel_streaming', scores: { desordenado: 2 } },
      { label: 'de servicios digitales o apps premium', value: 'cancel_app', scores: { desordenado: 2 } },
      { label: 'de entrega periódica física que había olvidado', value: 'cancel_fisico', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Suscripciones', bestDays: 'Cualquier dia', bestTimeWindow: 'Mañana',
    monthPhase: 'Inicio', targetAvatarPrimary: 'desordenado',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 14, monthlyDelta: 15, yearlyDelta: 180,
    labelImpact: 'Cancelar suscripciones sin uso ahorra ~15 EUR/mes',
    active: true, intent: 'gasto_evitado_suscripcion_desordenado', habit_principle: 'satisfying', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_50', text: 'He encontrado un cobro recurrente que seguía vivo por descuido: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'una prueba gratuita que se había convertido en pago', value: 'trial_cobro', scores: { desordenado: 2 } },
      { label: 'un servicio que dejé de usar pero nunca cancelé', value: 'servicio_olv', scores: { desordenado: 2 } },
      { label: 'una tarifa que podía reducir llamando al proveedor', value: 'tarifa_red', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 12, habitCategory: 'Cobros olvidados', bestDays: 'Cualquier dia', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'desordenado',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 14, monthlyDelta: 20, yearlyDelta: 240,
    labelImpact: 'Detectar cobros olvidados ahorra ~20 EUR/mes',
    active: true, intent: 'gasto_evitado_cobro_olvidado', habit_principle: 'satisfying', tone: 'reflexivo', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_51', text: 'Para no pagar de más por improvisar, he planificado con antelación: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'he preparado el menú semanal y la lista de la compra', value: 'menu_semana', scores: { desordenado: 2 } },
      { label: 'he revisado los gastos previstos del mes', value: 'rev_gastos', scores: { desordenado: 2 } },
      { label: 'he preparado ropa y material para no comprar de urgencia', value: 'prep_urgencia', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Planificacion semanal', bestDays: 'Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'desordenado',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 7, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Planificar la semana ahorra ~40 EUR/mes',
    active: true, intent: 'gasto_evitado_planif_semana', habit_principle: 'obvious', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_52', text: 'Al revisar el banco, he descubierto una zona clara de ahorro en: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'en cargos automáticos que no había detectado', value: 'cargos_auto', scores: { desordenado: 2 } },
      { label: 'en gastos de conveniencia que sumaban más de lo que pensaba', value: 'gastos_conv_rev', scores: { desordenado: 2 } },
      { label: 'en compras de impulso que podría haber evitado', value: 'impulso_rev', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Revision extracto', bestDays: 'Domingo, Lunes', bestTimeWindow: 'Mañana',
    monthPhase: 'Final', targetAvatarPrimary: 'desordenado',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 14, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Revisar extracto mensual ahorra ~30 EUR/mes',
    active: true, intent: 'gasto_evitado_extracto', habit_principle: 'satisfying', tone: 'reflexivo', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_53', text: 'Esta semana he ordenado mi dinero para no gastar a ciegas mediante: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'he separado el dinero para gastos fijos antes de gastar lo demás', value: 'sep_fijos', scores: { desordenado: 2 } },
      { label: 'he anotado todos mis gastos del día', value: 'anotar_gst', scores: { desordenado: 2 } },
      { label: 'he marcado un límite para una categoría en la que me pasaba', value: 'limite_cat', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 0, habitCategory: 'Organizacion financiera', bestDays: 'Lunes, Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Inicio', targetAvatarPrimary: 'desordenado',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 7, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Organizar el dinero en categorias ahorra ~50 EUR/mes',
    active: true, intent: 'gasto_evitado_organizacion', habit_principle: 'obvious', tone: 'reflexivo', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_54', text: 'He evitado un gasto de emergencia que habría nacido por no prever: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'tenía ya en casa lo que necesitaba para la semana', value: 'casa_prep', scores: { desordenado: 2 } },
      { label: 'había planificado comidas sin necesitar comprar fuera urgente', value: 'comida_prev', scores: { desordenado: 2 } },
      { label: 'había preparado alternativa por si el plan fallaba', value: 'plan_b', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Gasto de emergencia evitado', bestDays: 'Cualquier dia', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'desordenado',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 5, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Prevenir emergencias ahorra ~30 EUR/mes',
    active: true, intent: 'gasto_evitado_emergencia', habit_principle: 'obvious', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_55', text: 'En el supermercado, he evitado gastar de más usando esta barrera: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'he ido con lista y no he cogido nada más', value: 'lista_estricta', scores: { desordenado: 2 } },
      { label: 'he hecho la compra online para evitar impulsos del pasillo', value: 'compra_online_plan', scores: { desordenado: 2 } },
      { label: 'he evitado el pasillo de ofertas y productos capricho', value: 'evitar_pasillo', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Compra con lista', bestDays: 'Sabado, Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'desordenado',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 7, monthlyDelta: 45, yearlyDelta: 540,
    labelImpact: 'Comprar con lista fija ahorra ~45 EUR/mes',
    active: true, intent: 'gasto_evitado_compra_con_lista', habit_principle: 'obvious', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_57', text: 'Al revisar el mes, he encontrado margen real de ahorro en: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'gastos de ocio y entretenimiento', value: 'ocio_margen', scores: { desordenado: 2 } },
      { label: 'gastos de alimentación y restauración', value: 'comida_margen', scores: { desordenado: 2 } },
      { label: 'gastos de ropa y caprichos personales', value: 'ropa_margen', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Revision mensual', bestDays: 'Domingo, Lunes', bestTimeWindow: 'Mañana',
    monthPhase: 'Final', targetAvatarPrimary: 'desordenado',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 30, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Auditoria mensual ahorra ~40 EUR/mes',
    active: true, intent: 'gasto_evitado_auditoria_mensual', habit_principle: 'satisfying', tone: 'reflexivo', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_61', text: 'Cuando iba a pedir delivery por cansancio, he resuelto la comida en casa con: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'pasta rápida con lo que había', value: 'pasta_rapida', scores: { comodo: 2 } },
      { label: 'una tortilla o huevos revueltos', value: 'tortilla', scores: { comodo: 2 } },
      { label: 'sobras de la nevera que aún estaban bien', value: 'sobras_nevera', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Delivery evitado', bestDays: 'Cualquier día', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 3, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Improvisar en casa evita ~4 pedidos/mes',
    active: true, intent: 'gasto_evitado_delivery_improvisa', habit_principle: 'easy', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_62', text: 'Para no pagar transporte de conveniencia, he elegido una alternativa barata para: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'el trabajo (metro o bus en vez de taxi)', value: 'trabajo_metro', scores: { comodo: 2 } },
      { label: 'una salida (bici o andando)', value: 'salida_bici', scores: { comodo: 2 } },
      { label: 'un recado cercano (andando)', value: 'recado_andando', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 7, habitCategory: 'Transporte económico', bestDays: 'Lunes a Viernes', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 3, monthlyDelta: 28, yearlyDelta: 336,
    labelImpact: 'Sustituir 1 taxi diario ahorra ~28 EUR/mes',
    active: true, intent: 'gasto_evitado_transporte_eco', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_63', text: 'He preparado la semana para no gastar de urgencia en este punto débil: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'comida (meal prep del domingo)', value: 'comida_semana', scores: { comodo: 2 } },
      { label: 'ropa (lista la noche anterior)', value: 'ropa_prep', scores: { comodo: 2 } },
      { label: 'gestiones que dejo para el último momento', value: 'gestiones_ant', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Planificación semanal', bestDays: 'Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 7, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Preparar la semana evita gastos de urgencia ~50 EUR/mes',
    active: true, intent: 'gasto_evitado_planif_urgencia', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_65', text: 'Antes de ir al súper por impulso, he aprovechado lo que ya tenía usando: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'arroz, pasta o legumbres que tenía', value: 'arroz_verduras', scores: { comodo: 2 } },
      { label: 'una lata o conserva que estaba olvidada', value: 'lata_aprovechada', scores: { comodo: 2 } },
      { label: 'algo del congelador que tenía pendiente', value: 'congelado_util', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 8, habitCategory: 'Aprovechamiento despensa', bestDays: 'Cualquier día', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 4, monthlyDelta: 32, yearlyDelta: 384,
    labelImpact: 'Aprovechar despensa evita ~4 compras extra/mes',
    active: true, intent: 'gasto_evitado_despensa', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_66', text: 'He rechazado un extra que me ofrecieron aunque parecía cómodo o fácil: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'seguro o garantía extendida', value: 'seguro_extra', scores: { comodo: 2 } },
      { label: 'envío exprés (no urgía)', value: 'envio_express', scores: { comodo: 2 } },
      { label: 'accesorio o upgrade del producto', value: 'garantia_extendida', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 8, habitCategory: 'Upsell rechazado', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 5, monthlyDelta: 16, yearlyDelta: 192,
    labelImpact: 'Rechazar upsells ahorra ~16 EUR/mes',
    active: true, intent: 'gasto_evitado_upsell_rechazo', habit_principle: 'obvious', tone: 'preventivo', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_67', text: 'He ahorrado haciendo yo mismo algo que normalmente delegaría pagando: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'limpieza o mantenimiento del hogar', value: 'limpieza_casa', scores: { comodo: 2 } },
      { label: 'arreglo de ropa o costura', value: 'arreglo_ropa', scores: { comodo: 2 } },
      { label: 'un corte de pelo o cuidado personal', value: 'corte_pelo_casa', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'DIY ahorro', bestDays: 'Sábado, Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 7, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'DIY mensual ahorra ~30 EUR/mes',
    active: true, intent: 'gasto_evitado_diy', habit_principle: 'easy', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_68', text: 'He elegido la opción básica en vez de pagar por la versión premium de: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'un producto (marca blanca vs marca)', value: 'producto_marca_blanca', scores: { comodo: 2 } },
      { label: 'un plan o app (básico en vez de premium)', value: 'plan_basico_app', scores: { comodo: 2 } },
      { label: 'un dispositivo (modelo anterior o básico)', value: 'modelo_anterior', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Versión básica elegida', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 5, monthlyDelta: 25, yearlyDelta: 300,
    labelImpact: 'Elegir básico ahorra ~25 EUR/mes',
    active: true, intent: 'gasto_evitado_version_basica', habit_principle: 'obvious', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_69', text: 'He mantenido el plan social sin disparar el gasto organizando en casa: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'cena en casa (cocinamos juntos)', value: 'cena_casa', scores: { social: 2 } },
      { label: 'película o serie en casa', value: 'pelicula_casa', scores: { social: 2 } },
      { label: 'juegos de mesa o actividad en casa', value: 'juegos_mesa', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Plan en casa', bestDays: 'Viernes, Sábado, Domingo', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 5, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Plan en casa vs fuera ahorra ~50 EUR/mes',
    active: true, intent: 'gasto_evitado_plan_casa', habit_principle: 'attractive', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_70', text: 'Antes de salir, he comunicado un límite para no seguir el gasto del grupo en: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'el límite de gasto de la noche', value: 'limite_noche', scores: { social: 2 } },
      { label: 'el tope máximo de la cena', value: 'tope_cena', scores: { social: 2 } },
      { label: 'el máximo por consumición o copa', value: 'max_consumicion', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Límite social comunicado', bestDays: 'Viernes, Sábado', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 5, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Comunicar límite evita sobregastos grupales',
    active: true, intent: 'gasto_evitado_limite_comunicado', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_73', text: 'Me he ido a tiempo para evitar que la noche siguiera drenando dinero en: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'copas extra de madrugada', value: 'copas_extra', scores: { social: 2 } },
      { label: 'taxi de vuelta muy caro', value: 'taxi_noche', scores: { social: 2 } },
      { label: 'after o local improvisado más caro', value: 'after_improvisado', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Salida a tiempo', bestDays: 'Sábado, Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 5, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Salir antes evita escalada de gasto nocturno',
    active: true, intent: 'gasto_evitado_salida_tiempo', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_74', text: 'He elegido un sitio sencillo para no convertir una quedada normal en gasto caro: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'terraza del barrio o bar local', value: 'terraza_barrio', scores: { social: 2 } },
      { label: 'café o vermú sencillo', value: 'cafe_sencillo', scores: { social: 2 } },
      { label: 'sitio de toda la vida más barato', value: 'bar_local', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Bar económico elegido', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 4, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Bar del barrio vs caro ahorra ~30 EUR/mes',
    active: true, intent: 'gasto_evitado_bar_economico', habit_principle: 'attractive', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_75', text: 'He evitado pagar de más por la cuenta del grupo haciendo: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'pedí cuenta separada', value: 'cuenta_separada', scores: { social: 2 } },
      { label: 'pagué solo lo mío (sin ronda)', value: 'pagar_lo_mio', scores: { social: 2 } },
      { label: 'usamos una app para dividir bien', value: 'app_split', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'División justa cuenta', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 5, monthlyDelta: 20, yearlyDelta: 240,
    labelImpact: 'Dividir bien la cuenta evita pagar de más',
    active: true, intent: 'gasto_evitado_cuenta_justa', habit_principle: 'satisfying', tone: 'reflexivo', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_76', text: 'He propuesto una actividad gratuita para sustituir un plan de pago como: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'deporte en el parque o cancha gratis', value: 'deporte_parque', scores: { social: 2 } },
      { label: 'ruta de senderismo o paseo en grupo', value: 'ruta_senderismo', scores: { social: 2 } },
      { label: 'barbacoa o picnic en casa/parque', value: 'bbq_casa', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 25, habitCategory: 'Actividad gratuita liderada', bestDays: 'Sábado, Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 7, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Liderar actividad gratis ahorra ~50 EUR/mes',
    active: true, intent: 'gasto_evitado_actividad_gratis', habit_principle: 'attractive', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_77', text: 'He cerrado una app o web justo antes de entrar en modo compra impulsiva en: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'Amazon o Aliexpress', value: 'amazon_cerrado', scores: { impulsivo: 2 } },
      { label: 'tienda de ropa online', value: 'zara_cerrado', scores: { impulsivo: 2 } },
      { label: 'app de comida o delivery', value: 'tienda_comida', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 30, habitCategory: 'App cerrada sin comprar', bestDays: 'Cualquier día', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 3, monthlyDelta: 60, yearlyDelta: 720,
    labelImpact: 'Cerrar app sin comprar evita ~60 EUR/mes',
    active: true, intent: 'gasto_evitado_app_cerrada', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_78', text: 'He esperado antes de comprar y el motivo real para no hacerlo fue: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'ya no lo quería tanto', value: 'ya_no_lo_queria', scores: { impulsivo: 2 } },
      { label: 'encontré una alternativa más barata', value: 'encontre_alternativa', scores: { impulsivo: 2 } },
      { label: 'me di cuenta de que ya tenía algo similar', value: 'ya_tenia_similar', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 25, habitCategory: 'Decisión de espera', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 5, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Esperar antes de comprar ahorra ~50 EUR/mes',
    active: true, intent: 'gasto_evitado_espera_decision', habit_principle: 'obvious', tone: 'reflexivo', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_79', text: 'He visto publicidad o una historia en redes y no he comprado: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'un producto de Instagram o TikTok', value: 'producto_instagram', scores: { impulsivo: 2 } },
      { label: 'ropa o accesorio de un influencer', value: 'ropa_tiktok', scores: { impulsivo: 2 } },
      { label: 'un plan o servicio anunciado', value: 'plan_anuncio', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 25, habitCategory: 'Publicidad ignorada', bestDays: 'Cualquier día', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Ignorar publicidad en redes ahorra ~50 EUR/mes',
    active: true, intent: 'gasto_evitado_publicidad_redes', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_80', text: 'He hecho la pregunta incómoda “¿lo necesito?” y no he comprado: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'una prenda de ropa nueva', value: 'ropa_nueva', scores: { impulsivo: 2 } },
      { label: 'un gadget o accesorio tech', value: 'gadget_tech', scores: { impulsivo: 2 } },
      { label: 'un artículo de decoración', value: 'accesorio_hogar', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 30, habitCategory: 'Reflexión antes de comprar', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 60, yearlyDelta: 720,
    labelImpact: 'Reflexionar antes de comprar ahorra ~60 EUR/mes',
    active: true, intent: 'gasto_evitado_reflexion_compra', habit_principle: 'obvious', tone: 'reflexivo', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_81', text: 'He reducido tentaciones futuras desactivando avisos relacionados con: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'alertas de ofertas de Amazon o tiendas', value: 'alertas_amazon', scores: { impulsivo: 2 } },
      { label: 'notificaciones de ropa o moda', value: 'noti_ropa', scores: { impulsivo: 2 } },
      { label: 'emails de ofertas y newsletters', value: 'email_ofertas', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 0, habitCategory: 'Fricción digital añadida', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo',
    scenarioWeight: 2, priorityBase: 8, cooldownDays: 14, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Desactivar notificaciones reduce compras impulsivas',
    active: true, intent: 'gasto_evitado_notif_desactivadas', habit_principle: 'obvious', tone: 'preventivo', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_82', text: 'He evitado pagar de más por novedad eligiendo segunda mano en: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'ropa o complementos (Vinted, Wallapop)', value: 'ropa_segunda', scores: { impulsivo: 2 } },
      { label: 'libro o juego (segunda mano)', value: 'libro_segunda', scores: { impulsivo: 2 } },
      { label: 'mueble o artículo de hogar', value: 'mueble_segunda', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Segunda mano elegida', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo',
    scenarioWeight: 2, priorityBase: 8, cooldownDays: 7, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Segunda mano ahorra ~40 EUR/mes',
    active: true, intent: 'gasto_evitado_segunda_mano', habit_principle: 'easy', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_83', text: 'He frenado una compra emocional al reconocer que venía de: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'aburrimiento o falta de estímulo', value: 'aburrimiento', scores: { impulsivo: 2 } },
      { label: 'estrés o mal día en el trabajo', value: 'estres_laboral', scores: { impulsivo: 2 } },
      { label: 'presión del grupo o ganas de encajar', value: 'presion_social', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Compra emocional frenada', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 60, yearlyDelta: 720,
    labelImpact: 'Identificar emocion detras de la compra la para',
    active: true, intent: 'gasto_evitado_compra_emocional_reconocida', habit_principle: 'obvious', tone: 'reflexivo', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_84', text: 'He usado algo que ya tenía en vez de comprar otra vez para: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'vestirme (ropa del armario que no usaba)', value: 'ropa_armario', scores: { impulsivo: 2 } },
      { label: 'una tarea (herramienta que ya tenía)', value: 'herramienta_casa', scores: { impulsivo: 2 } },
      { label: 'un uso (producto viejo aún útil)', value: 'producto_viejo', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Reutilizar lo que hay', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo',
    scenarioWeight: 2, priorityBase: 8, cooldownDays: 5, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Reutilizar antes de comprar ahorra ~30 EUR/mes',
    active: true, intent: 'gasto_evitado_reutilizar', habit_principle: 'easy', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_85', text: 'He encontrado un servicio activo que me cobraba sin aportarme valor: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'gimnasio o clases que no iba', value: 'gym_no_usado', scores: { desordenado: 2 } },
      { label: 'app o herramienta olvidada', value: 'app_olvidada', scores: { desordenado: 2 } },
      { label: 'servicio con renovación automática', value: 'servicio_aut', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Servicio cancelado', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Inicio', targetAvatarPrimary: 'desordenado',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 14, monthlyDelta: 25, yearlyDelta: 300,
    labelImpact: 'Cancelar servicios sin usar ahorra ~25 EUR/mes',
    active: true, intent: 'gasto_evitado_servicio_cancelado', habit_principle: 'satisfying', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_86', text: 'Al revisar mis finanzas, he identificado un patrón de fuga en: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'suscripciones o cargos automáticos', value: 'suscripciones_rev', scores: { desordenado: 2 } },
      { label: 'gastos hormiga del día a día', value: 'gastos_hormiga', scores: { desordenado: 2 } },
      { label: 'gastos de comodidad innecesarios', value: 'comodidad_innec', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 0, habitCategory: 'Revisión financiera activa', bestDays: 'Domingo, Lunes', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'desordenado',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 7, monthlyDelta: 35, yearlyDelta: 420,
    labelImpact: 'Revisar finanzas semanalmente identifica ahorros',
    active: true, intent: 'gasto_evitado_revision_finanzas', habit_principle: 'satisfying', tone: 'reflexivo', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_87', text: 'Antes de comprar, he comparado y he elegido mejor precio en: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'supermercado (marca blanca vs marca)', value: 'supermercado_comp', scores: { desordenado: 2 } },
      { label: 'seguro o contrato (comparador online)', value: 'seguro_comp', scores: { desordenado: 2 } },
      { label: 'un servicio o producto de ocio', value: 'servicio_comp', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Comparación de precios', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'desordenado',
    scenarioWeight: 2, priorityBase: 8, cooldownDays: 5, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Comparar precios ahorra ~30 EUR/mes',
    active: true, intent: 'gasto_evitado_comparacion_precios', habit_principle: 'obvious', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_88', text: 'He puesto presupuesto a una categoría donde suelo perder control: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'presupuesto de ocio del mes', value: 'presup_ocio', scores: { desordenado: 2 } },
      { label: 'presupuesto de alimentación', value: 'presup_comida', scores: { desordenado: 2 } },
      { label: 'presupuesto de ropa', value: 'presup_ropa', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 0, habitCategory: 'Presupuesto por categoría', bestDays: 'Domingo, Lunes', bestTimeWindow: 'Mañana',
    monthPhase: 'Inicio', targetAvatarPrimary: 'desordenado',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 30, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Tener presupuesto por categoria limita el gasto',
    active: true, intent: 'gasto_evitado_presupuesto_categoria', habit_principle: 'obvious', tone: 'reflexivo', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_90', text: 'Antes de renovar por inercia, he buscado o negociado una mejor opción en: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'tarifa de móvil o internet', value: 'movil_renegoc', scores: { desordenado: 2 } },
      { label: 'seguro (coche, hogar, salud)', value: 'seguro_renegoc', scores: { desordenado: 2 } },
      { label: 'tarifa de luz o gas', value: 'internet_renegoc', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Negociación de contratos', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Inicio', targetAvatarPrimary: 'desordenado',
    scenarioWeight: 2, priorityBase: 8, cooldownDays: 30, monthlyDelta: 20, yearlyDelta: 240,
    labelImpact: 'Renegociar tarifas ahorra ~20 EUR/mes',
    active: true, intent: 'gasto_evitado_negociacion', habit_principle: 'satisfying', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_91', text: 'En una auditoría rápida del mes, he descubierto una fuga concreta: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'gastos hormiga que no controlaba', value: 'gasto_hormiga_mes', scores: { desordenado: 2 } },
      { label: 'suscripción innecesaria que cancelaré', value: 'sub_innecesaria', scores: { desordenado: 2 } },
      { label: 'un impulso grande del que no era consciente', value: 'impulso_grande', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Auditoría mensual rápida', bestDays: 'Domingo, Lunes', bestTimeWindow: 'Mañana',
    monthPhase: 'Final', targetAvatarPrimary: 'desordenado',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 30, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Auditoria mensual identifica 30 EUR/mes de margen',
    active: true, intent: 'gasto_evitado_auditoria_rapida', habit_principle: 'satisfying', tone: 'reflexivo', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_92', text: 'He automatizado el ahorro para no depender de motivación o fuerza de voluntad con: ____.',
    format: 'fill_blank' as const,
    blankOptions: [
      { label: 'transferencia automática a cuenta ahorro', value: 'transferencia_aut', scores: { desordenado: 2 } },
      { label: 'regla de redondeo o ahorro inteligente', value: 'regla_redondeo', scores: { desordenado: 2 } },
      { label: 'cuenta separada de ahorros sin tarjeta', value: 'cuenta_ahorro_sep', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 50, habitCategory: 'Ahorro automático', bestDays: 'Domingo, Lunes', bestTimeWindow: 'Mañana',
    monthPhase: 'Inicio', targetAvatarPrimary: 'desordenado',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 30, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Ahorro automatico asegura consistencia sin esfuerzo',
    active: true, intent: 'gasto_evitado_ahorro_automatico', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
];

export const DAILY_QUESTIONS_BANK: DailyQuestion[] = [
  ...Q_CONVENIENCIA,
  ...Q_IMPROVISADOR,
  ...Q_FOMO_SOCIAL,
  ...Q_PLAN_ALARGA,
  ...Q_ANTOJO_EMO,
  ...Q_CAZADOR_OFERTAS,
  ...Q_MICROFUGAS,
  ...Q_SIN_SISTEMA,
  ...Q_FILL_BLANK,
];

/** Banco activo: solo preguntas con active:true */
export const ACTIVE_QUESTIONS_BANK: DailyQuestion[] =
  DAILY_QUESTIONS_BANK.filter(q => q.active);

/** Buscar una pregunta por ID */
export function getQuestionById(id: string): DailyQuestion | undefined {
  return DAILY_QUESTIONS_BANK.find(q => q.id === id);
}
