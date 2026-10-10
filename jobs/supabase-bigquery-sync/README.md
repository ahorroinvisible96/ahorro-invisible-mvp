# supabase-bigquery-sync (Analytics V2 · Fase 5C)

Cloud Run Job diario: Supabase (V2) → BigQuery raw → modelos SQL → tests de calidad.

## Arquitectura

```
Cloud Scheduler `supabase-bq-sync-schedule` (cron `0 0 * * *`, Etc/UTC = 02:00 Madrid en verano / 01:00 en invierno)
  → Cloud Run Job `supabase-to-bigquery` (europe-west3)
      1. EXTRACT  Supabase REST (service role, allowlist de columnas) + auth users (sin email)
      2. LOAD     BigQuery `raw_supabase_v2` — staging → validación → swap
      3. MODEL    sql/models/*.sql en orden → dataset `analytics_v2`
      4. TEST     sql/tests/*.sql + reconciliación Supabase↔BigQuery → `analytics_v2.dq_results`
                  exit 1 si falla un test `critical` (visible en Cloud Logging / ejecuciones)
PostHog batch export (nativo) → `raw_posthog.events` (independiente del job)
```

## Datasets

| Dataset | Contenido |
|---|---|
| `raw_supabase_v2` | Tablas V2 (ledger `savings_transactions`, `daily_decisions`, `goals`, `goal_events`, onboarding, avatar, banda de ingreso, catálogos, `app_flags`) + `auth_users` (solo id/fechas/flags internos) |
| `analytics_v2` | `params`, `dim_user`, `fct_ledger`, `fct_decision`, `stg_events`, `fct_user_day`, `mart_kpi_daily`, `mart_funnel(_user)`, `mart_cohort_retention`, `mart_retention_dn`, `mart_user_savings`, `mart_goals`, `mart_bank_segments`, `mart_bank_savings_curve`, `mart_kpi_summary`, `dq_results` |
| `raw_supabase` | Tablas V1 congeladas desde el cutover (2026-10-10). Solo se reexportan con `EXPORT_V1=true` |
| `raw_posthog` | Batch export de PostHog |

Excluido siempre: emails, nombres, títulos de objetivos, ingreso exacto, `user_free_text`, `private.*`.
Usuarios internos/test (`is_internal`, `is_suspected_test`) se marcan en `dim_user` y quedan fuera de todos los `fct_*`/`mart_*`.

## Variables de entorno

| Variable | Valor en prod |
|---|---|
| `SUPABASE_URL` | `https://dhbstyyesbycjehlbkya.supabase.co` |
| `SUPABASE_SECRET_NAME` | `projects/gen-lang-client-0725004018/secrets/SUPABASE_SERVICE_ROLE_KEY/versions/latest` |
| `BQ_PROJECT_ID` | `gen-lang-client-0725004018` |
| `BQ_DATASET` / `BQ_DATASET_V2` / `BQ_ANALYTICS_DATASET` / `BQ_POSTHOG_DATASET` | `raw_supabase` / `raw_supabase_v2` / `analytics_v2` / `raw_posthog` |
| `EXPORT_V1` | `false` |
| `MODE` | `full` (también `models` = solo modelos+tests, `tests` = solo tests) |
| `INTERNAL_EMAIL_REGEX`, `SUSPECT_EMAIL_REGEX` | opcionales (defaults en `main.py`) |

Parámetros de negocio (margen LTV, k-anonimato, días de churn, ventana de activación) en
[`sql/models/00_params.sql`](sql/models/00_params.sql).

## Tests de calidad (`sql/tests`)

Contrato: cada fichero es un único `SELECT` que devuelve `(test_name, severity, failures, details)`; `failures = 0` → OK.

| Fichero | Cubre |
|---|---|
| `01_integrity.sql` | PK únicas, FKs del ledger, 1 decisión activa por día, marts no vacíos |
| `02_ledger.sql` | transferencias suman 0, sin saldos negativos, anulaciones válidas, Σ ledger = objetivos + hucha |
| `03_kpis.sql` | Σ diario = ledger, activos ≤ registrados, ratios ∈ [0,1], embudo monótono, k-anonimato en Bancos |
| `04_privacy_freshness.sql` | sin internos en modelos, sin columnas PII, PostHog ↔ ledger, frescura < 26 h |

Además, el job añade la reconciliación por tabla (filas y suma de importes Supabase vs BigQuery).

```sql
-- Último resultado
SELECT * FROM `gen-lang-client-0725004018.analytics_v2.dq_results`
WHERE run_id = (SELECT run_id FROM `gen-lang-client-0725004018.analytics_v2.dq_results` ORDER BY run_at DESC LIMIT 1)
ORDER BY passed, severity;
```

## Build y deploy

```bash
gcloud builds submit --region europe-west3 \
  --tag europe-west3-docker.pkg.dev/gen-lang-client-0725004018/supabase-bq-sync/supabase-to-bigquery:<tag> \
  jobs/supabase-bigquery-sync/

gcloud run jobs update supabase-to-bigquery --region europe-west3 \
  --image europe-west3-docker.pkg.dev/gen-lang-client-0725004018/supabase-bq-sync/supabase-to-bigquery:<tag> \
  --set-env-vars SUPABASE_URL=...,SUPABASE_SECRET_NAME=...,BQ_PROJECT_ID=...,EXPORT_V1=false,MODE=full \
  --max-retries 1 --task-timeout 900
```

Service account: `1076218367921-compute@developer.gserviceaccount.com` (BigQuery Admin + Secret Accessor).

## Ejecución manual

```bash
gcloud run jobs execute supabase-to-bigquery --region europe-west3 --wait
# solo modelos + tests, sin volver a extraer:
gcloud run jobs execute supabase-to-bigquery --region europe-west3 --update-env-vars MODE=models
```

## Logs

```
resource.type="cloud_run_job"
resource.labels.job_name="supabase-to-bigquery"
```
