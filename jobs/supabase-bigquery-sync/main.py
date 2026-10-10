"""
Supabase → BigQuery sync job (Analytics V2, Fase 5C).

Pipeline (una ejecución diaria, Cloud Run Job):
  1. EXTRACT  tablas V2 de Supabase (REST, service role, allowlist de columnas)
              + auth users (solo id/fechas/flags internos, nunca email)
  2. LOAD     a BigQuery `raw_supabase_v2` con full refresh seguro (staging → validación → swap)
  3. MODEL    ejecuta sql/models/*.sql en orden → dataset `analytics_v2` (tablas para Looker Studio)
  4. TEST     ejecuta sql/tests/*.sql (calidad de datos) + reconciliación Supabase↔BigQuery
              → resultados en `analytics_v2.dq_results`; exit 1 si falla un test crítico

Authentication:
  - BigQuery:  Application Default Credentials (Cloud Run service account)
  - Supabase:  SUPABASE_SERVICE_ROLE_KEY from Secret Manager

Environment variables:
  SUPABASE_URL          – e.g. https://xxxx.supabase.co
  SUPABASE_SECRET_NAME  – Secret Manager resource name for the service role key
  BQ_PROJECT_ID         – GCP project id
  BQ_DATASET            – dataset V1 legado (default: raw_supabase) — solo si EXPORT_V1=true
  BQ_DATASET_V2         – dataset raw V2 (default: raw_supabase_v2)
  BQ_ANALYTICS_DATASET  – dataset modelado (default: analytics_v2)
  BQ_POSTHOG_DATASET    – dataset del batch export de PostHog (default: raw_posthog)
  BQ_LOCATION           – ubicación de los datasets nuevos (default: la del dataset V1 o EU)
  EXPORT_V1             – "true" para volver a exportar las tablas V1 (congeladas tras el cutover)
  MODE                  – full (default) | models | tests
  INTERNAL_EMAIL_REGEX  – regex de cuentas internas/test (se evalúa aquí; el email NO se exporta)
  SUSPECT_EMAIL_REGEX   – regex de dominios sospechosos (solo cuenta si el email no está confirmado)

Privacy: no se exportan nombres, emails, ingresos exactos, textos libres (user_free_text), títulos de
objetivos V2 ni tablas private.*. user_id es un UUID seudónimo.
Deletes: full refresh → las bajas de usuario desaparecen también de BigQuery.
"""

import os
import re
import sys
import json
import time
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone

import requests
from google.cloud import bigquery, secretmanager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger(__name__)

PAGE_SIZE = 1000  # Supabase REST max per request
SQL_DIR = Path(__file__).parent / "sql"


def S(*specs: str) -> list:
    """'name:TYPE' o 'name:TYPE!' (REQUIRED) → lista de SchemaField."""
    out = []
    for spec in specs:
        name, typ = spec.split(":")
        req = typ.endswith("!")
        out.append(bigquery.SchemaField(name, typ.rstrip("!"), mode="REQUIRED" if req else "NULLABLE"))
    return out


def cols(schema: list) -> list:
    return [f.name for f in schema]


