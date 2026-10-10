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
} else {
  errors.push(`falta ${docPath}`);
}

if (errors.length) {
  console.error(`analytics:check FAIL (${errors.length})`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`analytics:check OK · ${catalog.size} eventos en catálogo · ${[...catalog.values()].filter((k) => k === 'confirmed').length} confirmados · ${files.length} ficheros revisados`);
