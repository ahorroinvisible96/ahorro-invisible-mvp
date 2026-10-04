// Aplica migraciones a Supabase REAL de staging (REMOTE_VAULT=1). Uso: node apply_remote.mjs v1|v2|<file...>
import { Db, V1_MIGRATIONS, V2_MIGRATIONS, REMOTE } from './harness.mjs';
if (!REMOTE) { console.error('Requiere REMOTE_VAULT=1'); process.exit(2); }
const arg = process.argv.slice(2);
const files = arg[0] === 'v1' ? V1_MIGRATIONS : arg[0] === 'v2' ? V2_MIGRATIONS() : arg;
const db = await new Db().start();
const who = (await db.admin.query('select current_user u, version() v')).rows[0];
console.log('conectado como', who.u, '|', who.v.split(' on ')[0]);
for (const f of files) {
  const t0 = Date.now();
  try { await db.applyMigration(f); console.log('OK  ', f, `${Date.now() - t0} ms`); }
  catch (e) { console.log('FAIL', f, e.message); await db.stop(); process.exit(1); }
}
await db.stop();