# ──────────────────────────────────────────────────────────────────────────────
# V2 — allowlists (nunca SELECT *). JSON → STRING (json.dumps).
# ──────────────────────────────────────────────────────────────────────────────
V2_TABLES: dict = {
    "savings_transactions": {
        "pk": "transaction_id",
        "schema": S("transaction_id:STRING!", "user_id:STRING!", "transaction_type:STRING", "bucket_type:STRING",
                    "goal_id:STRING", "amount:NUMERIC", "currency:STRING", "decision_id:STRING",
                    "transfer_group_id:STRING", "reverses_transaction_id:STRING", "amends_transaction_id:STRING",
                    "reason:STRING", "occurred_at:TIMESTAMP", "timezone:STRING", "local_date:DATE",
                    "recorded_at:TIMESTAMP", "surface:STRING", "actor:STRING", "data_origin:STRING"),
        "sum_check": "amount",
    },
    "daily_decisions": {
        "pk": "decision_id",
        "schema": S("decision_id:STRING!", "user_id:STRING!", "local_date:DATE", "occurred_at:TIMESTAMP",
                    "timezone:STRING", "recorded_at:TIMESTAMP", "outcome:STRING", "question_bank_version:STRING",
                    "question_id:STRING", "selected_option_key:STRING", "has_custom_text:BOOL",
                    "declared_amount:NUMERIC", "credit_rule_version:STRING", "goal_id:STRING",
                    "impression_id:STRING", "surface:STRING", "status:STRING", "voided_at:TIMESTAMP",
                    "void_reason:STRING", "data_origin:STRING"),
        "sum_check": "declared_amount",
    },
    "daily_prompt_impressions": {
        "pk": "impression_id",
        "schema": S("impression_id:STRING!", "user_id:STRING!", "local_date:DATE", "shown_at:TIMESTAMP",
                    "timezone:STRING", "recorded_at:TIMESTAMP", "question_bank_version:STRING", "question_id:STRING",
                    "avatar_used:STRING", "time_slot:STRING", "selection_reason:STRING",
                    "replaces_impression_id:STRING", "first_surface:STRING", "data_origin:STRING"),
    },
    "goals": {
        "pk": "id",
        "filters": {"ledger_managed": "eq.true"},
        # title excluido (texto libre del usuario)
        "schema": S("id:STRING!", "user_id:STRING!", "target_amount:NUMERIC", "horizon_months:INTEGER",
                    "is_primary:BOOL", "status:STRING", "final_target_amount:NUMERIC", "step_index:INTEGER",
                    "start_date:DATE", "first_completed_at:TIMESTAMP", "archived_at:TIMESTAMP",
                    "deleted_at:TIMESTAMP", "onboarding_session_id:STRING", "created_at:TIMESTAMP",
                    "updated_at:TIMESTAMP", "data_origin:STRING", "legacy_id:STRING"),
    },
    "goal_events": {
        "pk": "goal_event_id",
        "schema": S("goal_event_id:STRING!", "user_id:STRING!", "goal_id:STRING", "event_type:STRING",
                    "cause:STRING", "completion_sequence:INTEGER", "target_amount_before:NUMERIC",
                    "target_amount_after:NUMERIC", "horizon_months_before:INTEGER", "horizon_months_after:INTEGER",
                    "title_changed:BOOL", "balance_destination_type:STRING", "destination_goal_id:STRING",
                    "balance_moved_amount:NUMERIC", "realism_is_unrealistic:BOOL", "realism_suggested_target:NUMERIC",
                    "realism_suggested_horizon:INTEGER", "accepted_step:BOOL", "related_transaction_id:STRING",
                    "balance_at_event:NUMERIC", "occurred_at:TIMESTAMP", "timezone:STRING", "local_date:DATE",
                    "recorded_at:TIMESTAMP", "surface:STRING", "data_origin:STRING"),
    },
    "onboarding_sessions": {
        "pk": "onboarding_session_id",
        "schema": S("onboarding_session_id:STRING!", "user_id:STRING!", "attempt_number:INTEGER", "flow_version:STRING",
                    "started_at:TIMESTAMP", "started_local_date:DATE", "completed_at:TIMESTAMP",
                    "completed_local_date:DATE", "savings_habit:STRING", "recommendation_rule_version:STRING",
                    "income_band_catalog_version:STRING", "rec_reference_income_amount:NUMERIC",
                    "rec_savings_rate_pct:NUMERIC", "rec_monthly_floor_amount:NUMERIC", "rec_horizon_months:INTEGER",
                    "recommended_monthly_amount:NUMERIC", "recommended_target_amount:NUMERIC",
                    "chosen_target_amount:NUMERIC", "chosen_horizon_months:INTEGER", "warning_shown:STRING",
                    "client_app_version:STRING", "data_origin:STRING", "recorded_at:TIMESTAMP"),
    },
    "avatar_assessments": {
        "pk": "assessment_id",
        "schema": S("assessment_id:STRING!", "user_id:STRING!", "questionnaire_key:STRING",
                    "questionnaire_version:STRING", "scoring_version:STRING", "onboarding_session_id:STRING",
                    "result_avatar:STRING", "scores:STRING", "completed_at:TIMESTAMP", "local_date:DATE",
                    "recorded_at:TIMESTAMP", "data_origin:STRING"),
    },
    "income_declarations": {
        "pk": "income_declaration_id",
        "schema": S("income_declaration_id:STRING!", "user_id:STRING!", "band_catalog_version:STRING",
                    "income_band_code:STRING", "source:STRING", "onboarding_session_id:STRING",
                    "declared_at:TIMESTAMP", "local_date:DATE", "recorded_at:TIMESTAMP", "data_origin:STRING"),
    },
    "user_profiles": {
        "pk": "id",
        # name, income_range, avatar (foto) y métricas V1 congeladas excluidas
        "schema": S("id:STRING!", "money_feeling:STRING", "created_at:TIMESTAMP", "updated_at:TIMESTAMP",
                    "onboarding_completed_at:TIMESTAMP", "timezone:STRING", "currency:STRING"),
    },
    "cat_income_bands": {
        "pk": "band_code",
        "schema": S("catalog_version:STRING", "band_code:STRING!", "lower_bound:NUMERIC", "upper_bound:NUMERIC",
                    "reference_income_amount:NUMERIC", "reference_method:STRING"),
    },
    "cat_recommendation_rules": {
        "pk": "rule_version",
        "schema": S("rule_version:STRING!", "savings_habit:STRING", "savings_rate_pct:NUMERIC",
                    "monthly_floor_amount:NUMERIC", "income_band_catalog_version:STRING", "formula:STRING",
                    "published_at:TIMESTAMP"),
    },
    "cat_daily_questions": {
        "pk": "question_id",
        "schema": S("question_bank_version:STRING", "question_id:STRING!", "avatar:STRING", "time_slot:STRING"),
    },
    "app_flags": {
        "pk": "key",
        "schema": S("key:STRING!", "enabled:BOOL", "updated_at:TIMESTAMP"),
    },
}

