import { Db } from './harness.mjs';
const db = new Db();
try {
  await db.start();
  await db.installShim();
  await db.applyAll();
  const r = await db.admin.query(`select count(*) from public.cat_daily_questions`);
  console.log('OK migraciones aplicadas; preguntas:', r.rows[0].count);
  // idempotencia: reaplicar V2
  for (const f of (await import('./harness.mjs')).V2_MIGRATIONS()) await db.applyMigration(f);
  console.log('OK re-aplicación idempotente');
} catch (e) { console.error('FALLO', e.message); process.exitCode = 1; }
finally { await db.stop(); }
