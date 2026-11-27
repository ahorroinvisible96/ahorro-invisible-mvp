# Runbook de Gobernanza, Privacidad y Operación Bank-Ready (Analytics V2)

Este runbook cubre las acciones operativas fuera de Git (PostHog EU, GCP IAM, Supabase solo lectura y Looker Studio) necesarias para cerrar el 100 % del endurecimiento de datos para comités de privacidad y bancos.

---

## 1. PostHog EU · Cierre de residuos de privacidad (5 min)

Aunque `src/lib/posthog.ts` ya bloquea en código Session Replay, heatmaps, autocapture y `$pageleave`, PostHog enriquece IP a nivel de servidor si no se desactiva en el proyecto:

1. Abrir **PostHog EU** (`https://eu.posthog.com`) → **Project Settings**.
2. **Privacidad IP / GeoIP:**
   - Activar **«Discard client IP data»** (`ON`).
   - En **Data pipelines / Transformations**, desactivar **GeoIP** si está habilitado.
3. **Session Replay histórico:**
   - Confirmar **Session Replay = OFF** a nivel de proyecto.
   - Ir a **Session Replay → Recordings** y eliminar/purgar cualquier grabación anterior al `2026-10-10` (pudieron capturar saldos o títulos de objetivos).
4. **Retención y verificación:**
   - Confirmar política de retención en PostHog EU y en BigQuery `raw_posthog` (recomendado: expiración de particiones `raw_posthog.events` a 365 días si no se requiere histórico crudo mayor).
   - Tras 7 días desde el cambio, confirmar en `analytics_v2.dq_results` que el test **`posthog_geoip_recent_check`** pasa a `failures = 0 (PASS)`.

---

## 2. GCP BigQuery · Aislamiento IAM del Dataset Bancario (`analytics_bank_v2`)

El Cloud Run Job materializa las 5 tablas k-anónimas en **`gen-lang-client-0725004018.analytics_bank_v2`** (verificado automáticamente por `no_user_id_in_bank_dataset`).

Para garantizar aislamiento técnico real hacia el informe *Looker Bank Intelligence*:

```bash
# 1. Crear cuenta de servicio dedicada para el informe externo de Bancos (solo lectura sobre analytics_bank_v2)
gcloud iam service-accounts create looker-bank-reader \
  --project=gen-lang-client-0725004018 \
  --display-name="Looker Studio Bank Intelligence (Read-Only k-anon)"

# 2. Permiso para lanzar consultas BigQuery en el proyecto (sin leer ningún dataset por defecto)
gcloud projects add-iam-policy-binding gen-lang-client-0725004018 \
  --member="serviceAccount:looker-bank-reader@gen-lang-client-0725004018.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"

# 3. Conceder roles/bigquery.dataViewer EXCLUSIVAMENTE sobre analytics_bank_v2
#    (NUNCA conceder acceso sobre analytics_v2, raw_supabase_v2 ni raw_posthog)
bq show --format=prettyjson gen-lang-client-0725004018:analytics_bank_v2 > bank_ds.json
# Añadir {"role": "READER", "userByEmail": "looker-bank-reader@gen-lang-client-0725004018.iam.gserviceaccount.com"} en "access"
bq update --source bank_ds.json gen-lang-client-0725004018:analytics_bank_v2
rm bank_ds.json
```

---

## 3. Supabase · Rol PostgreSQL de solo lectura para futuras auditorías (`R03`)

Evitar usar `SUPABASE_SERVICE_ROLE_KEY` en auditorías documentales o verificaciones manuales. Crear un rol PostgreSQL estrictamente `READ ONLY` (ejecutar solo tras revisión humana en Supabase):

```sql
-- Ejecutar en SQL Editor con cuenta propietaria (solo lectura sobre tablas V2 sin PII)
CREATE ROLE ai_readonly_auditor NOINHERIT LOGIN PASSWORD '<ROTAR_EN_GESTOR_SECRETOS>';
ALTER ROLE ai_readonly_auditor SET default_transaction_read_only = on;
GRANT USAGE ON SCHEMA public TO ai_readonly_auditor;
GRANT SELECT ON
  public.savings_transactions,
  public.daily_decisions,
  public.daily_prompt_impressions,
  public.goal_events,
  public.onboarding_sessions,
  public.avatar_assessments,
  public.income_declarations,
  public.cat_income_bands,
  public.cat_recommendation_rules,
  public.cat_daily_questions,
  public.app_flags
TO ai_readonly_auditor;
-- Nota: NO conceder SELECT sobre public.user_free_text, private.*, ni columnas de texto libre/PII.
```

---

## 4. Looker Studio · Limpieza y despliegue de los 2 informes

1. **Archivar informe V1 legado** (`677598b8-673c-414d-9f19-e42b71bb86d3`, consultaba `raw_supabase.*` eliminado).
2. **En el informe V2 interno existente (`215ef350-9d58-47b5-83f0-69adc3ae7fb5`):**
   - Ir a *Recurso → Gestionar fuentes de datos añadidas* y **eliminar `mart_user_savings` y `mart_goals`**.
   - Quitar la dimensión de fecha `computed_at` del scorecard `registered_users` y cambiar agregación de `SUM` a `MAX`.
   - Implementar las 3 páginas según:
     - [`looker_producto_spec.md`](looker_producto_spec.md)
     - [`looker_negocio_dq_spec.md`](looker_negocio_dq_spec.md)
3. **Crear el segundo informe independiente («Ahorro Invisible · Bank Intelligence»):**
   - Conectar **solo** a `gen-lang-client-0725004018.analytics_bank_v2.*` con credenciales limitadas (`looker-bank-reader`).
   - Implementar los 5 bloques de [`looker_bancos_spec.md`](looker_bancos_spec.md).