AUTH_USERS_SCHEMA = S("user_id:STRING!", "created_at:TIMESTAMP", "last_sign_in_at:TIMESTAMP",
                      "email_confirmed:BOOL", "provider:STRING", "is_internal:BOOL", "is_suspected_test:BOOL")

# ──────────────────────────────────────────────────────────────────────────────
# V1 legado (congelado desde el cutover 2026-10-10). Solo con EXPORT_V1=true.
# ──────────────────────────────────────────────────────────────────────────────
V1_TABLES: dict = {
    "user_profiles": {
        "pk": "id",
        "schema": S("id:STRING!", "money_feeling:STRING", "created_at:TIMESTAMP", "updated_at:TIMESTAMP",
                    "streak_current:INTEGER", "streak_max:INTEGER", "total_saved:NUMERIC", "daily_saved:NUMERIC",
                    "extra_saved:NUMERIC", "decisions_count:INTEGER", "extra_savings_count:INTEGER",
                    "goals_created_count:INTEGER", "active_days_count:INTEGER", "last_active_at:TIMESTAMP",
                    "onboarding_completed_at:TIMESTAMP"),
    },
    "goals": {
        "pk": "id",
        "filters": {"ledger_managed": "eq.false"},
        "schema": S("id:STRING!", "user_id:STRING", "title:STRING", "target_amount:NUMERIC", "current_amount:NUMERIC",
                    "horizon_months:INTEGER", "is_primary:BOOL", "archived:BOOL", "created_at:TIMESTAMP",
                    "updated_at:TIMESTAMP", "source:STRING", "completed_at:TIMESTAMP"),
    },
    "decisions": {
        "pk": "id",
        "schema": S("id:STRING!", "user_id:STRING", "date:DATE", "question_id:STRING", "answer_key:STRING",
                    "goal_id:STRING", "delta_amount:NUMERIC", "monthly_projection:NUMERIC",
                    "yearly_projection:NUMERIC", "created_at:TIMESTAMP", "updated_at:TIMESTAMP"),
    },
    "hucha": {
        "pk": "user_id",
        "schema": S("user_id:STRING!", "balance:NUMERIC", "created_at:TIMESTAMP", "updated_at:TIMESTAMP"),
    },
    "question_interactions": {
        "pk": "id",
        "schema": S("id:STRING!", "user_id:STRING", "question_id:STRING", "local_date:DATE", "time_slot:STRING",
                    "attempt_number:INTEGER", "responded:BOOL", "answer_key:STRING", "saved_amount:NUMERIC",
                    "avatar_dominant:STRING", "avatar_secondary:STRING", "avatar_confidence:NUMERIC",
                    "ai_decision_type:STRING", "ai_decision_reason:STRING", "ai_from_model:BOOL",
                    "should_change_question:BOOL", "created_at:TIMESTAMP", "updated_at:TIMESTAMP"),
    },
}

