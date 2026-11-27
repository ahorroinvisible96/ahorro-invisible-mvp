# supabase-bigquery-sync (Analytics V2 · Bank-Grade Governance)

Cloud Run Job diario: Supabase (V2) → BigQuery raw → modelos SQL internos + dataset bancario aislado → tests de calidad DQ.

## Arquitectura

```
Cloud Scheduler `supabase-bq-sync-schedule` (cron `0 0 * * *`, Etc/UTC = 02:00 Madrid verano / 01:00 invierno)
  → Cloud Run Job `supabase-to-bigquery` (europe-west3)
      1. EXTRACT  Supabase REST (service role, allowlist de columnas) + auth users (sin email)
      2. LOAD     BigQuery `raw_supabase_v2` — staging → validación → swap atómico
      3. MODEL    sql/models/00..12.sql en orden → `analytics_v2` (interno) + `analytics_bank_v2` (aislado k-anónimo)
      4. TEST     sql/tests/01..04.sql + reconciliación Supabase↔BigQuery → `analytics_v2.dq_results`
                  exit 1 si falla un test `critical` (visible en Cloud Logging / ejecuciones)
PostHog batch export (nativo) → `raw_posthog.events` (independiente del job; deduplicado en `stg_events`)
```

## Datasets

| Dataset | Contenido | Acceso Looker |
|---|---|---|
| `raw_supabase_v2` | 14 tablas V2 (ledger `savings_transactions`, `daily_decisions`, `daily_prompt_impressions`, `goals`, `goal_events`, onboarding, avatar, banda de ingreso, catálogos, `app_flags`, `auth_users` sin email) | **Nunca directo** |
| `raw_posthog` | Batch export nativo de PostHog (`events`) | **Nunca directo** |
| `analytics_v2` | Capa interna (21 tablas materializadas): `params`, `dim_user`, `fct_ledger`, `fct_decision`, `fct_prompt_impression`, `stg_events`, `fct_user_day`, `mart_kpi_daily`, `mart_funnel(_user/_by_era)`, `mart_cohort_retention`, `mart_retention_dn`, `mart_user_savings`, `mart_goals(_summary)`, `mart_ux_*`, `mart_bank_*`, `mart_kpi_summary`, `dq_results` | Solo informe interno (excluyendo tablas con `user_id`) |
| `analytics_bank_v2` | **Dataset bancario aislado (CERO `user_id` / PII):** `mart_bank_segments`, `mart_bank_savings_curve`, `mart_bank_goals_profile`, `mart_bank_behavioral_segments`, `bank_governance_metadata` | Informe externo *Bank Intelligence* (IAM solo lectura restringido) |

Excluido siempre: emails, nombres, títulos de objetivos, ingreso exacto, `user_free_text`, `private.*`.
Usuarios internos/test (`is_internal`, `is_suspected_test`) se marcan en `dim_user` y quedan fuera de todos los `fct_*`/`mart_*`.

## Variables de entorno

| Variable | Valor en prod |
|---|---|
| `SUPABASE_URL` | `https://dhbstyyesbycjehlbkya.supabase.co` |
| `SUPABASE_SECRET_NAME` | `projects/gen-lang-client-0725004018/secrets/SUPABASE_SERVICE_ROLE_KEY/versions/latest` |
| `BQ_PROJECT_ID` | `gen-lang-client-0725004018` |
| `BQ_DATASET_V2` / `BQ_ANALYTICS_DATASET` / `BQ_BANK_DATASET` / `BQ_POSTHOG_DATASET` | `raw_supabase_v2` / `analytics_v2` / `analytics_bank_v2` / `raw_posthog` |
| `BQ_LOCATION` | `EU` (o detectado automáticamente desde `raw_supabase_v2`) |
| `EXPORT_V1` | `false` |
| `MODE` | `full` (también `models` = solo modelos+tests, `tests` = solo tests) |
| `INTERNAL_EMAIL_REGEX`, `SUSPECT_EMAIL_REGEX` | opcionales (defaults en `main.py`) |

Parámetros de negocio (`mfeu_min_saving_days_30d`, `habit_min_weeks_in_4w`, `k_anonymity_min`, `stat_min_n_indicative`, `stat_min_n_robust`, `bank_margin_annual_pct`, `indicative_margin_years`) en [`sql/models/00_params.sql`](sql/models/00_params.sql).

## Tests de calidad (`sql/tests`)

Contrato: cada fichero es un único `SELECT` que devuelve `(test_name, severity, failures, details)`; `failures = 0` → OK.

| Fichero | Cubre |
|---|---|
| `01_integrity.sql` | PK únicas (incl. `stg_events` deduplicado y `fct_prompt_impression`), FKs, 1 decisión activa/día, marts internos y bancarios no vacíos |
| `02_ledger.sql` | Transferencias suman `0`, sin saldos negativos, anulaciones válidas, `ledger_saving_kind_reconciles` (`daily+extra=net`), `Σ ledger = objetivos + hucha` |
| `03_kpis.sql` | Cuadre diario/acumulado, jerarquía `habit_4w ≤ mfeu_30d ≤ savers_30d ≤ financial_mau ≤ mau ≤ registrados`, cero `days_to_first_saving < 0`, ratios ∈ `[0,1]`, k-anonimato + supresión complementaria + `n >= 10`, paridad `analytics_v2 ↔ analytics_bank_v2` |
| `04_privacy_freshness.sql` | Cero internos en modelos, cero PII en `raw`/`an`/`bank`, **`no_user_id_in_bank_dataset` (critical)**, reconciliación por ID PostHog ↔ Ledger sin bypass `e.n=0`, check de `$geoip/$ip` reciente, frescura `< 26h` |

## Build, deploy controlado (`S10` + aprobación humana obligatoria) y rollback

```bash
# 1. Build nueva imagen inmutable con tag versionado (requiere aprobación S10 + A05)
gcloud builds submit --region europe-west3 \
  --tag europe-west3-docker.pkg.dev/gen-lang-client-0725004018/supabase-bq-sync/supabase-to-bigquery:v2-5d1 \
  jobs/supabase-bigquery-sync/

# 2. Actualizar el Cloud Run Job (añadiendo BQ_BANK_DATASET=analytics_bank_v2)
gcloud run jobs update supabase-to-bigquery --region europe-west3 \
  --image europe-west3-docker.pkg.dev/gen-lang-client-0725004018/supabase-bq-sync/supabase-to-bigquery:v2-5d1 \
  --set-env-vars SUPABASE_URL=https://dhbstyyesbycjehlbkya.supabase.co,SUPABASE_SECRET_NAME=projects/gen-lang-client-0725004018/secrets/SUPABASE_SERVICE_ROLE_KEY/versions/latest,BQ_PROJECT_ID=gen-lang-client-0725004018,BQ_DATASET_V2=raw_supabase_v2,BQ_ANALYTICS_DATASET=analytics_v2,BQ_BANK_DATASET=analytics_bank_v2,BQ_POSTHOG_DATASET=raw_posthog,EXPORT_V1=false,MODE=full \
  --max-retries 1 --task-timeout 900

# 3. Ejecución inmediata de validación
gcloud run jobs execute supabase-to-bigquery --region europe-west3 --wait

# Rollback inmediato a la imagen previa estable (v2-5c1):
gcloud run jobs update supabase-to-bigquery --region europe-west3 \
  --image europe-west3-docker.pkg.dev/gen-lang-client-0725004018/supabase-bq-sync/supabase-to-bigquery:v2-5c1
gcloud run jobs execute supabase-to-bigquery --region europe-west3 --update-env-vars MODE=models --wait
```
