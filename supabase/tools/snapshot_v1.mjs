#!/usr/bin/env node
/**
 * Data Model V2 · 5B.0 — Snapshot agregado PRE-V2 de las tablas V1.
 *
 * SOLO LECTURA. Usa la API REST de Supabase (PostgREST) con la service role
 * para LEER filas, las agrega en memoria y escribe únicamente AGREGADOS
 * (sin ids de usuario, sin nombres, sin textos libres, sin importes por usuario).
 *
 * Uso:  node supabase/tools/snapshot_v1.mjs <ruta-al-.env.local> [salida.json]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const envFile = process.argv[2];
const outFile = process.argv[3];
if (!envFile) { console.error('Falta la ruta del .env'); process.exit(2); }

const env = {};
for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
}
const url = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function fetchAll(table, select) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${url}/rest/v1/${table}?select=${select}`, {
      headers: { ...headers, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

const r2 = (n) => Math.round(n * 100) / 100;
const sum = (a, f) => r2(a.reduce((s, x) => s + Number(f(x) ?? 0), 0));
const isDaily = (d) => d.question_id !== 'extra_saving' && d.question_id !== 'grace_day';

const [profiles, goals, decisions, hucha, qi, push] = await Promise.all([
  fetchAll('user_profiles', 'id,created_at,onboarding_completed_at,income_range'),
  fetchAll('goals', 'id,user_id,target_amount,current_amount,is_primary,archived,source,completed_at'),
  fetchAll('decisions', 'id,user_id,date,question_id,goal_id,delta_amount,created_at'),
  fetchAll('hucha', 'user_id,balance,entries'),
  fetchAll('question_interactions', 'id'),
  fetchAll('push_subscriptions', 'id'),
]);

// Saldo por goal según decisiones (solo para medir el desfase V1; no se guarda por usuario)
const decByGoal = new Map();
for (const d of decisions) if (d.goal_id) decByGoal.set(d.goal_id, (decByGoal.get(d.goal_id) ?? 0) + Number(d.delta_amount));
const goalsMismatch = goals.filter((g) => Math.abs(Number(g.current_amount) - (decByGoal.get(g.id) ?? 0)) > 0.005);

const primaryPerUser = new Map();
for (const g of goals) if (g.is_primary && !g.archived) primaryPerUser.set(g.user_id, (primaryPerUser.get(g.user_id) ?? 0) + 1);

const dailyKey = new Map();
let dupDaily = 0;
for (const d of decisions.filter(isDaily)) {
  const k = `${d.user_id}|${d.date}`;
  if (dailyKey.has(k)) dupDaily++;
  dailyKey.set(k, true);
}

const huchaEntriesTotal = hucha.reduce((s, h) => s + (Array.isArray(h.entries) ? h.entries.reduce((x, e) => x + Number(e.amount ?? 0), 0) : 0), 0);
const dates = decisions.map((d) => d.date).sort();

const snapshot = {
  taken_at: new Date().toISOString(),
  note: 'Agregados PRE-V2. Sin PII, sin ids de usuario, sin textos libres.',
  counts: {
    user_profiles: profiles.length,
    user_profiles_income_range_not_null: profiles.filter((p) => p.income_range).length,
    user_profiles_onboarding_completed_at_not_null: profiles.filter((p) => p.onboarding_completed_at).length,
    goals: goals.length,
    goals_active: goals.filter((g) => !g.archived).length,
    goals_archived: goals.filter((g) => g.archived).length,
    goals_source_onboarding: goals.filter((g) => g.source === 'onboarding').length,
    goals_completed_at_not_null: goals.filter((g) => g.completed_at).length,
    decisions: decisions.length,
    decisions_daily: decisions.filter(isDaily).length,
    decisions_extra_saving: decisions.filter((d) => d.question_id === 'extra_saving').length,
    decisions_goal_id_null: decisions.filter((d) => !d.goal_id).length,
    decisions_delta_zero: decisions.filter((d) => Number(d.delta_amount) === 0).length,
    decisions_delta_negative: decisions.filter((d) => Number(d.delta_amount) < 0).length,
    hucha_rows: hucha.length,
    hucha_balance_positive: hucha.filter((h) => Number(h.balance) > 0).length,
    question_interactions: qi.length,
    push_subscriptions: push.length,
    distinct_users_with_decisions: new Set(decisions.map((d) => d.user_id)).size,
    distinct_users_with_goals: new Set(goals.map((g) => g.user_id)).size,
  },
  sums_eur: {
    goals_current_amount: sum(goals, (g) => g.current_amount),
    goals_current_amount_active: sum(goals.filter((g) => !g.archived), (g) => g.current_amount),
    goals_target_amount: sum(goals, (g) => g.target_amount),
    decisions_delta_total: sum(decisions, (d) => d.delta_amount),
    decisions_delta_daily: sum(decisions.filter(isDaily), (d) => d.delta_amount),
    decisions_delta_extra: sum(decisions.filter((d) => d.question_id === 'extra_saving'), (d) => d.delta_amount),
    hucha_balance_total: sum(hucha, (h) => h.balance),
    hucha_entries_total: r2(huchaEntriesTotal),
  },
  date_range_decisions: { min: dates[0] ?? null, max: dates[dates.length - 1] ?? null },
  v1_anomalies: {
    goals_current_amount_ne_sum_of_decisions: goalsMismatch.length,
    users_with_more_than_one_active_primary_goal: [...primaryPerUser.values()].filter((n) => n > 1).length,
    duplicated_daily_decisions_same_user_date: dupDaily,
  },
};

const json = JSON.stringify(snapshot, null, 2);
console.log(json);
if (outFile) {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, json + '\n');
}