DEFAULT_INTERNAL_RE = r"(\.test$|\.invalid$|\.local$|@example\.(com|org|net)$|@test\.com$|^ahorroinvisible|\+test@|^e2e_|^t_[0-9a-f]{8}@)"
DEFAULT_SUSPECT_RE = r"@(gmail\.(es|rd|co)|gtg\.com|hotmial\.com|gmial\.com)$"


# ──────────────────────────────────────────────────────────────────────────────
# Secret Manager / Supabase
# ──────────────────────────────────────────────────────────────────────────────
def get_secret(secret_name: str) -> str:
    client = secretmanager.SecretManagerServiceClient()
    response = client.access_secret_version(name=secret_name)
    return response.payload.data.decode("utf-8").strip()


def sb_headers(key: str) -> dict:
    return {"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"}


def extract_table(supabase_url: str, key: str, table_name: str, columns: list, pk: str,
                  filters: dict | None = None) -> list:
    """Paginated REST extraction with explicit column allowlist (never SELECT *)."""
    base_url = f"{supabase_url}/rest/v1/{table_name}"
    rows, offset = [], 0
    while True:
        params = {"select": ",".join(columns), "order": f"{pk}.asc", "limit": PAGE_SIZE, "offset": offset}
        if filters:
            params.update(filters)
        resp = requests.get(base_url, headers=sb_headers(key), params=params, timeout=30)
        resp.raise_for_status()
        page = resp.json()
        if not page:
            break
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return rows


def normalize_rows(rows: list, schema: list) -> list:
    """JSON/arrays → string; garantiza solo columnas del schema."""
    names = cols(schema)
    numeric = {f.name for f in schema if f.field_type == "NUMERIC"}
    out = []
    for r in rows:
        o = {}
        for n in names:
            v = r.get(n)
            if isinstance(v, (dict, list)):
                v = json.dumps(v, ensure_ascii=False, sort_keys=True)
            elif n in numeric and isinstance(v, float):
                v = round(v, 9)  # NUMERIC admite como máximo 9 decimales
            o[n] = v
        out.append(o)
    return out


def extract_auth_users(supabase_url: str, key: str) -> list:
    """Auth admin API → solo id, fechas, proveedor y flags internos. El email se evalúa y se descarta."""
    internal_re = re.compile(os.environ.get("INTERNAL_EMAIL_REGEX", DEFAULT_INTERNAL_RE), re.I)
    suspect_re = re.compile(os.environ.get("SUSPECT_EMAIL_REGEX", DEFAULT_SUSPECT_RE), re.I)
    users, page = [], 1
    while True:
        resp = requests.get(f"{supabase_url}/auth/v1/admin/users", headers=sb_headers(key),
                            params={"page": page, "per_page": 1000}, timeout=30)
        resp.raise_for_status()
        batch = resp.json().get("users", [])
        for u in batch:
            email = (u.get("email") or "").strip().lower()
            confirmed = bool(u.get("email_confirmed_at"))
            users.append({
                "user_id": u["id"],
                "created_at": u.get("created_at"),
                "last_sign_in_at": u.get("last_sign_in_at"),
                "email_confirmed": confirmed,
                "provider": (u.get("app_metadata") or {}).get("provider"),
                "is_internal": bool(internal_re.search(email)) or bool((u.get("user_metadata") or {}).get("e2e")),
                "is_suspected_test": bool(suspect_re.search(email)) and not confirmed,
            })
        if len(batch) < 1000:
            break
        page += 1
    return users


# ──────────────────────────────────────────────────────────────────────────────
# BigQuery helpers
# ──────────────────────────────────────────────────────────────────────────────
def ensure_dataset(bq_client, project: str, dataset: str, location: str) -> None:
    ds = bigquery.Dataset(f"{project}.{dataset}")
    ds.location = location
    bq_client.create_dataset(ds, exists_ok=True)


def scalar(bq_client, sql: str):
    return next(iter(bq_client.query(sql).result()))[0]


