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
   * 'fill_blank' = frase con hueco + desplegable de 3 opciones orientadas a un gasto evitado
   *                Opción 1 y 2 refuerzan avatar principal, Opción 3 apunta a avatar secundario.
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
  /** Avatar secundario — eliminado, siempre vacío */
  targetAvatarSecondary:     AvatarKey | '';
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
// Los nuevos metadatos se derivan automáticamente de los campos existentes
function q(
  id: string, text: string, suggestedAmount: number,
  habitCategory: string, bestDays: string, bestTimeWindow: string, monthPhase: string,
  ap: AvatarKey, as2: AvatarKey | '',
  scenarioWeight: number, priorityBase: number, cooldownDays: number,
  monthlyDelta: number, yearlyDelta: number, labelImpact: string,
): DailyQuestion {
  // Auto-derivar intent de habitCategory
  const intent = habitCategory.toLowerCase();

  // Auto-derivar habit_principle del tono/contenido
  let habit_principle: HabitPrinciple = 'easy';
  if (text.includes('evitad') || text.includes('resistid') || text.includes('cerrado')) habit_principle = 'obvious';
  else if (text.includes('reflexi') || text.includes('revisad') || text.includes('revis')) habit_principle = 'satisfying';
  else if (text.includes('propuesto') || text.includes('racha') || text.includes('celebr')) habit_principle = 'attractive';

  // Auto-derivar tone
  let tone: QuestionTone = 'neutral';
  if (text.includes('racha') || text.includes('progreso') || text.includes('celebr')) tone = 'celebratorio';
  else if (text.includes('reflexi') || text.includes('revis') || text.includes('Domingo')) tone = 'reflexivo';
  else if (text.includes('evitad') || text.includes('parad') || text.includes('resisti')) tone = 'preventivo';
  else if (text.includes('ahorrad') || text.includes('consegui')) tone = 'motivador';

  // Auto-derivar difficulty del suggestedAmount
  let difficulty: QuestionDifficulty = 'low';
  if (suggestedAmount >= 15) difficulty = 'high';
  else if (suggestedAmount >= 6) difficulty = 'medium';

  return {
    id, text, suggestedAmount, habitCategory, bestDays, bestTimeWindow, monthPhase,
    targetAvatarPrimary: ap, targetAvatarSecondary: as2,
    scenarioWeight, priorityBase, cooldownDays, monthlyDelta, yearlyDelta, labelImpact,
    format: 'amount',
    // Metadatos IA auto-derivados
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
const Q_CONVENIENCIA: DailyQuestion[] = [
  q('Q_CI_01', 'Si hoy has cocinado en casa en vez de pedir delivery, ¿cuánto te has ahorrado?', 12, 'Delivery', 'Lunes, Martes, Miércoles, Jueves', 'Noche', 'Cualquiera', 'comodo', '', 3, 9, 2, 48, 576, 'Evitar 1 pedido semanal ahorra ~48 €/mes'),
  q('Q_CI_02', 'Si hoy te has preparado el café en casa en vez de comprarlo fuera, ¿cuánto te has ahorrado?', 3, 'Cafés', 'Lunes a Viernes', 'Mañana', 'Cualquiera', 'comodo', '', 2, 7, 2, 45, 540, 'Café en casa cada día laborable ahorra ~45 €/mes'),
  q('Q_CI_03', 'Si hoy has ido andando o en transporte público en vez de coger taxi/VTC, ¿cuánto te has ahorrado?', 8, 'Transporte', 'Lunes a Viernes', 'Mañana', 'Cualquiera', 'comodo', '', 2, 7, 3, 32, 384, 'Evitar 1 taxi semanal ahorra ~32 €/mes'),
  q('Q_CI_04', 'Si hoy has llevado comida de casa al trabajo en vez de comprar fuera, ¿cuánto te has ahorrado?', 8, 'Comida', 'Lunes a Viernes', 'Mañana', 'Cualquiera', 'comodo', '', 3, 8, 2, 64, 768, 'Llevar táper 2 días más por semana ahorra ~64 €/mes'),
  q('Q_CI_05', 'Si esta noche has cenado algo sencillo de casa en vez de pedir comida, ¿cuánto te has ahorrado?', 10, 'Delivery', 'Viernes, Sábado', 'Noche', 'Cualquiera', 'comodo', '', 3, 8, 3, 40, 480, 'Evitar delivery de fin de semana ahorra ~40 €/mes'),
  q('Q_CI_06', 'Si hoy has revisado la nevera antes de abrir la app de delivery, ¿cuánto te has ahorrado?', 12, 'Delivery', 'Cualquier día', 'Noche', 'Cualquiera', 'comodo', '', 3, 8, 3, 36, 432, 'Revisar nevera antes de pedir evita ~3 pedidos/mes'),
  q('Q_CI_13', 'Si hoy has evitado un gasto por comodidad (envío rápido, taxi corto, snack de máquina…), ¿cuánto?', 5, 'Comodidad', 'Martes, Miércoles, Jueves', 'Tarde', 'Cualquiera', 'comodo', '', 2, 7, 3, 20, 240, 'Evitar gastos de comodidad ahorra ~20 €/mes'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// 2. CÓMODO / IMPROVISADOR — 15 preguntas
//    No planifica, acaba gastando más de lo necesario por falta de previsión
//    Días: entre semana (decisiones de comida). Momentos: antes de comer/cenar
// ═══════════════════════════════════════════════════════════════════════════════
const Q_IMPROVISADOR: DailyQuestion[] = [
  q('Q_IM_01', 'Si hoy has planificado la cena en vez de decidir a última hora (delivery/fuera), ¿cuánto te has ahorrado?', 10, 'Planificación', 'Lunes, Martes, Miércoles, Jueves', 'Tarde', 'Cualquiera', 'comodo', '', 3, 8, 2, 40, 480, 'Planificar cena evita delivery impulsivo'),
  q('Q_IM_02', 'Si hoy ya tenías pensado qué comer y no has improvisado comprando fuera, ¿cuánto te has ahorrado?', 8, 'Planificación', 'Lunes a Viernes', 'Mañana', 'Cualquiera', 'comodo', '', 3, 8, 2, 48, 576, 'Planificar comida ahorra ~48 €/mes'),
  q('Q_IM_03', 'Si hoy has preparado comida para aprovechar sobras en vez de comprar nuevo, ¿cuánto te has ahorrado?', 6, 'Sobras', 'Cualquier día', 'Noche', 'Cualquiera', 'comodo', '', 2, 7, 3, 24, 288, 'Usar sobras evita ~6 compras innecesarias/mes'),
  q('Q_IM_07', 'Si hoy has planificado los menús de la semana, ¿cuánto crees que ahorrarás?', 15, 'Planificación', 'Domingo', 'Mañana', 'Cualquiera', 'comodo', '', 3, 9, 7, 60, 720, 'Meal prep semanal ahorra ~60 €/mes'),
  q('Q_IM_08', 'Si hoy, al pensar "me pido algo", has parado y cocinado algo rápido, ¿cuánto te has ahorrado?', 10, 'Delivery', 'Cualquier día', 'Noche', 'Cualquiera', 'comodo', '', 3, 8, 3, 30, 360, 'Parar y cocinar evita pedidos impulsivos'),
  q('Q_IM_13', 'Si te ha dado pereza cocinar pero has hecho algo rápido en casa igualmente, ¿cuánto te has ahorrado?', 10, 'Delivery', 'Lunes, Martes, Miércoles', 'Noche', 'Cualquiera', 'comodo', '', 3, 8, 3, 30, 360, 'Algo rápido en casa siempre es más barato que delivery'),
  q('Q_IM_14', 'Si hoy has precocinado batch para varios días, ¿cuánto crees que ahorrarás esta semana?', 20, 'Planificación', 'Domingo', 'Tarde', 'Cualquiera', 'comodo', '', 3, 9, 7, 60, 720, 'Batch cooking semanal ahorra ~60 €/mes'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SOCIAL / FOMO SOCIAL — 15 preguntas
//    Dice que sí a todo por miedo a perdérselo, gasta en planes sociales
//    Días: Jueves–Sábado (planes). Momentos: Tarde (decisiones) y Noche (salidas)
// ═══════════════════════════════════════════════════════════════════════════════
const Q_FOMO: DailyQuestion[] = [
  q('Q_FS_01', 'Si hoy te han propuesto un plan caro y has dicho que no o propuesto algo más barato, ¿cuánto te has ahorrado?', 15, 'Planes sociales', 'Jueves, Viernes, Sábado', 'Tarde', 'Cualquiera', 'social', '', 3, 9, 3, 60, 720, 'Decir no a 1 plan caro al mes ahorra ~60 €'),
  q('Q_FS_02', 'Si hoy has cenado en casa antes de salir con amigos para gastar menos fuera, ¿cuánto te has ahorrado?', 12, 'Planes sociales', 'Viernes, Sábado', 'Tarde', 'Cualquiera', 'social', '', 3, 9, 3, 48, 576, 'Cenar antes de salir ahorra ~12 € por noche'),
  q('Q_FS_03', 'Si hoy has propuesto un plan gratuito o barato a tus amigos en vez de uno caro, ¿cuánto te has ahorrado?', 15, 'Planes sociales', 'Viernes, Sábado, Domingo', 'Tarde', 'Cualquiera', 'social', '', 3, 8, 4, 45, 540, 'Proponer planes baratos ahorra ~45 €/mes'),
  q('Q_FS_04', 'Si hoy has salido con un presupuesto máximo y lo has respetado, ¿cuánto te has ahorrado vs lo que hubieras gastado?', 10, 'Control social', 'Viernes, Sábado', 'Tarde', 'Cualquiera', 'social', '', 3, 8, 3, 40, 480, 'Salir con presupuesto ahorra ~40 €/mes'),
  q('Q_FS_05', 'Si hoy has elegido un plan de domingo gratuito (parque, paseo, casa) en vez de pagar, ¿cuánto te has ahorrado?', 12, 'Ocio gratis', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'social', '', 2, 7, 4, 36, 432, 'Planes gratis de fin de semana ahorran ~36 €/mes'),
  q('Q_FS_06', 'Si hoy has dicho que no a un plan que realmente no te apetecía (solo ibas por quedar bien), ¿cuánto?', 20, 'FOMO', 'Jueves, Viernes, Sábado', 'Tarde', 'Cualquiera', 'social', '', 3, 9, 4, 40, 480, 'Decir no a planes por compromiso ahorra mucho'),
  q('Q_FS_10', 'Si acabas de cobrar y has evitado un plan social caro para no caer en la euforia del cobro, ¿cuánto?', 20, 'Post-cobro', 'Cualquier día', 'Tarde', 'Inicio', 'social', '', 3, 8, 7, 30, 360, 'Controlar post-cobro evita excesos'),
  q('Q_FS_12', 'Si hoy te has ido a tu hora en vez de quedarte "un rato más" gastando, ¿cuánto te has ahorrado?', 10, 'Planes sociales', 'Viernes, Sábado', 'Noche', 'Cualquiera', 'social', '', 3, 8, 3, 40, 480, 'Irse a la hora prevista evita el gasto extra'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SOCIAL / PLAN QUE SE ALARGA — 15 preguntas
//    El plan empieza barato pero escala: segunda ronda, cambio de sitio, taxis
//    Días: Viernes–Sábado (noches). Momentos: Noche (cuando escala)
// ═══════════════════════════════════════════════════════════════════════════════
const Q_PLAN_ALARGA: DailyQuestion[] = [
  q('Q_PA_01', 'Si anoche te fuiste a tu hora en vez de quedarte a "una más", ¿cuánto te has ahorrado?', 12, 'Escalada social', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'social', '', 3, 9, 3, 48, 576, 'Irse a la hora planeada evita 2-3 copas extra'),
  q('Q_PA_02', 'Si anoche evitaste la segunda ronda de copas, ¿cuánto te has ahorrado?', 10, 'Escalada social', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'social', '', 3, 9, 3, 40, 480, 'Saltarse la segunda ronda ahorra ~10 € por noche'),
  q('Q_PA_04', 'Si anoche os quedasteis en un solo sitio en vez de ir cambiando de bar, ¿cuánto te has ahorrado?', 12, 'Escalada social', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'social', '', 3, 8, 3, 36, 432, 'Cada cambio de bar suma ~10-15 € extra'),
  q('Q_PA_05', 'Si hoy antes de salir te has puesto un tope de gasto para esta noche, ¿cuánto crees que ahorrarás?', 10, 'Control previo', 'Viernes, Sábado', 'Tarde', 'Cualquiera', 'social', '', 3, 8, 3, 40, 480, 'Ponerse un tope antes de salir funciona'),
  q('Q_PA_09', 'Si anoche pediste la cuenta antes de que el plan escalara, ¿cuánto te has ahorrado?', 10, 'Escalada social', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'social', '', 3, 8, 3, 30, 360, 'Pedir la cuenta a tiempo frena la escalada'),
  q('Q_PA_12', 'Si anoche dijiste "yo paso" cuando el grupo quería seguir la fiesta, ¿cuánto te has ahorrado?', 15, 'Escalada social', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'social', '', 3, 9, 3, 45, 540, 'Saber decir "yo paso" es el mayor ahorro social'),
  q('Q_PA_14', 'Si esta noche piensas salir, ¿ya tienes hora de vuelta definida? Si la respetas, ¿cuánto ahorrarás?', 10, 'Control previo', 'Viernes, Sábado', 'Tarde', 'Cualquiera', 'social', '', 3, 8, 3, 40, 480, 'Hora de vuelta definida = gasto controlado'),
  q('Q_PA_15', 'Si anoche te quedaste en un solo plan en vez de hacer bar-hopping, ¿cuánto te has ahorrado?', 15, 'Escalada social', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'social', '', 3, 8, 3, 45, 540, 'Quedarse en un sitio vs bar-hopping ahorra mucho'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// 5. IMPULSIVO / ANTOJO EMOCIONAL — 15 preguntas
//    Compra por capricho, emoción, aburrimiento o ansiedad
//    Días: cualquiera (el impulso no tiene día fijo). Momentos: noche (online)
// ═══════════════════════════════════════════════════════════════════════════════
const Q_ANTOJO: DailyQuestion[] = [
  q('Q_AE_01', 'Si hoy has cerrado una app de compras sin comprar nada, ¿cuánto te has ahorrado?', 20, 'Compra online', 'Cualquier día', 'Noche', 'Cualquiera', 'impulsivo', '', 3, 9, 2, 40, 480, 'Cerrar la app sin comprar ahorra ~40 €/mes'),
  q('Q_AE_02', 'Si hoy has visto algo que querías y has aplicado la regla de esperar 24h, ¿cuánto te has ahorrado?', 25, 'Impulso', 'Cualquier día', 'Noche', 'Cualquiera', 'impulsivo', '', 3, 9, 3, 50, 600, 'La regla de 24h evita el 70% de compras impulsivas'),
  q('Q_AE_03', 'Si hoy has vaciado tu carrito online sin comprar, ¿cuánto te has ahorrado?', 30, 'Compra online', 'Cualquier día', 'Noche', 'Cualquiera', 'impulsivo', '', 3, 8, 3, 60, 720, 'Vaciar el carrito en vez de pagar ahorra mucho'),
  q('Q_AE_04', 'Si hoy has sentido ganas de comprarte algo por estrés/ansiedad y no lo has hecho, ¿cuánto?', 15, 'Emocional', 'Cualquier día', 'Noche', 'Cualquiera', 'impulsivo', '', 3, 9, 3, 30, 360, 'Reconocer compra emocional es el primer paso'),
  q('Q_AE_05', 'Si hoy has evitado un capricho de comida/bebida (snack, café especial, dulce), ¿cuánto te has ahorrado?', 4, 'Caprichos', 'Cualquier día', 'Tarde', 'Cualquiera', 'impulsivo', '', 2, 7, 2, 48, 576, 'Los caprichos diarios suman mucho al mes'),
  q('Q_AE_06', 'Si hoy has salido a caminar/hacer deporte en vez de comprar para "sentirte mejor", ¿cuánto?', 10, 'Emocional', 'Cualquier día', 'Tarde', 'Cualquiera', 'impulsivo', '', 2, 7, 4, 20, 240, 'El deporte gratis sustituye al shopping emocional'),
  q('Q_AE_08', 'Si hoy no has abierto apps de compras (Amazon, Shein, Zara…), ¿cuánto te has ahorrado?', 15, 'Compra online', 'Cualquier día', 'Mañana', 'Cualquiera', 'impulsivo', '', 3, 8, 3, 30, 360, 'No abrir apps de compras elimina la tentación'),
  q('Q_AE_13', 'Si hoy has dejado pasar una "oportunidad" de comprar algo que no necesitabas, ¿cuánto?', 20, 'Impulso', 'Cualquier día', 'Tarde', 'Cualquiera', 'impulsivo', '', 3, 8, 4, 40, 480, 'Dejar pasar "oportunidades" ahorra mucho a largo plazo'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// 6. IMPULSIVO / CAZADOR DE OFERTAS — 15 preguntas
//    Compra cosas que no necesita solo porque están en oferta/rebaja/2x1
//    Días: cualquiera. Momentos: tarde (tiendas), noche (online)
// ═══════════════════════════════════════════════════════════════════════════════
const Q_CAZADOR: DailyQuestion[] = [
  q('Q_CO_01', 'Si hoy has visto una oferta y has decidido no comprar porque no lo necesitabas, ¿cuánto te has ahorrado?', 15, 'Ofertas', 'Cualquier día', 'Tarde', 'Cualquiera', 'impulsivo', '', 3, 9, 2, 30, 360, 'No picar en ofertas innecesarias ahorra ~30 €/mes'),
  q('Q_CO_02', 'Si hoy has borrado o ignorado emails de rebajas/ofertas sin abrirlos, ¿cuánto te has ahorrado?', 10, 'Marketing', 'Cualquier día', 'Mañana', 'Cualquiera', 'impulsivo', '', 2, 7, 3, 20, 240, 'No abrir emails de ofertas elimina la tentación'),
  q('Q_CO_04', 'Si hoy has visto algo en rebajas y has esperado 48h antes de decidir, ¿cuánto te has ahorrado?', 20, 'Ofertas', 'Cualquier día', 'Noche', 'Cualquiera', 'impulsivo', '', 3, 8, 3, 40, 480, 'Esperar 48h elimina el 80% de compras en rebajas'),
  q('Q_CO_05', 'Si hoy has ignorado notificaciones de "Flash Sale" o "Últimas unidades", ¿cuánto te has ahorrado?', 15, 'Marketing', 'Cualquier día', 'Tarde', 'Cualquiera', 'impulsivo', '', 2, 8, 3, 30, 360, 'Las urgencias artificiales son manipulación pura'),
  q('Q_CO_07', 'Si hoy has ido a la compra solo con lista y no has comprado cosas en oferta que no necesitabas, ¿cuánto?', 10, 'Compras', 'Sábado', 'Mañana', 'Cualquiera', 'impulsivo', '', 3, 8, 7, 40, 480, 'Solo con lista = sin extras innecesarios en oferta'),
  q('Q_CO_08', 'Si hoy has pensado "¿lo compraría sin descuento?" y la respuesta era no, ¿cuánto te has ahorrado?', 15, 'Reflexión', 'Cualquier día', 'Tarde', 'Cualquiera', 'impulsivo', '', 3, 9, 3, 30, 360, 'Si no lo comprarías a precio normal, no lo necesitas'),
  q('Q_CO_12', 'Si a principios de mes has fijado un tope para "ofertas" y hoy lo has respetado, ¿cuánto has ahorrado?', 20, 'Control', 'Cualquier día', 'Mañana', 'Inicio', 'impulsivo', '', 3, 8, 7, 40, 480, 'Tope mensual de ofertas controla la hemorragia'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// 7. DESORDENADO / MICROFUGAS — 15 preguntas
//    Pequeños gastos diarios que no controla y que suman mucho
//    Días: entre semana (rutina diaria). Momentos: mañana (cafés) y tarde (snacks)
// ═══════════════════════════════════════════════════════════════════════════════
const Q_MICROFUGAS: DailyQuestion[] = [
  q('Q_MF_01', 'Si hoy te has preparado el café en casa en vez de comprarlo, ¿cuánto te has ahorrado?', 2, 'Cafés', 'Lunes a Viernes', 'Mañana', 'Cualquiera', 'desordenado', '', 2, 8, 2, 40, 480, 'El café diario fuera cuesta ~40 €/mes'),
  q('Q_MF_02', 'Si hoy has traído comida/snacks de casa en vez de comprar algo suelto, ¿cuánto te has ahorrado?', 4, 'Snacks', 'Lunes a Viernes', 'Mañana', 'Cualquiera', 'desordenado', '', 2, 7, 2, 48, 576, 'Snacks sueltos cuestan ~48 €/mes'),
  q('Q_MF_03', 'Si hoy has evitado la máquina de vending/cafetería automática, ¿cuánto te has ahorrado?', 2, 'Vending', 'Lunes a Viernes', 'Tarde', 'Cualquiera', 'desordenado', '', 2, 7, 2, 30, 360, 'La máquina de vending cuesta ~30 €/mes'),
  q('Q_MF_04', 'Si hoy has revisado suscripciones y cancelado alguna que no usas, ¿cuánto te ahorras al mes?', 8, 'Suscripciones', 'Cualquier día', 'Mañana', 'Cualquiera', 'desordenado', '', 3, 8, 14, 12, 144, 'Las suscripciones olvidadas cuestan ~12 €/mes'),
  q('Q_MF_06', 'Si hoy has pasado por una tienda sin entrar "a mirar" y acabar comprando algo, ¿cuánto te has ahorrado?', 8, 'Compras casuales', 'Cualquier día', 'Tarde', 'Cualquiera', 'desordenado', '', 2, 7, 3, 24, 288, 'Entrar "solo a mirar" casi nunca es gratis'),
  q('Q_MF_10', 'Si esta noche has apuntado todos los gastos pequeños del día, ¿cuánto has detectado que podrías haber evitado?', 5, 'Control', 'Cualquier día', 'Noche', 'Cualquiera', 'desordenado', '', 3, 8, 3, 20, 240, 'Anotar gastos pequeños da visibilidad real'),
  q('Q_MF_15', 'Si hoy has identificado un gasto "invisible" que haces todos los días sin pensar, ¿cuánto es al mes?', 5, 'Conciencia', 'Cualquier día', 'Noche', 'Cualquiera', 'desordenado', '', 3, 8, 5, 20, 240, 'Identificar microfugas es el primer paso para pararlas'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// 8. DESORDENADO / SIN SISTEMA — 15 preguntas
//    No tiene presupuesto ni control, el dinero se va sin saber a dónde
//    Días: Lunes (inicio semana), Domingo (revisión), fin de mes
//    Momentos: Mañana (moment de claridad)
// ═══════════════════════════════════════════════════════════════════════════════
const Q_SIN_SISTEMA: DailyQuestion[] = [
  q('Q_SS_01', 'Si hoy has mirado tu saldo bancario y has evitado un gasto por ser consciente, ¿cuánto te has ahorrado?', 10, 'Control', 'Lunes', 'Mañana', 'Cualquiera', 'desordenado', '', 3, 9, 7, 20, 240, 'Mirar el saldo activa el control automático'),
  q('Q_SS_02', 'Si hoy te has puesto un límite de gasto para el día y lo has respetado, ¿cuánto te has ahorrado?', 8, 'Control', 'Lunes, Martes', 'Mañana', 'Cualquiera', 'desordenado', '', 3, 8, 5, 32, 384, 'Un límite diario evita derroches sin control'),
  q('Q_SS_03', 'Si hoy domingo has revisado lo que has gastado esta semana, ¿cuánto crees que puedes mejorar la próxima?', 10, 'Reflexión', 'Domingo', 'Mañana', 'Cualquiera', 'desordenado', '', 3, 8, 7, 20, 240, 'La revisión semanal reduce gastos innecesarios'),
  q('Q_SS_04', 'Si hoy has descubierto un cargo recurrente que no sabías que tenías y lo has cancelado, ¿cuánto?', 10, 'Suscripciones', 'Cualquier día', 'Mañana', 'Cualquiera', 'desordenado', '', 3, 9, 14, 10, 120, 'Los cargos olvidados roban dinero cada mes'),
  q('Q_SS_06', 'Si esta semana te has fijado un presupuesto semanal, ¿cuánto has ahorrado vs no tener ninguno?', 15, 'Control', 'Lunes', 'Mañana', 'Cualquiera', 'desordenado', '', 3, 9, 7, 30, 360, 'Tener presupuesto semanal reduce el gasto un 15-20%'),
  q('Q_SS_08', 'Si estás a final de mes y has evitado un gasto para no quedarte justo, ¿cuánto te has ahorrado?', 10, 'Fin de mes', 'Cualquier día', 'Tarde', 'Final', 'desordenado', '', 3, 9, 5, 20, 240, 'Controlar final de mes evita descubiertos'),
  q('Q_SS_09', 'Si a principio de mes has separado dinero fijo (alquiler, facturas) del variable, ¿cuánto te has ahorrado?', 15, 'Organización', 'Cualquier día', 'Mañana', 'Inicio', 'desordenado', '', 3, 8, 30, 30, 360, 'Separar fijo de variable da claridad total'),
  q('Q_SS_10', 'Si a mitad de mes has revisado cuánto te queda y has ajustado tus gastos, ¿cuánto has ahorrado?', 10, 'Control', 'Cualquier día', 'Mañana', 'Mitad', 'desordenado', '', 3, 8, 14, 20, 240, 'La revisión de mitad de mes evita sorpresas'),
];



// ═══════════════════════════════════════════════════════════════════════════════
// 9. PREGUNTAS FILL_BLANK — 12 preguntas orientadas a registrar ahorros
//
//    Cada pregunta tiene un hueco que el usuario completa con un desplegable.
//    Las opciones representan gastos evitados.
//    Estructura de opciones por pregunta:
//      Opción 1 → refuerza avatar principal
//      Opción 2 → refuerza avatar principal
//      Opción 3 → apunta a avatar secundario
//      Otro     → respuesta libre analizada por IA (allowOther: true)
// ═══════════════════════════════════════════════════════════════════════════════
const Q_FILL_BLANK: DailyQuestion[] = [
  // ── Cómodo / Conveniencia ──────────────────────────────────────────────
  {
    id: 'Q_FB_01',
    format: 'fill_blank',
    text: 'Hoy he evitado gastar dinero en ____.',
    blankOptions: [
      { label: 'un café fuera de casa',          value: 'cafe',     scores: { comodo: 2 } },
      { label: 'un desayuno de camino al trabajo', value: 'desayuno', scores: { comodo: 2 } },
      { label: 'un capricho impulsivo',           value: 'capricho', scores: { comodo: 2 } },
    ],
    allowOther: true,
    otherRequiresAI: true,
    aiConfidenceThreshold: 0.70,
    suggestedAmount: 3,
    habitCategory: 'Cafés y desayunos',
    bestDays: 'Lunes a Viernes',
    bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera',
    targetAvatarPrimary: 'comodo',
    targetAvatarSecondary: '',
    scenarioWeight: 3,
    priorityBase: 9,
    cooldownDays: 3,
    monthlyDelta: 45,
    yearlyDelta: 540,
    labelImpact: 'Evitar cafés fuera ahorra ~45 €/mes',
    active: true,
    intent: 'gasto_evitado_cafe',
    habit_principle: 'obvious',
    tone: 'motivador',
    difficulty: 'low',
    experimental: false,
  },
  {
    id: 'Q_FB_02',
    format: 'fill_blank',
    text: 'Esta semana he preparado en casa lo que normalmente compraba fuera: ____.',
    blankOptions: [
      { label: 'el almuerzo para el trabajo',     value: 'almuerzo',  scores: { comodo: 2 } },
      { label: 'el café o infusión de la mañana', value: 'cafe_casa', scores: { comodo: 2 } },
      { label: 'la compra con lista en vez de improvisar', value: 'compra_lista', scores: { comodo: 2 } },
    ],
    allowOther: true,
    otherRequiresAI: true,
    aiConfidenceThreshold: 0.70,
    suggestedAmount: 8,
    habitCategory: 'Planificación comidas',
    bestDays: 'Lunes a Viernes',
    bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera',
    targetAvatarPrimary: 'comodo',
    targetAvatarSecondary: '',
    scenarioWeight: 3,
    priorityBase: 9,
    cooldownDays: 4,
    monthlyDelta: 64,
    yearlyDelta: 768,
    labelImpact: 'Preparar comida en casa ahorra ~64 €/mes',
    active: true,
    intent: 'gasto_evitado_comida_casa',
    habit_principle: 'easy',
    tone: 'motivador',
    difficulty: 'low',
    experimental: false,
  },
  // ── Social / FOMO ──────────────────────────────────────────────────────
  {
    id: 'Q_FB_03',
    format: 'fill_blank',
    text: 'Hoy he dicho no a un gasto social que no necesitaba: ____.',
    blankOptions: [
      { label: 'una ronda de más en el bar',        value: 'ronda',       scores: { social: 2 } },
      { label: 'un plan caro que no me apetecía',   value: 'plan_caro',   scores: { social: 2 } },
      { label: 'una compra impulsiva con el grupo',  value: 'compra_grupo', scores: { social: 2 } },
    ],
    allowOther: true,
    otherRequiresAI: true,
    aiConfidenceThreshold: 0.70,
    suggestedAmount: 10,
    habitCategory: 'Control gasto social',
    bestDays: 'Viernes, Sábado, Domingo',
    bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera',
    targetAvatarPrimary: 'social',
    targetAvatarSecondary: '',
    scenarioWeight: 3,
    priorityBase: 9,
    cooldownDays: 3,
    monthlyDelta: 40,
    yearlyDelta: 480,
    labelImpact: 'Controlar el gasto social ahorra ~40 €/mes',
    active: true,
    intent: 'gasto_evitado_social',
    habit_principle: 'obvious',
    tone: 'motivador',
    difficulty: 'medium',
    experimental: false,
  },
  {
    id: 'Q_FB_04',
    format: 'fill_blank',
    text: 'Este fin de semana he controlado mejor el gasto en ____.',
    blankOptions: [
      { label: 'consumiciones y copas',              value: 'copas',       scores: { social: 2 } },
      { label: 'comidas y cenas fuera',              value: 'restaurante', scores: { social: 2 } },
      { label: 'taxis y desplazamientos nocturnos',  value: 'taxi_noche',  scores: { social: 2 } },
    ],
    allowOther: true,
    otherRequiresAI: true,
    aiConfidenceThreshold: 0.70,
    suggestedAmount: 15,
    habitCategory: 'Ocio fin de semana',
    bestDays: 'Lunes, Domingo',
    bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera',
    targetAvatarPrimary: 'social',
    targetAvatarSecondary: '',
    scenarioWeight: 3,
    priorityBase: 9,
    cooldownDays: 5,
    monthlyDelta: 45,
    yearlyDelta: 540,
    labelImpact: 'Controlar el fin de semana ahorra ~45 €/mes',
    active: true,
    intent: 'gasto_evitado_finde',
    habit_principle: 'satisfying',
    tone: 'motivador',
    difficulty: 'medium',
    experimental: false,
  },
  // ── Impulsivo / Antojo ──────────────────────────────────────────────────
  {
    id: 'Q_FB_05',
    format: 'fill_blank',
    text: 'Hoy he resistido la tentación de comprar ____.',
    blankOptions: [
      { label: 'algo que vi en redes sociales',    value: 'redes',      scores: { impulsivo: 2 } },
      { label: 'una oferta que «no podía perder»', value: 'oferta',     scores: { impulsivo: 2 } },
      { label: 'algo que me recomendó alguien',    value: 'recomendado', scores: { impulsivo: 2 } },
    ],
    allowOther: true,
    otherRequiresAI: true,
    aiConfidenceThreshold: 0.70,
    suggestedAmount: 20,
    habitCategory: 'Resistencia al impulso',
    bestDays: 'Cualquier día',
    bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera',
    targetAvatarPrimary: 'impulsivo',
    targetAvatarSecondary: '',
    scenarioWeight: 3,
    priorityBase: 9,
    cooldownDays: 4,
    monthlyDelta: 60,
    yearlyDelta: 720,
    labelImpact: 'Resistir impulsos ahorra ~60 €/mes',
    active: true,
    intent: 'gasto_evitado_impulso',
    habit_principle: 'obvious',
    tone: 'motivador',
    difficulty: 'high',
    experimental: false,
  },
  {
    id: 'Q_FB_06',
    format: 'fill_blank',
    text: 'He cerrado sin comprar una app, web o tienda donde pensaba gastar en ____.',
    blankOptions: [
      { label: 'ropa o accesorios',             value: 'ropa',       scores: { impulsivo: 2 } },
      { label: 'tecnología o gadgets',           value: 'gadget',     scores: { impulsivo: 2 } },
      { label: 'decoración u objetos para casa', value: 'deco',       scores: { impulsivo: 2 } },
    ],
    allowOther: true,
    otherRequiresAI: true,
    aiConfidenceThreshold: 0.70,
    suggestedAmount: 25,
    habitCategory: 'Compra online evitada',
    bestDays: 'Cualquier día',
    bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera',
    targetAvatarPrimary: 'impulsivo',
    targetAvatarSecondary: '',
    scenarioWeight: 3,
    priorityBase: 9,
    cooldownDays: 4,
    monthlyDelta: 80,
    yearlyDelta: 960,
    labelImpact: 'Cerrar carritos sin comprar ahorra ~80 €/mes',
    active: true,
    intent: 'gasto_evitado_online',
    habit_principle: 'obvious',
    tone: 'motivador',
    difficulty: 'high',
    experimental: false,
  },
  // ── Desordenado / Microfugas ──────────────────────────────────────────
  {
    id: 'Q_FB_07',
    format: 'fill_blank',
    text: 'Hoy he identificado y parado un gasto pequeño que hacía de forma automática: ____.',
    blankOptions: [
      { label: 'una suscripción que no usaba',         value: 'suscripcion', scores: { desordenado: 2 } },
      { label: 'algo que compraba por inercia cada día', value: 'inercia',    scores: { desordenado: 2 } },
      { label: 'un snack o bebida del trabajo',         value: 'snack',      scores: { desordenado: 2 } },
    ],
    allowOther: true,
    otherRequiresAI: true,
    aiConfidenceThreshold: 0.70,
    suggestedAmount: 5,
    habitCategory: 'Microfugas detectadas',
    bestDays: 'Cualquier día',
    bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera',
    targetAvatarPrimary: 'desordenado',
    targetAvatarSecondary: '',
    scenarioWeight: 3,
    priorityBase: 9,
    cooldownDays: 5,
    monthlyDelta: 20,
    yearlyDelta: 240,
    labelImpact: 'Detectar microfugas ahorra ~20 €/mes',
    active: true,
    intent: 'gasto_evitado_microfuga',
    habit_principle: 'obvious',
    tone: 'motivador',
    difficulty: 'low',
    experimental: false,
  },
  {
    id: 'Q_FB_08',
    format: 'fill_blank',
    text: 'Al revisar mis gastos esta semana, he encontrado que podía ahorrar en ____.',
    blankOptions: [
      { label: 'pagos recurrentes o tarifas olvidadas', value: 'recurrente', scores: { desordenado: 2 } },
      { label: 'gastos de conveniencia que se acumulan', value: 'conveniencia', scores: { desordenado: 2 } },
      { label: 'compras por impulso que no recuerdo',    value: 'impulso_olvidado', scores: { desordenado: 2 } },
    ],
    allowOther: true,
    otherRequiresAI: true,
    aiConfidenceThreshold: 0.70,
    suggestedAmount: 10,
    habitCategory: 'Revisión de gastos',
    bestDays: 'Domingo, Lunes',
    bestTimeWindow: 'Mañana',
    monthPhase: 'Final',
    targetAvatarPrimary: 'desordenado',
    targetAvatarSecondary: '',
    scenarioWeight: 3,
    priorityBase: 9,
    cooldownDays: 7,
    monthlyDelta: 25,
    yearlyDelta: 300,
    labelImpact: 'Revisar gastos semanalmente ahorra ~25 €/mes',
    active: true,
    intent: 'gasto_evitado_revision',
    habit_principle: 'satisfying',
    tone: 'reflexivo',
    difficulty: 'low',
    experimental: false,
  },
  // ── Cómodo / Delivery ──────────────────────────────────────────────────
  {
    id: 'Q_FB_09',
    format: 'fill_blank',
    text: 'Hoy he cocinado o me he organizado en vez de pedir o comprar fuera: ____.',
    blankOptions: [
      { label: 'he cocinado lo que tenía en la nevera', value: 'nevera',   scores: { comodo: 2 } },
      { label: 'he llevado táper al trabajo',            value: 'taper',    scores: { comodo: 2 } },
      { label: 'he planificado la cena con antelación',  value: 'planif',   scores: { comodo: 2 } },
    ],
    allowOther: true,
    otherRequiresAI: true,
    aiConfidenceThreshold: 0.70,
    suggestedAmount: 10,
    habitCategory: 'Delivery evitado',
    bestDays: 'Lunes a Viernes',
    bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera',
    targetAvatarPrimary: 'comodo',
    targetAvatarSecondary: '',
    scenarioWeight: 3,
    priorityBase: 9,
    cooldownDays: 3,
    monthlyDelta: 48,
    yearlyDelta: 576,
    labelImpact: 'Evitar delivery ahorra ~48 €/mes',
    active: true,
    intent: 'gasto_evitado_delivery',
    habit_principle: 'easy',
    tone: 'motivador',
    difficulty: 'medium',
    experimental: false,
  },
  // ── Impulsivo / Suscripciones y ofertas ───────────────────────────────
  {
    id: 'Q_FB_10',
    format: 'fill_blank',
    text: 'Hoy he ignorado o cancelado algo que no usaba de verdad: ____.',
    blankOptions: [
      { label: 'una suscripción de streaming o app',  value: 'streaming',   scores: { impulsivo: 2 } },
      { label: 'una prueba gratuita que iba a cobrar', value: 'trial',       scores: { impulsivo: 2 } },
      { label: 'una tarifa que podía reducir',         value: 'tarifa',      scores: { impulsivo: 2 } },
    ],
    allowOther: true,
    otherRequiresAI: true,
    aiConfidenceThreshold: 0.70,
    suggestedAmount: 8,
    habitCategory: 'Suscripciones canceladas',
    bestDays: 'Cualquier día',
    bestTimeWindow: 'Mañana',
    monthPhase: 'Inicio',
    targetAvatarPrimary: 'impulsivo',
    targetAvatarSecondary: '',
    scenarioWeight: 3,
    priorityBase: 8,
    cooldownDays: 14,
    monthlyDelta: 12,
    yearlyDelta: 144,
    labelImpact: 'Cancelar suscripciones sin uso ahorra ~12 €/mes',
    active: true,
    intent: 'gasto_evitado_suscripcion',
    habit_principle: 'satisfying',
    tone: 'motivador',
    difficulty: 'low',
    experimental: false,
  },
  // ── Social / Presión de grupo ──────────────────────────────────────────
  {
    id: 'Q_FB_11',
    format: 'fill_blank',
    text: 'Hoy he propuesto una alternativa más barata al plan del grupo: ____.',
    blankOptions: [
      { label: 'quedar en casa en vez de ir al bar',        value: 'casa_bar',    scores: { social: 2 } },
      { label: 'buscar un restaurante o plan más económico', value: 'econ',        scores: { social: 2 } },
      { label: 'renunciar al plan y quedarme sin gastar',   value: 'no_plan',     scores: { social: 2 } },
    ],
    allowOther: true,
    otherRequiresAI: true,
    aiConfidenceThreshold: 0.70,
    suggestedAmount: 15,
    habitCategory: 'Alternativa social barata',
    bestDays: 'Jueves, Viernes, Sábado',
    bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera',
    targetAvatarPrimary: 'social',
    targetAvatarSecondary: '',
    scenarioWeight: 3,
    priorityBase: 9,
    cooldownDays: 4,
    monthlyDelta: 45,
    yearlyDelta: 540,
    labelImpact: 'Proponer alternativas baratas ahorra ~45 €/mes',
    active: true,
    intent: 'gasto_evitado_alternativa_social',
    habit_principle: 'attractive',
    tone: 'motivador',
    difficulty: 'medium',
    experimental: false,
  },
  // ── Desordenado / Sin sistema ──────────────────────────────────────────
  {
    id: 'Q_FB_12',
    format: 'fill_blank',
    text: 'Hoy he evitado el gasto imprevisto que suelo hacer sin pensar: ____.',
    blankOptions: [
      { label: 'comprar algo de camino sin necesitarlo', value: 'camino',    scores: { desordenado: 2 } },
      { label: 'pagar extra por falta de planificación',  value: 'sin_plan',  scores: { desordenado: 2 } },
      { label: 'ceder a un antojo en el último momento',  value: 'antojo',    scores: { desordenado: 2 } },
    ],
    allowOther: true,
    otherRequiresAI: true,
    aiConfidenceThreshold: 0.70,
    suggestedAmount: 8,
    habitCategory: 'Gasto imprevisto evitado',
    bestDays: 'Cualquier día',
    bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera',
    targetAvatarPrimary: 'desordenado',
    targetAvatarSecondary: '',
    scenarioWeight: 3,
    priorityBase: 9,
    cooldownDays: 3,
    monthlyDelta: 24,
    yearlyDelta: 288,
    labelImpact: 'Evitar gastos imprevistos ahorra ~24 €/mes',
    active: true,
    intent: 'gasto_evitado_imprevisto',
    habit_principle: 'obvious',
    tone: 'motivador',
    difficulty: 'medium',
    experimental: false,
  },

  // ── Cómodo / Conveniencia (cont.) ───────────────────────────────────────
  {
    id: 'Q_FB_13', format: 'fill_blank',
    text: 'Esta mañana he salido de casa sin parar a comprar nada de camino: ____.',
    blankOptions: [
      { label: 'he desayunado antes de salir',             value: 'desayuno_casa', scores: { comodo: 2 } },
      { label: 'he llevado el café preparado en un termo',  value: 'cafe_termo',   scores: { comodo: 2 } },
      { label: 'he planificado la ruta para evitar tentaciones', value: 'ruta_plan', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 4, habitCategory: 'Rutina mañana', bestDays: 'Lunes a Viernes', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 3, monthlyDelta: 48, yearlyDelta: 576,
    labelImpact: 'Salir de casa preparado ahorra ~48 €/mes',
    active: true, intent: 'gasto_evitado_manana', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_14', format: 'fill_blank',
    text: 'Hoy he evitado el gasto en transporte de conveniencia eligiendo: ____.',
    blankOptions: [
      { label: 'transporte público en vez de taxi o Uber',  value: 'transporte_pub', scores: { comodo: 2 } },
      { label: 'ir andando o en bicicleta',                 value: 'andar_bici',    scores: { comodo: 2 } },
      { label: 'coordinarme con alguien para ir juntos',     value: 'compartir_v',   scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 8, habitCategory: 'Transporte', bestDays: 'Lunes a Viernes', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 3, monthlyDelta: 64, yearlyDelta: 768,
    labelImpact: 'Evitar taxi ahorra ~64 €/mes',
    active: true, intent: 'gasto_evitado_transporte', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_15', format: 'fill_blank',
    text: 'He hecho la compra del supermercado de forma más inteligente: ____.',
    blankOptions: [
      { label: 'con lista escrita, sin salirme de ella',     value: 'lista_compra', scores: { comodo: 2 } },
      { label: 'en la tienda más barata del barrio',          value: 'tienda_barata', scores: { comodo: 2 } },
      { label: 'revisando lo que ya tenía antes de ir',        value: 'revisar_prev', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Compra supermercado', bestDays: 'Sábado, Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 5, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Comprar con lista ahorra ~30 €/mes',
    active: true, intent: 'gasto_evitado_compra_lista', habit_principle: 'obvious', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_17', format: 'fill_blank',
    text: 'He preparado el almuerzo yo mismo en vez de comprarlo fuera: ____.',
    blankOptions: [
      { label: 'he calentado sobras del día anterior',        value: 'sobras',       scores: { comodo: 2 } },
      { label: 'he preparado algo rápido con lo que había',   value: 'algo_rapido',  scores: { comodo: 2 } },
      { label: 'he hecho batch cooking el finde para toda la semana', value: 'batch',  scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 7, habitCategory: 'Almuerzo', bestDays: 'Lunes a Viernes', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 3, monthlyDelta: 56, yearlyDelta: 672,
    labelImpact: 'Llevar almuerzo de casa ahorra ~56 €/mes',
    active: true, intent: 'gasto_evitado_almuerzo', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_20', format: 'fill_blank',
    text: 'He reducido el gasto por pereza en casa esta tarde-noche: ____.',
    blankOptions: [
      { label: 'he cocinado en vez de pedir porque era lo fácil', value: 'cocinar_vs_pedir', scores: { comodo: 2 } },
      { label: 'he evitado el taxi tomando el metro o bus nocturno', value: 'metro_noche',   scores: { comodo: 2 } },
      { label: 'he resistido el capricho de comprar algo para entretenerme', value: 'cap_entret', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Tarde-noche', bestDays: 'Lunes a Jueves', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 3, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Evitar la comodidad nocturna ahorra ~40 €/mes',
    active: true, intent: 'gasto_evitado_noche_comodo', habit_principle: 'obvious', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_21', format: 'fill_blank',
    text: 'He ahorrado eligiendo la alternativa más económica en vez de la cómoda: ____.',
    blankOptions: [
      { label: 'he cocinado en vez de pedir delivery o comida preparada', value: 'cocinar_vs_delivery', scores: { comodo: 2 } },
      { label: 'he usado transporte público en vez de taxi o Uber', value: 'tp_vs_taxi', scores: { comodo: 2 } },
      { label: 'he planificado la compra en vez de comprar sobre la marcha', value: 'planif_compra', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 8, habitCategory: 'Elección económica', bestDays: 'Lunes a Viernes', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 4, monthlyDelta: 48, yearlyDelta: 576,
    labelImpact: 'Elegir opciones económicas ahorra ~48 €/mes',
    active: true, intent: 'gasto_evitado_eleccion_econ', habit_principle: 'obvious', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_23', format: 'fill_blank',
    text: 'He preparado la semana con antelación para evitar gastos de comodidad: ____.',
    blankOptions: [
      { label: 'he preparado los almuerzos del lunes al viernes', value: 'meal_prep',  scores: { comodo: 2 } },
      { label: 'he tenido la ropa lista para no necesitar nada de urgencia', value: 'ropa_lista', scores: { comodo: 2 } },
      { label: 'he hecho el plan semanal para no improvisar gastos', value: 'plan_semanal', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Planificación semanal', bestDays: 'Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 7, monthlyDelta: 60, yearlyDelta: 720,
    labelImpact: 'Preparar la semana ahorra ~60 €/mes',
    active: true, intent: 'gasto_evitado_prep_semana', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_24', format: 'fill_blank',
    text: 'He ahorrado evitando el gasto rápido de conveniencia al salir: ____.',
    blankOptions: [
      { label: 'he comprado en el mercado en vez de en la gasolinera', value: 'mercado_vs_gas', scores: { comodo: 2 } },
      { label: 'he elegido el menú del día en vez de la carta', value: 'menu_dia', scores: { comodo: 2 } },
      { label: 'he comparado opciones antes de entrar al primer sitio', value: 'comparar_antes', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 5, habitCategory: 'Comida fuera económica', bestDays: 'Lunes a Viernes', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: '',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 4, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Menú del día y mercado ahorra ~40 €/mes',
    active: true, intent: 'gasto_evitado_conveniencia_salida', habit_principle: 'obvious', tone: 'motivador', difficulty: 'low', experimental: false,
  },

  // ── Social / FOMO (cont.) ───────────────────────────────────────────────
  {
    id: 'Q_FB_25', format: 'fill_blank',
    text: 'Hoy he propuesto al grupo un plan más barato y lo han aceptado: ____.',
    blankOptions: [
      { label: 'quedar en casa de alguien en vez de ir al bar', value: 'casa_vs_bar',   scores: { social: 2 } },
      { label: 'ir a una terraza más económica',                value: 'terraza_eco', scores: { social: 2 } },
      { label: 'cocinar juntos en vez de ir a restaurante',      value: 'cocinar_juntos', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Plan alternativo social', bestDays: 'Jueves, Viernes, Sábado', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Proponer plan económico ahorra ~30 €/mes',
    active: true, intent: 'gasto_evitado_plan_alternativo', habit_principle: 'attractive', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_26', format: 'fill_blank',
    text: 'He controlado el gasto en la última cena o comida de grupo: ____.',
    blankOptions: [
      { label: 'he pedido algo sencillo en vez del plato más caro', value: 'pedido_sencillo', scores: { social: 2 } },
      { label: 'he compartido entrantes en vez de pedir plato propio', value: 'compartir_plato', scores: { social: 2 } },
      { label: 'he decidido el tope de gasto antes de llegar y lo he cumplido', value: 'tope_previo', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 12, habitCategory: 'Cena de grupo', bestDays: 'Viernes, Sábado', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 5, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Controlar cena de grupo ahorra ~30 €/mes',
    active: true, intent: 'gasto_evitado_cena_grupo', habit_principle: 'obvious', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_27', format: 'fill_blank',
    text: 'He dicho que no a un plan social caro sin sentirme mal: ____.',
    blankOptions: [
      { label: 'me he quedado en casa sin gastar nada',              value: 'quedado_casa', scores: { social: 2 } },
      { label: 'he propuesto otro plan más adelante más económico', value: 'plan_despues', scores: { social: 2 } },
      { label: 'he resistido la presión del grupo y salido ganando',  value: 'resistir_grupo', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Decir no al plan', bestDays: 'Jueves, Viernes, Sábado', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Decir no a planes caros ahorra ~40 €/mes',
    active: true, intent: 'gasto_evitado_no_plan', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_28', format: 'fill_blank',
    text: 'He ahorrado en el transporte de vuelta de un plan nocturno: ____.',
    blankOptions: [
      { label: 'he vuelto en metro o bus en vez de taxi',          value: 'metro_vuelta',  scores: { social: 2 } },
      { label: 'he coordinado con alguien para compartir transporte', value: 'compartir_taxi', scores: { social: 2 } },
      { label: 'he salido antes para coger el último metro',       value: 'salir_antes',  scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Transporte nocturno', bestDays: 'Viernes, Sábado', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 5, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Metro vs taxi en la vuelta ahorra ~30 €/mes',
    active: true, intent: 'gasto_evitado_transporte_noche', habit_principle: 'obvious', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_29', format: 'fill_blank',
    text: 'He controlado lo que gasté en la última salida de fin de semana: ____.',
    blankOptions: [
      { label: 'he llevado efectivo limitado y no he sacado más', value: 'efectivo_lim', scores: { social: 2 } },
      { label: 'he pedido cuenta separada para no pagar de más',  value: 'cuenta_sep',  scores: { social: 2 } },
      { label: 'he decidido de antemano el tope de gasto del día', value: 'tope_dia',    scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Salida finde', bestDays: 'Lunes, Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 5, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Controlar el fin de semana ahorra ~40 €/mes',
    active: true, intent: 'gasto_evitado_control_finde', habit_principle: 'satisfying', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_31', format: 'fill_blank',
    text: 'He controlado el gasto en el último bar o restaurante: ____.',
    blankOptions: [
      { label: 'he pedido agua o bebida sin alcohol parte de la noche', value: 'agua_noche', scores: { social: 2 } },
      { label: 'he evitado invitar rondas cuando no tocaba',            value: 'no_ronda',   scores: { social: 2 } },
      { label: 'he marcado un máximo de consumiciones y lo he cumplido', value: 'max_consumiciones', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Bar y restaurante', bestDays: 'Viernes, Sábado, Domingo', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Controlar consumiciones ahorra ~30 €/mes',
    active: true, intent: 'gasto_evitado_bar', habit_principle: 'obvious', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_33', format: 'fill_blank',
    text: 'He resistido la presión del grupo y he ahorrado en: ____.',
    blankOptions: [
      { label: 'no unirme a la ronda cuando no me apetecía',        value: 'no_ronda_presion', scores: { social: 2 } },
      { label: 'no participar en la compra colectiva del grupo',     value: 'no_compra_grupo', scores: { social: 2 } },
      { label: 'no comprar lo que todos compraban solo por no quedar mal', value: 'no_presion_compra', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Presión social evitada', bestDays: 'Viernes, Sábado, Domingo', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Resistir presión de grupo ahorra ~30 €/mes',
    active: true, intent: 'gasto_evitado_presion_grupo', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_35', format: 'fill_blank',
    text: 'He ahorrado evitando el efecto de cascada en una salida nocturna: ____.',
    blankOptions: [
      { label: 'no he seguido la escalada de bares y copas del grupo', value: 'no_escalada', scores: { social: 2 } },
      { label: 'me he ido a casa antes sin sentirme presionado/a',     value: 'ido_antes',   scores: { social: 2 } },
      { label: 'he rechazado el último local más caro al que iban',    value: 'no_local_caro', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Escalada social nocturna', bestDays: 'Viernes, Sábado', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 5, monthlyDelta: 45, yearlyDelta: 540,
    labelImpact: 'Cortar la escalada nocturna ahorra ~45 €/mes',
    active: true, intent: 'gasto_evitado_escalada_nocturna', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_36', format: 'fill_blank',
    text: 'He propuesto y liderado un plan social más económico: ____.',
    blankOptions: [
      { label: 'una barbacoa o cena en casa del grupo',           value: 'bbq_casa',   scores: { social: 2 } },
      { label: 'una actividad gratuita: parque, mercado, ruta',  value: 'activ_gratis',scores: { social: 2 } },
      { label: 'una tarde de juegos o películas en casa',         value: 'juegos_casa', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 25, habitCategory: 'Plan social barato', bestDays: 'Viernes, Sábado, Domingo', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 7, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Liderar plan económico ahorra ~50 €/mes',
    active: true, intent: 'gasto_evitado_plan_liderado', habit_principle: 'attractive', tone: 'motivador', difficulty: 'medium', experimental: false,
  },

  // ── Impulsivo / Antojo (cont.) ───────────────────────────────────────────
  {
    id: 'Q_FB_37', format: 'fill_blank',
    text: 'He vaciado el carrito de una tienda online sin comprar: ____.',
    blankOptions: [
      { label: 'ropa o moda que no necesitaba realmente',          value: 'carrito_ropa',    scores: { impulsivo: 2 } },
      { label: 'electrónica o tecnología que parecía imprescindible', value: 'carrito_tech', scores: { impulsivo: 2 } },
      { label: 'artículos de hogar o decoración que me gustaron',    value: 'carrito_deco',  scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 35, habitCategory: 'Carrito abandonado', bestDays: 'Cualquier día', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 70, yearlyDelta: 840,
    labelImpact: 'Abandonar carritos ahorra ~70 €/mes',
    active: true, intent: 'gasto_evitado_carrito', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_38', format: 'fill_blank',
    text: 'He aplicado la regla de las 24 horas antes de comprar y he decidido no hacerlo: ____.',
    blankOptions: [
      { label: 'porque ya no lo quería al día siguiente',         value: 'ya_no_queria',  scores: { impulsivo: 2 } },
      { label: 'porque he encontrado alternativa más barata',      value: 'alternativa_24h', scores: { impulsivo: 2 } },
      { label: 'porque me he dado cuenta de que ya tenía algo similar', value: 'ya_tenia_similar', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 25, habitCategory: 'Regla 24h', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 5, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'La regla de 24h ahorra ~50 €/mes',
    active: true, intent: 'gasto_evitado_24h', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_40', format: 'fill_blank',
    text: 'He evitado la compra impulsiva después de ver algo en redes: ____.',
    blankOptions: [
      { label: 'un producto que vi en Instagram o TikTok',         value: 'redes_producto', scores: { impulsivo: 2 } },
      { label: 'algo que promocionaba un influencer o anuncio',    value: 'influencer',     scores: { impulsivo: 2 } },
      { label: 'un plan o experiencia que parecía imprescindible', value: 'exp_social',     scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 25, habitCategory: 'Compra por redes sociales', bestDays: 'Cualquier día', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 75, yearlyDelta: 900,
    labelImpact: 'Evitar compras de redes ahorra ~75 €/mes',
    active: true, intent: 'gasto_evitado_redes', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_42', format: 'fill_blank',
    text: 'He parado una compra emocional que estaba a punto de hacer: ____.',
    blankOptions: [
      { label: 'cuando estaba aburrido o sin hacer nada',         value: 'compra_aburrido', scores: { impulsivo: 2 } },
      { label: 'cuando estaba estresado y quería liberarme',      value: 'compra_estres',  scores: { impulsivo: 2 } },
      { label: 'cuando vi algo bonito sin tener ninguna necesidad', value: 'compra_capricho', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Compra emocional', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 60, yearlyDelta: 720,
    labelImpact: 'Parar compras emocionales ahorra ~60 €/mes',
    active: true, intent: 'gasto_evitado_compra_emocional', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_43', format: 'fill_blank',
    text: 'He eliminado o bloqueado una tentación de compra digital: ____.',
    blankOptions: [
      { label: 'he desinstalado la app de compras del móvil',       value: 'desinstalar_app', scores: { impulsivo: 2 } },
      { label: 'he borrado la tarjeta guardada en la web de tienda', value: 'borrar_tarjeta', scores: { impulsivo: 2 } },
      { label: 'he cancelado las notificaciones de ofertas',          value: 'cancelar_noti', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 0, habitCategory: 'Fricción compra digital', bestDays: 'Cualquier día', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 14, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Poner fricción digital ahorra ~30 €/mes',
    active: true, intent: 'gasto_evitado_friccion_digital', habit_principle: 'obvious', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_46', format: 'fill_blank',
    text: 'He esperado antes de confirmar una compra grande y no la he hecho: ____.',
    blankOptions: [
      { label: 'un artículo de más de 100€ que creía necesitar',   value: 'espera_100',   scores: { impulsivo: 2 } },
      { label: 'una suscripción o servicio de pago anual',         value: 'espera_sub',   scores: { impulsivo: 2 } },
      { label: 'algo que vi en feria, mercadillo o tienda pop-up',  value: 'espera_feria', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 80, habitCategory: 'Compra grande evitada', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 10, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Esperar antes de compra grande ahorra ~30 €/mes',
    active: true, intent: 'gasto_evitado_espera_grande', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_48', format: 'fill_blank',
    text: 'He resistido comprar algo solo porque estaba de oferta: ____.',
    blankOptions: [
      { label: 'ropa o complementos con descuento que no necesitaba', value: 'oferta_ropa',  scores: { impulsivo: 2 } },
      { label: 'tecnología o gadget rebajado que me pareció ganga',   value: 'oferta_tech', scores: { impulsivo: 2 } },
      { label: 'algo de hogar o decoración en rebajas',               value: 'oferta_hogar', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 30, habitCategory: 'Oferta resistida', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 5, monthlyDelta: 45, yearlyDelta: 540,
    labelImpact: 'Resistir ofertas sin necesidad ahorra ~45 €/mes',
    active: true, intent: 'gasto_evitado_oferta_resistida', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },

  // ── Desordenado / Microfugas (cont.) ─────────────────────────────────────
  {
    id: 'Q_FB_49', format: 'fill_blank',
    text: 'Esta semana he cancelado o reducido una suscripción que no usaba: ____.',
    blankOptions: [
      { label: 'de streaming o entretenimiento digital',            value: 'cancel_streaming', scores: { desordenado: 2 } },
      { label: 'de servicios digitales o apps premium',             value: 'cancel_app',      scores: { desordenado: 2 } },
      { label: 'de entrega periódica física que había olvidado',      value: 'cancel_fisico',   scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Suscripciones', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Inicio', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 14, monthlyDelta: 15, yearlyDelta: 180,
    labelImpact: 'Cancelar suscripciones sin uso ahorra ~15 €/mes',
    active: true, intent: 'gasto_evitado_suscripcion_desordenado', habit_principle: 'satisfying', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_50', format: 'fill_blank',
    text: 'He detectado y parado un cobro recurrente que no recordaba: ____.',
    blankOptions: [
      { label: 'una prueba gratuita que se había convertido en pago',  value: 'trial_cobro',  scores: { desordenado: 2 } },
      { label: 'un servicio que dejé de usar pero nunca cancelé',      value: 'servicio_olv', scores: { desordenado: 2 } },
      { label: 'una tarifa que podía reducir llamando al proveedor',    value: 'tarifa_red',  scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 12, habitCategory: 'Cobros olvidados', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 14, monthlyDelta: 20, yearlyDelta: 240,
    labelImpact: 'Detectar cobros olvidados ahorra ~20 €/mes',
    active: true, intent: 'gasto_evitado_cobro_olvidado', habit_principle: 'satisfying', tone: 'reflexivo', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_51', format: 'fill_blank',
    text: 'He planificado la semana con antelación para evitar gastos imprevistos: ____.',
    blankOptions: [
      { label: 'he preparado el menú semanal y la lista de la compra', value: 'menu_semana', scores: { desordenado: 2 } },
      { label: 'he revisado los gastos previstos del mes',              value: 'rev_gastos',  scores: { desordenado: 2 } },
      { label: 'he preparado ropa y material para no comprar de urgencia', value: 'prep_urgencia', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Planificación semanal', bestDays: 'Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 7, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Planificar la semana ahorra ~40 €/mes',
    active: true, intent: 'gasto_evitado_planif_semana', habit_principle: 'obvious', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_52', format: 'fill_blank',
    text: 'He revisado mis extractos del banco y he encontrado dónde ahorrar: ____.',
    blankOptions: [
      { label: 'en cargos automáticos que no había detectado',         value: 'cargos_auto',  scores: { desordenado: 2 } },
      { label: 'en gastos de conveniencia que sumaban más de lo que pensaba', value: 'gastos_conv_rev', scores: { desordenado: 2 } },
      { label: 'en compras de impulso que podría haber evitado',        value: 'impulso_rev',  scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Revisión extracto', bestDays: 'Domingo, Lunes', bestTimeWindow: 'Mañana',
    monthPhase: 'Final', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 14, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Revisar extracto mensual ahorra ~30 €/mes',
    active: true, intent: 'gasto_evitado_extracto', habit_principle: 'satisfying', tone: 'reflexivo', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_53', format: 'fill_blank',
    text: 'He organizado mejor mi dinero esta semana: ____.',
    blankOptions: [
      { label: 'he separado el dinero para gastos fijos antes de gastar lo demás', value: 'sep_fijos',  scores: { desordenado: 2 } },
      { label: 'he anotado todos mis gastos del día',                            value: 'anotar_gst', scores: { desordenado: 2 } },
      { label: 'he marcado un límite para una categoría en la que me pasaba',   value: 'limite_cat', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 0, habitCategory: 'Organización financiera', bestDays: 'Lunes, Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Inicio', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 7, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Organizar el dinero en categorías ahorra ~50 €/mes',
    active: true, intent: 'gasto_evitado_organizacion', habit_principle: 'obvious', tone: 'reflexivo', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_54', format: 'fill_blank',
    text: 'He evitado el gasto de emergencia por falta de planificación: ____.',
    blankOptions: [
      { label: 'tenía ya en casa lo que necesitaba para la semana',           value: 'casa_prep',   scores: { desordenado: 2 } },
      { label: 'había planificado comidas sin necesitar comprar fuera urgente', value: 'comida_prev', scores: { desordenado: 2 } },
      { label: 'había preparado alternativa por si el plan fallaba',            value: 'plan_b',      scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Gasto de emergencia evitado', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 5, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Prevenir emergencias ahorra ~30 €/mes',
    active: true, intent: 'gasto_evitado_emergencia', habit_principle: 'obvious', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_55', format: 'fill_blank',
    text: 'He reducido el gasto en el supermercado evitando ir sin lista: ____.',
    blankOptions: [
      { label: 'he ido con lista y no he cogido nada más',              value: 'lista_estricta', scores: { desordenado: 2 } },
      { label: 'he hecho la compra online para evitar impulsos del pasillo', value: 'compra_online_plan', scores: { desordenado: 2 } },
      { label: 'he evitado el pasillo de ofertas y productos capricho',  value: 'evitar_pasillo', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Compra con lista', bestDays: 'Sábado, Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 7, monthlyDelta: 45, yearlyDelta: 540,
    labelImpact: 'Comprar con lista fija ahorra ~45 €/mes',
    active: true, intent: 'gasto_evitado_compra_con_lista', habit_principle: 'obvious', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_57', format: 'fill_blank',
    text: 'He organizado mis gastos del mes y he encontrado margen de ahorro en: ____.',
    blankOptions: [
      { label: 'gastos de ocio y entretenimiento',             value: 'ocio_margen',  scores: { desordenado: 2 } },
      { label: 'gastos de alimentación y restauración',        value: 'comida_margen', scores: { desordenado: 2 } },
      { label: 'gastos de ropa y caprichos personales',        value: 'ropa_margen',  scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Revisión mensual', bestDays: 'Domingo, Lunes', bestTimeWindow: 'Mañana',
    monthPhase: 'Final', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 30, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Auditoría mensual ahorra ~40 €/mes',
    active: true, intent: 'gasto_evitado_auditoria_mensual', habit_principle: 'satisfying', tone: 'reflexivo', difficulty: 'low', experimental: false,
  },

  // ── CÓMODO (nuevas Q_FB_61–Q_FB_68) ─────────────────────────────────────────
  {
    id: 'Q_FB_61', format: 'fill_blank',
    text: 'He resistido pedir delivery y he improvisado algo en casa: ____.',
    blankOptions: [
      { label: 'pasta rápida con lo que había',            value: 'pasta_rapida',  scores: { comodo: 2 } },
      { label: 'una tortilla o huevos revueltos',           value: 'tortilla',      scores: { comodo: 2 } },
      { label: 'sobras de la nevera que aún estaban bien',  value: 'sobras_nevera', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Delivery evitado', bestDays: 'Cualquier día', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 3, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Improvisar en casa evita ~4 pedidos/mes',
    active: true, intent: 'gasto_evitado_delivery_improvisa', habit_principle: 'easy', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_62', format: 'fill_blank',
    text: 'He elegido transporte más barato en vez del más cómodo para ir a: ____.',
    blankOptions: [
      { label: 'el trabajo (metro o bus en vez de taxi)', value: 'trabajo_metro', scores: { comodo: 2 } },
      { label: 'una salida (bici o andando)',             value: 'salida_bici',   scores: { comodo: 2 } },
      { label: 'un recado cercano (andando)',             value: 'recado_andando', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 7, habitCategory: 'Transporte económico', bestDays: 'Lunes a Viernes', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: '',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 3, monthlyDelta: 28, yearlyDelta: 336,
    labelImpact: 'Sustituir 1 taxi diario ahorra ~28 €/mes',
    active: true, intent: 'gasto_evitado_transporte_eco', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_63', format: 'fill_blank',
    text: 'He preparado la semana para no tener que gastar de urgencia en: ____.',
    blankOptions: [
      { label: 'comida (meal prep del domingo)',       value: 'comida_semana', scores: { comodo: 2 } },
      { label: 'ropa (lista la noche anterior)',       value: 'ropa_prep',    scores: { comodo: 2 } },
      { label: 'gestiones que dejo para el último momento', value: 'gestiones_ant', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Planificación semanal', bestDays: 'Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 7, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Preparar la semana evita gastos de urgencia ~50 €/mes',
    active: true, intent: 'gasto_evitado_planif_urgencia', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_65', format: 'fill_blank',
    text: 'He cocinado con lo que tenía en la despensa sin ir al supermercado: ____.',
    blankOptions: [
      { label: 'arroz, pasta o legumbres que tenía', value: 'arroz_verduras', scores: { comodo: 2 } },
      { label: 'una lata o conserva que estaba olvidada', value: 'lata_aprovechada', scores: { comodo: 2 } },
      { label: 'algo del congelador que tenía pendiente', value: 'congelado_util', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 8, habitCategory: 'Aprovechamiento despensa', bestDays: 'Cualquier día', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: '',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 4, monthlyDelta: 32, yearlyDelta: 384,
    labelImpact: 'Aprovechar despensa evita ~4 compras extra/mes',
    active: true, intent: 'gasto_evitado_despensa', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_66', format: 'fill_blank',
    text: 'He rechazado el complemento o servicio extra que me ofrecieron al comprar: ____.',
    blankOptions: [
      { label: 'seguro o garantía extendida',     value: 'seguro_extra',        scores: { comodo: 2 } },
      { label: 'envío exprés (no urgía)',          value: 'envio_express',       scores: { comodo: 2 } },
      { label: 'accesorio o upgrade del producto', value: 'garantia_extendida', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 8, habitCategory: 'Upsell rechazado', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: '',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 5, monthlyDelta: 16, yearlyDelta: 192,
    labelImpact: 'Rechazar upsells ahorra ~16 €/mes',
    active: true, intent: 'gasto_evitado_upsell_rechazo', habit_principle: 'obvious', tone: 'preventivo', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_67', format: 'fill_blank',
    text: 'He optado por hacer yo mismo algo que normalmente pago: ____.',
    blankOptions: [
      { label: 'limpieza o mantenimiento del hogar', value: 'limpieza_casa', scores: { comodo: 2 } },
      { label: 'arreglo de ropa o costura',          value: 'arreglo_ropa',  scores: { comodo: 2 } },
      { label: 'un corte de pelo o cuidado personal', value: 'corte_pelo_casa', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'DIY ahorro', bestDays: 'Sábado, Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: '',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 7, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'DIY mensual ahorra ~30 €/mes',
    active: true, intent: 'gasto_evitado_diy', habit_principle: 'easy', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_68', format: 'fill_blank',
    text: 'He comprado la versión básica en vez de la premium de: ____.',
    blankOptions: [
      { label: 'un producto (marca blanca vs marca)',       value: 'producto_marca_blanca', scores: { comodo: 2 } },
      { label: 'un plan o app (básico en vez de premium)', value: 'plan_basico_app',        scores: { comodo: 2 } },
      { label: 'un dispositivo (modelo anterior o básico)', value: 'modelo_anterior',       scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Versión básica elegida', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: '',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 5, monthlyDelta: 25, yearlyDelta: 300,
    labelImpact: 'Elegir básico ahorra ~25 €/mes',
    active: true, intent: 'gasto_evitado_version_basica', habit_principle: 'obvious', tone: 'motivador', difficulty: 'low', experimental: false,
  },

  // ── SOCIAL (nuevas Q_FB_69–Q_FB_76) ──────────────────────────────────────────
  {
    id: 'Q_FB_69', format: 'fill_blank',
    text: 'He organizado un plan en casa con amigos para ahorrar en: ____.',
    blankOptions: [
      { label: 'cena en casa (cocinamos juntos)',   value: 'cena_casa',   scores: { social: 2 } },
      { label: 'película o serie en casa',          value: 'pelicula_casa', scores: { social: 2 } },
      { label: 'juegos de mesa o actividad en casa', value: 'juegos_mesa', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Plan en casa', bestDays: 'Viernes, Sábado, Domingo', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 5, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Plan en casa vs fuera ahorra ~50 €/mes',
    active: true, intent: 'gasto_evitado_plan_casa', habit_principle: 'attractive', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_70', format: 'fill_blank',
    text: 'He comunicado al grupo mi límite de gasto antes de salir y lo hemos respetado: ____.',
    blankOptions: [
      { label: 'el límite de gasto de la noche',    value: 'limite_noche',    scores: { social: 2 } },
      { label: 'el tope máximo de la cena',         value: 'tope_cena',       scores: { social: 2 } },
      { label: 'el máximo por consumición o copa', value: 'max_consumicion', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Límite social comunicado', bestDays: 'Viernes, Sábado', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 5, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Comunicar límite evita sobregastos grupales',
    active: true, intent: 'gasto_evitado_limite_comunicado', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_73', format: 'fill_blank',
    text: 'He salido antes para evitar que la noche se alargara y gastara más en: ____.',
    blankOptions: [
      { label: 'copas extra de madrugada',          value: 'copas_extra',      scores: { social: 2 } },
      { label: 'taxi de vuelta muy caro',            value: 'taxi_noche',       scores: { social: 2 } },
      { label: 'after o local improvisado más caro', value: 'after_improvisado', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Salida a tiempo', bestDays: 'Sábado, Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 5, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Salir antes evita escalada de gasto nocturno',
    active: true, intent: 'gasto_evitado_salida_tiempo', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_74', format: 'fill_blank',
    text: 'He preferido quedar a tomar algo sencillo en vez de ir a un sitio caro: ____.',
    blankOptions: [
      { label: 'terraza del barrio o bar local',   value: 'terraza_barrio', scores: { social: 2 } },
      { label: 'café o vermú sencillo',             value: 'cafe_sencillo',  scores: { social: 2 } },
      { label: 'sitio de toda la vida más barato', value: 'bar_local',      scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Bar económico elegido', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 4, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Bar del barrio vs caro ahorra ~30 €/mes',
    active: true, intent: 'gasto_evitado_bar_economico', habit_principle: 'attractive', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_75', format: 'fill_blank',
    text: 'He dividido bien la cuenta en vez de pagar de más por ser quien invita: ____.',
    blankOptions: [
      { label: 'pedí cuenta separada',             value: 'cuenta_separada', scores: { social: 2 } },
      { label: 'pagué solo lo mío (sin ronda)',    value: 'pagar_lo_mio',   scores: { social: 2 } },
      { label: 'usamos una app para dividir bien', value: 'app_split',      scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'División justa cuenta', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: '',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 5, monthlyDelta: 20, yearlyDelta: 240,
    labelImpact: 'Dividir bien la cuenta evita pagar de más',
    active: true, intent: 'gasto_evitado_cuenta_justa', habit_principle: 'satisfying', tone: 'reflexivo', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_76', format: 'fill_blank',
    text: 'He propuesto una actividad gratuita al grupo en vez de gastar en: ____.',
    blankOptions: [
      { label: 'deporte en el parque o cancha gratis', value: 'deporte_parque',   scores: { social: 2 } },
      { label: 'ruta de senderismo o paseo en grupo',  value: 'ruta_senderismo',  scores: { social: 2 } },
      { label: 'barbacoa o picnic en casa/parque',     value: 'bbq_casa',         scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 25, habitCategory: 'Actividad gratuita liderada', bestDays: 'Sábado, Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 7, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Liderar actividad gratis ahorra ~50 €/mes',
    active: true, intent: 'gasto_evitado_actividad_gratis', habit_principle: 'attractive', tone: 'motivador', difficulty: 'medium', experimental: false,
  },

  // ── IMPULSIVO (nuevas Q_FB_77–Q_FB_84) ───────────────────────────────────────
  {
    id: 'Q_FB_77', format: 'fill_blank',
    text: 'He cerrado la app o web de compras sin añadir nada al carrito en: ____.',
    blankOptions: [
      { label: 'Amazon o Aliexpress',         value: 'amazon_cerrado', scores: { impulsivo: 2 } },
      { label: 'tienda de ropa online',       value: 'zara_cerrado',   scores: { impulsivo: 2 } },
      { label: 'app de comida o delivery',    value: 'tienda_comida',  scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 30, habitCategory: 'App cerrada sin comprar', bestDays: 'Cualquier día', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 3, monthlyDelta: 60, yearlyDelta: 720,
    labelImpact: 'Cerrar app sin comprar evita ~60 €/mes',
    active: true, intent: 'gasto_evitado_app_cerrada', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_78', format: 'fill_blank',
    text: 'He esperado antes de comprar y al final he decidido no hacerlo porque: ____.',
    blankOptions: [
      { label: 'ya no lo quería tanto',              value: 'ya_no_lo_queria',  scores: { impulsivo: 2 } },
      { label: 'encontré una alternativa más barata', value: 'encontre_alternativa', scores: { impulsivo: 2 } },
      { label: 'me di cuenta de que ya tenía algo similar', value: 'ya_tenia_similar', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 25, habitCategory: 'Decisión de espera', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 5, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Esperar antes de comprar ahorra ~50 €/mes',
    active: true, intent: 'gasto_evitado_espera_decision', habit_principle: 'obvious', tone: 'reflexivo', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_79', format: 'fill_blank',
    text: 'He evitado comprar algo que vi en un anuncio o historia de redes sociales: ____.',
    blankOptions: [
      { label: 'un producto de Instagram o TikTok', value: 'producto_instagram', scores: { impulsivo: 2 } },
      { label: 'ropa o accesorio de un influencer',  value: 'ropa_tiktok',       scores: { impulsivo: 2 } },
      { label: 'un plan o servicio anunciado',       value: 'plan_anuncio',      scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 25, habitCategory: 'Publicidad ignorada', bestDays: 'Cualquier día', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Ignorar publicidad en redes ahorra ~50 €/mes',
    active: true, intent: 'gasto_evitado_publicidad_redes', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_80', format: 'fill_blank',
    text: 'He pensado si realmente lo necesitaba y he decidido no comprar: ____.',
    blankOptions: [
      { label: 'una prenda de ropa nueva',     value: 'ropa_nueva',      scores: { impulsivo: 2 } },
      { label: 'un gadget o accesorio tech',   value: 'gadget_tech',     scores: { impulsivo: 2 } },
      { label: 'un artículo de decoración',    value: 'accesorio_hogar', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 30, habitCategory: 'Reflexión antes de comprar', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 60, yearlyDelta: 720,
    labelImpact: 'Reflexionar antes de comprar ahorra ~60 €/mes',
    active: true, intent: 'gasto_evitado_reflexion_compra', habit_principle: 'obvious', tone: 'reflexivo', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_81', format: 'fill_blank',
    text: 'He desactivado las notificaciones de una app de compras para evitar tentaciones de: ____.',
    blankOptions: [
      { label: 'alertas de ofertas de Amazon o tiendas', value: 'alertas_amazon',  scores: { impulsivo: 2 } },
      { label: 'notificaciones de ropa o moda',          value: 'noti_ropa',       scores: { impulsivo: 2 } },
      { label: 'emails de ofertas y newsletters',        value: 'email_ofertas',   scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 0, habitCategory: 'Fricción digital añadida', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: '',
    scenarioWeight: 2, priorityBase: 8, cooldownDays: 14, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Desactivar notificaciones reduce compras impulsivas',
    active: true, intent: 'gasto_evitado_notif_desactivadas', habit_principle: 'obvious', tone: 'preventivo', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_82', format: 'fill_blank',
    text: 'He comprado la versión de segunda mano en vez de nueva de: ____.',
    blankOptions: [
      { label: 'ropa o complementos (Vinted, Wallapop)', value: 'ropa_segunda',   scores: { impulsivo: 2 } },
      { label: 'libro o juego (segunda mano)',           value: 'libro_segunda',  scores: { impulsivo: 2 } },
      { label: 'mueble o artículo de hogar',             value: 'mueble_segunda', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Segunda mano elegida', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: '',
    scenarioWeight: 2, priorityBase: 8, cooldownDays: 7, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Segunda mano ahorra ~40 €/mes',
    active: true, intent: 'gasto_evitado_segunda_mano', habit_principle: 'easy', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_83', format: 'fill_blank',
    text: 'He frenado una compra emocional reconociendo que era por: ____.',
    blankOptions: [
      { label: 'aburrimiento o falta de estímulo',     value: 'aburrimiento',    scores: { impulsivo: 2 } },
      { label: 'estrés o mal día en el trabajo',       value: 'estres_laboral',  scores: { impulsivo: 2 } },
      { label: 'presión del grupo o ganas de encajar', value: 'presion_social',  scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Compra emocional frenada', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 60, yearlyDelta: 720,
    labelImpact: 'Identificar emoción detrás de la compra la para',
    active: true, intent: 'gasto_evitado_compra_emocional_reconocida', habit_principle: 'obvious', tone: 'reflexivo', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_84', format: 'fill_blank',
    text: 'He utilizado lo que ya tenía en vez de comprar algo nuevo para: ____.',
    blankOptions: [
      { label: 'vestirme (ropa del armario que no usaba)', value: 'ropa_armario',     scores: { impulsivo: 2 } },
      { label: 'una tarea (herramienta que ya tenía)',     value: 'herramienta_casa', scores: { impulsivo: 2 } },
      { label: 'un uso (producto viejo aún útil)',         value: 'producto_viejo',   scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Reutilizar lo que hay', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: '',
    scenarioWeight: 2, priorityBase: 8, cooldownDays: 5, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Reutilizar antes de comprar ahorra ~30 €/mes',
    active: true, intent: 'gasto_evitado_reutilizar', habit_principle: 'easy', tone: 'motivador', difficulty: 'medium', experimental: false,
  },

  // ── DESORDENADO (nuevas Q_FB_85–Q_FB_92) ─────────────────────────────────────
  {
    id: 'Q_FB_85', format: 'fill_blank',
    text: 'He encontrado y cancelado un servicio activo que no usaba: ____.',
    blankOptions: [
      { label: 'gimnasio o clases que no iba',    value: 'gym_no_usado',  scores: { desordenado: 2 } },
      { label: 'app o herramienta olvidada',       value: 'app_olvidada', scores: { desordenado: 2 } },
      { label: 'servicio con renovación automática', value: 'servicio_aut', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Servicio cancelado', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Inicio', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 14, monthlyDelta: 25, yearlyDelta: 300,
    labelImpact: 'Cancelar servicios sin usar ahorra ~25 €/mes',
    active: true, intent: 'gasto_evitado_servicio_cancelado', habit_principle: 'satisfying', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_86', format: 'fill_blank',
    text: 'He revisado mis finanzas esta semana y he identificado dónde puedo ahorrar: ____.',
    blankOptions: [
      { label: 'suscripciones o cargos automáticos', value: 'suscripciones_rev', scores: { desordenado: 2 } },
      { label: 'gastos hormiga del día a día',        value: 'gastos_hormiga',   scores: { desordenado: 2 } },
      { label: 'gastos de comodidad innecesarios',    value: 'comodidad_innec',  scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 0, habitCategory: 'Revisión financiera activa', bestDays: 'Domingo, Lunes', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 7, monthlyDelta: 35, yearlyDelta: 420,
    labelImpact: 'Revisar finanzas semanalmente identifica ahorros',
    active: true, intent: 'gasto_evitado_revision_finanzas', habit_principle: 'satisfying', tone: 'reflexivo', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_87', format: 'fill_blank',
    text: 'He comparado precios antes de comprar y he elegido la opción más barata de: ____.',
    blankOptions: [
      { label: 'supermercado (marca blanca vs marca)', value: 'supermercado_comp', scores: { desordenado: 2 } },
      { label: 'seguro o contrato (comparador online)', value: 'seguro_comp',      scores: { desordenado: 2 } },
      { label: 'un servicio o producto de ocio',       value: 'servicio_comp',    scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Comparación de precios', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: '',
    scenarioWeight: 2, priorityBase: 8, cooldownDays: 5, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Comparar precios ahorra ~30 €/mes',
    active: true, intent: 'gasto_evitado_comparacion_precios', habit_principle: 'obvious', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_88', format: 'fill_blank',
    text: 'He creado un presupuesto para esta categoría de gasto y lo he seguido: ____.',
    blankOptions: [
      { label: 'presupuesto de ocio del mes',  value: 'presup_ocio',   scores: { desordenado: 2 } },
      { label: 'presupuesto de alimentación',  value: 'presup_comida', scores: { desordenado: 2 } },
      { label: 'presupuesto de ropa',          value: 'presup_ropa',   scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 0, habitCategory: 'Presupuesto por categoría', bestDays: 'Domingo, Lunes', bestTimeWindow: 'Mañana',
    monthPhase: 'Inicio', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 30, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Tener presupuesto por categoría limita el gasto',
    active: true, intent: 'gasto_evitado_presupuesto_categoria', habit_principle: 'obvious', tone: 'reflexivo', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_90', format: 'fill_blank',
    text: 'He negociado o buscado una oferta mejor antes de renovar: ____.',
    blankOptions: [
      { label: 'tarifa de móvil o internet',       value: 'movil_renegoc',   scores: { desordenado: 2 } },
      { label: 'seguro (coche, hogar, salud)',      value: 'seguro_renegoc',  scores: { desordenado: 2 } },
      { label: 'tarifa de luz o gas',               value: 'internet_renegoc', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Negociación de contratos', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Inicio', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: '',
    scenarioWeight: 2, priorityBase: 8, cooldownDays: 30, monthlyDelta: 20, yearlyDelta: 240,
    labelImpact: 'Renegociar tarifas ahorra ~20 €/mes',
    active: true, intent: 'gasto_evitado_negociacion', habit_principle: 'satisfying', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_91', format: 'fill_blank',
    text: 'He hecho una auditoría rápida de mis gastos del mes y he encontrado: ____.',
    blankOptions: [
      { label: 'gastos hormiga que no controlaba',    value: 'gasto_hormiga_mes', scores: { desordenado: 2 } },
      { label: 'suscripción innecesaria que cancelaré', value: 'sub_innecesaria', scores: { desordenado: 2 } },
      { label: 'un impulso grande del que no era consciente', value: 'impulso_grande', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Auditoría mensual rápida', bestDays: 'Domingo, Lunes', bestTimeWindow: 'Mañana',
    monthPhase: 'Final', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 30, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Auditoría mensual identifica ~30 €/mes de margen',
    active: true, intent: 'gasto_evitado_auditoria_rapida', habit_principle: 'satisfying', tone: 'reflexivo', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_92', format: 'fill_blank',
    text: 'He configurado un ahorro automático para no depender de la fuerza de voluntad en: ____.',
    blankOptions: [
      { label: 'transferencia automática a cuenta ahorro', value: 'transferencia_aut', scores: { desordenado: 2 } },
      { label: 'regla de redondeo o ahorro inteligente',   value: 'regla_redondeo',   scores: { desordenado: 2 } },
      { label: 'cuenta separada de ahorros sin tarjeta',   value: 'cuenta_ahorro_sep', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 50, habitCategory: 'Ahorro automático', bestDays: 'Domingo, Lunes', bestTimeWindow: 'Mañana',
    monthPhase: 'Inicio', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 30, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Ahorro automático asegura consistencia sin esfuerzo',
    active: true, intent: 'gasto_evitado_ahorro_automatico', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Banco completo y helpers
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Banco completo de preguntas.
 * Tipos disponibles: 'amount' (60 preguntas) y 'fill_blank' (60 preguntas).
 * Total: 120 preguntas activas.
 */
export const DAILY_QUESTIONS_BANK: DailyQuestion[] = [
  ...Q_CONVENIENCIA,
  ...Q_IMPROVISADOR,
  ...Q_FOMO,
  ...Q_PLAN_ALARGA,
  ...Q_ANTOJO,
  ...Q_CAZADOR,
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
