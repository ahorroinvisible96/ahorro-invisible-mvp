import posthog from 'posthog-js';

const posthogKey  = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

export const isPosthogConfigured = !!posthogKey;

let initialized = false;

export function initPosthog(): void {
  if (!isPosthogConfigured || typeof window === 'undefined' || initialized) return;
  posthog.init(posthogKey!, {
    api_host: posthogHost,
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
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
 */
export function identifyUser(supabaseUserId: string): void {
  if (!isPosthogConfigured || typeof window === 'undefined') return;
  // Inicializar si aún no se ha hecho (puede llamarse antes del provider)
  if (!initialized) initPosthog();
  try { posthog.identify(supabaseUserId); } catch { /* fallthrough */ }
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
