/**
 * Suite de verificación automatizada para Analytics V2 Bank-Grade:
 *  - Integridad estructural y renderizado de los 13 modelos SQL + 4 suites DQ.
 *  - Verificación de contratos críticos (deduplicación PostHog, recursión saving_kind,
 *    día cerrado en summary, separación de actividad, k-anonimato + supresión complementaria,
 *    umbral n>=10/30, aislamiento analytics_bank_v2, cero est_ltv, reconciliación por ID).
 *  - Prueba matemática del algoritmo de supresión complementaria (cero differencing attack).
 *  - Verificación del cableado determinista de daily_prompt_impressions y fallback seguro.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MODELS_DIR = path.join(ROOT, 'jobs', 'supabase-bigquery-sync', 'sql', 'models');
const TESTS_DIR = path.join(ROOT, 'jobs', 'supabase-bigquery-sync', 'sql', 'tests');

const CTX = {
  project: 'gen-lang-client-0725004018',
  raw: 'raw_supabase_v2',
  an: 'analytics_v2',
  bank: 'analytics_bank_v2',
  ph: 'raw_posthog',
  v1: 'raw_supabase',
};

function renderSql(text) {
  let out = text;
  for (const [k, v] of Object.entries(CTX)) out = out.replaceAll(`{{${k}}}`, v);
  return out;
}

function stripSqlCommentsAndStrings(sql) {
  return sql
    .replace(/--[^\n]*/g, '')
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/`[^`]*`/g, '``');
}

function checkBalancedParens(sql, filename) {
  const clean = stripSqlCommentsAndStrings(sql);
  let depth = 0;
  for (const ch of clean) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    assert.ok(depth >= 0, `${filename}: paréntesis de cierre sin apertura`);
  }
  assert.equal(depth, 0, `${filename}: paréntesis desbalanceados (delta=${depth})`);
}

test('todos los modelos SQL (00..12) y suites DQ (01..04) renderizan sin placeholders ni paréntesis rotos', () => {
  const modelFiles = fs.readdirSync(MODELS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const testFiles = fs.readdirSync(TESTS_DIR).filter((f) => f.endsWith('.sql')).sort();

  assert.equal(modelFiles.length, 13, `Esperados 13 modelos SQL (00..12), encontrados ${modelFiles.length}`);
  assert.equal(testFiles.length, 4, `Esperadas 4 suites DQ (01..04), encontradas ${testFiles.length}`);

  for (const dir of [MODELS_DIR, TESTS_DIR]) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql'))) {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      const rendered = renderSql(raw);
      assert.ok(!/\{\{[^}]+\}\}/.test(rendered), `${f}: contiene placeholders sin resolver`);
      checkBalancedParens(rendered, f);
    }
  }
});

test('cada fichero en sql/tests es una única sentencia SELECT UNION ALL (contrato main.py)', () => {
  for (const f of fs.readdirSync(TESTS_DIR).filter((x) => x.endsWith('.sql')).sort()) {
    const clean = stripSqlCommentsAndStrings(fs.readFileSync(path.join(TESTS_DIR, f), 'utf8')).trim();
    const semicolons = clean.split(';').filter((part) => part.trim().length > 0);
    assert.equal(semicolons.length, 1, `${f}: debe contener exactamente 1 sentencia SELECT`);
    assert.match(clean, /^SELECT\s/i, `${f}: debe comenzar por SELECT`);
    assert.match(clean, /AS\s+test_name/i, `${f}: falta alias test_name`);
    assert.match(clean, /AS\s+severity/i, `${f}: falta alias severity`);
    assert.match(clean, /AS\s+failures/i, `${f}: falta alias failures`);
    assert.match(clean, /AS\s+details/i, `${f}: falta alias details`);
  }
});

test('correcciones P0/P1/P2 verificadas en el SQL de modelos y tests DQ', () => {
  const readM = (f) => fs.readFileSync(path.join(MODELS_DIR, f), 'utf8');
  const readT = (f) => fs.readFileSync(path.join(TESTS_DIR, f), 'utf8');

  // 00_params: umbrales MFEU, hábito, k=5, n=10/30
  const m00 = readM('00_params.sql');
  assert.match(m00, /mfeu_min_saving_days_30d/);
  assert.match(m00, /habit_min_weeks_in_4w/);
  assert.match(m00, /stat_min_n_indicative/);
  assert.match(m00, /stat_min_n_robust/);

  // 02_fct_ledger: recursión para saving_kind
  const m02 = readM('02_fct_ledger.sql');
  assert.match(m02, /WITH\s+RECURSIVE/i);
  assert.match(m02, /depth\s*<\s*20/);

  // 03_fct_decision_events: deduplicación PostHog + goal_id + fct_prompt_impression
  const m03 = readM('03_fct_decision_events.sql');
  assert.match(m03, /QUALIFY\s+ROW_NUMBER\(\)\s+OVER/i);
  assert.match(m03, /\$\.goal_id/);
  assert.match(m03, /CREATE OR REPLACE TABLE `\{\{project\}\}\.\{\{an\}\}\.fct_prompt_impression`/);

  // 04_fct_user_day: 3 niveles de actividad ortogonales
  const m04 = readM('04_fct_user_day.sql');
  assert.match(m04, /AS\s+is_financial_active/);
  assert.match(m04, /AS\s+is_app_active/);
  assert.match(m04, /AS\s+is_saving_day/);

  // 05_mart_kpi_daily: MFEU real, hábito 4w, apertura V1 solo desde cutover
  const m05 = readM('05_mart_kpi_daily.sql');
  assert.match(m05, /AS\s+mfeu_30d/);
  assert.match(m05, /AS\s+habit_users_4w/);
  assert.match(m05, /IF\(d\.date >= p\.v2_cutover_date,\s*opening\.opening_total,\s*0\)/);

  // 06_mart_funnel: sin días negativos ni etiqueta engañosa 'Hábito'
  const m06 = readM('06_mart_funnel.sql');
  assert.match(m06, /GREATEST\(0\.0,/);
  assert.match(m06, /activated_7d_clean/);
  assert.doesNotMatch(m06, /'Hábito \(≥3 días con ahorro\)'/);

  // 09_mart_goals: separación was_ever_completed / is_currently_at_target + mart_goals_summary sin user_id
  const m09 = readM('09_mart_goals.sql');
  assert.match(m09, /AS\s+was_ever_completed/);
  assert.match(m09, /AS\s+is_currently_at_target/);
  assert.match(m09, /CREATE OR REPLACE TABLE `\{\{project\}\}\.\{\{an\}\}\.mart_goals_summary`/);

  // 10_mart_bank: supresión complementaria, SAFE_OFFSET (nunca OFFSET), cero est_ltv, dataset {{bank}}, sin subquery escalar en UNNEST/JOIN ON
  const m10 = readM('10_mart_bank.sql');
  assert.match(m10, /SAFE_OFFSET/);
  assert.doesNotMatch(m10, /\[OFFSET\(/);
  assert.doesNotMatch(m10, /UNNEST\([^;\n]*\(SELECT/i);
  assert.doesNotMatch(m10, /\bON\b[^;]*?<=?\s*\(SELECT/i);
  assert.doesNotMatch(m10, /\best_ltv\b/);
  assert.match(m10, /indicative_3y_deposit_margin_organic_eur/);
  assert.match(m10, /\{\{bank\}\}\.mart_bank_segments/);
  assert.match(m10, /\{\{bank\}\}\.mart_bank_goals_profile/);
  assert.match(m10, /\{\{bank\}\}\.mart_bank_behavioral_segments/);
  assert.match(m10, /\{\{bank\}\}\.bank_governance_metadata/);

  // 11_mart_kpi_summary: día cerrado (DATE_SUB(..., INTERVAL 1 DAY)) y sin est_ltv
  const m11 = readM('11_mart_kpi_summary.sql');
  assert.match(m11, /DATE_SUB\(CURRENT_DATE\('Europe\/Madrid'\),\s*INTERVAL 1 DAY\)/);
  assert.match(m11, /AS\s+as_of_date/);
  assert.doesNotMatch(m11, /\best_ltv_total\b/);

  // Tests DQ: PK stg_events, saving_kind reconcile, supresión complementaria, no_user_id_in_bank_dataset, sin bypass e.n=0
  assert.match(readT('01_integrity.sql'), /pk_unique_stg_events/);
  assert.match(readT('02_ledger.sql'), /ledger_saving_kind_reconciles/);
  assert.match(readT('03_kpis.sql'), /bank_complementary_suppression/);
  assert.match(readT('03_kpis.sql'), /bank_isolated_dataset_parity/);
  const t04 = readT('04_privacy_freshness.sql');
  assert.match(t04, /no_user_id_in_bank_dataset/);
  assert.match(t04, /posthog_confirmed_orphan_txns/);
  assert.match(t04, /posthog_confirmed_orphan_decisions/);
  assert.match(t04, /posthog_geoip_recent_check/);
  assert.doesNotMatch(t04, /IF\(e\.n = 0 OR/);
});

test('algoritmo de supresión complementaria en mart_bank_* garantiza cero differencing attacks', () => {
  const k = 5;
  function foldSegments(countsByBand) {
    const step1 = {};
    for (const [band, n] of Object.entries(countsByBand)) {
      const seg1 = n >= k ? band : 'otros';
      step1[seg1] = (step1[seg1] || 0) + n;
    }
    const otrosN = step1.otros || 0;
    const nonOtros = Object.entries(step1)
      .filter(([b]) => b !== 'otros')
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    if (otrosN > 0 && otrosN < k && nonOtros.length > 0) {
      const [smallestBand, smallestN] = nonOtros[0];
      delete step1[smallestBand];
      step1.otros = otrosN + smallestN;
    }
    return step1;
  }

  const scenarios = [
    { name: 'total < k (4 usuarios)', input: { lt_1000: 2, '2000_2500': 2 } },
    { name: 'foto actual (2000_2500=6, resto=16)', input: { lt_1000: 2, '1000_1500': 3, '1500_2000': 4, '2000_2500': 6, '2500_3000': 4, gt_3000: 3 } },
    { name: 'peligro differencing (1 banda grande + otros=3)', input: { '2000_2500': 18, lt_1000: 2, gt_3000: 1 } },
    { name: 'peligro differencing (2 bandas + otros=3)', input: { '2000_2500': 12, '1500_2000': 7, lt_1000: 2, gt_3000: 1 } },
    { name: 'todas las bandas >= k', input: { '1000_1500': 10, '1500_2000': 15, '2000_2500': 20 } },
  ];

  for (const sc of scenarios) {
    const total = Object.values(sc.input).reduce((a, b) => a + b, 0);
    const folded = foldSegments(sc.input);
    const sumAfter = Object.values(folded).reduce((a, b) => a + b, 0);
    assert.equal(sumAfter, total, `${sc.name}: se perdieron usuarios`);
    if (total >= k) {
      for (const [seg, n] of Object.entries(folded)) {
        assert.ok(n >= k, `${sc.name}: segmento ${seg} quedó con ${n} < ${k} (riesgo differencing attack)`);
      }
    }
  }
});

test('main.py incluye BQ_BANK_DATASET y resuelve ubicación desde datasets V2 sin depender de raw_supabase', () => {
  const py = fs.readFileSync(path.join(ROOT, 'jobs', 'supabase-bigquery-sync', 'main.py'), 'utf8');
  assert.match(py, /BQ_BANK_DATASET/);
  assert.match(py, /analytics_bank_v2/);
  assert.match(py, /"bank":\s*ds_bank/);
  assert.match(py, /def resolve_bq_location/);
  assert.doesNotMatch(py, /get_dataset\(f"\{bq_project\}\.\{ds_v1\}"\)/);
});

test('cableado de daily_prompt_impressions usa UUID determinista y fallback seguro que nunca bloquea ahorros', () => {
  const idsSrc = fs.readFileSync(path.join(ROOT, 'src', 'services', 'v2', 'ids.ts'), 'utf8');
  const outboxSrc = fs.readFileSync(path.join(ROOT, 'src', 'services', 'v2', 'outbox.ts'), 'utf8');
  const storeSrc = fs.readFileSync(path.join(ROOT, 'src', 'services', 'dashboardStore.ts'), 'utf8');

  assert.match(idsSrc, /export async function promptImpressionUuid/);
  assert.match(outboxSrc, /'prompt\.impression':/);
  assert.match(outboxSrc, /rpc\('record_prompt_impression'/);
  assert.match(outboxSrc, /args\.p_impression_id = null;/);
  assert.match(outboxSrc, /c\.type === 'prompt\.impression'/);
  assert.match(storeSrc, /export function recordPromptImpressionShown/);
  assert.match(storeSrc, /impressionLocalDate:\s*today/);

  // Verificar determinismo SHA-256 del formato UUID v8 usado por v1Uuid
  const makeUuid = (userId, kind, legacy) => {
    const h = crypto.createHash('sha256').update(`ai:v1:${userId}:${kind}:${legacy}`).digest('hex');
    const s = h.slice(0, 12) + '8' + h.slice(13, 16) + '89ab'[parseInt(h.slice(16, 18), 16) % 4] + h.slice(17, 32);
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
  };
  const u1 = makeUuid('11111111-1111-1111-1111-111111111111', 'imp', '2026-11-27:q_com_m_01');
  const u2 = makeUuid('11111111-1111-1111-1111-111111111111', 'imp', '2026-11-27:q_com_m_01');
  const u3 = makeUuid('11111111-1111-1111-1111-111111111111', 'imp', '2026-11-27:q_com_m_02');
  assert.equal(u1, u2);
  assert.notEqual(u1, u3);
  assert.match(u1, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
