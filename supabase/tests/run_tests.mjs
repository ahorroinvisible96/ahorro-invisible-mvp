// Suite de pruebas 5B.1 / 5B.2 sobre Postgres local aislado (NO producción).
// Uso: cd supabase/tests && npm i && node run_tests.mjs
import { Db } from './harness.mjs';
import { randomUUID as uuid } from 'node:crypto';
import fs from 'node:fs';

const db = new Db();
const results = [];
let failures = 0;

const iso = (hoursAgo = 0, minutes = 0) => new Date(Date.now() - hoursAgo * 3600e3 + minutes * 60e3).toISOString();
const TZ = 'Europe/Madrid';

async function t(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('  PASS', name); }
  catch (e) { failures++; results.push({ name, ok: false, err: e.message }); console.log('  FAIL', name, '\n       ', e.message); }
}
function eq(a, b, msg = '') {
  if (String(a) !== String(b)) throw new Error(`${msg} esperado=${b} real=${a}`);
}
function ok(r, msg = '') { if (!r.ok) throw new Error(`${msg} RPC falló: ${r.error}`); return r.data; }
function fail(r, code, msg = '') {
  if (r.ok) throw new Error(`${msg} se esperaba error '${code}' pero tuvo éxito: ${JSON.stringify(r.data)}`);
  if (!String(r.error).includes(code)) throw new Error(`${msg} se esperaba '${code}', real='${r.error}'`);
}
async function q(sql, params = []) { return (await db.admin.query(sql, params)).rows; }
const bal = async (uid, bucket, goal = null) =>
  Number((await q(`select coalesce(sum(amount),0) b from public.savings_transactions where user_id=$1 and bucket_type=$2 and goal_id is not distinct from $3`, [uid, bucket, goal]))[0].b);

const A = uuid(), B = uuid(), C = uuid(), D = uuid(), E = uuid(), F = uuid(), G = uuid();
let QUESTION; // {id, option}

async function mkGoal(uid, { id = uuid(), title = 'Viaje', target = 100, horizon = 3, primary = false, source = 'goals_page' } = {}) {
  const r = await db.rpc(uid, 'create_goal', { p_goal_id: id, p_title: title, p_target_amount: target, p_horizon_months: horizon,
    p_source: source, p_set_primary: primary, p_occurred_at: iso(0, -1), p_timezone: TZ });
  ok(r, 'create_goal');
  return id;
}
const extra = (uid, amount, goal = null, o = {}) => db.rpc(uid, 'record_extra_saving', {
  p_transaction_id: o.id ?? uuid(), p_occurred_at: o.at ?? iso(0, -1), p_timezone: o.tz ?? TZ, p_amount: amount,
  p_goal_id: goal, p_note: o.note ?? null });
const decision = (uid, o = {}) => db.rpc(uid, 'record_daily_decision', {
  p_decision_id: o.id ?? uuid(), p_occurred_at: o.at ?? iso(0, -1), p_timezone: o.tz ?? TZ, p_outcome: o.outcome ?? 'saved',
  p_question_bank_version: 'qb_v1', p_question_id: QUESTION.id, p_selected_option_key: o.opt ?? QUESTION.option,
  p_declared_amount: o.amount ?? 10, p_custom_text: o.text ?? null, p_goal_id: o.goal ?? null, p_impression_id: o.impression ?? null });

console.log('▶ Arrancando Postgres local aislado y aplicando migraciones…');
await db.start();
await db.installShim();
await db.applyAll();
for (const u of [A, B, C, D, E, F, G]) await db.addUser(u);
QUESTION = (await q(`select question_id id, options->0->>'option_key' option from public.cat_daily_questions order by question_id limit 1`))[0];

