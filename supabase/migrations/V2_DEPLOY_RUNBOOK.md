# Runbook de despliegue Schema V2 (006–016)

Solo infraestructura V2. NO dual-write, backfill, saldos, lecturas ni retirada V1.

## Estado
**Aplicado en producción el 2026-10-04 (5B.2.5)** vía Management API, 1 transacción por fichero,
`lock_timeout = 5s`. Duración total ≈ 2,6 s. Evidencias: `supabase/snapshots/5b25/`.

## Recuperación (proyecto en plan Free)
- Verificado por API/dashboard: `backups: []`, `pitr_enabled: false` ("Free Plan does not include project backups").
- Compensación usada para este cambio aditivo:
  1. Backup lógico de todas las tablas V1 de `public` justo antes del deploy (fuera del repo: contiene datos de usuarios).
  2. Restauración ensayada en staging real (corrupción → restore por PK → 0 diferencias en hashes por fila).
  3. Rollback ensayado: [`rollback/V2_down_006_016.sql`](rollback/V2_down_006_016.sql) → catálogo V1 idéntico a producción.
- Recomendado antes de 5B.3/5B.4 (cuando haya datos V2 reales): plan Pro (backups diarios 7 días) o PITR.

## Staging real
Proyecto Supabase dedicado (org Free, sin coste) `ahorro-invisible-staging`. V1 replicado desde las migraciones
001/002/004/005 + `tests/fixtures/prod_v1_drift.sql` (deriva real de prod) → catálogo V1 idéntico a prod.

## Orden
006 → 007 → 008 → 009 → 010 → 011 → 012 → 013 → 014 → 015 → 016.

## Revisión de bloqueos (todas ADITIVAS)
- `ALTER TABLE goals/user_profiles ADD COLUMN … DEFAULT constante`: metadata-only (PG ≥ 11), sin reescritura.
- CHECK V2 de `goals` condicionados a `ledger_managed` (false por defecto): filas V1 válidas.
- `UNIQUE (id,user_id)` e índices sobre `goals` (52 filas): instantáneo. Índice único primary solo `WHERE ledger_managed`.
- Triggers/políticas RESTRICTIVE nuevas solo afectan a filas `ledger_managed` o a objetos V2.
- Sin DROP, RENAME ni UPDATE de datos V1. Sin dual-write.
- Efecto global único fuera de objetos V2: `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon`
  (solo funciones futuras; el rollback lo revierte).

## Corrección detectada en staging real (aplicada antes de prod)
`avatar_assessment_answers` no tenía ruta de borrado en cascada → la baja de cuenta de un usuario con onboarding V2
fallaba. 007 ahora usa `ON DELETE CASCADE` hacia `avatar_assessments` (test `V1-2b`).

## Validación post-deploy
- `tools/v1_snapshot.sql` PRE vs POST: counts, sumas, `max(updated_at)` y hash por fila → 0 diferencias.
- `tools/v2_postdeploy_check.sql`: owners, SECURITY DEFINER + `search_path=''`, EXECUTE solo `authenticated`, private sin acceso.
- `tools/prod_smoke_rollback.sql` y `tools/prod_smoke_v1_rollback.sql`: pruebas con usuario sintético que abortan (no persisten).

## Notas para 5B.3
- `service_role` NO tiene EXECUTE sobre las RPC: el servidor debe invocarlas con el JWT del usuario.
- 3 usuarios de `auth.users` sin `user_profiles` (no existe trigger auth→profiles; los crea la app).

# 5B.3–5B.7 — Cutover V2 en producción (2026-10-10)

## Orden ejecutado
1. Backup lógico V1 de prod (fuera del repo) + `tools/v1_snapshot.sql` PRE.
2. 017 + 018 en prod (flags sembradas OFF → comportamiento V1). Verificado: RLS en `app_flags`, sin escritura de
   clientes, SECURITY DEFINER con `search_path`, sin EXECUTE `anon`, snapshot V1 idéntico.
3. Smoke reversible (bloque `DO` que aborta): `create_goal` + `get_dashboard_state` → 0 filas persistidas.
4. Push `main` (7bef6d5) → deploy Vercel READY.
   - **Hallazgo**: el dominio de producción estaba fijado a un deployment de mayo (auto-asignación desactivada
     tras un rollback). Se promovió el deployment de 7bef6d5 (`vercel promote`). Rollback de frontend:
     `vercel rollback` al deployment anterior si fuese necesario.
5. `V2_DUAL_WRITE` ON (T0) → `private.v2_backfill('infinity')` + `private.v2_backfill(T0)`.
6. `private.v1_v2_compare()`: OK 249 · EXPECTED_LEGACY 52 · MIGRATION_ADJUSTMENT 10 · **REAL_MISMATCH 0**.
7. `V2_READS` ON → login solo lee `app_flags` + `rpc/get_dashboard_state` (+ `shadow_check`).
8. `V2_WRITE_AUTHORITY` + `V1_RUNTIME_RETIRED` ON → **019** aplicada: `decisions`, `hucha`,
   `question_interactions`, `goals` sin INSERT/UPDATE/DELETE para anon/authenticated/service_role (SELECT se
   conserva). Sin DROP físico. Rollback: `supabase/rollback/019_v1_retirement_rollback.sql` (probado en staging).

## Validación E2E en producción (usuario dedicado, eliminado al terminar)
Crear objetivo, editar, hacer principal, decisión diaria 10 € (= 10 € en ledger), reinicio, "no he ahorrado"
(sin asiento), extra 5 €, archivar→hucha, hucha→objetivo, reactivar, eliminar con reasignación, refresh,
logout, login en sesión nueva (solo `app_flags` + `get_dashboard_state`). Outbox vacío tras cada acción.

## Invariantes post-cutover
negative_buckets 0 · unbalanced_transfers 0 · dup_active_daily_per_day 0 · dup_goal_legacy 0 ·
dup_reversals 0 · multi_primary 0 · cross_user_goal_refs 0 · dead_letters_24h 0.

## Notas
- Tras la autoridad V2, `private.v1_v2_compare()` deja de ser significativo para actividad nueva (V1 congelado).
- Crons (19:00/20:00 UTC, domingo 09:00) leen V2.