def load_table_safe(bq_client, project: str, dataset: str, table_name: str, rows: list, schema: list,
                    pk: str) -> int:
    """staging (WRITE_TRUNCATE) → validar filas + PK → copiar a final → borrar staging."""
    staging_ref = f"{project}.{dataset}.{table_name}_staging"
    final_ref = f"{project}.{dataset}.{table_name}"
    job = bq_client.load_table_from_json(rows, staging_ref, job_config=bigquery.LoadJobConfig(
        schema=schema, write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON))
    job.result()
    if job.errors:
        raise RuntimeError(f"{table_name} staging load errors: {job.errors}")
    n = scalar(bq_client, f"SELECT COUNT(*) FROM `{staging_ref}`")
    if n != len(rows):
        raise ValueError(f"{table_name}: expected {len(rows)} rows in staging, got {n}")
    nulls = scalar(bq_client, f"SELECT COUNT(*) FROM `{staging_ref}` WHERE `{pk}` IS NULL")
    if nulls:
        raise ValueError(f"{table_name}: {nulls} NULL PKs in staging")
    copy = bq_client.copy_table(staging_ref, final_ref, job_config=bigquery.CopyJobConfig(
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE))
    copy.result()
    if copy.errors:
        raise RuntimeError(f"{table_name} copy job errors: {copy.errors}")
    bq_client.delete_table(staging_ref, not_found_ok=True)
    return len(rows)


def render_sql(text: str, ctx: dict) -> str:
    for k, v in ctx.items():
        text = text.replace("{{" + k + "}}", v)
    return text


def run_models(bq_client, ctx: dict) -> None:
    for f in sorted((SQL_DIR / "models").glob("*.sql")):
        t = time.time()
        bq_client.query(render_sql(f.read_text(encoding="utf-8"), ctx)).result()
        log.info("  model %-40s OK %.1fs", f.name, time.time() - t)


