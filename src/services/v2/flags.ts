"use client";
// ─── Feature flags de servidor (public.app_flags) ───────────────────────────────
// Kill-switches globales: se leen de Supabase (no del bundle) para poder apagarlos
// al instante sin desplegar. Caché en localStorage solo para arrancar sin esperar red.

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type V2FlagKey = 'V2_DUAL_WRITE' | 'V2_READS' | 'V2_WRITE_AUTHORITY' | 'V1_RUNTIME_RETIRED' | 'V2_LOCAL_IMPORT';

export type V2Flags = Record<V2FlagKey, boolean> & {
  /** T0: instante en que se activó V2_DUAL_WRITE (las acciones anteriores las cubre el backfill). */
  t0: string | null;
  fetchedAt: number;
};

const CACHE_KEY = 'ai_v2_flags';
const DEFAULTS: V2Flags = {
  V2_DUAL_WRITE: false, V2_READS: false, V2_WRITE_AUTHORITY: false, V1_RUNTIME_RETIRED: false, V2_LOCAL_IMPORT: false,
  t0: null, fetchedAt: 0,
};

let memo: V2Flags | null = null;
const listeners = new Set<(f: V2Flags) => void>();

export function getFlags(): V2Flags {
  if (memo) return memo;
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) memo = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<V2Flags>) };
  } catch { /* ignore */ }
  return memo ?? DEFAULTS;
}

export function onFlagsChange(fn: (f: V2Flags) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** V2 es la fuente de lectura (y localStorage solo caché). */
export const v2ReadsOn = () => { const f = getFlags(); return f.V2_READS || f.V2_WRITE_AUTHORITY; };
/** V2 es la autoridad de escritura: V1 ya no se escribe. */
export const v2WriteAuthority = () => getFlags().V2_WRITE_AUTHORITY;
/** Las RPC V2 deben ejecutarse (dual-write o autoridad). */
export const v2WritesOn = () => { const f = getFlags(); return f.V2_DUAL_WRITE || f.V2_WRITE_AUTHORITY; };
/** El runtime V1 (tablas goals/decisions/hucha legacy) sigue en uso. */
export const v1RuntimeOn = () => { const f = getFlags(); return !f.V2_WRITE_AUTHORITY && !f.V1_RUNTIME_RETIRED; };

export async function refreshFlags(): Promise<V2Flags> {
  if (!isSupabaseConfigured || !supabase) return getFlags();
  try {
    const { data, error } = await supabase.from('app_flags').select('key, enabled, updated_at');
    if (error || !data) return getFlags();
    const next: V2Flags = { ...DEFAULTS, fetchedAt: Date.now() };
    for (const row of data as { key: string; enabled: boolean; updated_at: string }[]) {
      if (row.key in DEFAULTS) (next as Record<string, unknown>)[row.key] = !!row.enabled;
      if (row.key === 'V2_DUAL_WRITE' && row.enabled) next.t0 = row.updated_at;
    }
    // Con autoridad V2, T0 sigue siendo el instante del dual-write (si existió).
    if (!next.t0) next.t0 = getFlags().t0;
    const changed = JSON.stringify({ ...next, fetchedAt: 0 }) !== JSON.stringify({ ...getFlags(), fetchedAt: 0 });
    memo = next;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    if (changed) listeners.forEach((fn) => { try { fn(next); } catch { /* ignore */ } });
    return next;
  } catch {
    return getFlags();
  }
}
