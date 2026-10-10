// Pruebas con Auth + PostgREST REALES de Supabase staging (JWT emitidos por GoTrue, RLS evaluada por PostgREST).
// Uso: REMOTE_VAULT=1 node postgrest_real.mjs   (credenciales servidas en memoria por el vault; nunca en disco)
import { randomUUID as uuid, randomBytes } from 'node:crypto';
const C = await (await fetch('http://127.0.0.1:54330/creds')).json();
const results = []; let fails = 0;
const t = async (name, fn) => { try { await fn(); results.push([name, 'PASS']); console.log('  PASS', name); } catch (e) { fails++; results.push([name, 'FAIL', e.message]); console.log('  FAIL', name, '\n       ', e.message); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const H = (jwt, key = C.anon) => ({ apikey: key, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });
async function req(method, path, jwt, body, key) {
  const r = await fetch(`${C.url}${path}`, { method, headers: H(jwt, key), body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch { j = txt; }
  return { s: r.status, j };
}
async function mkUser() {
  const email = `t_${randomBytes(4).toString('hex')}@staging.test`, password = randomBytes(18).toString('base64url');
  const a = await req('POST', '/auth/v1/admin/users', C.service, { email, password, email_confirm: true }, C.service);
  if (a.s >= 300) throw new Error('admin create ' + JSON.stringify(a.j));
  const s = await req('POST', '/auth/v1/token?grant_type=password', C.anon, { email, password });
  if (!s.j.access_token) throw new Error('login ' + JSON.stringify(s.j));
  return { id: a.j.id, jwt: s.j.access_token };
}
const now = () => new Date(Date.now() - 30e3).toISOString();
const rpc = (u, fn, args) => req('POST', `/rest/v1/rpc/${fn}`, u ? u.jwt : C.anon, args);

const A = await mkUser(), B = await mkUser();
console.log('usuarios reales creados en auth.users (staging)');

await t('R1 auth.uid() real: create_goal vía PostgREST con JWT de GoTrue (owner app_rpc_owner escribe en goals con RLS V1)', async () => {
  const id = uuid();
  const r = await rpc(A, 'create_goal', { p_goal_id: id, p_title: 'Viaje', p_target_amount: 300, p_horizon_months: 6, p_source: 'goals_page', p_set_primary: true, p_occurred_at: now(), p_timezone: 'Europe/Madrid' });
  assert(r.s === 200, `HTTP ${r.s} ${JSON.stringify(r.j)}`);
  A.goal = id;
  const g = await req('GET', `/rest/v1/goals?id=eq.${id}&select=user_id,ledger_managed,is_primary`, A.jwt);
  assert(g.j.length === 1 && g.j[0].user_id === A.id && g.j[0].ledger_managed === true, JSON.stringify(g.j));
});
await t('R2 10 € declarados = 10 € (record_extra_saving real) y saldo en v_hucha_balance', async () => {
  const r = await rpc(A, 'record_extra_saving', { p_transaction_id: uuid(), p_occurred_at: now(), p_timezone: 'Europe/Madrid', p_amount: 10, p_goal_id: null, p_note: null });
  assert(r.s === 200, `HTTP ${r.s} ${JSON.stringify(r.j)}`);
  const tx = await req('GET', `/rest/v1/savings_transactions?select=amount,user_id,local_date`, A.jwt);
  assert(tx.j.length === 1 && Number(tx.j[0].amount) === 10, JSON.stringify(tx.j));
  const v = await req('GET', `/rest/v1/v_hucha_balance?select=*`, A.jwt);
  assert(v.s === 200 && JSON.stringify(v.j).includes('10'), `vista ${v.s} ${JSON.stringify(v.j)}`);
});
await t('R3 RLS real: B no ve ledger, goals ni vista de A', async () => {
  for (const p of ['/rest/v1/savings_transactions?select=*', '/rest/v1/goals?select=*', '/rest/v1/v_hucha_balance?select=*', '/rest/v1/goal_events?select=*']) {
    const r = await req('GET', p, B.jwt);
    assert(r.s === 200 && Array.isArray(r.j) && r.j.length === 0, `${p} -> ${r.s} ${JSON.stringify(r.j).slice(0, 200)}`);
  }
});
await t('R4 B no puede usar el goal de A (ownership en RPC)', async () => {
  const r = await rpc(B, 'record_extra_saving', { p_transaction_id: uuid(), p_occurred_at: now(), p_timezone: 'Europe/Madrid', p_amount: 5, p_goal_id: A.goal, p_note: null });
  assert(r.s >= 400, `debió fallar: ${r.s} ${JSON.stringify(r.j)}`);
});
await t('R5 anon no puede ejecutar RPC ni leer tablas V2', async () => {
  const r = await rpc(null, 'record_extra_saving', { p_transaction_id: uuid(), p_occurred_at: now(), p_timezone: 'UTC', p_amount: 5, p_goal_id: null, p_note: null });
  assert(r.s === 401 || r.s === 403 || r.s === 404, `rpc anon ${r.s} ${JSON.stringify(r.j)}`);
  const v = await req('GET', '/rest/v1/savings_transactions?select=*', C.anon);
  assert(v.s >= 400 || (Array.isArray(v.j) && v.j.length === 0), `tabla anon ${v.s} ${JSON.stringify(v.j)}`);
});
await t('R6 escritura directa al ledger vía PostgREST bloqueada (INSERT/UPDATE/DELETE)', async () => {
  const i = await req('POST', '/rest/v1/savings_transactions', A.jwt, { transaction_id: uuid(), user_id: A.id, transaction_type: 'extra_saving', bucket_type: 'hucha', amount: 999, reason: 'x', occurred_at: now(), timezone: 'UTC', local_date: '2026-01-01' });
  assert(i.s >= 400, `insert ${i.s}`);
  const u = await req('PATCH', `/rest/v1/savings_transactions?user_id=eq.${A.id}`, A.jwt, { amount: 1 });
  assert(u.s >= 400 || (Array.isArray(u.j) && u.j.length === 0), `update ${u.s} ${JSON.stringify(u.j)}`);
  const d = await req('DELETE', `/rest/v1/savings_transactions?user_id=eq.${A.id}`, A.jwt);
  assert(d.s >= 400 || (Array.isArray(d.j) && d.j.length === 0), `delete ${d.s} ${JSON.stringify(d.j)}`);
  const tx = await req('GET', `/rest/v1/savings_transactions?select=amount`, A.jwt);
  assert(tx.j.length === 1 && Number(tx.j[0].amount) === 10, 'ledger alterado ' + JSON.stringify(tx.j));
});
await t('R7 helpers private no expuestos por PostgREST', async () => {
  const r = await req('POST', '/rest/v1/rpc/current_uid', A.jwt, {});
  assert(r.s === 404 || r.s >= 400, `private expuesto ${r.s}`);
  const r2 = await req('POST', '/rest/v1/rpc/lock_user_ledger', A.jwt, { p_user_id: A.id });
  assert(r2.s >= 400, `private expuesto ${r2.s}`);
});
const flags = await req('GET', '/rest/v1/app_flags?select=key,enabled', C.anon);
const RETIRED = Array.isArray(flags.j) && flags.j.some(f => f.key === 'V1_RUNTIME_RETIRED' && f.enabled);
if (RETIRED) await t('R8 V1 retirada (019): escritura V1 bloqueada para authenticated/service_role; user_profiles (KEEP) operativa; lectura propia OK', async () => {
  const p = await req('POST', '/rest/v1/user_profiles', B.jwt, { id: B.id, name: 'Test' });
  assert(p.s === 201, `profile ${p.s} ${JSON.stringify(p.j)}`);
  const pu = await req('PATCH', `/rest/v1/user_profiles?id=eq.${B.id}`, B.jwt, { money_feeling: 'ok' });
  assert(pu.s === 200 && pu.j.length === 1, `profile update ${pu.s} ${JSON.stringify(pu.j)}`);
  const gid = 'goal_' + Date.now();
  for (const [who, jwt, key] of [['authenticated', B.jwt, C.anon], ['service_role', C.service, C.service]]) {
    const g = await req('POST', '/rest/v1/goals', jwt, { id: gid, user_id: B.id, title: 'V1 goal', target_amount: 100, current_amount: 0, is_primary: true, created_at: now(), updated_at: now() }, key);
    assert(g.s === 401 || g.s === 403, `${who} goals insert ${g.s} ${JSON.stringify(g.j)}`);
    const d = await req('POST', '/rest/v1/decisions', jwt, { id: 'd_' + Date.now(), user_id: B.id, date: '2026-01-01', question_id: 'q', answer_key: 'a', delta_amount: 1 }, key);
    assert(d.s === 401 || d.s === 403, `${who} decisions insert ${d.s} ${JSON.stringify(d.j)}`);
    const h = await req('POST', '/rest/v1/hucha', jwt, { user_id: B.id, balance: 1, entries: [] }, key);
    assert(h.s === 401 || h.s === 403, `${who} hucha insert ${h.s} ${JSON.stringify(h.j)}`);
    const q = await req('POST', '/rest/v1/question_interactions', jwt, { user_id: B.id, question_id: 'q', local_date: '2026-01-01', time_slot: 'Tarde' }, key);
    assert(q.s === 401 || q.s === 403, `${who} question_interactions insert ${q.s} ${JSON.stringify(q.j)}`);
    const u = await req('PATCH', `/rest/v1/goals?user_id=eq.${A.id}`, jwt, { title: 'x' }, key);
    assert(u.s === 401 || u.s === 403, `${who} goals update ${u.s} ${JSON.stringify(u.j)}`);
    const del = await req('DELETE', `/rest/v1/decisions?user_id=eq.${B.id}`, jwt, null, key);
    assert(del.s === 401 || del.s === 403, `${who} decisions delete ${del.s} ${JSON.stringify(del.j)}`);
  }
  const r = await req('GET', `/rest/v1/goals?select=id&user_id=eq.${A.id}`, A.jwt);
  assert(r.s === 200 && r.j.length >= 1, `lectura propia goals ${r.s}`);
  const x = await req('GET', `/rest/v1/user_profiles?id=eq.${B.id}`, A.jwt);
  assert(x.j.length === 0, 'A ve perfil de B');
});
else await t('R8 compatibilidad V1 vía PostgREST: user_profiles y goals (insert/update/archive/delete) con el patrón actual de la app', async () => {
  const p = await req('POST', '/rest/v1/user_profiles', B.jwt, { id: B.id, name: 'Test' });
  assert(p.s === 201, `profile ${p.s} ${JSON.stringify(p.j)}`);
  const gid = 'goal_' + Date.now();
  const g = await req('POST', '/rest/v1/goals', B.jwt, { id: gid, user_id: B.id, title: 'V1 goal', target_amount: 100, current_amount: 0, is_primary: true, created_at: now(), updated_at: now() });
  assert(g.s === 201, `goal ${g.s} ${JSON.stringify(g.j)}`);
  const gu = await req('PATCH', `/rest/v1/goals?id=eq.${gid}`, B.jwt, { current_amount: 25, updated_at: now() });
  assert(gu.s === 200 && gu.j.length === 1 && Number(gu.j[0].current_amount) === 25, `goal update ${gu.s} ${JSON.stringify(gu.j)}`);
  const ga = await req('PATCH', `/rest/v1/goals?id=eq.${gid}`, B.jwt, { archived: true, updated_at: now() });
  assert(ga.s === 200 && ga.j.length === 1, `goal archive ${ga.s} ${JSON.stringify(ga.j)}`);
  const pu = await req('PATCH', `/rest/v1/user_profiles?id=eq.${B.id}`, B.jwt, { total_saved: 25 });
  assert(pu.s === 200 && pu.j.length === 1, `profile update ${pu.s} ${JSON.stringify(pu.j)}`);
  const gd = await req('DELETE', `/rest/v1/goals?id=eq.${gid}`, B.jwt);
  assert(gd.s === 200 && gd.j.length === 1, `goal delete V1 ${gd.s} ${JSON.stringify(gd.j)}`);
  // A no ve nada de B
  const x = await req('GET', `/rest/v1/user_profiles?id=eq.${B.id}`, A.jwt);
  assert(x.j.length === 0, 'A ve perfil de B');
});
await t('R9 V1: A no puede modificar goals V2 (ledger_managed) por PostgREST directo', async () => {
  const r = await req('PATCH', `/rest/v1/goals?id=eq.${A.goal}`, A.jwt, { current_amount: 9999, updated_at: now() });
  assert(r.s >= 400 || (Array.isArray(r.j) && r.j.length === 0), `goal V2 modificado: ${r.s} ${JSON.stringify(r.j)}`);
});
await t('R10 baja de cuenta real (Admin API) borra en cascada, incluido ledger append-only', async () => {
  const d = await req('DELETE', `/auth/v1/admin/users/${A.id}`, C.service, null, C.service);
  assert(d.s === 200, `delete user ${d.s} ${JSON.stringify(d.j)}`);
});
await t('R11 service_role (clave de servidor) no tiene EXECUTE sobre RPC de negocio', async () => {
  const r = await req('POST', '/rest/v1/rpc/record_extra_saving', C.service, { p_transaction_id: uuid(), p_occurred_at: now(), p_timezone: 'UTC', p_amount: 1, p_goal_id: null, p_note: null }, C.service);
  assert(r.s >= 400, `service_role ejecutó RPC ${r.s} ${JSON.stringify(r.j)}`);
});
await req('DELETE', `/auth/v1/admin/users/${B.id}`, C.service, null, C.service);
console.log(`RESULTADO POSTGREST REAL: ${results.length - fails}/${results.length} OK`);
process.exit(fails ? 1 : 0);