def run_tests(bq_client, ctx: dict, run_id: str, extra: list) -> bool:
    """Cada test devuelve filas (test_name, severity, failures, details). failures=0 → OK."""
    results = list(extra)
    for f in sorted((SQL_DIR / "tests").glob("*.sql")):
        try:
            for row in bq_client.query(render_sql(f.read_text(encoding="utf-8"), ctx)).result():
                results.append({"test_name": row["test_name"], "severity": row["severity"],
                                "failures": int(row["failures"]), "details": row.get("details")})
        except Exception as exc:  # un test roto es un fallo crítico
            results.append({"test_name": f.stem, "severity": "critical", "failures": 1, "details": f"ERROR: {exc}"[:900]})
    now = datetime.now(timezone.utc).isoformat()
    rows = [{**r, "run_id": run_id, "run_at": now, "passed": r["failures"] == 0} for r in results]
    table = f"{ctx['project']}.{ctx['an']}.dq_results"
    bq_client.load_table_from_json(rows, table, job_config=bigquery.LoadJobConfig(
        schema=S("run_id:STRING!", "run_at:TIMESTAMP!", "test_name:STRING!", "severity:STRING", "failures:INTEGER",
                 "passed:BOOL", "details:STRING"),
        write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON)).result()
    critical_fail = False
    for r in rows:
        lvl = logging.INFO if r["passed"] else (logging.ERROR if r["severity"] == "critical" else logging.WARNING)
        log.log(lvl, "  DQ %-4s %-45s [%s] failures=%s %s", "OK" if r["passed"] else "FAIL", r["test_name"],
                r["severity"], r["failures"], r.get("details") or "")
        critical_fail |= (not r["passed"] and r["severity"] == "critical")
    log.info("DQ summary: %d tests, %d failed (%s critical)", len(rows), sum(not r["passed"] for r in rows),
             "≥1" if critical_fail else "0")
    return not critical_fail


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────
def main() -> None:
    job_start = time.time()
    run_id = str(uuid.uuid4())
    mode = os.environ.get("MODE", "full")
    log.info("=== Supabase → BigQuery (Analytics V2) run_id=%s mode=%s ===", run_id, mode)

    supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
    bq_project = os.environ["BQ_PROJECT_ID"]
    ds_v1 = os.environ.get("BQ_DATASET", "raw_supabase")
    ds_v2 = os.environ.get("BQ_DATASET_V2", "raw_supabase_v2")
    ds_an = os.environ.get("BQ_ANALYTICS_DATASET", "analytics_v2")
    ds_ph = os.environ.get("BQ_POSTHOG_DATASET", "raw_posthog")
    export_v1 = os.environ.get("EXPORT_V1", "false").lower() == "true"

    bq_client = bigquery.Client(project=bq_project)
    location = os.environ.get("BQ_LOCATION")
    if not location:
        try:
            location = bq_client.get_dataset(f"{bq_project}.{ds_v1}").location
        except Exception:
            location = "EU"
    for ds in (ds_v2, ds_an):
        ensure_dataset(bq_client, bq_project, ds, location)

    ctx = {"project": bq_project, "raw": ds_v2, "an": ds_an, "ph": ds_ph, "v1": ds_v1}
    recon: list = []
    any_error = False

    if mode == "full":
        key = get_secret(os.environ["SUPABASE_SECRET_NAME"])
        plan = [(ds_v2, name, cfg) for name, cfg in V2_TABLES.items()]
        if export_v1:
            plan += [(ds_v1, name, cfg) for name, cfg in V1_TABLES.items()]
        for dataset, name, cfg in plan:
            t = time.time()
            try:
                rows = normalize_rows(extract_table(supabase_url, key, name, cols(cfg["schema"]), cfg["pk"],
                                                    cfg.get("filters")), cfg["schema"])
                if any(r.get(cfg["pk"]) is None for r in rows):
                    raise ValueError(f"{name}: NULL PK after extraction")
                n = load_table_safe(bq_client, bq_project, dataset, name, rows, cfg["schema"], cfg["pk"])
                recon.append({"test_name": f"recon_rows_{dataset}.{name}", "severity": "critical", "failures": 0,
                              "details": f"supabase={len(rows)} bq={n}"})
                if cfg.get("sum_check"):
                    col = cfg["sum_check"]
                    sb_sum = round(sum(float(r[col] or 0) for r in rows), 2)
                    bq_sum = round(float(scalar(bq_client, f"SELECT IFNULL(SUM({col}),0) FROM `{bq_project}.{dataset}.{name}`")), 2)
                    recon.append({"test_name": f"recon_sum_{dataset}.{name}.{col}", "severity": "critical",
                                  "failures": int(abs(sb_sum - bq_sum) > 0.005),
                                  "details": f"supabase={sb_sum} bq={bq_sum}"})
                log.info("[%s.%s] OK rows=%d %.1fs", dataset, name, n, time.time() - t)
            except Exception as exc:
                any_error = True
                recon.append({"test_name": f"recon_rows_{dataset}.{name}", "severity": "critical", "failures": 1,
                              "details": f"ERROR: {exc}"[:900]})
                log.error("[%s.%s] FAILED: %s", dataset, name, exc, exc_info=True)
        try:
            users = extract_auth_users(supabase_url, key)
            load_table_safe(bq_client, bq_project, ds_v2, "auth_users", users, AUTH_USERS_SCHEMA, "user_id")
            recon.append({"test_name": f"recon_rows_{ds_v2}.auth_users", "severity": "critical", "failures": 0,
                          "details": f"users={len(users)} internal={sum(u['is_internal'] for u in users)} "
                                     f"suspected={sum(u['is_suspected_test'] for u in users)}"})
            log.info("[auth_users] OK rows=%d", len(users))
        except Exception as exc:
            any_error = True
            recon.append({"test_name": f"recon_rows_{ds_v2}.auth_users", "severity": "critical", "failures": 1,
                          "details": f"ERROR: {exc}"[:900]})
            log.error("[auth_users] FAILED: %s", exc, exc_info=True)

    if mode in ("full", "models") and not any_error:
        log.info("--- models ---")
        try:
            run_models(bq_client, ctx)
        except Exception as exc:
            any_error = True
            log.error("models FAILED: %s", exc, exc_info=True)

    ok = True
    if mode in ("full", "models", "tests"):
        log.info("--- data quality ---")
        ok = run_tests(bq_client, ctx, run_id, recon)

    log.info("=== done in %.1fs errors=%s dq_ok=%s ===", time.time() - job_start, any_error, ok)
    if any_error or not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
