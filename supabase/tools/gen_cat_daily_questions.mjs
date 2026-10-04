// Genera supabase/migrations/012_seed_cat_daily_questions.sql a partir de
// src/services/dailyQuestionsBank.ts (solo lectura del fuente). Determinista.
// Uso (desde ahorro-invisible-mvp/): node supabase/tools/gen_cat_daily_questions.mjs
import fs from 'node:fs';

const src = fs.readFileSync('src/services/dailyQuestionsBank.ts', 'utf8');
const start = src.indexOf('export const QUESTIONS_BANK');
const open = src.indexOf('[', src.indexOf('=', start));
const close = src.indexOf('\n];', open);
const arr = new Function('return ' + src.slice(open, close + 2))();

const slug = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const SLOTS = new Set(['manana', 'tarde', 'noche']);
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const rows = arr.map((b) => {
  const slot = slug(b.timeSlot);
  if (!SLOTS.has(slot)) throw new Error('slot desconocido ' + b.timeSlot + ' en ' + b.id);
  const keys = new Set();
  const opts = b.options.map((o) => {
    const k = slug(o);
    if (!k || keys.has(k) || k === 'custom') throw new Error('option_key invalida ' + o + ' en ' + b.id);
    keys.add(k);
    return { option_key: k, label: o };
  });
  return `(${q('qb_v1')},${q(b.id)},${q(b.avatar)},${q(slot)},${q(b.text)},${q(JSON.stringify(opts))}::jsonb)`;
});

const out = `-- ============================================================
-- Data Model V2 — 5B.1 — Seed cat_daily_questions (qb_v1)
-- GENERADO por supabase/tools/gen_cat_daily_questions.mjs desde
-- src/services/dailyQuestionsBank.ts. No editar a mano.
-- Preguntas: ${rows.length}. Idempotente (ON CONFLICT DO NOTHING).
-- Una versión publicada no se modifica: cambios => qb_v2.
-- ============================================================
INSERT INTO public.cat_daily_questions
  (question_bank_version, question_id, avatar, time_slot, text_template, options)
VALUES
${rows.join(',\n')}
ON CONFLICT (question_bank_version, question_id) DO NOTHING;
`;
fs.writeFileSync('supabase/migrations/012_seed_cat_daily_questions.sql', out, 'utf8');
console.log('preguntas', rows.length);