console.log('\n── Estructura / integridad (5B.1)');
await t('S1 tablas V2 creadas y catálogos sembrados', async () => {
  const names = ['onboarding_sessions','avatar_assessments','avatar_assessment_answers','income_declarations','goal_events',
    'daily_prompt_impressions','daily_decisions','savings_transactions','user_free_text','cat_income_bands',
    'cat_recommendation_rules','cat_daily_questions'];
  for (const n of names) eq((await q(`select to_regclass('public.${n}') r`))[0].r, n, n);
  eq((await q(`select count(*)::int c from public.cat_income_bands`))[0].c, 6, 'bands');
  eq((await q(`select count(*)::int c from public.cat_recommendation_rules`))[0].c, 4, 'rules');
  eq((await q(`select count(*)::int c from public.cat_daily_questions`))[0].c, 1512, 'questions');
  eq((await q(`select reference_income_amount r from public.cat_income_bands where band_code='gt_3000'`))[0].r, '3000.00');
});
await t('S2 V1 intacto: tablas y columnas legacy siguen existiendo', async () => {
  for (const n of ['decisions','hucha','question_interactions','push_subscriptions'])
    eq((await q(`select to_regclass('public.${n}') r`))[0].r, n, n);
  const cols = (await q(`select column_name from information_schema.columns where table_name='goals' and table_schema='public'`)).map(r => r.column_name);
  for (const c of ['current_amount','archived','completed_at']) if (!cols.includes(c)) throw new Error('falta ' + c);
});
await t('S3 sin FKs cross-user: toda FK hacia tablas V2 con user_id incluye user_id', async () => {
  const bad = await q(`
    select c.conname, c.conrelid::regclass::text tbl from pg_constraint c
    where c.contype='f' and c.connamespace='public'::regnamespace
      and c.conrelid::regclass::text in ('goal_events','savings_transactions','daily_decisions','user_free_text','daily_prompt_impressions','avatar_assessments','avatar_assessment_answers','income_declarations','goals')
      and c.confrelid::regclass::text in ('goals','daily_decisions','savings_transactions','daily_prompt_impressions','onboarding_sessions','avatar_assessments')
      and not exists (select 1 from pg_attribute a where a.attrelid=c.conrelid and a.attnum = any(c.conkey) and a.attname='user_id')`);
  eq(bad.length, 0, JSON.stringify(bad));
});
await t('S4 sin dependencias circulares entre tablas V2', async () => {
  const edges = await q(`select c.conrelid::regclass::text a, c.confrelid::regclass::text b from pg_constraint c
     where c.contype='f' and c.connamespace='public'::regnamespace and c.conrelid<>c.confrelid
       and c.confrelid::regclass::text not in ('cat_daily_questions','cat_income_bands','cat_recommendation_rules')`);
  const g = new Map();
  for (const e of edges) { if (!g.has(e.a)) g.set(e.a, new Set()); g.get(e.a).add(e.b); }
  const state = new Map();
  const dfs = (n, path) => {
    if (state.get(n) === 1) throw new Error('ciclo: ' + [...path, n].join(' -> '));
    if (state.get(n) === 2) return;
    state.set(n, 1);
    for (const m of g.get(n) ?? []) dfs(m, [...path, n]);
    state.set(n, 2);
  };
  for (const n of g.keys()) dfs(n, []);
});
await t('S5 sin balances editables: ninguna columna de saldo en tablas V2; goals V2 exige current_amount=0', async () => {
  const cols = await q(`select table_name, column_name from information_schema.columns where table_schema='public'
     and table_name in ('goal_events','savings_transactions','daily_decisions','onboarding_sessions','income_declarations','daily_prompt_impressions')
     and column_name ~ '(^balance$|current_amount|^saldo)'`);
  eq(cols.length, 0, JSON.stringify(cols));
  const r = await q(`select pg_get_constraintdef(oid) d from pg_constraint where conname='goals_v2_shape_chk'`);
  if (!/current_amount\s*=\s*\(?0/.test(r[0].d)) throw new Error('falta check current_amount=0: ' + r[0].d);
});
await t('S6 un único principal activo por usuario (índice parcial)', async () => {
  const gid1 = await mkGoal(F, { primary: true, title: 'P1' });
  const gid2 = await mkGoal(F, { primary: true, title: 'P2' });
  const rows = await q(`select id, is_primary from public.goals where user_id=$1 order by created_at`, [F]);
  eq(rows.filter(r => r.is_primary).length, 1);
  eq(rows.find(r => r.is_primary).id, gid2);
  void gid1;
});

console.log('\n── Seguridad y permisos (5B.2)');
await t('P1 usuario sin JWT → not_authenticated', async () => {
  fail(await db.rpc(null, 'record_extra_saving', { p_transaction_id: uuid(), p_occurred_at: iso(0, -1), p_timezone: TZ, p_amount: 5 }), 'not_authenticated');
});
await t('P2 anon no puede ejecutar RPC', async () => {
  fail(await db.rpc(null, 'record_extra_saving', { p_transaction_id: uuid(), p_occurred_at: iso(0, -1), p_timezone: TZ, p_amount: 5 }, { role: 'anon' }), 'permission denied');
});
await t('P3 authenticated no tiene INSERT/UPDATE/DELETE directo en tablas V2 financieras/históricas', async () => {
  const tabs = ['savings_transactions','daily_decisions','goal_events','onboarding_sessions','avatar_assessments',
    'avatar_assessment_answers','income_declarations','daily_prompt_impressions','user_free_text'];
  for (const tb of tabs) for (const op of ['INSERT','UPDATE','DELETE','TRUNCATE']) for (const role of ['authenticated','anon','service_role']) {
    const r = (await q(`select has_table_privilege($1, 'public.${tb}', $2) p`, [role, op]))[0].p;
    if (r) throw new Error(`${role} tiene ${op} en ${tb}`);
  }
  // y un intento real
  const r = await db.asUser(A, async c => { try { await c.query(`insert into public.savings_transactions(transaction_id,user_id,transaction_type,bucket_type,amount,reason,occurred_at,timezone,local_date) values (gen_random_uuid(),$1,'extra_saving','hucha',1000,'user_saving',now(),'UTC',current_date)`, [A]); return 'inserted'; } catch (e) { return e.message; } });
  if (!String(r).includes('permission denied')) throw new Error('INSERT directo no bloqueado: ' + r);
});
await t('P4 funciones SECURITY DEFINER: search_path vacío, dueño app_rpc_owner, EXECUTE solo authenticated', async () => {
  const fns = await q(`select p.proname, p.prosecdef, pg_get_userbyid(p.proowner) owner, p.proconfig, p.oid
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
      and p.proname in ('start_onboarding','complete_onboarding','record_prompt_impression','record_daily_decision','record_extra_saving','amend_decision_amount','void_decision','use_grace_day','transfer_between_buckets','create_goal','update_goal','set_primary_goal','archive_goal','reactivate_goal','delete_goal')`);
  eq(fns.length, 15, 'nº RPC');
  for (const f of fns) {
    if (!f.prosecdef) throw new Error(f.proname + ' no es SECURITY DEFINER');
    eq(f.owner, 'app_rpc_owner', f.proname + ' owner');
    if (!(f.proconfig ?? []).some(s => /search_path=("")?$/.test(s) || s === 'search_path=""')) throw new Error(f.proname + ' sin search_path seguro: ' + JSON.stringify(f.proconfig));
    for (const [role, expect] of [['authenticated', true], ['anon', false], ['service_role', false]]) {
      const p = (await q(`select has_function_privilege($1, $2::oid, 'EXECUTE') p`, [role, f.oid]))[0].p;
      if (p !== expect) throw new Error(`${f.proname}: EXECUTE ${role}=${p}`);
    }
    // ningún parámetro user_id
    const args = (await q(`select pg_get_function_arguments($1::oid) a`, [f.oid]))[0].a;
    if (/user_id/i.test(args)) throw new Error(f.proname + ' acepta user_id');
  }
  // helpers privados no ejecutables por roles de la app
  const priv = await q(`select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'`);
  for (const f of priv) for (const role of ['authenticated','anon','service_role'])
    if ((await q(`select has_function_privilege($1,$2::oid,'EXECUTE') p`, [role, f.oid]))[0].p) throw new Error(`private.${f.proname} ejecutable por ${role}`);
  eq((await q(`select has_schema_privilege('authenticated','private','USAGE') p`))[0].p, false, 'USAGE private');
});
await t('P5 tablas V2 con RLS activada y política solo SELECT own', async () => {
  const rows = await q(`select c.relname, c.relrowsecurity rls, (select count(*) from pg_policy p where p.polrelid=c.oid and p.polcmd<>'r')::int writes
     from pg_class c where c.relnamespace='public'::regnamespace and c.relname in ('savings_transactions','daily_decisions','goal_events','onboarding_sessions','avatar_assessments','avatar_assessment_answers','income_declarations','daily_prompt_impressions','user_free_text')`);
  eq(rows.length, 9);
  for (const r of rows) { if (!r.rls) throw new Error(r.relname + ' sin RLS'); eq(r.writes, 0, r.relname + ' políticas de escritura'); }
});
await t('1 usuario A no puede tocar datos de B', async () => {
  const gB = await mkGoal(B, { title: 'Privado B' });
  ok(await extra(B, 50, gB));
  const decB = uuid(); ok(await decision(B, { id: decB, goal: gB, amount: 7 }));
  fail(await db.rpc(A, 'update_goal', { p_mutation_id: uuid(), p_goal_id: gB, p_occurred_at: iso(0, -1), p_timezone: TZ, p_title: 'hack' }), 'not_found');
  fail(await db.rpc(A, 'archive_goal', { p_mutation_id: uuid(), p_goal_id: gB, p_occurred_at: iso(0, -1), p_timezone: TZ }), 'not_found');
  fail(await db.rpc(A, 'delete_goal', { p_mutation_id: uuid(), p_goal_id: gB, p_occurred_at: iso(0, -1), p_timezone: TZ }), 'not_found');
  fail(await db.rpc(A, 'set_primary_goal', { p_mutation_id: uuid(), p_goal_id: gB, p_occurred_at: iso(0, -1), p_timezone: TZ }), 'not_found');
  fail(await extra(A, 10, gB), 'not_found');
  fail(await db.rpc(A, 'amend_decision_amount', { p_mutation_id: uuid(), p_decision_id: decB, p_new_amount: 1, p_occurred_at: iso(0, -1), p_timezone: TZ }), 'not_found');
  fail(await db.rpc(A, 'void_decision', { p_mutation_id: uuid(), p_decision_id: decB, p_reason: 'user_reset_today', p_occurred_at: iso(0, -1), p_timezone: TZ }), 'not_found');
  fail(await db.rpc(A, 'transfer_between_buckets', { p_transfer_group_id: uuid(), p_from_bucket: 'goal', p_from_goal_id: gB, p_to_bucket: 'hucha', p_to_goal_id: null, p_amount: 5, p_occurred_at: iso(0, -1), p_timezone: TZ }), 'not_found');
  // lectura directa: A no ve nada de B
  const seen = await db.asUser(A, async c => (await c.query(`select (select count(*) from public.savings_transactions) t, (select count(*) from public.daily_decisions) d, (select count(*) from public.goal_events) e, (select count(*) from public.v_goal_state) g`)).rows[0]);
  eq(`${seen.t}|${seen.d}|${seen.e}|${seen.g}`, '0|0|0|0', 'A ve datos de B');
  eq(await bal(B, 'goal', gB), 57, 'saldo B intacto'); // 50 extra + 7 decisión
});
await t('8 goal de otro usuario rechazado (RPC y FK compuesta en BD)', async () => {
  const gB = (await q(`select id from public.goals where user_id=$1 and ledger_managed limit 1`, [B]))[0].id;
  fail(await decision(A, { goal: gB }), 'not_found');
  // FK compuesta: incluso con privilegios totales, no se puede apuntar al goal de B desde A
  let err = '';
  try { await q(`insert into public.savings_transactions(transaction_id,user_id,transaction_type,bucket_type,goal_id,amount,reason,occurred_at,timezone,local_date) values (gen_random_uuid(),$1,'extra_saving','goal',$2,5,'user_saving',now(),'UTC',current_date)`, [A, gB]); } catch (e) { err = e.message; }
  if (!/foreign key|violates/i.test(err)) throw new Error('FK cross-user no bloqueó: ' + err);
});

console.log('\n── Idempotencia');
await t('2 misma petición repetida no duplica datos', async () => {
  const id = uuid(); const at1 = iso(0, -1);
  const r1 = ok(await extra(C, 20, null, { id, at: at1 }));
  const r2 = ok(await extra(C, 20, null, { id, at: at1 }));
  eq(r2.idempotent_replay, true);
  eq(r1.transaction_id, r2.transaction_id);
  eq((await q(`select count(*)::int c from public.savings_transactions where transaction_id=$1`, [id]))[0].c, 1);
  eq(await bal(C, 'hucha'), 20);
  // goals
  const gid = uuid(); const atg = iso(0, -1);
  const mk = () => db.rpc(C, 'create_goal', { p_goal_id: gid, p_title: 'X', p_target_amount: 100, p_horizon_months: 3, p_source: 'goals_page', p_set_primary: false, p_occurred_at: atg, p_timezone: TZ });
  const a = ok(await mk()); const b = ok(await mk());
  eq(b.idempotent_replay, true); eq(a.goal_id, b.goal_id);
  eq((await q(`select count(*)::int c from public.goal_events where goal_id=$1 and event_type='created'`, [gid]))[0].c, 1);
  // decisión diaria
  const did = uuid(); const at = iso(0, -2);
  ok(await decision(D, { id: did, at })); const d2 = ok(await decision(D, { id: did, at }));
  eq(d2.idempotent_replay, true);
  eq((await q(`select count(*)::int c from public.savings_transactions where decision_id=$1`, [did]))[0].c, 1);
  eq(await bal(D, 'hucha'), 10);
});
await t('3 misma clave + payload distinto → idempotency_conflict', async () => {
  const id = uuid(); const at = iso(0, -1);
  ok(await extra(C, 5, null, { id, at }));
  fail(await extra(C, 6, null, { id, at }), 'idempotency_conflict');
  fail(await extra(C, 5, null, { id, at: iso(0, -2) }), 'idempotency_conflict'); // mismo importe, otro instante
  const gid = uuid(); const atg = iso(0, -1);
  const mk = (title) => db.rpc(C, 'create_goal', { p_goal_id: gid, p_title: title, p_target_amount: 10, p_horizon_months: 1, p_source: 'dashboard', p_set_primary: false, p_occurred_at: atg, p_timezone: TZ });
  ok(await mk('uno')); fail(await mk('dos'), 'idempotency_conflict');
  eq((await q(`select title t from public.goals where id=$1`, [gid]))[0].t, 'uno');
  eq(await bal(C, 'hucha'), 25);
});

console.log('\n── Ledger');
await t('4 transferencias de dos asientos que suman 0', async () => {
  const g = await mkGoal(C, { title: 'Dest' });
  const grp = uuid();
  const r = ok(await db.rpc(C, 'transfer_between_buckets', { p_transfer_group_id: grp, p_from_bucket: 'hucha', p_from_goal_id: null, p_to_bucket: 'goal', p_to_goal_id: g, p_amount: 10, p_occurred_at: iso(0, -1), p_timezone: TZ }));
  const rows = await q(`select transaction_type, amount from public.savings_transactions where transfer_group_id=$1 order by amount`, [grp]);
  eq(rows.length, 2); eq(rows[0].transaction_type, 'transfer_out'); eq(rows[1].transaction_type, 'transfer_in');
  eq(Number(rows[0].amount) + Number(rows[1].amount), 0);
  eq(await bal(C, 'goal', g), 10); eq(await bal(C, 'hucha'), 15);
  // Ahorro neto registrado excluye transferencias
  const net = Number((await q(`select sum(amount) s from public.savings_transactions where user_id=$1 and transaction_type in ('daily_saving','extra_saving','amendment','reversal')`, [C]))[0].s);
  eq(net, 25); void r;
  // BD: un asiento de transferencia suelto no puede confirmarse
  let err = '';
  try { await db.admin.query('BEGIN'); await db.admin.query(`insert into public.savings_transactions(transaction_id,user_id,transaction_type,bucket_type,amount,transfer_group_id,reason,occurred_at,timezone,local_date) values (gen_random_uuid(),$1,'transfer_in','hucha',5,gen_random_uuid(),'manual_hucha_transfer',now(),'UTC',current_date)`, [C]); await db.admin.query('COMMIT'); }
  catch (e) { err = e.message; await db.admin.query('ROLLBACK'); }
  if (!err.includes('invalid_transfer')) throw new Error('transferencia huérfana aceptada: ' + err);
});
await t('5 ledger no acepta UPDATE (ni siquiera el propietario/superusuario)', async () => {
  const id = (await q(`select transaction_id from public.savings_transactions where user_id=$1 limit 1`, [C]))[0].transaction_id;
  for (const role of [null, 'app_rpc_owner']) {
    let err = '';
    try { await db.admin.query('BEGIN'); if (role) await db.admin.query(`SET LOCAL ROLE ${role}`); await db.admin.query(`update public.savings_transactions set amount = amount + 1 where transaction_id=$1`, [id]); await db.admin.query('COMMIT'); }
    catch (e) { err = e.message; await db.admin.query('ROLLBACK'); }
    if (!err.includes('immutable_table')) throw new Error(`UPDATE aceptado (${role ?? 'superuser'}): ${err}`);
  }
});
await t('6 ledger no acepta DELETE ni TRUNCATE', async () => {
  const id = (await q(`select transaction_id from public.savings_transactions where user_id=$1 limit 1`, [C]))[0].transaction_id;
  for (const sql of [`delete from public.savings_transactions where transaction_id='${id}'`, `truncate public.savings_transactions`]) {
    let err = '';
    try { await db.admin.query('BEGIN'); await db.admin.query(sql); await db.admin.query('COMMIT'); }
    catch (e) { err = e.message; await db.admin.query('ROLLBACK'); }
    if (!err.includes('immutable_table') && !err.includes('cannot truncate')) throw new Error(`aceptado: ${sql} → ${err}`);
  }
});
await t('7 no puede quedar saldo negativo (RPC y red de seguridad en COMMIT)', async () => {
  const g = await mkGoal(E, { title: 'Vacío' });
  fail(await db.rpc(E, 'transfer_between_buckets', { p_transfer_group_id: uuid(), p_from_bucket: 'goal', p_from_goal_id: g, p_to_bucket: 'hucha', p_to_goal_id: null, p_amount: 1, p_occurred_at: iso(0, -1), p_timezone: TZ }), 'insufficient_balance');
  const did = uuid(); ok(await decision(E, { id: did, goal: g, amount: 5 }));
  fail(await db.rpc(E, 'transfer_between_buckets', { p_transfer_group_id: uuid(), p_from_bucket: 'goal', p_from_goal_id: g, p_to_bucket: 'hucha', p_to_goal_id: null, p_amount: 5.01, p_occurred_at: iso(0, -1), p_timezone: TZ }), 'insufficient_balance');
  // Saltándose la RPC (escritura directa como propietario): el COMMIT aborta
  let err = '';
  try { await db.admin.query('BEGIN'); await db.admin.query(`insert into public.savings_transactions(transaction_id,user_id,transaction_type,bucket_type,amount,reason,occurred_at,timezone,local_date) values (gen_random_uuid(),$1,'amendment','hucha',-1,'user_amend',now(),'UTC',current_date)`, [E]); await db.admin.query('COMMIT'); }
  catch (e) { err = e.message; await db.admin.query('ROLLBACK'); }
  if (!err.includes('insufficient_balance')) throw new Error('saldo negativo aceptado: ' + err);
  eq(await bal(E, 'hucha'), 0);
});

console.log('\n── Tiempo');
await t('9 local_date correcto cerca de medianoche, DST y otras zonas', async () => {
  const cd = async (ts, tz) => (await q(`select to_char(private.compute_local_date($1::timestamptz,$2),'YYYY-MM-DD') d`, [ts, tz]))[0].d;
  eq(await cd('2026-03-10T23:30:00Z', TZ), '2026-03-11', '23:30Z Madrid → 00:30 del 11');
  eq(await cd('2026-03-10T22:30:00Z', TZ), '2026-03-10', '22:30Z Madrid → 23:30 del 10');
  eq(await cd('2026-03-28T23:30:00Z', TZ), '2026-03-29', 'víspera cambio DST');
  eq(await cd('2026-10-24T22:30:00Z', TZ), '2026-10-25', 'CEST (+2): 22:30Z → 00:30');
  eq(await cd('2026-10-25T22:30:00Z', TZ), '2026-10-25', 'CET (+1) tras cambio: 22:30Z → 23:30');
  eq(await cd('2026-06-01T03:00:00Z', 'America/Los_Angeles'), '2026-05-31', 'zona oeste');
  eq(await cd('2026-06-01T23:30:00Z', 'Pacific/Kiritimati'), '2026-06-02', 'UTC+14');
  // Integración: el servidor imputa el día según la zona enviada, no UTC
  for (const tz of ['Pacific/Kiritimati', 'Etc/GMT+12', TZ, 'America/Los_Angeles']) {
    const id = uuid(); const at = iso(0, -1);
    ok(await extra(C, 1, null, { id, at, tz }));
    const row = (await q(`select to_char(local_date,'YYYY-MM-DD') d, to_char((occurred_at at time zone $2)::date,'YYYY-MM-DD') exp from public.savings_transactions where transaction_id=$1`, [id, tz]))[0];
    eq(row.d, row.exp, tz);
  }
  fail(await extra(C, 1, null, { tz: 'Mars/Olympus' }), 'invalid_timezone');
  fail(await extra(C, 1, null, { tz: 'Europe/Madrid; drop table x' }), 'invalid_timezone');
  // Gracia → ayer
  const gid = uuid();
  const g = ok(await db.rpc(G, 'use_grace_day', { p_decision_id: gid, p_occurred_at: iso(0, -1), p_timezone: TZ }));
  const exp = (await q(`select to_char(((now() - interval '1 minute') at time zone $1)::date - 1,'YYYY-MM-DD') d`, [TZ]))[0].d;
  eq(g.local_date, exp, 'gracia = ayer local');
  // la gracia solo una vez al mes (otra fecha objetivo: anteayer local)
  const sameMonth = (await q(`select date_trunc('month',((now()-interval '24 hours') at time zone $1)::date::timestamp) = date_trunc('month',((now()-interval '1 minute') at time zone $1)::date::timestamp) s`, [TZ]))[0].s;
  const g2 = await db.rpc(G, 'use_grace_day', { p_decision_id: uuid(), p_occurred_at: iso(24), p_timezone: TZ });
  if (sameMonth) fail(g2, 'grace_already_used'); else ok(g2);
  // misma fecha objetivo: ya hay decisión
  fail(await db.rpc(G, 'use_grace_day', { p_decision_id: uuid(), p_occurred_at: iso(0, -1), p_timezone: TZ }), 'daily_decision_exists');
});
await t('10 acción offline <72 h aceptada (71 h)', async () => {
  const r = ok(await extra(C, 2, null, { at: iso(71) }));
  eq(r.recorded_amount, 2);
});
await t('11 acción >72 h rechazada (73 h)', async () => {
  fail(await extra(C, 2, null, { at: iso(73) }), 'out_of_time_window');
});
await t('12 timestamp futuro >5 min rechazado (+6 min); +4 min aceptado', async () => {
  fail(await extra(C, 2, null, { at: iso(0, 6) }), 'out_of_time_window');
  ok(await extra(C, 2, null, { at: iso(0, 4) }));
});

console.log('\n── Negocio');
await t('13 borrar goal conserva el dinero vía hucha', async () => {
  const g = await mkGoal(D, { title: 'A borrar', primary: true });
  ok(await extra(D, 30, g, { note: 'ahorro' }));
  const hBefore = await bal(D, 'hucha'); const netBefore = Number((await q(`select sum(amount) s from public.savings_transactions where user_id=$1 and transaction_type in ('daily_saving','extra_saving','amendment','reversal')`, [D]))[0].s);
  const r = ok(await db.rpc(D, 'delete_goal', { p_mutation_id: uuid(), p_goal_id: g, p_occurred_at: iso(0, -1), p_timezone: TZ }));
  eq(r.balance_moved_amount, 30); eq(r.destination_type, 'hucha');
  eq(await bal(D, 'goal', g), 0); eq(await bal(D, 'hucha'), hBefore + 30);
  const netAfter = Number((await q(`select sum(amount) s from public.savings_transactions where user_id=$1 and transaction_type in ('daily_saving','extra_saving','amendment','reversal')`, [D]))[0].s);
  eq(netAfter, netBefore, 'ahorro neto no cambia');
  const st = (await q(`select status, deleted_at is not null del, is_primary from public.goals where id=$1`, [g]))[0];
  eq(st.status, 'deleted'); eq(st.del, true); eq(st.is_primary, false);
  const ev = (await q(`select balance_destination_type t, balance_moved_amount m from public.goal_events where goal_id=$1 and event_type='deleted'`, [g]))[0];
  eq(ev.t, 'hucha'); eq(ev.m, '30.00');
  // no se puede operar sobre un goal borrado
  fail(await extra(D, 1, g), 'goal_not_active');
  fail(await db.rpc(D, 'reactivate_goal', { p_mutation_id: uuid(), p_goal_id: g, p_occurred_at: iso(0, -1), p_timezone: TZ }), 'goal_not_active');
});
await t('14 ahorro declarado 10 € genera exactamente 10 € (sin multiplicador de ingresos)', async () => {
  const gid = await mkGoal(A, { title: 'Meta' });
  const did = uuid();
  const r = ok(await decision(A, { id: did, goal: gid, amount: 10 }));
  eq(r.recorded_amount, 10);
  const rows = await q(`select amount, transaction_type from public.savings_transactions where decision_id=$1`, [did]);
  eq(rows.length, 1); eq(rows[0].amount, '10.00'); eq(rows[0].transaction_type, 'daily_saving');
  eq((await q(`select credit_rule_version v, declared_amount a from public.daily_decisions where decision_id=$1`, [did]))[0].v, 'identity_v1');
  // importes inválidos
  fail(await decision(A, { amount: 0.001, at: iso(30) }), 'invalid_amount');
  fail(await decision(A, { amount: -5, at: iso(30) }), 'invalid_amount');
  fail(await decision(A, { amount: 100000.01, at: iso(30) }), 'invalid_amount');
  fail(await decision(A, { amount: 5, opt: 'no_existe', at: iso(30) }), 'invalid_option');
  fail(await decision(A, { amount: 5, outcome: 'otro', at: iso(30) }), 'invalid_argument');
  // una sola decisión activa por día
  fail(await decision(A, { amount: 3 }), 'daily_decision_exists');
});
await t('N1 amend/void: enmienda por diferencia, reversal por asiento vivo, sin saldo negativo', async () => {
  const g = await mkGoal(F, { title: 'Enm' });
  const did = uuid(); ok(await decision(F, { id: did, goal: g, amount: 10, at: iso(0, -3) }));
  const a1 = ok(await db.rpc(F, 'amend_decision_amount', { p_mutation_id: uuid(), p_decision_id: did, p_new_amount: 25, p_occurred_at: iso(0, -1), p_timezone: TZ }));
  eq(a1.delta, 15); eq(await bal(F, 'goal', g), 25);
  const a2 = ok(await db.rpc(F, 'amend_decision_amount', { p_mutation_id: uuid(), p_decision_id: did, p_new_amount: 4, p_occurred_at: iso(0, -1), p_timezone: TZ }));
  eq(a2.delta, -21); eq(await bal(F, 'goal', g), 4);
  fail(await db.rpc(F, 'amend_decision_amount', { p_mutation_id: uuid(), p_decision_id: did, p_new_amount: 0, p_occurred_at: iso(0, -1), p_timezone: TZ }), 'invalid_amount');
  // declared_amount original inmutable
  eq((await q(`select declared_amount a from public.daily_decisions where decision_id=$1`, [did]))[0].a, '10.00');
  const v = ok(await db.rpc(F, 'void_decision', { p_mutation_id: uuid(), p_decision_id: did, p_reason: 'user_reset_today', p_occurred_at: iso(0, -1), p_timezone: TZ }));
  eq(v.reversals, 3); eq(await bal(F, 'goal', g), 0);
  eq((await q(`select status from public.daily_decisions where decision_id=$1`, [did]))[0].status, 'voided');
  fail(await db.rpc(F, 'void_decision', { p_mutation_id: uuid(), p_decision_id: did, p_reason: 'user_reset_today', p_occurred_at: iso(0, -1), p_timezone: TZ }), 'decision_not_active');
  // tras anular, el día queda libre para una nueva decisión
  ok(await decision(F, { goal: g, amount: 3, at: iso(0, -3) }));
});
await t('N2 completado/reversión de objetivo registra goal_events y first_completed_at write-once', async () => {
  const g = await mkGoal(E, { title: 'Completar', target: 50 });
  const r1 = ok(await extra(E, 50, g));
  eq(r1.goal_completion, 'completed');
  const fc = (await q(`select first_completed_at f from public.goals where id=$1`, [g]))[0].f;
  if (!fc) throw new Error('first_completed_at vacío');
  ok(await db.rpc(E, 'transfer_between_buckets', { p_transfer_group_id: uuid(), p_from_bucket: 'goal', p_from_goal_id: g, p_to_bucket: 'hucha', p_to_goal_id: null, p_amount: 10, p_occurred_at: iso(0, -1), p_timezone: TZ }));
  const ev = await q(`select event_type, completion_sequence s from public.goal_events where goal_id=$1 and event_type in ('completed','completion_reverted') order by recorded_at, completion_sequence`, [g]);
  eq(ev.map(e => e.event_type + e.s).sort().join(','), 'completed1,completion_reverted1');
  const r2 = ok(await extra(E, 10, g)); eq(r2.goal_completion, 'completed');
  eq((await q(`select max(completion_sequence) m from public.goal_events where goal_id=$1 and event_type='completed'`, [g]))[0].m, 2);
  eq((await q(`select first_completed_at f from public.goals where id=$1`, [g]))[0].f.toISOString(), fc.toISOString(), 'first_completed_at no cambia');
  // write-once también contra escritura directa
  let err = '';
  try { await db.admin.query('BEGIN'); await db.admin.query(`update public.goals set first_completed_at = now() where id=$1`, [g]); await db.admin.query('COMMIT'); } catch (e) { err = e.message; await db.admin.query('ROLLBACK'); }
  if (!err.includes('write_once')) throw new Error('first_completed_at modificable: ' + err);
});
await t('N3 guardia anti-bypass: UPDATE de un goal V2 sin evento aborta en COMMIT; goal_events inmutable', async () => {
  const g = (await q(`select id from public.goals where user_id=$1 and ledger_managed limit 1`, [E]))[0].id;
  let err = '';
  try { await db.admin.query('BEGIN'); await db.admin.query(`update public.goals set title='bypass' where id=$1`, [g]); await db.admin.query('COMMIT'); } catch (e) { err = e.message; await db.admin.query('ROLLBACK'); }
  if (!err.includes('goals_require_event')) throw new Error('bypass no bloqueado: ' + err);
  err = '';
  try { await db.admin.query(`update public.goal_events set cause='migration' where goal_id=$1`, [g]); } catch (e) { err = e.message; }
  if (!err.includes('immutable_table')) throw new Error('goal_events mutable: ' + err);
});
await t('N4 archivar con destino objetivo, principal se reasigna, reactivar', async () => {
  const g1 = await mkGoal(G, { title: 'G1', primary: true, target: 100 });
  const g2 = await mkGoal(G, { title: 'G2', target: 100 });
  ok(await extra(G, 40, g1));
  const r = ok(await db.rpc(G, 'archive_goal', { p_mutation_id: uuid(), p_goal_id: g1, p_occurred_at: iso(0, -1), p_timezone: TZ, p_destination_type: 'goal', p_destination_goal_id: g2 }));
  eq(r.balance_moved_amount, 40); eq(r.new_primary_goal_id, g2);
  eq(await bal(G, 'goal', g2), 40); eq(await bal(G, 'goal', g1), 0);
  eq((await q(`select is_primary p from public.goals where id=$1`, [g2]))[0].p, true);
  const rr = ok(await db.rpc(G, 'reactivate_goal', { p_mutation_id: uuid(), p_goal_id: g1, p_occurred_at: iso(0, -1), p_timezone: TZ }));
  eq(rr.status, 'active'); eq(rr.is_primary, false);
  // update_goal: cambio de meta y evento con texto solo en private_changes
  ok(await db.rpc(G, 'update_goal', { p_mutation_id: uuid(), p_goal_id: g2, p_occurred_at: iso(0, -1), p_timezone: TZ, p_title: 'TITULO-SECRETO-123', p_target_amount: 30 }));
  const e = (await q(`select event_type, title_changed tc, target_amount_before b, target_amount_after a, private_changes pc from public.goal_events where goal_id=$1 and event_type='updated'`, [g2]))[0];
  eq(e.tc, true); eq(e.b, '100.00'); eq(e.a, '30.00'); eq(e.pc.title.to, 'TITULO-SECRETO-123');
  eq((await q(`select count(*)::int c from public.goal_events where goal_id=$1 and event_type='completed'`, [g2]))[0].c, 1); // 40 ≥ 30
});
await t('N5 impresiones: idempotentes y deduplicadas por (usuario, día, pregunta)', async () => {
  const id1 = uuid();
  const base = { p_shown_at: iso(0, -1), p_timezone: TZ, p_question_bank_version: 'qb_v1', p_question_id: QUESTION.id, p_avatar_used: 'comodo', p_time_slot: 'manana', p_selection_reason: 'initial', p_first_surface: 'dashboard_widget' };
  const a = ok(await db.rpc(C, 'record_prompt_impression', { p_impression_id: id1, ...base }));
  const b = ok(await db.rpc(C, 'record_prompt_impression', { p_impression_id: id1, ...base }));
  eq(b.idempotent_replay, true);
  const c = ok(await db.rpc(C, 'record_prompt_impression', { p_impression_id: uuid(), ...base }));
  eq(c.deduplicated, true); eq(c.impression_id, a.impression_id);
  eq((await q(`select count(*)::int c from public.daily_prompt_impressions where user_id=$1 and question_id=$2`, [C, QUESTION.id]))[0].c, 1);
  fail(await db.rpc(C, 'record_prompt_impression', { p_impression_id: uuid(), ...base, p_question_id: 'NOPE' }), 'invalid_question');
  fail(await db.rpc(B, 'record_prompt_impression', { p_impression_id: uuid(), ...base, p_selection_reason: 'shuffle', p_replaces_impression_id: id1 }), 'not_found');
  // la decisión referencia la impresión
  ok(await decision(C, { impression: id1, at: iso(0, -5) }));
});
await t('15 texto libre solo en user_free_text (+ goals.title y goal_events.private_changes, no exportables)', async () => {
  const SECRET = 'SECRETO-TEXTO-LIBRE-987';
  const g = await mkGoal(B, { title: 'T-' + SECRET.slice(0, 3) });
  ok(await extra(B, 3, g, { note: 'nota ' + SECRET }));
  ok(await decision(B, { opt: '__custom__', text: 'custom ' + SECRET, amount: 2, at: iso(30) }));
  // dónde aparece el texto
  const tables = (await q(`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`)).map(r => r.table_name);
  const found = [];
  for (const tb of tables) {
    const n = (await q(`select count(*)::int c from public.${tb} x where (to_jsonb(x) - 'private_changes')::text like $1`, ['%' + SECRET + '%']))[0].c;
    if (n > 0) found.push(tb);
  }
  eq(found.join(','), 'user_free_text', 'tablas con el texto libre');
  // columnas text en tablas V2 exportables: solo claves/enum controlados (sin columnas de texto abierto)
  const cols = await q(`select table_name, column_name from information_schema.columns where table_schema='public' and data_type='text'
     and table_name in ('savings_transactions','daily_decisions','goal_events','onboarding_sessions','avatar_assessments','avatar_assessment_answers','income_declarations','daily_prompt_impressions')
     and column_name in ('text','title','note','custom_text','free_text','label')`);
  eq(cols.length, 0, JSON.stringify(cols));
  // la decisión custom solo expone has_custom_text + clave '__custom__'
  const d = (await q(`select selected_option_key k, has_custom_text h from public.daily_decisions where user_id=$1 and has_custom_text`, [B]))[0];
  eq(d.k, '__custom__'); eq(d.h, true);
  // el texto libre es inmutable
  let err = ''; try { await db.admin.query(`update public.user_free_text set text='x'`); } catch (e) { err = e.message; }
  if (!err.includes('immutable_table')) throw new Error('user_free_text mutable');
  fail(await decision(B, { opt: '__custom__', text: '', amount: 2, at: iso(40) }), 'invalid_argument');
  fail(await decision(B, { opt: '__custom__', text: 'x'.repeat(201), amount: 2, at: iso(40) }), 'invalid_argument');
});

console.log('\n── Onboarding');
const RULE = { rule: 'rec_v1', cat: 'income_ref_v1' };
const obArgs = (sid, over = {}) => ({
  p_session_id: sid, p_occurred_at: iso(0, -1), p_timezone: TZ,
  p_answers: [{ question_key: 'onb_q1', option_key: 'a' }, { question_key: 'onb_q2', option_key: 'b' }, { question_key: 'onb_q3', option_key: 'c' }],
  p_assessment_id: uuid(), p_questionnaire_version: 'onb_q_v1', p_scoring_version: 'score_v1',
  p_result_avatar: 'social', p_scores: { comodo: 2, social: 2, impulsivo: 1 },
  p_savings_habit: 'algo', p_income_declaration_id: uuid(), p_income_band_code: '2000_2500', p_income_band_catalog_version: RULE.cat,
  p_rule_version: RULE.rule, p_rec_reference_income_amount: 2250, p_rec_savings_rate_pct: 10, p_rec_monthly_floor_amount: 50,
  p_rec_horizon_months: 6, p_recommended_monthly_amount: 225, p_recommended_target_amount: 1350,
  p_chosen_target_amount: 1200, p_chosen_horizon_months: 6, p_warning_shown: 'none',
  p_goal_id: uuid(), p_goal_title: 'Mi viaje', ...over });
const OB = uuid();
await t('16a start_onboarding crea intento 1; idempotente', async () => {
  const at0 = iso(0, -5), at1 = iso(0, -4);
  const r = ok(await db.rpc(G, 'start_onboarding', { p_session_id: OB, p_occurred_at: at0, p_timezone: TZ }));
  eq(r.attempt_number, 1);
  eq(ok(await db.rpc(G, 'start_onboarding', { p_session_id: OB, p_occurred_at: at0, p_timezone: TZ })).idempotent_replay, true);
  fail(await db.rpc(G, 'start_onboarding', { p_session_id: OB, p_occurred_at: at1, p_timezone: TZ }), 'idempotency_conflict');
  eq(ok(await db.rpc(G, 'start_onboarding', { p_session_id: uuid(), p_occurred_at: at1, p_timezone: TZ })).attempt_number, 2);
});
await t('16b complete_onboarding rechaza recomendación/avatar manipulados (sin escribir nada)', async () => {
  const before = (await q(`select (select count(*) from public.goals where user_id=$1) g, (select count(*) from public.avatar_assessments where user_id=$1) a`, [G]))[0];
  fail(await db.rpc(G, 'complete_onboarding', obArgs(OB, { p_recommended_target_amount: 9999 })), 'recommendation_mismatch');
  fail(await db.rpc(G, 'complete_onboarding', obArgs(OB, { p_rec_reference_income_amount: 3500 })), 'recommendation_mismatch');
  fail(await db.rpc(G, 'complete_onboarding', obArgs(OB, { p_result_avatar: 'comodo' })), 'assessment_mismatch');
  fail(await db.rpc(A, 'complete_onboarding', obArgs(OB)), 'not_found'); // sesión de otro usuario
  const after = (await q(`select (select count(*) from public.goals where user_id=$1) g, (select count(*) from public.avatar_assessments where user_id=$1) a`, [G]))[0];
  eq(JSON.stringify(after), JSON.stringify(before));
});
await t('16c onboarding completo es atómico: fallo a mitad ⇒ rollback total', async () => {
  const existing = (await q(`select id from public.goals where user_id=$1 and ledger_managed limit 1`, [G]))[0].id; // id de goal ya usado ⇒ falla al crear el goal (después de insertar evaluación e ingresos)
  const args = obArgs(OB, { p_goal_id: existing });
  const before = (await q(`select (select count(*) from public.avatar_assessment_answers where user_id=$1) ans, (select count(*) from public.income_declarations where user_id=$1) inc`, [G]))[0];
  const r = await db.rpc(G, 'complete_onboarding', args);
  if (r.ok) throw new Error('debía fallar');
  const after = (await q(`select (select count(*) from public.avatar_assessment_answers where user_id=$1) ans, (select count(*) from public.income_declarations where user_id=$1) inc`, [G]))[0];
  eq(JSON.stringify(after), JSON.stringify(before), 'filas parciales');
  eq((await q(`select count(*)::int c from public.avatar_assessments where assessment_id=$1`, [args.p_assessment_id]))[0].c, 0);
  eq((await q(`select completed_at is null n from public.onboarding_sessions where onboarding_session_id=$1`, [OB]))[0].n, true);
});
await t('16d onboarding completo OK: todo creado en una transacción y recomendación verificada', async () => {
  const args = obArgs(OB);
  const r = ok(await db.rpc(G, 'complete_onboarding', args));
  eq(r.result_avatar, 'social'); eq(r.accepted_recommendation, false);
  const s = (await q(`select * from public.onboarding_sessions where onboarding_session_id=$1`, [OB]))[0];
  eq(s.recommended_target_amount, '1350.00'); eq(s.chosen_target_amount, '1200.00'); eq(s.rec_reference_income_amount, '2250.00');
  eq((await q(`select count(*)::int c from public.avatar_assessment_answers where assessment_id=$1`, [args.p_assessment_id]))[0].c, 3);
  eq((await q(`select count(*)::int c from public.income_declarations where onboarding_session_id=$1 and source='onboarding'`, [OB]))[0].c, 1);
  const g = (await q(`select source, onboarding_session_id, is_primary, target_amount, ledger_managed from public.goals where id=$1`, [args.p_goal_id]))[0];
  eq(g.source, 'onboarding'); eq(g.onboarding_session_id, OB); eq(g.is_primary, true); eq(g.ledger_managed, true);
  eq((await q(`select count(*)::int c from public.goal_events where goal_id=$1 and event_type in ('created','primary_set')`, [args.p_goal_id]))[0].c, 2);
  // reintento idéntico → replay; con otro payload → conflict
  eq(ok(await db.rpc(G, 'complete_onboarding', args)).idempotent_replay, true);
  fail(await db.rpc(G, 'complete_onboarding', { ...args, p_goal_title: 'otro' }), 'idempotency_conflict');
  // sesión completada inmutable
  let err = ''; try { await db.admin.query(`update public.onboarding_sessions set savings_habit='nunca' where onboarding_session_id=$1`, [OB]); } catch (e) { err = e.message; }
  if (!err.includes('immutable_table')) throw new Error('sesión completada modificable');
  // D1: con ingresos declarados, 10 € siguen siendo 10 €
  const did = uuid(); ok(await decision(G, { id: did, amount: 10, goal: args.p_goal_id, at: iso(0, -2) }));
  eq((await q(`select amount from public.savings_transactions where decision_id=$1`, [did]))[0].amount, '10.00');
});
await t('16e tramo gt_3000 usa referencia 3000 (no 3500) y suelo mínimo 50', async () => {
  const sid = uuid(); ok(await db.rpc(A, 'start_onboarding', { p_session_id: sid, p_occurred_at: iso(0, -5), p_timezone: TZ }));
  const args = obArgs(sid, { p_income_band_code: 'gt_3000', p_savings_habit: 'bastante', p_rec_reference_income_amount: 3000, p_rec_savings_rate_pct: 20,
    p_recommended_monthly_amount: 600, p_recommended_target_amount: 3600, p_chosen_target_amount: 3600 });
  const r = ok(await db.rpc(A, 'complete_onboarding', args));
  eq(r.accepted_recommendation, true);
  const sid2 = uuid(); ok(await db.rpc(B, 'start_onboarding', { p_session_id: sid2, p_occurred_at: iso(0, -5), p_timezone: TZ }));
  ok(await db.rpc(B, 'complete_onboarding', obArgs(sid2, { p_income_band_code: 'lt_1000', p_savings_habit: 'nunca', p_rec_reference_income_amount: 500, p_rec_savings_rate_pct: 5,
    p_recommended_monthly_amount: 50, p_recommended_target_amount: 300, p_chosen_target_amount: 300 })), 'suelo 50 €');
});

console.log('\n── Concurrencia');
await t('CONC hucha=20 €, dos retiradas simultáneas de 15 € → 1 éxito + 1 insufficient_balance, saldo final 5 €', async () => {
  for (let round = 1; round <= 5; round++) {
    const U = uuid(); await db.addUser(U);
    const g1 = await mkGoal(U, { title: 'D1', target: 1000 }); const g2 = await mkGoal(U, { title: 'D2', target: 1000 });
    ok(await extra(U, 20, null));
    eq(await bal(U, 'hucha'), 20);
    const mv = (g) => db.rpc(U, 'transfer_between_buckets', { p_transfer_group_id: uuid(), p_from_bucket: 'hucha', p_from_goal_id: null, p_to_bucket: 'goal', p_to_goal_id: g, p_amount: 15, p_occurred_at: iso(0, -1), p_timezone: TZ });
    const [r1, r2] = await Promise.all([mv(g1), mv(g2)]);
    const okc = [r1, r2].filter(r => r.ok).length;
    const ib = [r1, r2].filter(r => !r.ok && String(r.error).includes('insufficient_balance')).length;
    eq(okc, 1, `ronda ${round}: éxitos`); eq(ib, 1, `ronda ${round}: insufficient_balance`);
    eq(await bal(U, 'hucha'), 5, `ronda ${round}: saldo hucha`);
    eq((await q(`select count(*)::int c from public.savings_transactions where user_id=$1 and transaction_type in ('transfer_out','transfer_in')`, [U]))[0].c, 2);
    eq(Number((await q(`select min(b) m from (select sum(amount) b from public.savings_transactions where user_id=$1 group by bucket_type, goal_id) s`, [U]))[0].m) >= 0, true, 'ningún bucket negativo');
  }
});
await t('CONC-2 mismo idempotency key concurrente → un solo efecto', async () => {
  const U = uuid(); await db.addUser(U);
  const id = uuid(), at = iso(0, -1); // un reintento reenvía EXACTAMENTE el mismo payload
  const rs = await Promise.all([extra(U, 7, null, { id, at }), extra(U, 7, null, { id, at }), extra(U, 7, null, { id, at })]);
  eq(rs.filter(r => r.ok).length, 3, 'todas devuelven resultado');
  eq((await q(`select count(*)::int c from public.savings_transactions where user_id=$1`, [U]))[0].c, 1);
  eq(await bal(U, 'hucha'), 7);
});
await t('CONC-3 red de seguridad sin RPC: dos INSERT directos concurrentes de −15 con saldo 20 → uno falla en COMMIT', async () => {
  const U = uuid(); await db.addUser(U); ok(await extra(U, 20, null));
  const direct = async () => {
    const c = await db.client();
    try {
      await c.query('BEGIN');
      await c.query(`insert into public.savings_transactions(transaction_id,user_id,transaction_type,bucket_type,amount,reason,occurred_at,timezone,local_date) values (gen_random_uuid(),$1,'amendment','hucha',-15,'user_amend',now(),'UTC',current_date)`, [U]);
      await new Promise(r => setTimeout(r, 300));
      await c.query('COMMIT'); return 'ok';
    } catch (e) { try { await c.query('ROLLBACK'); } catch { /* */ } return e.message; } finally { await c.end(); }
  };
  const [a, b] = await Promise.all([direct(), direct()]);
  const oks = [a, b].filter(x => x === 'ok').length;
  eq(oks, 1, JSON.stringify([a, b])); eq(await bal(U, 'hucha'), 5);
});

console.log('\n── Compatibilidad V1 y baja de cuenta');
await t('V1-1 la app V1 sigue escribiendo goals y decisions con su esquema actual', async () => {
  const V = uuid(); await db.addUser(V);
  await db.asUser(V, async c => {
    await c.query(`insert into public.user_profiles(id,name) values ($1,'v1') on conflict (id) do update set name='v1'`, [V]);
    await c.query(`insert into public.goals(id,user_id,title,target_amount,current_amount,horizon_months,is_primary,archived,created_at,updated_at,source) values ('goal_v1_1',$1,'v1',100,10,3,true,false,now(),now(),'onboarding')`, [V]);
    await c.query(`update public.goals set current_amount=20, archived=true where id='goal_v1_1'`);
    await c.query(`insert into public.decisions(id,user_id,date,question_id,answer_key,goal_id,delta_amount,created_at) values ('dec_1',$1,current_date,'Q1','a','goal_v1_1',5,now())`, [V]);
    await c.query(`insert into public.hucha(user_id,balance,entries) values ($1,5,'[]') on conflict (user_id) do update set balance=5`, [V]);
  });
  const g = (await q(`select status, ledger_managed, data_origin, current_amount from public.goals where id='goal_v1_1'`))[0];
  eq(g.status, 'archived', 'status derivado de archived'); eq(g.ledger_managed, false); eq(g.data_origin, 'v1_reconstructed'); eq(g.current_amount, '20');
  // V1 no puede crear/modificar filas gestionadas por el ledger
  const gB = (await q(`select id from public.goals where user_id=$1 and ledger_managed limit 1`, [B]))[0].id;
  const r = await db.asUser(V, async c => { try { await c.query(`update public.goals set title='x' where id=$1`, [gB]); const x = await c.query(`select 1`); return 'ok'; } catch (e) { return e.message; } });
  void r;
  const own = await db.asUser(A, async c => { const x = await c.query(`update public.goals set title='hack' where user_id=$1 and ledger_managed`, [A]); return x.rowCount; });
  eq(own, 0, 'UPDATE directo sobre goals V2 bloqueado por RLS restrictiva');
  const ins = await db.asUser(V, async c => { try { await c.query(`insert into public.goals(id,user_id,title,target_amount,horizon_months,created_at,updated_at,ledger_managed,current_amount,source,start_date) values ('x1',$1,'x',10,3,now(),now(),true,0,'dashboard',current_date)`, [V]); return 'inserted'; } catch (e) { return e.message; } });
  if (!/row-level security/.test(ins)) throw new Error('INSERT directo ledger_managed no bloqueado: ' + ins);
});
await t('V1-2 supresión de cuenta: DELETE en auth.users borra en cascada también el ledger inmutable', async () => {
  const U = uuid(); await db.addUser(U);
  const g = await mkGoal(U, { title: 'baja' }); ok(await extra(U, 5, g, { note: 'n' })); ok(await decision(U, { amount: 3, at: iso(0, -3) }));
  await db.admin.query(`delete from auth.users where id=$1`, [U]);
  for (const tb of ['savings_transactions','daily_decisions','goal_events','goals','user_free_text'])
    eq((await q(`select count(*)::int c from public.${tb} where user_id=$1`, [U]))[0].c, 0, tb);
});
await t('V1-3 migraciones V2 son idempotentes (re-aplicación sin errores ni cambios de datos)', async () => {
  const before = (await q(`select (select count(*) from public.savings_transactions) a, (select count(*) from public.cat_daily_questions) b`))[0];
  const { V2_MIGRATIONS } = await import('./harness.mjs');
  for (const f of V2_MIGRATIONS()) await db.applyMigration(f);
  const after = (await q(`select (select count(*) from public.savings_transactions) a, (select count(*) from public.cat_daily_questions) b`))[0];
  eq(JSON.stringify(after), JSON.stringify(before));
});

await db.stop();
const pass = results.filter(r => r.ok).length;
console.log(`\nRESULTADO: ${pass}/${results.length} OK, ${failures} fallos`);
fs.writeFileSync(new URL('./last_results.json', import.meta.url), JSON.stringify({ at: new Date().toISOString(), pass, total: results.length, results }, null, 2));
process.exit(failures ? 1 : 0);
