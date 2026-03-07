import posthog from 'posthog-js';

const posthogKey  = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.posthog.com';

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

export function posthogIdentify(userId: string, traits?: Record<string, unknown>): void {
  if (!isPosthogConfigured || !initialized || typeof window === 'undefined') return;
  try { posthog.identify(userId, traits); } catch { /* fallthrough */ }
}

export function posthogReset(): void {
  if (!isPosthogConfigured || !initialized || typeof window === 'undefined') return;
  try { posthog.reset(); } catch { /* fallthrough */ }
}
