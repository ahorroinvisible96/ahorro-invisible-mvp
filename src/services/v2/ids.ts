// ─── Identidad V1 → V2 ────────────────────────────────────────────────────────
// Réplica exacta de private.v1_uuid (017): UUID v8 = SHA-256('ai:v1:<user>:<kind>:<legacy>')
// con nibble de versión '8' y variante 8/9/a/b. Permite que el dual-write, el backfill y el
// import local generen SIEMPRE el mismo id para el mismo hecho V1 (idempotencia estructural).

export type LegacyKind = 'goal' | 'dec' | 'extra' | 'grace';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEGACY_RE: Record<LegacyKind, RegExp> = {
  goal: /^goal_\d{10,16}$/,
  dec: /^dec_\d{10,16}$/,
  extra: /^extra_\d{10,16}$/,
  grace: /^grace_\d{10,16}$/,
};

export const isUuid = (s: string | null | undefined): s is string => !!s && UUID_RE.test(s);
export const isLegacyId = (kind: LegacyKind, s: string | null | undefined): boolean => !!s && LEGACY_RE[kind].test(s);

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function v1Uuid(userId: string, kind: LegacyKind | 'avatar', legacy: string): Promise<string> {
  const data = new TextEncoder().encode(`ai:v1:${userId}:${kind}:${legacy}`);
  const h = hex(await globalThis.crypto.subtle.digest('SHA-256', data));
  const s = h.slice(0, 12) + '8' + h.slice(13, 16) + '89ab'[parseInt(h.slice(16, 18), 16) % 4] + h.slice(17, 32);
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

export function newUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Id V2 de una entidad local: si ya es UUID (creada en modo V2) se usa tal cual; si es V1 se deriva. */
export async function toV2Id(userId: string, kind: LegacyKind, localId: string): Promise<string> {
  if (isUuid(localId)) return localId.toLowerCase();
  if (!isLegacyId(kind, localId)) throw new Error(`invalid_local_id:${kind}`);
  return v1Uuid(userId, kind, localId);
}

/** Id V1 (legacy) para p_legacy_id, o null si la entidad nació en V2. */
export const legacyOrNull = (kind: LegacyKind, localId: string): string | null =>
  isLegacyId(kind, localId) ? localId : null;
