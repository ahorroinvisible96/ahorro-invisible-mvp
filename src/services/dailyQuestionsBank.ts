/**
 * Daily Questions Bank — Banco de 135 preguntas diarias (formato IMPORTE)
 *
 * CAMBIO FUNDAMENTAL: Las preguntas ya NO son Sí/No.
 * Cada pregunta describe un escenario de gasto concreto y el usuario
 * introduce cuánto se ha ahorrado (default: 0 €).
 *
 * 15 preguntas × 9 combinaciones:
 *   1. Cómodo   / conveniencia_inmediata  (Q_CI_01 – Q_CI_15)
 *   2. Cómodo   / improvisador            (Q_IM_01 – Q_IM_15)
 *   3. Social   / fomo_social             (Q_FS_01 – Q_FS_15)
 *   4. Social   / plan_que_se_alarga      (Q_PA_01 – Q_PA_15)
 *   5. Impulsivo / antojo_emocional       (Q_AE_01 – Q_AE_15)
 *   6. Impulsivo / cazador_de_ofertas     (Q_CO_01 – Q_CO_15)
 *   7. Desordenado / microfugas           (Q_MF_01 – Q_MF_15)
 *   8. Desordenado / sin_sistema          (Q_SS_01 – Q_SS_15)
 *   9. Constructor (transversal)          (Q_CT_01 – Q_CT_15)
 */

import type { AvatarKey, SubavatarKey } from './profilingService';

// ── Interface ────────────────────────────────────────────────────────────────
export interface DailyQuestion {
  id:                        string;
  /** Escenario de ahorro que se muestra al usuario */
  text:                      string;
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
  targetAvatarPrimary:       AvatarKey | 'constructor';
  /** Avatar secundario que también encaja */
  targetAvatarSecondary:     AvatarKey | 'constructor' | '';
  /** Subavatar principal */
  targetSubavatarPrimary:    SubavatarKey | '';
  /** Subavatar secundario */
  targetSubavatarSecondary:  SubavatarKey | '';
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
}

