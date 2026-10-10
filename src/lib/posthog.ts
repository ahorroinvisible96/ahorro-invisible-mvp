import posthog from 'posthog-js';
import { isInternalEmail } from '@/services/analyticsCatalog';

const posthogKey  = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

export const isPosthogConfigured = !!posthogKey;

let initialized = false;

/** Quita query string y hash de cualquier propiedad con URL (p. ej. ?code= del callback de auth). */
function sanitizeUrls(props: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(props)) {
    if (typeof v !== 'string' || !/url|referrer/i.test(k) || !/^https?:\/\//i.test(v)) continue;
    try { const u = new URL(v); props[k] = u.origin + u.pathname; } catch { props[k] = null; }
  }
}

export function initPosthog(): void {
  if (!isPosthogConfigured || typeof window === 'undefined' || initialized) return;
  posthog.init(posthogKey!, {
    api_host: posthogHost,
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    // Decisión de privacidad 5C: la app muestra datos financieros y texto del usuario en pantalla.
    // Session replay, heatmaps, dead clicks y excepciones automáticas quedan desactivados en código,
    // independientemente de la configuración remota del proyecto. Ver docs/analytics/privacy.md.
    disable_session_recording: true,
    enable_heatmaps: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    disable_surveys: true,
    before_send: (event) => {
      if (event?.properties) sanitizeUrls(event.properties);
      if (event?.$set) sanitizeUrls(event.$set as Record<string, unknown>);
      if (event?.$set_once) sanitizeUrls(event.$set_once as Record<string, unknown>);
      return event;
    },
  });
  initialized = true;
}

export function posthogCapture(event: string, properties?: Record<string, unknown>): void {
  if (!isPosthogConfigured || !initialized || typeof window === 'undefined') return;
  try { posthog.capture(event, properties); } catch { /* fallthrough */ }
}

/**
 * Identifica al usuario en PostHog usando el UUID de Supabase Auth.
 * Debe llamarse inmediatamente después de cualquier autenticación exitosa
 * (signup, login, callback, restauración de sesión).
 * NUNCA usar email como distinct_id.
 *
 * `opts.email` solo se usa localmente para calcular `is_internal` (misma regla que el job de
 * BigQuery); el email NO se envía a PostHog. `is_internal` se guarda como propiedad de persona
 * (filtro "internal users" del proyecto) y como super-propiedad (viaja en cada evento → BigQuery).
 */
export function identifyUser(supabaseUserId: string, opts?: { email?: string | null; e2e?: boolean }): void {
  if (!isPosthogConfigured || typeof window === 'undefined') return;
  // Inicializar si aún no se ha hecho (puede llamarse antes del provider)
  if (!initialized) initPosthog();
  try {
    if (opts && ('email' in opts || 'e2e' in opts)) {
      const isInternal = isInternalEmail(opts.email) || !!opts.e2e;
      posthog.identify(supabaseUserId, { is_internal: isInternal });
      posthog.register({ is_internal: isInternal });
    } else {
      posthog.identify(supabaseUserId);
    }
  } catch { /* fallthrough */ }
}

/** session_id real de PostHog (o null si no está inicializado). */
export function getPosthogSessionId(): string | null {
  if (!isPosthogConfigured || !initialized || typeof window === 'undefined') return null;
  try { return posthog.get_session_id() || null; } catch { return null; }
}

/**
 * Resetea la identidad PostHog al hacer logout.
 * Evita que dos usuarios en el mismo dispositivo compartan identidad.
 */
export function resetUser(): void {
  if (!isPosthogConfigured || !initialized || typeof window === 'undefined') return;
  try { posthog.reset(); } catch { /* fallthrough */ }
}

/** @internal — Solo para uso interno de analytics.ts */
export function posthogIdentify(userId: string, traits?: Record<string, unknown>): void {
  if (!isPosthogConfigured || !initialized || typeof window === 'undefined') return;
  try { posthog.identify(userId, traits); } catch { /* fallthrough */ }
}

/** @internal — Solo para uso interno de analytics.ts */
export function posthogReset(): void {
  if (!isPosthogConfigured || !initialized || typeof window === 'undefined') return;
  try { posthog.reset(); } catch { /* fallthrough */ }
}
