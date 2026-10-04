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
  const isConn = r => !r.ok && /EMAXCONN|max clients|too many|ECONNRESET|timeout/i.test(r.error);
  const conn = rs.filter(isConn).length; connErrs += conn;
  const logicErrs = rs.filter(r => !r.ok && !isConn(r)).map(r => r.error);
  const exRan = rs.slice(0, 3).filter(r => r.ok), ddRan = rs.slice(3).filter(r => r.ok);
  const replays = rs.filter(r => r.ok && r.data?.idempotent_replay).length;
  const expectedRows = (exRan.length ? 1 : 0) + (ddRan.length ? 1 : 0);
  const expectedSum = (exRan.length ? 7 : 0) + (ddRan.length ? 10 : 0);
  const expectedReplays = Math.max(0, exRan.length - 1) + Math.max(0, ddRan.length - 1);
  const tx = (await q(`select count(*)::int c, coalesce(sum(amount),0)::numeric s from public.savings_transactions where user_id=$1`, [U]))[0];
  const good = logicErrs.length === 0 && replays === expectedReplays && tx.c === expectedRows && Number(tx.s) === expectedSum;
  if (conn === 0) fullIters++;
  if (!good) bad.push({ i, logicErrs, conn, replays, expectedReplays, tx, expectedRows, expectedSum });
}
let connErrs = 0, fullIters = 0;
const PAR = Number(process.env.PAR ?? 5);
for (let i = 0; i < N; i += PAR) await Promise.all(Array.from({ length: Math.min(PAR, N - i) }, (_, k) => iter(i + k)));
console.log(`ITERACIONES=${N} COMPLETAS_SIN_LIMITE_POOLER=${fullIters} ERRORES_CONEXION_POOLER=${connErrs} FALLOS_LOGICOS=${bad.length}`);
if (bad.length) console.log(JSON.stringify(bad.slice(0, 5), null, 1));
await db.stop?.();
process.exit(bad.length ? 1 : 0);
