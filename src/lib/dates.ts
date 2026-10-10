// ─── Fechas locales (Data Model V2 §9) ──────────────────────────────────────────
// El "día" del usuario cambia a las 00:00 de SU zona horaria. Nunca se usa
// toISOString() para calcular días (eso es UTC y descuadra entre 00:00 y 02:00 en Madrid).

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD en la zona horaria del dispositivo. */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM en la zona horaria del dispositivo. */
export function localMonthStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Suma n días naturales a una fecha local YYYY-MM-DD (seguro frente a DST). */
export function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0); // mediodía: inmune a cambios de hora
  dt.setDate(dt.getDate() + n);
  return localDateStr(dt);
}

/** Fecha local de hace n días. */
export function localDateDaysAgo(n: number): string {
  return addDaysStr(localDateStr(), -n);
}

/** Zona IANA del dispositivo (fallback Europe/Madrid). */
export function userTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';
  } catch {
    return 'Europe/Madrid';
  }
}
