// Estrés de idempotencia/concurrencia (CONC-2). Uso: cd supabase/tests && node stress_conc.mjs [iteraciones]
import { Db } from './harness.mjs';
import { randomUUID as uuid } from 'node:crypto';

const N = Number(process.argv[2] ?? 50);
const db = new Db();
await db.start(); await db.installShim(); await db.applyAll();
const q = async (s, p = []) => (await db.admin.query(s, p)).rows;
const TZ = 'Europe/Madrid';
const at = () => new Date(Date.now() - 60e3).toISOString();
const Q = (await q(`select question_id id, options->0->>'option_key' o from public.cat_daily_questions order by 1 limit 1`))[0];

const bad = [];
async function iter(i) {
  const U = uuid(); await db.addUser(U);
  const id = uuid(), did = uuid(), when = at();
  const ex = () => db.rpc(U, 'record_extra_saving', { p_transaction_id: id, p_occurred_at: when, p_timezone: TZ, p_amount: 7, p_goal_id: null, p_note: null });
  const dd = () => db.rpc(U, 'record_daily_decision', { p_decision_id: did, p_occurred_at: when, p_timezone: TZ, p_outcome: 'saved',
    p_question_bank_version: 'qb_v1', p_question_id: Q.id, p_selected_option_key: Q.o, p_declared_amount: 10, p_custom_text: null, p_goal_id: null, p_impression_id: null });
  const rs = await Promise.all([ex(), ex(), ex(), dd(), dd(), dd()]);
  const exOk = rs.slice(0, 3), ddOk = rs.slice(3);
  const errs = rs.filter(r => !r.ok).map(r => r.error);
  const replays = rs.filter(r => r.ok && r.data?.idempotent_replay).length;
  const tx = (await q(`select count(*)::int c, coalesce(sum(amount),0)::numeric s from public.savings_transactions where user_id=$1`, [U]))[0];
  // 1 extra (+7) + 1 decisión (+10) = 2 filas, 17
  const good = errs.length === 0 && replays === 4 && tx.c === 2 && Number(tx.s) === 17;
  if (!good) bad.push({ i, errs, replays, tx, exOk: exOk.map(r => r.ok), ddOk: ddOk.map(r => r.ok) });
}
const PAR = 5;
for (let i = 0; i < N; i += PAR) await Promise.all(Array.from({ length: Math.min(PAR, N - i) }, (_, k) => iter(i + k)));
console.log(`ITERACIONES=${N} FALLOS=${bad.length}`);
if (bad.length) console.log(JSON.stringify(bad.slice(0, 5), null, 1));
await db.stop?.();
process.exit(bad.length ? 1 : 0);
