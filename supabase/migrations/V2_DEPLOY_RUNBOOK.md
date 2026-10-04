# Runbook de despliegue Schema V2 (006–016)

Solo infraestructura V2. NO dual-write, backfill, saldos, lecturas ni retirada V1.

## Precondiciones (bloqueantes)
1. Backup/PITR verificados en Dashboard → Database → Backups (última copia < 24 h; PITR sí/no; probado el procedimiento de restore).
2. `supabase/tools/prod_preflight.sql` ejecutado y revisado (triggers auth, owner, grants, RLS).
3. Staging real (branch o 2º proyecto) con 006–016 aplicadas y `supabase/tests` equivalentes en verde.
4. Snapshot PRE: `node supabase/tools/snapshot_v1.mjs .env.local supabase/snapshots/pre_deploy.json`.

## Orden
006 → 007 → 008 → 009 → 010 → 011 → 012 → 013 → 014 → 015 → 016 (SQL Editor o `psql -1 -f`, cada una en transacción).

## Revisión de bloqueos (todas ADITIVAS)
- `ALTER TABLE goals/user_profiles ADD COLUMN … DEFAULT constante`: metadata-only (PG ≥ 11), sin reescritura.
- CHECK V2 de `goals` condicionados a `ledger_managed` (false por defecto): filas V1 válidas, sin rechazos.
- `UNIQUE (id,user_id)` e índices sobre `goals` (≈52 filas): instantáneo. Índice único primary solo `WHERE ledger_managed`.
- Triggers/políticas RESTRICTIVE nuevas solo afectan a filas `ledger_managed` o a objetos V2.
- No hay DROP, RENAME ni UPDATE masivo sobre datos V1. No se activa dual-write.

## Rollback (antes de 5B.3, sin datos V2 reales)
Orden inverso: `DROP FUNCTION public.<rpc>…`, `DROP VIEW v_*`, `DROP TABLE` V2 (ledger, goal_events, onboarding_*, cat_*, private.*), después
`ALTER TABLE goals DROP COLUMN …` (columnas V2) y `ALTER TABLE user_profiles DROP COLUMN …`, `DROP ROLE app_rpc_owner`.
Si algo grave: restore PITR/backup.

## Validación post-deploy
Re-ejecutar `snapshot_v1.mjs` → `post_schema_snapshot.json` y comparar con PRE (deben ser idénticos).
