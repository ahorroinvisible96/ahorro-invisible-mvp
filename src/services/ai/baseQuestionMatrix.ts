/**
 * baseQuestionMatrix.ts — Matriz 4×4×7 de preguntas base
 *
 * Define la línea base (baseline) de qué pregunta mostrar para cada
 * combinación de: Día de la semana × Avatar × Franja horaria.
 *
 * Dimensiones:
 *   7 días (Lunes..Domingo) × 4 avatares × 4 franjas = 112 slots
 *
 * Franjas horarias (Europe/Madrid):
 *   Madrugada  00:00 – 06:00
 *   Mañana     06:00 – 14:00
 *   Tarde      14:00 – 20:00
 *   Noche      20:00 – 24:00
 *
 * La IA recibe la pregunta base y decide si mantenerla o cambiarla
 * en función del historial del usuario (aprendizaje activo).
 */

import type { AvatarKey } from '../profilingService';

// ── Tipos ──────────────────────────────────────────────────────────────────

export type TimeSlot4 = 'Madrugada' | 'Mañana' | 'Tarde' | 'Noche';
export type DayName = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo';

export interface MatrixSlot {
  questionId: string;
  /** Por qué se eligió esta pregunta para este slot */
  rationale: string;
}

// ── Constantes ─────────────────────────────────────────────────────────────

