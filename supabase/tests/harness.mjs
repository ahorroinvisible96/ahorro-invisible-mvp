// Harness de pruebas de BD (Postgres local aislado, NO producción).
// Arranca un Postgres embebido, instala un shim mínimo de Supabase
// (roles anon/authenticated/service_role, auth.users, auth.uid()) y aplica las
// migraciones en orden. Simula JWT con request.jwt.claims + SET ROLE.
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.resolve(here, '..', 'migrations');

// Baseline V1 aplicada en producción (002_analytics y 003_refactor_avatars NO están en prod).
export const V1_MIGRATIONS = [
  '001_initial_schema.sql', '002_analytics_columns.sql', '004_bigquery_temporal.sql', '005_question_interactions.sql',
];
export const V2_MIGRATIONS = () =>
  fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^(0(0[6-9]|[1-9]\d))_.*\.sql$/.test(f)).sort();

const SHIM = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
-- Defaults de Supabase: todo nuevo objeto en public se concede a los 3 roles
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
`;

export const REMOTE = process.env.REMOTE_VAULT === '1';

export class Db {
  constructor() { this.pgServer = null; this.admin = null; this.port = 0; this.dir = ''; this.remote = null; }

  async start({ port = 54340 + Math.floor(Math.random() * 500) } = {}) {
    if (REMOTE) {
      // Supabase REAL (staging). Credenciales servidas en memoria por el vault local; nunca en disco.
      this.remote = await (await fetch('http://127.0.0.1:54330/creds')).json();
      if (!this.remote.dbPass) throw new Error('vault sin credenciales');
      this.admin = await this.client();
      return this;
    }
    this.port = port;
    this.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai_pg_'));
    this.pgServer = new EmbeddedPostgres({
      databaseDir: this.dir, user: 'postgres', password: 'pw', port, persistent: false,
      initdbFlags: ['--encoding=UTF8', '--locale=C'],
      onLog: () => {}, onError: () => {},
    });
    await this.pgServer.initialise();
    await this.pgServer.start();
    this.admin = await this.client();
    return this;
  }

  async client() {
    const r = this.remote;
    const c = r
      ? new pg.Client({ host: r.dbHost, port: r.dbPort, user: r.dbUser, password: r.dbPass, database: r.dbName, ssl: { rejectUnauthorized: false } })
      : new pg.Client({ host: '127.0.0.1', port: this.port, user: 'postgres', password: 'pw', database: 'postgres' });
    await c.connect();
    return c;
  }

  // En remoto auth.* es el real de Supabase: no se instala shim.
  async installShim() { if (!REMOTE) await this.admin.query(SHIM); }

  async applyMigration(file) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    try { await this.admin.query(sql); }
    catch (e) { e.message = `[${file}] ${e.message}` + (e.position ? ` (pos ${e.position})` : ''); throw e; }
  }

  async applyAll({ upTo } = {}) {
    if (REMOTE && process.env.SKIP_APPLY === '1') return; // esquema ya aplicado en staging
    for (const f of [...V1_MIGRATIONS, 'DRIFT', ...V2_MIGRATIONS()]) {
      if (f === 'DRIFT') { await this.admin.query(fs.readFileSync(path.join(here, 'fixtures', 'prod_v1_drift.sql'), 'utf8')); continue; }
      if (upTo && f > upTo) break;
      await this.applyMigration(f);
    }
  }

  async addUser(id, email = null) {
    await this.admin.query('INSERT INTO auth.users(id,email) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, email ?? id + '@test.local']);
  }

  // Ejecuta fn(client) como rol `authenticated` con JWT sub=uid, dentro de una transacción.
  async asUser(uid, fn, { role = 'authenticated', commit = true } = {}) {
    const c = await this.client();
    try {
      await c.query('BEGIN');
      await c.query(`SET LOCAL ROLE ${role}`);
      if (uid) await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role })]);
      const r = await fn(c);
      await c.query(commit ? 'COMMIT' : 'ROLLBACK');
      return r;
    } catch (e) {
      try { await c.query('ROLLBACK'); } catch { /* */ }
      throw e;
    } finally { await c.end(); }
  }

  // Llama una RPC pública como usuario. Devuelve {ok,data} o {ok:false,error}.
  async rpc(uid, fn, args = {}, opts = {}) {
    const keys = Object.keys(args);
    const sql = `SELECT public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) AS r`;
    try {
      const r = await this.asUser(uid, (c) => c.query(sql, keys.map((k) => normalize(args[k]))), opts);
      return { ok: true, data: r.rows[0].r };
    } catch (e) {
      return { ok: false, error: e.message, code: e.code, detail: e.detail };
    }
  }

  async stop() {
    try { await this.admin?.end(); } catch { /* */ }
    if (REMOTE) return;
    try { await this.pgServer?.stop(); } catch { /* */ }
    try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch { /* */ }
  }
}

function normalize(v) {
  if (v !== null && typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v);
  return v;
}
