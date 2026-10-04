# supabase-bigquery-sync

Cloud Run Job que exporta datos de Supabase a BigQuery mediante full refresh diario.

## Arquitectura

```
Cloud Scheduler `supabase-bq-sync-schedule` (cron `0 0 * * *`, Etc/UTC = 02:00 Madrid en verano / 01:00 en invierno)
  → Cloud Run Job (this container)
      → Supabase REST API (service role key from Secret Manager)
      → BigQuery: staging → swap → final
```

## Tablas sincronizadas

| Tabla | PK | Columnas sensibles excluidas |
|---|---|---|
| user_profiles | id | name, income_range |
| goals | id | — |
| decisions | id | — |
| hucha | user_id | entries |
| question_interactions | id | — |

## Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase (no es secreto) |
| `SUPABASE_SECRET_NAME` | Resource name del secret en Secret Manager |
| `BQ_PROJECT_ID` | GCP Project ID |
| `BQ_DATASET` | Dataset BigQuery (default: `raw_supabase`) |

## Autenticación

- **BigQuery**: Application Default Credentials (service account de Cloud Run — sin JSON key)
- **Supabase**: `SUPABASE_SERVICE_ROLE_KEY` leída de Secret Manager en runtime

## Patrón de seguridad full refresh

1. Extraer todas las filas de Supabase (paginadas)
2. Validar extracción (row count, PK sin NULLs)
3. Cargar a tabla `_staging` en BigQuery
4. Validar staging (row count, PK NULLs)
5. Copiar staging → tabla final (WRITE_TRUNCATE)
6. Eliminar staging

**La tabla productiva nunca se trunca antes de tener datos válidos.**

## Build y deploy local (requiere gcloud)

```bash
# Build y push a Artifact Registry
gcloud builds submit \
  --tag europe-west3-docker.pkg.dev/PROJECT_ID/supabase-bq-sync/supabase-to-bigquery:latest \
  jobs/supabase-bigquery-sync/

# Crear Cloud Run Job
gcloud run jobs create supabase-to-bigquery \
  --image europe-west3-docker.pkg.dev/PROJECT_ID/supabase-bq-sync/supabase-to-bigquery:latest \
  --region europe-west3 \
  --service-account supabase-bq-sync@PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars SUPABASE_URL=https://dhbstyyesbycjehlbkya.supabase.co \
  --set-env-vars BQ_PROJECT_ID=PROJECT_ID \
  --set-env-vars BQ_DATASET=raw_supabase \
  --set-secrets SUPABASE_SECRET_NAME=SUPABASE_SERVICE_ROLE_KEY:latest \
  --max-retries 1 \
  --task-timeout 600
```

## Ejecución manual

```bash
gcloud run jobs execute supabase-to-bigquery --region europe-west3
```

## Logs

Todos los logs van a Cloud Logging. Filtra por:
```
resource.type="cloud_run_job"
resource.labels.job_name="supabase-to-bigquery"
```