// Helper para construir preguntas de forma compacta
function q(
  id: string, text: string, suggestedAmount: number,
  habitCategory: string, bestDays: string, bestTimeWindow: string, monthPhase: string,
  ap: AvatarKey | 'constructor', as2: AvatarKey | 'constructor' | '',
  sp: SubavatarKey | '', ss: SubavatarKey | '',
  scenarioWeight: number, priorityBase: number, cooldownDays: number,
  monthlyDelta: number, yearlyDelta: number, labelImpact: string,
): DailyQuestion {
  return { id, text, suggestedAmount, habitCategory, bestDays, bestTimeWindow, monthPhase,
    targetAvatarPrimary: ap, targetAvatarSecondary: as2,
    targetSubavatarPrimary: sp, targetSubavatarSecondary: ss,
    scenarioWeight, priorityBase, cooldownDays, monthlyDelta, yearlyDelta, labelImpact };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CÓMODO / CONVENIENCIA INMEDIATA — 15 preguntas
//    Gasta más por comodidad: delivery, taxi, café fuera, opciones premium
//    Días: entre semana (rutina). Momentos: mañana (café/transporte), noche (delivery)
// ═══════════════════════════════════════════════════════════════════════════════
const Q_CONVENIENCIA: DailyQuestion[] = [
  q('Q_CI_01', 'Si hoy has cocinado en casa en vez de pedir delivery, ¿cuánto te has ahorrado?', 12, 'Delivery', 'Lunes, Martes, Miércoles, Jueves', 'Noche', 'Cualquiera', 'comodo', 'impulsivo', 'conveniencia_inmediata', '', 3, 9, 2, 48, 576, 'Evitar 1 pedido semanal ahorra ~48 €/mes'),
  q('Q_CI_02', 'Si hoy te has preparado el café en casa en vez de comprarlo fuera, ¿cuánto te has ahorrado?', 3, 'Cafés', 'Lunes a Viernes', 'Mañana', 'Cualquiera', 'comodo', 'desordenado', 'conveniencia_inmediata', 'microfugas', 2, 7, 2, 45, 540, 'Café en casa cada día laborable ahorra ~45 €/mes'),
  q('Q_CI_03', 'Si hoy has ido andando o en transporte público en vez de coger taxi/VTC, ¿cuánto te has ahorrado?', 8, 'Transporte', 'Lunes a Viernes', 'Mañana', 'Cualquiera', 'comodo', '', 'conveniencia_inmediata', '', 2, 7, 3, 32, 384, 'Evitar 1 taxi semanal ahorra ~32 €/mes'),
  q('Q_CI_04', 'Si hoy has llevado comida de casa al trabajo en vez de comprar fuera, ¿cuánto te has ahorrado?', 8, 'Comida', 'Lunes a Viernes', 'Mañana', 'Cualquiera', 'comodo', '', 'conveniencia_inmediata', 'improvisador', 3, 8, 2, 64, 768, 'Llevar táper 2 días más por semana ahorra ~64 €/mes'),
  q('Q_CI_05', 'Si esta noche has cenado algo sencillo de casa en vez de pedir comida, ¿cuánto te has ahorrado?', 10, 'Delivery', 'Viernes, Sábado', 'Noche', 'Cualquiera', 'comodo', 'social', 'conveniencia_inmediata', '', 3, 8, 3, 40, 480, 'Evitar delivery de fin de semana ahorra ~40 €/mes'),
  q('Q_CI_06', 'Si hoy has revisado la nevera antes de abrir la app de delivery, ¿cuánto te has ahorrado?', 12, 'Delivery', 'Cualquier día', 'Noche', 'Cualquiera', 'comodo', 'impulsivo', 'conveniencia_inmediata', 'antojo_emocional', 3, 8, 3, 36, 432, 'Revisar nevera antes de pedir evita ~3 pedidos/mes'),
  q('Q_CI_07', 'Si hoy has desayunado en casa en vez de comprar algo por el camino, ¿cuánto te has ahorrado?', 4, 'Cafés', 'Lunes a Viernes', 'Mañana', 'Cualquiera', 'comodo', 'desordenado', 'conveniencia_inmediata', 'microfugas', 2, 6, 3, 60, 720, 'Desayunar en casa ahorra ~60 €/mes'),
  q('Q_CI_08', 'Si hoy has elegido menú del día en vez de pedir a la carta, ¿cuánto te has ahorrado?', 5, 'Comida', 'Lunes a Viernes', 'Tarde', 'Cualquiera', 'comodo', '', 'conveniencia_inmediata', '', 1, 5, 4, 20, 240, 'Elegir menú del día ahorra ~5 € por comida'),
  q('Q_CI_09', 'Si hoy has hecho la compra en persona en vez de pedirla online con recargo, ¿cuánto te has ahorrado?', 5, 'Compras', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'comodo', '', 'conveniencia_inmediata', '', 2, 6, 7, 20, 240, 'Compra presencial ahorra el recargo de envío'),
  q('Q_CI_10', 'Si hoy has elegido la opción estándar en vez de la premium (envío, servicio…), ¿cuánto te has ahorrado?', 5, 'Servicios', 'Cualquier día', 'Tarde', 'Cualquiera', 'comodo', 'impulsivo', 'conveniencia_inmediata', '', 2, 6, 4, 15, 180, 'Evitar upgrades innecesarios ahorra ~15 €/mes'),
  q('Q_CI_11', 'Si hoy has caminado un trayecto corto en vez de pedir un VTC, ¿cuánto te has ahorrado?', 6, 'Transporte', 'Cualquier día', 'Tarde', 'Cualquiera', 'comodo', '', 'conveniencia_inmediata', '', 2, 6, 4, 24, 288, 'Caminar trayectos cortos ahorra ~24 €/mes'),
  q('Q_CI_12', 'Si hoy has llevado tu propia botella de agua en vez de comprar, ¿cuánto te has ahorrado?', 2, 'Bebidas', 'Lunes a Viernes', 'Mañana', 'Cualquiera', 'comodo', 'desordenado', 'conveniencia_inmediata', 'microfugas', 1, 4, 5, 30, 360, 'Llevar botella propia ahorra ~30 €/mes'),
  q('Q_CI_13', 'Si hoy has evitado un gasto por comodidad (envío rápido, taxi corto, snack de máquina…), ¿cuánto?', 5, 'Comodidad', 'Martes, Miércoles, Jueves', 'Tarde', 'Cualquiera', 'comodo', '', 'conveniencia_inmediata', '', 2, 7, 3, 20, 240, 'Evitar gastos de comodidad ahorra ~20 €/mes'),
  q('Q_CI_14', 'Si hoy has preparado snacks de casa en vez de comprar en la tienda o máquina, ¿cuánto te has ahorrado?', 3, 'Snacks', 'Lunes a Viernes', 'Mañana', 'Cualquiera', 'comodo', 'desordenado', 'conveniencia_inmediata', 'microfugas', 1, 5, 4, 36, 432, 'Snacks de casa en vez de máquina ahorra ~36 €/mes'),
  q('Q_CI_15', 'Si hoy has usado un servicio gratuito en vez de pagar la versión rápida/premium, ¿cuánto?', 4, 'Servicios', 'Cualquier día', 'Tarde', 'Cualquiera', 'comodo', 'impulsivo', 'conveniencia_inmediata', '', 2, 5, 5, 12, 144, 'Usar opciones gratuitas ahorra ~12 €/mes'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// 2. CÓMODO / IMPROVISADOR — 15 preguntas
//    No planifica, acaba gastando más de lo necesario por falta de previsión
//    Días: entre semana (decisiones de comida). Momentos: antes de comer/cenar
// ═══════════════════════════════════════════════════════════════════════════════
const Q_IMPROVISADOR: DailyQuestion[] = [
  q('Q_IM_01', 'Si hoy has planificado la cena en vez de decidir a última hora (delivery/fuera), ¿cuánto te has ahorrado?', 10, 'Planificación', 'Lunes, Martes, Miércoles, Jueves', 'Tarde', 'Cualquiera', 'comodo', '', 'improvisador', 'conveniencia_inmediata', 3, 8, 2, 40, 480, 'Planificar cena evita delivery impulsivo'),
  q('Q_IM_02', 'Si hoy ya tenías pensado qué comer y no has improvisado comprando fuera, ¿cuánto te has ahorrado?', 8, 'Planificación', 'Lunes a Viernes', 'Mañana', 'Cualquiera', 'comodo', '', 'improvisador', 'conveniencia_inmediata', 3, 8, 2, 48, 576, 'Planificar comida ahorra ~48 €/mes'),
  q('Q_IM_03', 'Si hoy has preparado comida para aprovechar sobras en vez de comprar nuevo, ¿cuánto te has ahorrado?', 6, 'Sobras', 'Cualquier día', 'Noche', 'Cualquiera', 'comodo', 'desordenado', 'improvisador', 'microfugas', 2, 7, 3, 24, 288, 'Usar sobras evita ~6 compras innecesarias/mes'),
  q('Q_IM_04', 'Si hoy has hecho la compra con lista y no te has desviado, ¿cuánto te has ahorrado?', 10, 'Compras', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'comodo', 'desordenado', 'improvisador', 'sin_sistema', 2, 7, 7, 40, 480, 'Comprar con lista evita ~40 € en extras/mes'),
  q('Q_IM_05', 'Si esta noche has dejado algo preparado para mañana (comida, café, ropa), ¿cuánto evitarás gastar?', 5, 'Planificación', 'Domingo, Lunes, Martes, Miércoles, Jueves', 'Noche', 'Cualquiera', 'comodo', '', 'improvisador', '', 2, 7, 3, 20, 240, 'Preparar la noche anterior evita gastos por prisa'),
  q('Q_IM_06', 'Si hoy has buscado ruta en transporte público en vez de improvisar con taxi, ¿cuánto te has ahorrado?', 7, 'Transporte', 'Lunes a Viernes', 'Mañana', 'Cualquiera', 'comodo', '', 'improvisador', 'conveniencia_inmediata', 2, 6, 4, 28, 336, 'Planificar transporte evita taxis de última hora'),
  q('Q_IM_07', 'Si hoy has planificado los menús de la semana, ¿cuánto crees que ahorrarás?', 15, 'Planificación', 'Domingo', 'Mañana', 'Cualquiera', 'comodo', '', 'improvisador', '', 3, 9, 7, 60, 720, 'Meal prep semanal ahorra ~60 €/mes'),
  q('Q_IM_08', 'Si hoy, al pensar "me pido algo", has parado y cocinado algo rápido, ¿cuánto te has ahorrado?', 10, 'Delivery', 'Cualquier día', 'Noche', 'Cualquiera', 'comodo', 'impulsivo', 'improvisador', 'antojo_emocional', 3, 8, 3, 30, 360, 'Parar y cocinar evita pedidos impulsivos'),
  q('Q_IM_09', 'Si hoy has traído café/snack de casa en vez de improvisar comprando, ¿cuánto te has ahorrado?', 4, 'Cafés', 'Lunes a Viernes', 'Mañana', 'Cualquiera', 'comodo', '', 'improvisador', 'microfugas', 2, 6, 3, 48, 576, 'Llevar café y snack de casa ahorra ~48 €/mes'),
  q('Q_IM_10', 'Si hoy has evitado una compra de "emergencia" en tienda de barrio (más cara), ¿cuánto te has ahorrado?', 4, 'Compras', 'Cualquier día', 'Tarde', 'Cualquiera', 'comodo', 'desordenado', 'improvisador', 'microfugas', 2, 6, 4, 16, 192, 'Evitar compras de emergencia ahorra ~16 €/mes'),
  q('Q_IM_11', 'Si hoy has tenido un plan para la tarde/noche y no has acabado gastando por aburrimiento, ¿cuánto?', 8, 'Ocio', 'Viernes', 'Tarde', 'Cualquiera', 'comodo', 'social', 'improvisador', '', 2, 7, 4, 32, 384, 'Tener plan evita gastos por improvisación'),
  q('Q_IM_12', 'Si hoy has cocinado de más para tener comida mañana, ¿cuánto te ahorrarás?', 8, 'Planificación', 'Domingo, Martes, Miércoles', 'Noche', 'Cualquiera', 'comodo', '', 'improvisador', '', 2, 7, 4, 32, 384, 'Cocinar de más evita comprar al día siguiente'),
  q('Q_IM_13', 'Si te ha dado pereza cocinar pero has hecho algo rápido en casa igualmente, ¿cuánto te has ahorrado?', 10, 'Delivery', 'Lunes, Martes, Miércoles', 'Noche', 'Cualquiera', 'comodo', '', 'improvisador', 'conveniencia_inmediata', 3, 8, 3, 30, 360, 'Algo rápido en casa siempre es más barato que delivery'),
  q('Q_IM_14', 'Si hoy has precocinado batch para varios días, ¿cuánto crees que ahorrarás esta semana?', 20, 'Planificación', 'Domingo', 'Tarde', 'Cualquiera', 'comodo', '', 'improvisador', '', 3, 9, 7, 60, 720, 'Batch cooking semanal ahorra ~60 €/mes'),
  q('Q_IM_15', 'Si hoy has puesto una alarma/recordatorio para no improvisar la comida de mañana, ¿cuánto evitarás?', 8, 'Planificación', 'Lunes, Martes, Miércoles, Jueves', 'Noche', 'Cualquiera', 'comodo', '', 'improvisador', '', 2, 6, 4, 32, 384, 'Recordatorios nocturnos eliminan improvisación matutina'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SOCIAL / FOMO SOCIAL — 15 preguntas
//    Dice que sí a todo por miedo a perdérselo, gasta en planes sociales
//    Días: Jueves–Sábado (planes). Momentos: Tarde (decisiones) y Noche (salidas)
// ═══════════════════════════════════════════════════════════════════════════════
const Q_FOMO: DailyQuestion[] = [
  q('Q_FS_01', 'Si hoy te han propuesto un plan caro y has dicho que no o propuesto algo más barato, ¿cuánto te has ahorrado?', 15, 'Planes sociales', 'Jueves, Viernes, Sábado', 'Tarde', 'Cualquiera', 'social', 'impulsivo', 'fomo_social', '', 3, 9, 3, 60, 720, 'Decir no a 1 plan caro al mes ahorra ~60 €'),
  q('Q_FS_02', 'Si hoy has cenado en casa antes de salir con amigos para gastar menos fuera, ¿cuánto te has ahorrado?', 12, 'Planes sociales', 'Viernes, Sábado', 'Tarde', 'Cualquiera', 'social', 'comodo', 'fomo_social', '', 3, 9, 3, 48, 576, 'Cenar antes de salir ahorra ~12 € por noche'),
  q('Q_FS_03', 'Si hoy has propuesto un plan gratuito o barato a tus amigos en vez de uno caro, ¿cuánto te has ahorrado?', 15, 'Planes sociales', 'Viernes, Sábado, Domingo', 'Tarde', 'Cualquiera', 'social', '', 'fomo_social', '', 3, 8, 4, 45, 540, 'Proponer planes baratos ahorra ~45 €/mes'),
  q('Q_FS_04', 'Si hoy has salido con un presupuesto máximo y lo has respetado, ¿cuánto te has ahorrado vs lo que hubieras gastado?', 10, 'Control social', 'Viernes, Sábado', 'Tarde', 'Cualquiera', 'social', 'desordenado', 'fomo_social', 'sin_sistema', 3, 8, 3, 40, 480, 'Salir con presupuesto ahorra ~40 €/mes'),
  q('Q_FS_05', 'Si hoy has elegido un plan de domingo gratuito (parque, paseo, casa) en vez de pagar, ¿cuánto te has ahorrado?', 12, 'Ocio gratis', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'social', '', 'fomo_social', '', 2, 7, 4, 36, 432, 'Planes gratis de fin de semana ahorran ~36 €/mes'),
  q('Q_FS_06', 'Si hoy has dicho que no a un plan que realmente no te apetecía (solo ibas por quedar bien), ¿cuánto?', 20, 'FOMO', 'Jueves, Viernes, Sábado', 'Tarde', 'Cualquiera', 'social', '', 'fomo_social', '', 3, 9, 4, 40, 480, 'Decir no a planes por compromiso ahorra mucho'),
  q('Q_FS_07', 'Es lunes. Si el finde has controlado el gasto social, ¿cuánto menos has gastado de lo que sueles?', 15, 'Reflexión', 'Lunes', 'Mañana', 'Cualquiera', 'social', '', 'fomo_social', 'plan_que_se_alarga', 2, 7, 7, 30, 360, 'Reflexionar el lunes refuerza el control'),
  q('Q_FS_08', 'Si hoy has salido solo con efectivo limitado para controlar gasto, ¿cuánto te has ahorrado?', 10, 'Control social', 'Viernes, Sábado', 'Tarde', 'Cualquiera', 'social', '', 'fomo_social', '', 2, 7, 4, 40, 480, 'Salir con cash limita naturalmente el gasto'),
  q('Q_FS_09', 'Si hoy has propuesto hacer plan en casa (series, cena, juegos) en vez de salir, ¿cuánto te has ahorrado?', 15, 'Planes sociales', 'Viernes, Sábado', 'Tarde', 'Cualquiera', 'social', 'comodo', 'fomo_social', '', 2, 7, 4, 45, 540, 'Ver algo en casa con amigos vs bar ahorra ~15 €'),
  q('Q_FS_10', 'Si acabas de cobrar y has evitado un plan social caro para no caer en la euforia del cobro, ¿cuánto?', 20, 'Post-cobro', 'Cualquier día', 'Tarde', 'Inicio', 'social', 'impulsivo', 'fomo_social', '', 3, 8, 7, 30, 360, 'Controlar post-cobro evita excesos'),
  q('Q_FS_11', 'Si hoy has elegido un sitio más barato para salir con amigos, ¿cuánto te has ahorrado?', 8, 'Planes sociales', 'Viernes, Sábado', 'Noche', 'Cualquiera', 'social', '', 'fomo_social', '', 2, 7, 3, 32, 384, 'Elegir sitios más baratos ahorra ~32 €/mes'),
  q('Q_FS_12', 'Si hoy te has ido a tu hora en vez de quedarte "un rato más" gastando, ¿cuánto te has ahorrado?', 10, 'Planes sociales', 'Viernes, Sábado', 'Noche', 'Cualquiera', 'social', '', 'fomo_social', 'plan_que_se_alarga', 3, 8, 3, 40, 480, 'Irse a la hora prevista evita el gasto extra'),
  q('Q_FS_13', 'Si hoy has disfrutado de un plan solo/a o tranquilo en vez de ir a todo lo que te proponen, ¿cuánto?', 15, 'FOMO', 'Cualquier día', 'Tarde', 'Cualquiera', 'social', '', 'fomo_social', '', 2, 7, 5, 30, 360, 'Disfrutar de planes tranquilos reduce gasto social'),
  q('Q_FS_14', 'Si hoy es domingo y estás revisando lo que has gastado este finde en social, ¿cuánto has ahorrado vs otros findes?', 10, 'Reflexión', 'Domingo', 'Mañana', 'Cualquiera', 'social', 'desordenado', 'fomo_social', '', 2, 6, 7, 25, 300, 'Revisar gasto social cada semana da perspectiva'),
  q('Q_FS_15', 'Si esta semana has quedado con amigos para hacer algo gratis (deporte, paseo, casa), ¿cuánto te has ahorrado?', 12, 'Ocio gratis', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'social', '', 'fomo_social', '', 2, 7, 7, 36, 432, 'Alternar planes gratis reduce el gasto mensual'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SOCIAL / PLAN QUE SE ALARGA — 15 preguntas
//    El plan empieza barato pero escala: segunda ronda, cambio de sitio, taxis
//    Días: Viernes–Sábado (noches). Momentos: Noche (cuando escala)
// ═══════════════════════════════════════════════════════════════════════════════
const Q_PLAN_ALARGA: DailyQuestion[] = [
  q('Q_PA_01', 'Si anoche te fuiste a tu hora en vez de quedarte a "una más", ¿cuánto te has ahorrado?', 12, 'Escalada social', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'social', '', 'plan_que_se_alarga', 'fomo_social', 3, 9, 3, 48, 576, 'Irse a la hora planeada evita 2-3 copas extra'),
  q('Q_PA_02', 'Si anoche evitaste la segunda ronda de copas, ¿cuánto te has ahorrado?', 10, 'Escalada social', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'social', '', 'plan_que_se_alarga', '', 3, 9, 3, 40, 480, 'Saltarse la segunda ronda ahorra ~10 € por noche'),
  q('Q_PA_03', 'Si anoche cambiaste a agua o refresco a mitad de noche, ¿cuánto te has ahorrado?', 8, 'Bebidas', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'social', '', 'plan_que_se_alarga', '', 2, 7, 3, 32, 384, 'Alternar con agua ahorra ~8 € por noche'),
  q('Q_PA_04', 'Si anoche os quedasteis en un solo sitio en vez de ir cambiando de bar, ¿cuánto te has ahorrado?', 12, 'Escalada social', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'social', '', 'plan_que_se_alarga', '', 3, 8, 3, 36, 432, 'Cada cambio de bar suma ~10-15 € extra'),
  q('Q_PA_05', 'Si hoy antes de salir te has puesto un tope de gasto para esta noche, ¿cuánto crees que ahorrarás?', 10, 'Control previo', 'Viernes, Sábado', 'Tarde', 'Cualquiera', 'social', 'desordenado', 'plan_que_se_alarga', 'sin_sistema', 3, 8, 3, 40, 480, 'Ponerse un tope antes de salir funciona'),
  q('Q_PA_06', 'Si anoche evitaste invitar una ronda, ¿cuánto te has ahorrado?', 15, 'Rondas', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'social', '', 'plan_que_se_alarga', '', 2, 7, 4, 30, 360, 'No invitar rondas por presión social ahorra mucho'),
  q('Q_PA_07', 'Es lunes. Si el fin de semana controlaste los planes que se alargan, ¿cuánto menos gastaste?', 15, 'Reflexión', 'Lunes', 'Mañana', 'Cualquiera', 'social', '', 'plan_que_se_alarga', 'fomo_social', 2, 7, 7, 30, 360, 'Lunes de reflexión refuerza el control nocturno'),
  q('Q_PA_08', 'Si anoche elegiste volver andando o en bus en vez de coger taxi de madrugada, ¿cuánto te has ahorrado?', 10, 'Transporte nocturno', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'social', 'comodo', 'plan_que_se_alarga', 'conveniencia_inmediata', 2, 7, 3, 40, 480, 'Evitar taxi de madrugada ahorra ~10 € por noche'),
  q('Q_PA_09', 'Si anoche pediste la cuenta antes de que el plan escalara, ¿cuánto te has ahorrado?', 10, 'Escalada social', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'social', '', 'plan_que_se_alarga', '', 3, 8, 3, 30, 360, 'Pedir la cuenta a tiempo frena la escalada'),
  q('Q_PA_10', 'Si hoy has tomado algo antes de salir (pre-cena, hidratarte) para gastar menos fuera, ¿cuánto ahorrarás?', 8, 'Control previo', 'Viernes, Sábado', 'Tarde', 'Cualquiera', 'social', 'comodo', 'plan_que_se_alarga', '', 2, 7, 3, 32, 384, 'Precena en casa reduce gasto en restaurante'),
  q('Q_PA_11', 'Si hoy has propuesto el plan (sitio, hora) en vez de dejar que otros elijan uno más caro, ¿cuánto?', 10, 'Control social', 'Jueves, Viernes', 'Tarde', 'Cualquiera', 'social', '', 'plan_que_se_alarga', 'fomo_social', 2, 7, 4, 30, 360, 'Proponer tú el plan te da control del gasto'),
  q('Q_PA_12', 'Si anoche dijiste "yo paso" cuando el grupo quería seguir la fiesta, ¿cuánto te has ahorrado?', 15, 'Escalada social', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'social', '', 'plan_que_se_alarga', '', 3, 9, 3, 45, 540, 'Saber decir "yo paso" es el mayor ahorro social'),
  q('Q_PA_13', 'Si anoche compartiste platos/tapas en vez de pedir cada uno por separado, ¿cuánto te has ahorrado?', 6, 'Comida social', 'Viernes, Sábado', 'Noche', 'Cualquiera', 'social', '', 'plan_que_se_alarga', '', 1, 5, 4, 18, 216, 'Compartir platos reduce la cuenta un 30%'),
  q('Q_PA_14', 'Si esta noche piensas salir, ¿ya tienes hora de vuelta definida? Si la respetas, ¿cuánto ahorrarás?', 10, 'Control previo', 'Viernes, Sábado', 'Tarde', 'Cualquiera', 'social', '', 'plan_que_se_alarga', '', 3, 8, 3, 40, 480, 'Hora de vuelta definida = gasto controlado'),
  q('Q_PA_15', 'Si anoche te quedaste en un solo plan en vez de hacer bar-hopping, ¿cuánto te has ahorrado?', 15, 'Escalada social', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'social', '', 'plan_que_se_alarga', '', 3, 8, 3, 45, 540, 'Quedarse en un sitio vs bar-hopping ahorra mucho'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// 5. IMPULSIVO / ANTOJO EMOCIONAL — 15 preguntas
//    Compra por capricho, emoción, aburrimiento o ansiedad
//    Días: cualquiera (el impulso no tiene día fijo). Momentos: noche (online)
// ═══════════════════════════════════════════════════════════════════════════════
const Q_ANTOJO: DailyQuestion[] = [
  q('Q_AE_01', 'Si hoy has cerrado una app de compras sin comprar nada, ¿cuánto te has ahorrado?', 20, 'Compra online', 'Cualquier día', 'Noche', 'Cualquiera', 'impulsivo', 'comodo', 'antojo_emocional', '', 3, 9, 2, 40, 480, 'Cerrar la app sin comprar ahorra ~40 €/mes'),
  q('Q_AE_02', 'Si hoy has visto algo que querías y has aplicado la regla de esperar 24h, ¿cuánto te has ahorrado?', 25, 'Impulso', 'Cualquier día', 'Noche', 'Cualquiera', 'impulsivo', '', 'antojo_emocional', '', 3, 9, 3, 50, 600, 'La regla de 24h evita el 70% de compras impulsivas'),
  q('Q_AE_03', 'Si hoy has vaciado tu carrito online sin comprar, ¿cuánto te has ahorrado?', 30, 'Compra online', 'Cualquier día', 'Noche', 'Cualquiera', 'impulsivo', '', 'antojo_emocional', 'cazador_de_ofertas', 3, 8, 3, 60, 720, 'Vaciar el carrito en vez de pagar ahorra mucho'),
  q('Q_AE_04', 'Si hoy has sentido ganas de comprarte algo por estrés/ansiedad y no lo has hecho, ¿cuánto?', 15, 'Emocional', 'Cualquier día', 'Noche', 'Cualquiera', 'impulsivo', '', 'antojo_emocional', '', 3, 9, 3, 30, 360, 'Reconocer compra emocional es el primer paso'),
  q('Q_AE_05', 'Si hoy has evitado un capricho de comida/bebida (snack, café especial, dulce), ¿cuánto te has ahorrado?', 4, 'Caprichos', 'Cualquier día', 'Tarde', 'Cualquiera', 'impulsivo', 'comodo', 'antojo_emocional', 'microfugas', 2, 7, 2, 48, 576, 'Los caprichos diarios suman mucho al mes'),
  q('Q_AE_06', 'Si hoy has salido a caminar/hacer deporte en vez de comprar para "sentirte mejor", ¿cuánto?', 10, 'Emocional', 'Cualquier día', 'Tarde', 'Cualquiera', 'impulsivo', '', 'antojo_emocional', '', 2, 7, 4, 20, 240, 'El deporte gratis sustituye al shopping emocional'),
  q('Q_AE_07', 'Si hoy has resistido una notificación de oferta/promoción sin entrar a comprar, ¿cuánto?', 15, 'Notificaciones', 'Cualquier día', 'Tarde', 'Cualquiera', 'impulsivo', '', 'antojo_emocional', 'cazador_de_ofertas', 2, 7, 3, 30, 360, 'Ignorar notificaciones de ofertas evita compras innecesarias'),
  q('Q_AE_08', 'Si hoy no has abierto apps de compras (Amazon, Shein, Zara…), ¿cuánto te has ahorrado?', 15, 'Compra online', 'Cualquier día', 'Mañana', 'Cualquiera', 'impulsivo', '', 'antojo_emocional', '', 3, 8, 3, 30, 360, 'No abrir apps de compras elimina la tentación'),
  q('Q_AE_09', 'Si hoy has elegido entretenimiento gratuito (leer, pasear, peli en casa) en vez de gastar, ¿cuánto?', 10, 'Ocio', 'Cualquier día', 'Noche', 'Cualquiera', 'impulsivo', '', 'antojo_emocional', '', 2, 6, 4, 20, 240, 'Entretenimiento gratis vs de pago ahorra ~20 €/mes'),
  q('Q_AE_10', 'Si hoy has eliminado un artículo del carrito antes de finalizar la compra, ¿cuánto te has ahorrado?', 15, 'Compra online', 'Cualquier día', 'Noche', 'Cualquiera', 'impulsivo', '', 'antojo_emocional', '', 2, 7, 3, 30, 360, 'Revisar el carrito antes de pagar reduce el gasto'),
  q('Q_AE_11', 'Si hoy sentías un antojo de algo y lo has sustituido por una alternativa gratis, ¿cuánto?', 5, 'Caprichos', 'Cualquier día', 'Tarde', 'Cualquiera', 'impulsivo', 'comodo', 'antojo_emocional', '', 2, 7, 3, 20, 240, 'Sustituir antojos por alternativas gratis funciona'),
  q('Q_AE_12', 'Si hoy te has dado un "autocuidado gratis" (baño, música, paseo) en vez de comprar algo, ¿cuánto?', 10, 'Emocional', 'Sábado, Domingo', 'Tarde', 'Cualquiera', 'impulsivo', '', 'antojo_emocional', '', 2, 6, 5, 20, 240, 'Autocuidado gratis sustituye a comprarse caprichos'),
  q('Q_AE_13', 'Si hoy has dejado pasar una "oportunidad" de comprar algo que no necesitabas, ¿cuánto?', 20, 'Impulso', 'Cualquier día', 'Tarde', 'Cualquiera', 'impulsivo', '', 'antojo_emocional', 'cazador_de_ofertas', 3, 8, 4, 40, 480, 'Dejar pasar "oportunidades" ahorra mucho a largo plazo'),
  q('Q_AE_14', 'Si hoy has evitado añadir extras al finalizar una compra (el típico "¿quieres añadir…?"), ¿cuánto?', 5, 'Extras', 'Cualquier día', 'Tarde', 'Cualquiera', 'impulsivo', 'comodo', 'antojo_emocional', 'microfugas', 2, 6, 3, 15, 180, 'Los extras al comprar suman ~15 €/mes'),
  q('Q_AE_15', 'Domingo de reflexión: ¿cuánto has evitado gastar en impulsos esta semana?', 15, 'Reflexión', 'Domingo', 'Mañana', 'Cualquiera', 'impulsivo', '', 'antojo_emocional', '', 2, 7, 7, 30, 360, 'Reflexionar el domingo refuerza el autocontrol'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// 6. IMPULSIVO / CAZADOR DE OFERTAS — 15 preguntas
//    Compra cosas que no necesita solo porque están en oferta/rebaja/2x1
//    Días: cualquiera. Momentos: tarde (tiendas), noche (online)
// ═══════════════════════════════════════════════════════════════════════════════
const Q_CAZADOR: DailyQuestion[] = [
  q('Q_CO_01', 'Si hoy has visto una oferta y has decidido no comprar porque no lo necesitabas, ¿cuánto te has ahorrado?', 15, 'Ofertas', 'Cualquier día', 'Tarde', 'Cualquiera', 'impulsivo', '', 'cazador_de_ofertas', 'antojo_emocional', 3, 9, 2, 30, 360, 'No picar en ofertas innecesarias ahorra ~30 €/mes'),
  q('Q_CO_02', 'Si hoy has borrado o ignorado emails de rebajas/ofertas sin abrirlos, ¿cuánto te has ahorrado?', 10, 'Marketing', 'Cualquier día', 'Mañana', 'Cualquiera', 'impulsivo', '', 'cazador_de_ofertas', '', 2, 7, 3, 20, 240, 'No abrir emails de ofertas elimina la tentación'),
  q('Q_CO_03', 'Si hoy has visto un 2x1 y has pasado de él porque no lo necesitabas, ¿cuánto te has ahorrado?', 8, 'Ofertas', 'Cualquier día', 'Tarde', 'Cualquiera', 'impulsivo', '', 'cazador_de_ofertas', '', 2, 7, 3, 24, 288, 'Los 2x1 que no necesitas cuestan el doble de nada'),
  q('Q_CO_04', 'Si hoy has visto algo en rebajas y has esperado 48h antes de decidir, ¿cuánto te has ahorrado?', 20, 'Ofertas', 'Cualquier día', 'Noche', 'Cualquiera', 'impulsivo', '', 'cazador_de_ofertas', 'antojo_emocional', 3, 8, 3, 40, 480, 'Esperar 48h elimina el 80% de compras en rebajas'),
  q('Q_CO_05', 'Si hoy has ignorado notificaciones de "Flash Sale" o "Últimas unidades", ¿cuánto te has ahorrado?', 15, 'Marketing', 'Cualquier día', 'Tarde', 'Cualquiera', 'impulsivo', '', 'cazador_de_ofertas', '', 2, 8, 3, 30, 360, 'Las urgencias artificiales son manipulación pura'),
  q('Q_CO_06', 'Si hoy te has desuscrito de alguna newsletter de ofertas/tienda, ¿cuánto evitarás gastar al mes?', 10, 'Marketing', 'Lunes', 'Mañana', 'Cualquiera', 'impulsivo', '', 'cazador_de_ofertas', '', 2, 7, 14, 20, 240, 'Menos newsletters = menos tentaciones'),
  q('Q_CO_07', 'Si hoy has ido a la compra solo con lista y no has comprado cosas en oferta que no necesitabas, ¿cuánto?', 10, 'Compras', 'Sábado', 'Mañana', 'Cualquiera', 'impulsivo', 'comodo', 'cazador_de_ofertas', 'improvisador', 3, 8, 7, 40, 480, 'Solo con lista = sin extras innecesarios en oferta'),
  q('Q_CO_08', 'Si hoy has pensado "¿lo compraría sin descuento?" y la respuesta era no, ¿cuánto te has ahorrado?', 15, 'Reflexión', 'Cualquier día', 'Tarde', 'Cualquiera', 'impulsivo', '', 'cazador_de_ofertas', '', 3, 9, 3, 30, 360, 'Si no lo comprarías a precio normal, no lo necesitas'),
  q('Q_CO_09', 'Si hoy has evitado comprar un "añadido" tentador en caja (chicles, gadgets, ofertas), ¿cuánto?', 4, 'Extras', 'Cualquier día', 'Tarde', 'Cualquiera', 'impulsivo', 'desordenado', 'cazador_de_ofertas', 'microfugas', 1, 5, 3, 12, 144, 'Los extras de caja suman ~12 €/mes sin que te des cuenta'),
  q('Q_CO_10', 'Si hoy has evitado entrar en webs de ofertas diarias (Groupon, outlets, deals), ¿cuánto?', 15, 'Compra online', 'Martes, Miércoles', 'Noche', 'Cualquiera', 'impulsivo', '', 'cazador_de_ofertas', '', 2, 7, 4, 30, 360, 'No visitar webs de ofertas elimina la compra innecesaria'),
  q('Q_CO_11', 'Si hoy has dicho no a un "regalo por compra mínima" que te hubiese hecho gastar de más, ¿cuánto?', 10, 'Marketing', 'Cualquier día', 'Tarde', 'Cualquiera', 'impulsivo', '', 'cazador_de_ofertas', '', 2, 7, 5, 20, 240, 'Gastar más para el regalo no es ahorrar'),
  q('Q_CO_12', 'Si a principios de mes has fijado un tope para "ofertas" y hoy lo has respetado, ¿cuánto has ahorrado?', 20, 'Control', 'Cualquier día', 'Mañana', 'Inicio', 'impulsivo', 'desordenado', 'cazador_de_ofertas', 'sin_sistema', 3, 8, 7, 40, 480, 'Tope mensual de ofertas controla la hemorragia'),
  q('Q_CO_13', 'Si hoy has calculado el descuento real (no el % inflado) y has decidido que no valía la pena, ¿cuánto?', 12, 'Ofertas', 'Cualquier día', 'Tarde', 'Cualquiera', 'impulsivo', '', 'cazador_de_ofertas', '', 2, 7, 4, 24, 288, 'Calcular el descuento real destapa el humo del marketing'),
  q('Q_CO_14', 'Domingo de revisión: ¿cuánto has evitado gastar en ofertas/rebajas esta semana?', 15, 'Reflexión', 'Domingo', 'Mañana', 'Cualquiera', 'impulsivo', '', 'cazador_de_ofertas', '', 2, 7, 7, 30, 360, 'Reflexionar cada semana sobre ofertas da perspectiva'),
  q('Q_CO_15', 'Si hoy has preguntado "¿dónde voy a guardar esto?" antes de comprar algo en oferta y no lo has comprado, ¿cuánto?', 15, 'Ofertas', 'Cualquier día', 'Noche', 'Cualquiera', 'impulsivo', '', 'cazador_de_ofertas', '', 2, 7, 4, 30, 360, 'Si no tienes dónde ponerlo, no lo necesitas'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// 7. DESORDENADO / MICROFUGAS — 15 preguntas
//    Pequeños gastos diarios que no controla y que suman mucho
//    Días: entre semana (rutina diaria). Momentos: mañana (cafés) y tarde (snacks)
// ═══════════════════════════════════════════════════════════════════════════════
const Q_MICROFUGAS: DailyQuestion[] = [
  q('Q_MF_01', 'Si hoy te has preparado el café en casa en vez de comprarlo, ¿cuánto te has ahorrado?', 2, 'Cafés', 'Lunes a Viernes', 'Mañana', 'Cualquiera', 'desordenado', 'comodo', 'microfugas', 'conveniencia_inmediata', 2, 8, 2, 40, 480, 'El café diario fuera cuesta ~40 €/mes'),
  q('Q_MF_02', 'Si hoy has traído comida/snacks de casa en vez de comprar algo suelto, ¿cuánto te has ahorrado?', 4, 'Snacks', 'Lunes a Viernes', 'Mañana', 'Cualquiera', 'desordenado', 'comodo', 'microfugas', 'conveniencia_inmediata', 2, 7, 2, 48, 576, 'Snacks sueltos cuestan ~48 €/mes'),
  q('Q_MF_03', 'Si hoy has evitado la máquina de vending/cafetería automática, ¿cuánto te has ahorrado?', 2, 'Vending', 'Lunes a Viernes', 'Tarde', 'Cualquiera', 'desordenado', '', 'microfugas', '', 2, 7, 2, 30, 360, 'La máquina de vending cuesta ~30 €/mes'),
  q('Q_MF_04', 'Si hoy has revisado suscripciones y cancelado alguna que no usas, ¿cuánto te ahorras al mes?', 8, 'Suscripciones', 'Cualquier día', 'Mañana', 'Cualquiera', 'desordenado', '', 'microfugas', 'sin_sistema', 3, 8, 14, 12, 144, 'Las suscripciones olvidadas cuestan ~12 €/mes'),
  q('Q_MF_05', 'Si hoy has usado tu propia botella de agua en vez de comprar, ¿cuánto te has ahorrado?', 1, 'Bebidas', 'Cualquier día', 'Mañana', 'Cualquiera', 'desordenado', '', 'microfugas', '', 1, 5, 3, 20, 240, 'Comprar agua embotellada suma ~20 €/mes'),
  q('Q_MF_06', 'Si hoy has pasado por una tienda sin entrar "a mirar" y acabar comprando algo, ¿cuánto te has ahorrado?', 8, 'Compras casuales', 'Cualquier día', 'Tarde', 'Cualquiera', 'desordenado', 'impulsivo', 'microfugas', 'antojo_emocional', 2, 7, 3, 24, 288, 'Entrar "solo a mirar" casi nunca es gratis'),
  q('Q_MF_07', 'Si hoy has usado la versión gratuita de algo en vez de pagar premium, ¿cuánto te has ahorrado?', 5, 'Apps/Servicios', 'Cualquier día', 'Tarde', 'Cualquiera', 'desordenado', 'comodo', 'microfugas', 'conveniencia_inmediata', 2, 6, 5, 10, 120, 'Las versiones gratuitas a menudo son suficientes'),
  q('Q_MF_08', 'Si hoy has comprado a granel o formato grande en vez de packs individuales, ¿cuánto te has ahorrado?', 3, 'Compras', 'Sábado', 'Mañana', 'Cualquiera', 'desordenado', '', 'microfugas', '', 2, 6, 7, 12, 144, 'Comprar a granel ahorra ~12 €/mes vs individual'),
  q('Q_MF_09', 'Si hoy has evitado comprar algo innecesario en el súper de barrio (más caro), ¿cuánto te has ahorrado?', 3, 'Compras', 'Lunes a Viernes', 'Tarde', 'Cualquiera', 'desordenado', 'comodo', 'microfugas', 'improvisador', 2, 6, 3, 18, 216, 'El súper de barrio tiene un 20% de sobrecoste'),
  q('Q_MF_10', 'Si esta noche has apuntado todos los gastos pequeños del día, ¿cuánto has detectado que podrías haber evitado?', 5, 'Control', 'Cualquier día', 'Noche', 'Cualquiera', 'desordenado', '', 'microfugas', 'sin_sistema', 3, 8, 3, 20, 240, 'Anotar gastos pequeños da visibilidad real'),
  q('Q_MF_11', 'Si hoy has evitado un refresco/zumo/bebida de máquina y has bebido agua, ¿cuánto te has ahorrado?', 2, 'Bebidas', 'Lunes a Viernes', 'Tarde', 'Cualquiera', 'desordenado', '', 'microfugas', '', 1, 5, 2, 24, 288, 'Refrescos diarios cuestan ~24 €/mes'),
  q('Q_MF_12', 'Si hoy has compartido cuenta de streaming/servicio con alguien, ¿cuánto te ahorras al mes?', 5, 'Suscripciones', 'Cualquier día', 'Noche', 'Cualquiera', 'desordenado', '', 'microfugas', '', 2, 6, 14, 8, 96, 'Compartir cuentas reduce suscripciones a la mitad'),
  q('Q_MF_13', 'Si hoy has traído tu propia bolsa a la compra y evitado pagar por bolsas, ¿cuánto te has ahorrado?', 1, 'Compras', 'Sábado, Domingo', 'Mañana', 'Cualquiera', 'desordenado', '', 'microfugas', '', 1, 3, 7, 3, 36, 'Cada bolsa son céntimos que suman al año'),
  q('Q_MF_14', 'Domingo de revisión: ¿cuánto suman tus gastos pequeños de esta semana que podrías haber evitado?', 10, 'Reflexión', 'Domingo', 'Mañana', 'Cualquiera', 'desordenado', '', 'microfugas', '', 2, 7, 7, 20, 240, 'Las microfugas semanales suman ~20 €'),
  q('Q_MF_15', 'Si hoy has identificado un gasto "invisible" que haces todos los días sin pensar, ¿cuánto es al mes?', 5, 'Conciencia', 'Cualquier día', 'Noche', 'Cualquiera', 'desordenado', '', 'microfugas', 'sin_sistema', 3, 8, 5, 20, 240, 'Identificar microfugas es el primer paso para pararlas'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// 8. DESORDENADO / SIN SISTEMA — 15 preguntas
//    No tiene presupuesto ni control, el dinero se va sin saber a dónde
//    Días: Lunes (inicio semana), Domingo (revisión), fin de mes
//    Momentos: Mañana (moment de claridad)
// ═══════════════════════════════════════════════════════════════════════════════
const Q_SIN_SISTEMA: DailyQuestion[] = [
  q('Q_SS_01', 'Si hoy has mirado tu saldo bancario y has evitado un gasto por ser consciente, ¿cuánto te has ahorrado?', 10, 'Control', 'Lunes', 'Mañana', 'Cualquiera', 'desordenado', '', 'sin_sistema', '', 3, 9, 7, 20, 240, 'Mirar el saldo activa el control automático'),
  q('Q_SS_02', 'Si hoy te has puesto un límite de gasto para el día y lo has respetado, ¿cuánto te has ahorrado?', 8, 'Control', 'Lunes, Martes', 'Mañana', 'Cualquiera', 'desordenado', '', 'sin_sistema', '', 3, 8, 5, 32, 384, 'Un límite diario evita derroches sin control'),
  q('Q_SS_03', 'Si hoy domingo has revisado lo que has gastado esta semana, ¿cuánto crees que puedes mejorar la próxima?', 10, 'Reflexión', 'Domingo', 'Mañana', 'Cualquiera', 'desordenado', '', 'sin_sistema', 'microfugas', 3, 8, 7, 20, 240, 'La revisión semanal reduce gastos innecesarios'),
  q('Q_SS_04', 'Si hoy has descubierto un cargo recurrente que no sabías que tenías y lo has cancelado, ¿cuánto?', 10, 'Suscripciones', 'Cualquier día', 'Mañana', 'Cualquiera', 'desordenado', '', 'sin_sistema', 'microfugas', 3, 9, 14, 10, 120, 'Los cargos olvidados roban dinero cada mes'),
  q('Q_SS_05', 'Si hoy has categorizado tus gastos de ayer (comida, transporte, ocio…), ¿cuánto podrías haber evitado?', 5, 'Control', 'Cualquier día', 'Mañana', 'Cualquiera', 'desordenado', '', 'sin_sistema', '', 2, 7, 3, 15, 180, 'Categorizar gastos revela dónde se va el dinero'),
  q('Q_SS_06', 'Si esta semana te has fijado un presupuesto semanal, ¿cuánto has ahorrado vs no tener ninguno?', 15, 'Control', 'Lunes', 'Mañana', 'Cualquiera', 'desordenado', '', 'sin_sistema', '', 3, 9, 7, 30, 360, 'Tener presupuesto semanal reduce el gasto un 15-20%'),
  q('Q_SS_07', 'Si hoy has evitado un gasto que normalmente harías sin pensar, ¿cuánto te has ahorrado?', 8, 'Conciencia', 'Cualquier día', 'Tarde', 'Cualquiera', 'desordenado', 'impulsivo', 'sin_sistema', 'antojo_emocional', 2, 7, 3, 24, 288, 'Parar y pensar antes de gastar marca la diferencia'),
  q('Q_SS_08', 'Si estás a final de mes y has evitado un gasto para no quedarte justo, ¿cuánto te has ahorrado?', 10, 'Fin de mes', 'Cualquier día', 'Tarde', 'Final', 'desordenado', '', 'sin_sistema', '', 3, 9, 5, 20, 240, 'Controlar final de mes evita descubiertos'),
  q('Q_SS_09', 'Si a principio de mes has separado dinero fijo (alquiler, facturas) del variable, ¿cuánto te has ahorrado?', 15, 'Organización', 'Cualquier día', 'Mañana', 'Inicio', 'desordenado', '', 'sin_sistema', '', 3, 8, 30, 30, 360, 'Separar fijo de variable da claridad total'),
  q('Q_SS_10', 'Si a mitad de mes has revisado cuánto te queda y has ajustado tus gastos, ¿cuánto has ahorrado?', 10, 'Control', 'Cualquier día', 'Mañana', 'Mitad', 'desordenado', '', 'sin_sistema', '', 3, 8, 14, 20, 240, 'La revisión de mitad de mes evita sorpresas'),
  q('Q_SS_11', 'Si hoy has detectado un pago recurrente que puedes reducir (tarifa, seguro, plan), ¿cuánto al mes?', 10, 'Suscripciones', 'Cualquier día', 'Mañana', 'Final', 'desordenado', '', 'sin_sistema', '', 3, 8, 14, 15, 180, 'Las tarifas se pueden negociar casi siempre'),
  q('Q_SS_12', 'Si hoy, al ver tu saldo, has decidido NO hacer un gasto que ibas a hacer, ¿cuánto te has ahorrado?', 10, 'Control', 'Cualquier día', 'Tarde', 'Cualquiera', 'desordenado', '', 'sin_sistema', '', 2, 7, 3, 20, 240, 'La visibilidad del saldo frena el gasto automático'),
  q('Q_SS_13', 'Si hoy has encontrado un gasto mensual que puedes reducir o eliminar, ¿cuánto te ahorras al mes?', 8, 'Optimización', 'Cualquier día', 'Mañana', 'Cualquiera', 'desordenado', '', 'sin_sistema', '', 2, 7, 7, 12, 144, 'Optimizar gastos fijos reduce el coste de vida'),
  q('Q_SS_14', 'Si hoy has puesto una alarma semanal para revisar tus finanzas, ¿cuánto crees que ahorrarás?', 10, 'Hábito', 'Domingo', 'Mañana', 'Cualquiera', 'desordenado', '', 'sin_sistema', '', 2, 7, 14, 20, 240, 'La disciplina de revisar cada semana genera el hábito'),
  q('Q_SS_15', 'Si hoy has identificado tus 3 gastos más grandes del mes, ¿cuánto podrías reducir de cada uno?', 15, 'Reflexión', 'Cualquier día', 'Mañana', 'Final', 'desordenado', '', 'sin_sistema', '', 3, 8, 30, 30, 360, 'Conocer tus top 3 gastos es el primer paso'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// 9. CONSTRUCTOR (transversal) — 15 preguntas
//    Refuerzo positivo para usuarios con racha alta. Microahorros extra.
//    Días: cualquiera. Momentos: mañana (motivación), domingo (celebración)
// ═══════════════════════════════════════════════════════════════════════════════
const Q_CONSTRUCTOR: DailyQuestion[] = [
  q('Q_CT_01', 'Estás en racha. Si hoy has encontrado una forma de ahorrar algo extra, ¿cuánto?', 5, 'Microahorro', 'Cualquier día', 'Mañana', 'Cualquiera', 'constructor', '', '', '', 2, 7, 3, 10, 120, 'Los microahorros en racha aceleran el progreso'),
  q('Q_CT_02', 'Llevas días seguidos ahorrando. ¿Hoy has hecho algo consciente que te haya ahorrado dinero?', 5, 'Conciencia', 'Cualquier día', 'Mañana', 'Cualquiera', 'constructor', '', '', '', 2, 7, 3, 10, 120, 'La conciencia diaria mantiene la racha viva'),
  q('Q_CT_03', 'Es domingo. Si revisas la semana, ¿cuánto has ahorrado que antes se te hubiese escapado?', 10, 'Reflexión semanal', 'Domingo', 'Mañana', 'Cualquiera', 'constructor', '', '', '', 3, 8, 7, 20, 240, 'La revisión semanal celebra el progreso'),
  q('Q_CT_04', 'Para mantener tu racha: ¿has hecho al menos una decisión de ahorro hoy? ¿Cuánto?', 3, 'Racha', 'Cualquier día', 'Noche', 'Cualquiera', 'constructor', '', '', '', 2, 7, 2, 6, 72, 'Cualquier cantidad mantiene tu racha viva'),
  q('Q_CT_05', 'Es viernes. Si esta semana has ahorrado más de lo habitual, ¿cuánto extra has conseguido?', 10, 'Celebración', 'Viernes', 'Tarde', 'Cualquiera', 'constructor', '', '', '', 2, 7, 7, 15, 180, 'Celebrar los viernes el ahorro semanal motiva'),
  q('Q_CT_06', 'Lunes de nuevo comienzo. Si miras atrás, ¿cuánto ahorraste la semana pasada?', 10, 'Revisión', 'Lunes', 'Mañana', 'Cualquiera', 'constructor', '', '', '', 2, 7, 7, 15, 180, 'Empezar lunes revisando refuerza el hábito'),
  q('Q_CT_07', 'Tu objetivo se acerca. ¿Hoy quieres hacer un microahorro extra para acelerarlo? ¿Cuánto?', 5, 'Acelerar objetivo', 'Cualquier día', 'Mañana', 'Cualquiera', 'constructor', '', '', '', 3, 8, 5, 15, 180, 'Microahorros extra aceleran el objetivo'),
  q('Q_CT_08', 'Si llevas una semana perfecta, ¿quieres premiarla con un ahorro especial? ¿Cuánto extra?', 10, 'Recompensa', 'Domingo', 'Mañana', 'Cualquiera', 'constructor', '', '', '', 2, 7, 7, 10, 120, 'La semana perfecta merece un extra'),
  q('Q_CT_09', 'Hoy es un buen día para ser consciente. ¿Has evitado algún gasto que antes ni notarías? ¿Cuánto?', 5, 'Conciencia', 'Cualquier día', 'Tarde', 'Cualquiera', 'constructor', '', '', '', 2, 7, 3, 10, 120, 'La conciencia financiera es un superpoder'),
  q('Q_CT_10', 'Mitad de semana. Si vas bien con tu ahorro semanal, ¿puedes añadir algo extra? ¿Cuánto?', 5, 'Microahorro', 'Miércoles', 'Mañana', 'Cualquiera', 'constructor', '', '', '', 2, 6, 7, 10, 120, 'El miércoles es el punto de control ideal'),
  q('Q_CT_11', 'Ya no eres el mismo con el dinero. Si hoy has tomado una decisión financiera mejor, ¿cuánto te has ahorrado?', 8, 'Identidad', 'Cualquier día', 'Noche', 'Cualquiera', 'constructor', '', '', '', 2, 7, 4, 15, 180, 'Tu identidad de ahorrador crece con cada decisión'),
  q('Q_CT_12', 'Fin de mes. Si comparas cómo gastabas antes vs ahora, ¿cuánto extra has ahorrado este mes?', 20, 'Revisión mensual', 'Cualquier día', 'Mañana', 'Final', 'constructor', '', '', '', 3, 9, 30, 30, 360, 'La comparación mensual muestra el progreso real'),
  q('Q_CT_13', 'Si hoy le has contado a alguien tu progreso de ahorro y eso te ha motivado, ¿quieres añadir extra? ¿Cuánto?', 5, 'Social positivo', 'Sábado', 'Tarde', 'Cualquiera', 'constructor', '', '', '', 1, 5, 7, 5, 60, 'Compartir progreso genera accountability'),
  q('Q_CT_14', 'Lunes. Si te pones un mini-objetivo de ahorro para esta semana, ¿cuánto quieres guardar?', 10, 'Mini-objetivo', 'Lunes', 'Mañana', 'Cualquiera', 'constructor', '', '', '', 3, 8, 7, 15, 180, 'Mini-objetivos semanales mantienen el enfoque'),
  q('Q_CT_15', 'Si miras tu progreso total en la app, ¿quieres celebrarlo con un aporte extra? ¿Cuánto?', 10, 'Celebración', 'Cualquier día', 'Mañana', 'Cualquiera', 'constructor', '', '', '', 2, 7, 7, 10, 120, 'Celebrar el progreso refuerza el hábito'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// Banco completo y helpers
// ═══════════════════════════════════════════════════════════════════════════════
export const DAILY_QUESTIONS_BANK: DailyQuestion[] = [
  ...Q_CONVENIENCIA,
  ...Q_IMPROVISADOR,
  ...Q_FOMO,
  ...Q_PLAN_ALARGA,
  ...Q_ANTOJO,
  ...Q_CAZADOR,
  ...Q_MICROFUGAS,
  ...Q_SIN_SISTEMA,
  ...Q_CONSTRUCTOR,
];

/** Buscar una pregunta por ID */
export function getQuestionById(id: string): DailyQuestion | undefined {
  return DAILY_QUESTIONS_BANK.find(q => q.id === id);
}
