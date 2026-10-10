#!/usr/bin/env node
/**
 * Verifica el tracking V2 contra el catálogo (src/services/analyticsCatalog.ts):
 *  1. Todo evento emitido en el código (this.track('x') / analytics.confirmed('x')) existe en el catálogo.
 *  2. Todo evento del catálogo se emite en algún sitio (sin entradas muertas).
 *  3. Los `*_confirmed` solo se emiten desde el outbox V2 (nunca desde la UI).
 *  4. Nadie llama a posthog.capture / posthogCapture fuera de src/lib/posthog.ts y analytics.ts.
 *  5. Ninguna llamada a analytics.* pasa texto con pinta de PII (email, String(err), note, title…).
 *  6. El catálogo y docs/analytics/tracking_plan.md listan los mismos eventos.
 * Uso: npm run analytics:check
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['node_modules', '.next'].includes(e.name)) walk(p, out); }
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const errors = [];
const catalogSrc = read('src/services/analyticsCatalog.ts');
const catalogBlock = catalogSrc.slice(catalogSrc.indexOf('EVENT_CATALOG = {'), catalogSrc.indexOf('} as const satisfies'));
const catalog = new Map([...catalogBlock.matchAll(/^\s*([a-z0-9_]+):\s*\{\s*kind:\s*'(\w+)'/gm)].map((m) => [m[1], m[2]]));
if (catalog.size < 10) errors.push(`catálogo ilegible (${catalog.size} eventos)`);

const emitted = new Map(); // event -> Set(files)
const files = walk(path.join(root, 'src'));
for (const f of files) {
  const rel = path.relative(root, f).replace(/\\/g, '/');
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:this\.track|analytics\.confirmed)\(\s*'([a-z0-9_]+)'/g)) {
    if (!emitted.has(m[1])) emitted.set(m[1], new Set());
    emitted.get(m[1]).add(rel);
  }
  // analytics.confirmed(cond ? 'a' : 'b', …)
  for (const m of src.matchAll(/analytics\.confirmed\([^,]*\?\s*'([a-z0-9_]+)'\s*:\s*'([a-z0-9_]+)'/g)) {
    for (const ev of [m[1], m[2]]) { if (!emitted.has(ev)) emitted.set(ev, new Set()); emitted.get(ev).add(rel); }
  }
  if (!['src/lib/posthog.ts', 'src/services/analytics.ts'].includes(rel) && /\bposthog(Capture)?\.?capture\(|\bposthogCapture\(/.test(src)) {
    errors.push(`${rel}: captura directa a PostHog fuera de analytics.ts`);
  }
  for (const m of src.matchAll(/analytics\.\w+\(([^;]*)\);/g)) {
    const args = m[1].replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""');
    if (/String\(err|\.message\b|\bemail\b|\bnote\b|\btitle\b|customText|userName/.test(args)) {
      errors.push(`${rel}: posible PII en analytics.${m[0].slice(10, 60)}`);
    }
  }
}

for (const [ev, where] of emitted) {
  if (!catalog.has(ev)) errors.push(`evento fuera del catálogo: ${ev} (${[...where].join(', ')})`);
  if (ev.endsWith('_confirmed')) {
    const bad = [...where].filter((w) => w !== 'src/services/v2/outbox.ts');
    if (bad.length) errors.push(`${ev} emitido fuera del outbox: ${bad.join(', ')}`);
  }
}
for (const [ev, kind] of catalog) {
  if (!emitted.has(ev)) errors.push(`evento del catálogo sin emisor: ${ev}`);
  if ((kind === 'confirmed') !== ev.endsWith('_confirmed')) errors.push(`${ev}: kind=${kind} no coincide con el sufijo`);
}

const docPath = 'docs/analytics/tracking_plan.md';
if (fs.existsSync(path.join(root, docPath))) {
  const fullDoc = read(docPath);
  const doc = fullDoc.slice(Math.max(0, fullDoc.indexOf('## Eventos confirmados')));
  const documented = new Set([...doc.matchAll(/^\|\s*`([a-z0-9_]+)`\s*\|/gm)].map((m) => m[1]));
  for (const ev of catalog.keys()) if (!documented.has(ev)) errors.push(`${docPath}: falta ${ev}`);
  for (const ev of documented) if (!catalog.has(ev) && !doc.includes(`\`${ev}\` | obsoleto`)) errors.push(`${docPath}: ${ev} no está en el catálogo`);
  // 6b. Las propiedades de cada fila coinciden con las del catálogo.
  const catProps = new Map([...catalogBlock.matchAll(/^\s*([a-z0-9_]+):\s*\{\s*kind:\s*'\w+',\s*props:\s*\[([^\]]*)\]/gm)]
    .map((m) => [m[1], [...m[2].matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]).sort().join(',')]));
  for (const m of doc.matchAll(/^\|\s*`([a-z0-9_]+)`\s*\|([^|]*)\|/gm)) {
    const [, ev, cell] = m;
    if (!catProps.has(ev)) continue;
    const docProps = [...cell.matchAll(/`([a-z0-9_]+)`/g)].map((x) => x[1]).sort().join(',');
    if (docProps !== catProps.get(ev)) errors.push(`${docPath}: ${ev} propiedades [${docProps}] ≠ catálogo [${catProps.get(ev)}]`);
  }
} else {
  errors.push(`falta ${docPath}`);
}
if (!fs.existsSync(path.join(root, 'docs/analytics/privacy.md'))) errors.push('falta docs/analytics/privacy.md (referenciado desde src/lib/posthog.ts)');

// ── 7. Propiedades emitidas ⊆ catálogo (+ globales) ────────────────────────────
const GLOBAL_PROPS = new Set(['user_id', 'supabase_user_id', 'platform', 'app_version', 'schema_version', 'data_version',
  'device_locale', 'timezone', 'screen_name', 'session_id', 'is_internal']);
const catalogProps = new Map([...catalogBlock.matchAll(/^\s*([a-z0-9_]+):\s*\{\s*kind:\s*'\w+',\s*props:\s*\[([^\]]*)\]/gm)]
  .map((m) => [m[1], new Set([...m[2].matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]))]));
const analyticsSrc = read('src/services/analytics.ts');
for (const m of analyticsSrc.replace(/`[^`]*`/g, "''").matchAll(/this\.track\(\s*'([a-z0-9_]+)'\s*(?:,\s*\{([^}]*)\})?/g)) {
  const [, ev, body = ''] = m;
  const keys = [...body.matchAll(/(?:^|,|\{)\s*([a-z_][a-z0-9_]*)\s*(?=[:,]|$)/gi)].map((x) => x[1]);
  for (const k of keys) {
    if (!catalogProps.get(ev)?.has(k) && !GLOBAL_PROPS.has(k)) errors.push(`analytics.ts: ${ev} emite propiedad fuera del catálogo: ${k}`);
  }
}

// ── 8. IDs solo en *_confirmed (en cliente los IDs pueden ser locales: goal_<ts>) ─
const URL_OR_TEXT = /url|href|referrer|path|title|name|note|text|email|message/;
for (const [ev, props] of catalogProps) {
  for (const p of props) {
    if (catalog.get(ev) !== 'confirmed' && /_id$/.test(p) && p !== 'question_id') errors.push(`${ev}: ID '${p}' en evento no confirmado (usar solo en *_confirmed)`);
    if (URL_OR_TEXT.test(p)) errors.push(`${ev}: propiedad '${p}' con riesgo de URL/texto libre/PII`);
  }
}

// ── 9. Enums: surface y screen_name ───────────────────────────────────────────
const outboxSrc = read('src/services/v2/outbox.ts');
const surfaceBlock = (outboxSrc.match(/export type Surface =([^;]*);/) || [])[1] || '';
const SURFACES = new Set([...surfaceBlock.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
if (SURFACES.size < 5) errors.push('no se pudo leer el enum Surface de outbox.ts');
const screenBlock = (analyticsSrc.match(/type ScreenName =([^;]*);/) || [])[1] || '';
const SCREENS = new Set([...screenBlock.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]));
for (const m of analyticsSrc.matchAll(/screen_name:\s*'([a-z0-9_]+)'/g)) {
  if (!SCREENS.has(m[1])) errors.push(`screen_name fuera del enum ScreenName: ${m[1]}`);
}
for (const f of files) {
  const rel = path.relative(root, f).replace(/\\/g, '/');
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/surface:\s*'([a-z_]+)'/g)) if (!SURFACES.has(m[1])) errors.push(`${rel}: surface fuera del enum: ${m[1]}`);
  for (const m of src.matchAll(/analytics\.(goalCreateSubmitted|goalArchiveSubmitted|dailyAnswerSubmitted|extraSavingSubmitted)\(([^;]*)\);/g)) {
    const lits = [...m[2].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).filter((v) => !['saved', 'zero'].includes(v));
    if (!lits.length) errors.push(`${rel}: analytics.${m[1]} sin surface literal`);
    for (const v of lits) if (!SURFACES.has(v)) errors.push(`${rel}: analytics.${m[1]} surface inválida '${v}'`);
  }
}

// ── 10. Configuración de privacidad de PostHog ────────────────────────────────
const phSrc = read('src/lib/posthog.ts');
for (const [re, label] of [
  [/disable_session_recording:\s*true/, 'Session Replay desactivado (disable_session_recording: true)'],
  [/autocapture:\s*false/, 'autocapture: false'],
  [/capture_pageview:\s*false/, 'capture_pageview: false'],
  [/enable_heatmaps:\s*false/, 'enable_heatmaps: false'],
  [/before_send:/, 'before_send con saneado de URLs'],
]) if (!re.test(phSrc)) errors.push(`src/lib/posthog.ts: falta ${label}`);

// ── 11. Inventario de importes (informativo: importes de ahorro registrados, nunca ingresos) ─
const amountEvents = [...catalogProps].filter(([, ps]) => [...ps].some((p) => /amount|delta/.test(p))).map(([ev]) => ev);

if (errors.length) {
  console.error(`analytics:check FAIL (${errors.length})`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`analytics:check OK · ${catalog.size} eventos en catálogo · ${[...catalog.values()].filter((k) => k === 'confirmed').length} confirmados · ${files.length} ficheros revisados`);
console.log(`  surfaces: ${[...SURFACES].join(', ')}`);
console.log(`  eventos con importes de ahorro (sin ingresos): ${amountEvents.join(', ')}`);

