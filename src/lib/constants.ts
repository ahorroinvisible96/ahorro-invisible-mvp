// ─── Constantes compartidas de la aplicación ─────────────────────────────────

export const STORAGE_KEY = 'ahorro_invisible_dashboard_v1';

/**
 * Activa el banco piloto de 18 preguntas en lugar del banco completo de 135.
 * Usar durante la fase de pruebas de la nueva infraestructura.
 *
 * Activar: añadir NEXT_PUBLIC_USE_PILOT_BANK=true en .env.local
 */
export const USE_PILOT_BANK =
  process.env.NEXT_PUBLIC_USE_PILOT_BANK === 'true';