export const DAYS: DayName[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const AVATARS: (AvatarKey | 'constructor')[] = ['comodo', 'social', 'impulsivo', 'desordenado'];
export const TIME_SLOTS: TimeSlot4[] = ['Madrugada', 'Mañana', 'Tarde', 'Noche'];

// ── Matriz base 7×4×4 ─────────────────────────────────────────────────────
//
// Estructura: MATRIX[día][avatar][franja] = { questionId, rationale }
//
// Criterios de asignación:
//   1. Avatar primary match — pregunta diseñada para ese avatar
//   2. Coherencia temporal — el escenario tiene sentido a esa hora
//   3. Distribución uniforme — cada pregunta aparece max 2-3 veces
//   4. Variedad de categorías — no repetir la misma categoría en el mismo día
//   5. Madrugada = reflexión/revisión (usuario insomne o trasnochar)
//

const MATRIX: Record<DayName, Record<string, Record<TimeSlot4, MatrixSlot>>> = {
  // ════════════════════════════════════════════════════════════════════════
  // LUNES — inicio de semana, momento de propósitos y control
  // ════════════════════════════════════════════════════════════════════════
  Lunes: {
    comodo: {
      Madrugada: { questionId: 'Q_IM_05', rationale: 'Noche: preparar el día siguiente' },
      Mañana:    { questionId: 'Q_CI_02', rationale: 'Café en casa al empezar semana' },
      Tarde:     { questionId: 'Q_CI_08', rationale: 'Menú del día vs carta' },
      Noche:     { questionId: 'Q_CI_01', rationale: 'Evitar delivery primera noche' },
    },
    social: {
      Madrugada: { questionId: 'Q_PA_07', rationale: 'Reflexión: control del finde' },
      Mañana:    { questionId: 'Q_FS_07', rationale: 'Lunes: revisión gasto social del finde' },
      Tarde:     { questionId: 'Q_PA_11', rationale: 'Proponer planes propios' },
      Noche:     { questionId: 'Q_FS_09', rationale: 'Plan en casa vs salir' },
    },
    impulsivo: {
      Madrugada: { questionId: 'Q_AE_04', rationale: 'Compra nocturna por estrés' },
      Mañana:    { questionId: 'Q_AE_08', rationale: 'No abrir apps de compras' },
      Tarde:     { questionId: 'Q_CO_01', rationale: 'Resistir ofertas al empezar semana' },
      Noche:     { questionId: 'Q_AE_01', rationale: 'Cerrar apps sin comprar' },
    },
    desordenado: {
      Madrugada: { questionId: 'Q_SS_03', rationale: 'Revisión nocturna de la semana' },
      Mañana:    { questionId: 'Q_SS_01', rationale: 'Lunes: mirar saldo bancario' },
      Tarde:     { questionId: 'Q_SS_02', rationale: 'Fijar límite diario' },
      Noche:     { questionId: 'Q_MF_10', rationale: 'Apuntar gastos del día' },
    },
  },

  // ════════════════════════════════════════════════════════════════════════
  // MARTES — rutina establecida, microdecisiones diarias
  // ════════════════════════════════════════════════════════════════════════
  Martes: {
    comodo: {
      Madrugada: { questionId: 'Q_IM_12', rationale: 'Cocinar de más para mañana' },
      Mañana:    { questionId: 'Q_CI_04', rationale: 'Llevar táper al trabajo' },
      Tarde:     { questionId: 'Q_CI_13', rationale: 'Evitar gasto de comodidad' },
      Noche:     { questionId: 'Q_IM_13', rationale: 'Cocinar algo rápido vs delivery' },
    },
    social: {
      Madrugada: { questionId: 'Q_FS_13', rationale: 'Plan tranquilo por la noche' },
      Mañana:    { questionId: 'Q_CT_02', rationale: 'Conciencia diaria' },
      Tarde:     { questionId: 'Q_FS_03', rationale: 'Proponer plan barato' },
      Noche:     { questionId: 'Q_FS_11', rationale: 'Sitio más barato' },
    },
    impulsivo: {
      Madrugada: { questionId: 'Q_AE_09', rationale: 'Entretenimiento gratuito noche' },
      Mañana:    { questionId: 'Q_CO_02', rationale: 'Ignorar emails de ofertas' },
      Tarde:     { questionId: 'Q_AE_05', rationale: 'Evitar capricho de tarde' },
      Noche:     { questionId: 'Q_CO_10', rationale: 'No entrar en webs de ofertas' },
    },
    desordenado: {
      Madrugada: { questionId: 'Q_MF_15', rationale: 'Identificar gasto invisible' },
      Mañana:    { questionId: 'Q_MF_01', rationale: 'Café en casa' },
      Tarde:     { questionId: 'Q_MF_03', rationale: 'Evitar vending' },
      Noche:     { questionId: 'Q_SS_07', rationale: 'Gasto sin pensar' },
    },
  },

  // ════════════════════════════════════════════════════════════════════════
  // MIÉRCOLES — mitad de semana, punto de control
  // ════════════════════════════════════════════════════════════════════════
  Miércoles: {
    comodo: {
      Madrugada: { questionId: 'Q_IM_15', rationale: 'Alarma para no improvisar mañana' },
      Mañana:    { questionId: 'Q_CI_07', rationale: 'Desayuno en casa' },
      Tarde:     { questionId: 'Q_CI_10', rationale: 'Opción estándar vs premium' },
      Noche:     { questionId: 'Q_CI_06', rationale: 'Revisar nevera antes de delivery' },
    },
    social: {
      Madrugada: { questionId: 'Q_CT_04', rationale: 'Mantener racha nocturna' },
      Mañana:    { questionId: 'Q_CT_10', rationale: 'Miércoles: punto de control semanal' },
      Tarde:     { questionId: 'Q_FS_13', rationale: 'Plan tranquilo de mitad de semana' },
      Noche:     { questionId: 'Q_PA_13', rationale: 'Compartir platos si sales' },
    },
    impulsivo: {
      Madrugada: { questionId: 'Q_AE_02', rationale: 'Regla de 24h nocturna' },
      Mañana:    { questionId: 'Q_CO_06', rationale: 'Desuscribirse de newsletters' },
      Tarde:     { questionId: 'Q_CO_03', rationale: 'Resistir 2x1 innecesario' },
      Noche:     { questionId: 'Q_AE_03', rationale: 'Vaciar carrito online' },
    },
    desordenado: {
      Madrugada: { questionId: 'Q_MF_12', rationale: 'Compartir cuentas streaming' },
      Mañana:    { questionId: 'Q_MF_02', rationale: 'Traer snacks de casa' },
      Tarde:     { questionId: 'Q_MF_06', rationale: 'No entrar a tiendas a mirar' },
      Noche:     { questionId: 'Q_SS_05', rationale: 'Categorizar gastos de ayer' },
    },
  },

  // ════════════════════════════════════════════════════════════════════════
  // JUEVES — pre-fin de semana, decisiones de planes
  // ════════════════════════════════════════════════════════════════════════
  Jueves: {
    comodo: {
      Madrugada: { questionId: 'Q_IM_03', rationale: 'Aprovechar sobras' },
      Mañana:    { questionId: 'Q_CI_03', rationale: 'Transporte público vs taxi' },
      Tarde:     { questionId: 'Q_IM_01', rationale: 'Planificar cena' },
      Noche:     { questionId: 'Q_IM_08', rationale: 'Parar y cocinar vs pedir' },
    },
    social: {
      Madrugada: { questionId: 'Q_CT_11', rationale: 'Identidad de ahorrador' },
      Mañana:    { questionId: 'Q_CT_06', rationale: 'Revisión semanal' },
      Tarde:     { questionId: 'Q_FS_01', rationale: 'Pre-finde: plan caro → proponer más barato' },
      Noche:     { questionId: 'Q_FS_06', rationale: 'Decir no a plan que no apetece' },
    },
    impulsivo: {
      Madrugada: { questionId: 'Q_AE_10', rationale: 'Eliminar artículo del carrito' },
      Mañana:    { questionId: 'Q_CO_08', rationale: '¿Lo comprarías sin descuento?' },
      Tarde:     { questionId: 'Q_AE_07', rationale: 'Resistir notificación de oferta' },
      Noche:     { questionId: 'Q_CO_04', rationale: 'Esperar 48h en rebajas' },
    },
    desordenado: {
      Madrugada: { questionId: 'Q_SS_12', rationale: 'Saldo → no hacer un gasto' },
      Mañana:    { questionId: 'Q_MF_05', rationale: 'Botella de agua propia' },
      Tarde:     { questionId: 'Q_MF_09', rationale: 'Evitar súper de barrio' },
      Noche:     { questionId: 'Q_MF_10', rationale: 'Apuntar gastos del día' },
    },
  },

  // ════════════════════════════════════════════════════════════════════════
  // VIERNES — inicio de fin de semana, decisiones de ocio
  // ════════════════════════════════════════════════════════════════════════
  Viernes: {
    comodo: {
      Madrugada: { questionId: 'Q_CI_14', rationale: 'Preparar snacks para mañana' },
      Mañana:    { questionId: 'Q_CI_12', rationale: 'Botella de agua propia' },
      Tarde:     { questionId: 'Q_CI_11', rationale: 'Caminar trayecto corto' },
      Noche:     { questionId: 'Q_CI_05', rationale: 'Cenar en casa fin de semana' },
    },
    social: {
      Madrugada: { questionId: 'Q_PA_05', rationale: 'Tope de gasto antes de salir' },
      Mañana:    { questionId: 'Q_CT_05', rationale: 'Celebrar ahorro semanal' },
      Tarde:     { questionId: 'Q_FS_02', rationale: 'Cenar en casa antes de salir' },
      Noche:     { questionId: 'Q_FS_12', rationale: 'Irse a la hora prevista' },
    },
    impulsivo: {
      Madrugada: { questionId: 'Q_CO_15', rationale: '¿Dónde voy a guardar esto?' },
      Mañana:    { questionId: 'Q_CO_12', rationale: 'Tope mensual de ofertas' },
      Tarde:     { questionId: 'Q_AE_06', rationale: 'Deporte vs comprar' },
      Noche:     { questionId: 'Q_AE_01', rationale: 'Cerrar apps sin comprar' },
    },
    desordenado: {
      Madrugada: { questionId: 'Q_SS_08', rationale: 'Control de fin de mes' },
      Mañana:    { questionId: 'Q_SS_06', rationale: 'Presupuesto semanal' },
      Tarde:     { questionId: 'Q_MF_07', rationale: 'Versión gratuita vs premium' },
      Noche:     { questionId: 'Q_MF_15', rationale: 'Identificar gasto invisible' },
    },
  },

  // ════════════════════════════════════════════════════════════════════════
  // SÁBADO — día de ocio, gastos sociales y compras
  // ════════════════════════════════════════════════════════════════════════
  Sábado: {
    comodo: {
      Madrugada: { questionId: 'Q_IM_05', rationale: 'Dejar algo preparado anoche' },
      Mañana:    { questionId: 'Q_CI_09', rationale: 'Compra presencial vs online con recargo' },
      Tarde:     { questionId: 'Q_CI_15', rationale: 'Servicio gratuito vs premium' },
      Noche:     { questionId: 'Q_CI_06', rationale: 'Revisar nevera antes de delivery' },
    },
    social: {
      Madrugada: { questionId: 'Q_PA_01', rationale: 'Reflexión: ¿te fuiste a tu hora anoche?' },
      Mañana:    { questionId: 'Q_FS_05', rationale: 'Plan gratuito de fin de semana' },
      Tarde:     { questionId: 'Q_FS_04', rationale: 'Presupuesto para salir' },
      Noche:     { questionId: 'Q_PA_14', rationale: 'Hora de vuelta definida' },
    },
    impulsivo: {
      Madrugada: { questionId: 'Q_AE_04', rationale: 'Compra emocional nocturna' },
      Mañana:    { questionId: 'Q_CO_07', rationale: 'Compra solo con lista' },
      Tarde:     { questionId: 'Q_AE_12', rationale: 'Autocuidado gratis' },
      Noche:     { questionId: 'Q_AE_02', rationale: 'Regla de 24h antes de comprar' },
    },
    desordenado: {
      Madrugada: { questionId: 'Q_MF_10', rationale: 'Apuntar gastos del día' },
      Mañana:    { questionId: 'Q_MF_08', rationale: 'Comprar a granel' },
      Tarde:     { questionId: 'Q_MF_06', rationale: 'No entrar a tiendas a mirar' },
      Noche:     { questionId: 'Q_MF_12', rationale: 'Compartir cuentas streaming' },
    },
  },

  // ════════════════════════════════════════════════════════════════════════
  // DOMINGO — reflexión, revisión, planificación de la semana
  // ════════════════════════════════════════════════════════════════════════
  Domingo: {
    comodo: {
      Madrugada: { questionId: 'Q_IM_12', rationale: 'Cocinar de más para la semana' },
      Mañana:    { questionId: 'Q_IM_07', rationale: 'Planificar menús de la semana' },
      Tarde:     { questionId: 'Q_IM_14', rationale: 'Batch cooking dominical' },
      Noche:     { questionId: 'Q_IM_05', rationale: 'Preparar el lunes' },
    },
    social: {
      Madrugada: { questionId: 'Q_PA_02', rationale: 'Reflexión: ¿evitaste la 2ª ronda?' },
      Mañana:    { questionId: 'Q_FS_14', rationale: 'Domingo: revisar gasto social del finde' },
      Tarde:     { questionId: 'Q_FS_15', rationale: 'Plan gratis con amigos' },
      Noche:     { questionId: 'Q_FS_09', rationale: 'Series en casa vs salir' },
    },
    impulsivo: {
      Madrugada: { questionId: 'Q_AE_09', rationale: 'Entretenimiento gratuito noche' },
      Mañana:    { questionId: 'Q_AE_15', rationale: 'Domingo: reflexión impulsos' },
      Tarde:     { questionId: 'Q_AE_13', rationale: 'Dejar pasar oportunidades' },
      Noche:     { questionId: 'Q_CO_14', rationale: 'Revisión semanal de ofertas' },
    },
    desordenado: {
      Madrugada: { questionId: 'Q_SS_04', rationale: 'Descubrir cargos olvidados' },
      Mañana:    { questionId: 'Q_SS_03', rationale: 'Domingo: revisión semanal' },
      Tarde:     { questionId: 'Q_MF_14', rationale: 'Revisión microfugas de la semana' },
      Noche:     { questionId: 'Q_SS_14', rationale: 'Poner alarma para revisar finanzas' },
    },
  },
};

// ── Funciones públicas ────────────────────────────────────────────────────

/**
 * Obtiene la franja horaria actual (4 franjas, Europe/Madrid).
 */
export function getCurrentTimeSlot4(): TimeSlot4 {
  const now = new Date();
  const madridStr = now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' });
  const hour = new Date(madridStr).getHours();

  if (hour >= 0 && hour < 6) return 'Madrugada';
  if (hour >= 6 && hour < 14) return 'Mañana';
  if (hour >= 14 && hour < 20) return 'Tarde';
  return 'Noche'; // 20-24
}

/**
 * Obtiene el día de la semana actual (Europe/Madrid).
 */
export function getCurrentDayName(): DayName {
  const now = new Date();
  const madridStr = now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' });
  const dayIndex = new Date(madridStr).getDay();
  // getDay: 0=Domingo, 1=Lunes...
  const dayMap: DayName[] = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return dayMap[dayIndex];
}

/**
 * Obtiene la pregunta base de la matriz para un día, avatar y franja dados.
 * Si el avatar es null o 'constructor', usa 'desordenado' como fallback.
 */
export function getMatrixBaseQuestion(
  day: DayName,
  avatar: string | null,
  timeSlot: TimeSlot4,
): MatrixSlot {
  // Normalizar avatar
  const effectiveAvatar = (!avatar || avatar === 'constructor')
    ? 'desordenado'
    : avatar;

  const dayMatrix = MATRIX[day];
  if (!dayMatrix) {
    return { questionId: 'Q_CT_01', rationale: 'fallback: día no encontrado' };
  }

  const avatarMatrix = dayMatrix[effectiveAvatar];
  if (!avatarMatrix) {
    // Si el avatar no está en la matriz, usar desordenado
    const fallbackMatrix = dayMatrix['desordenado'];
    return fallbackMatrix?.[timeSlot] ?? { questionId: 'Q_CT_01', rationale: 'fallback: avatar no encontrado' };
  }

  return avatarMatrix[timeSlot] ?? { questionId: 'Q_CT_01', rationale: 'fallback: franja no encontrada' };
}

/**
 * Devuelve la pregunta base para AHORA (momento actual, Europe/Madrid).
 */
export function getCurrentMatrixBaseQuestion(avatar: string | null): MatrixSlot {
  return getMatrixBaseQuestion(getCurrentDayName(), avatar, getCurrentTimeSlot4());
}

/**
 * Devuelve la matriz completa para un día dado (para debug/visualización).
 */
export function getDayMatrix(day: DayName): Record<string, Record<TimeSlot4, MatrixSlot>> {
  return MATRIX[day];
}

/**
 * Estadísticas de la matriz: cuántas veces aparece cada question_id.
 */
export function getMatrixStats(): { totalSlots: number; uniqueQuestions: number; distribution: Record<string, number> } {
  const dist: Record<string, number> = {};
  let total = 0;

  for (const day of DAYS) {
    for (const avatar of AVATARS) {
      for (const slot of TIME_SLOTS) {
        const s = MATRIX[day]?.[avatar]?.[slot];
        if (s) {
          dist[s.questionId] = (dist[s.questionId] ?? 0) + 1;
          total++;
        }
      }
    }
  }

  return {
    totalSlots: total,
    uniqueQuestions: Object.keys(dist).length,
    distribution: dist,
  };
}
