"""
Supabase → BigQuery full-refresh sync job.

Authentication:
  - BigQuery:  Application Default Credentials (Cloud Run service account)
  - Supabase:  SUPABASE_SERVICE_ROLE_KEY from Secret Manager

Environment variables (set in Cloud Run Job):
  SUPABASE_URL          – e.g. https://xxxx.supabase.co
  SUPABASE_SECRET_NAME  – Secret Manager resource name for the service role key
                          e.g. projects/MY_PROJECT/secrets/SUPABASE_SERVICE_ROLE_KEY/versions/latest
  BQ_PROJECT_ID         – GCP project id
  BQ_DATASET            – BigQuery dataset (default: raw_supabase)

Privacy: name, income_range (user_profiles) and entries (hucha) are NOT extracted.
Deletes: handled implicitly — full refresh replaces each table entirely.
"""

import os
import sys
import time
import logging
from datetime import datetime, timezone

import requests
from google.cloud import bigquery, secretmanager

# ──────────────────────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Column allowlists — never use SELECT *
# Excluded: user_profiles.name, user_profiles.income_range, hucha.entries
# ──────────────────────────────────────────────────────────────────────────────
TABLE_CONFIG: dict = {
    "user_profiles": {
        "pk": "id",
        "columns": [
            "id", "money_feeling",
            "created_at", "updated_at",
            "streak_current", "streak_max",
            "total_saved", "daily_saved", "extra_saved",
            "decisions_count", "extra_savings_count",
            "goals_created_count", "active_days_count",
            "last_active_at", "onboarding_completed_at",
        ],
        "schema": [
            bigquery.SchemaField("id",                       "STRING",    mode="REQUIRED"),
            bigquery.SchemaField("money_feeling",            "STRING",    mode="NULLABLE"),
            bigquery.SchemaField("created_at",               "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("updated_at",               "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("streak_current",           "INTEGER",   mode="NULLABLE"),
            bigquery.SchemaField("streak_max",               "INTEGER",   mode="NULLABLE"),
            bigquery.SchemaField("total_saved",              "NUMERIC",   mode="NULLABLE"),
            bigquery.SchemaField("daily_saved",              "NUMERIC",   mode="NULLABLE"),
            bigquery.SchemaField("extra_saved",              "NUMERIC",   mode="NULLABLE"),
            bigquery.SchemaField("decisions_count",          "INTEGER",   mode="NULLABLE"),
            bigquery.SchemaField("extra_savings_count",      "INTEGER",   mode="NULLABLE"),
            bigquery.SchemaField("goals_created_count",      "INTEGER",   mode="NULLABLE"),
            bigquery.SchemaField("active_days_count",        "INTEGER",   mode="NULLABLE"),
            bigquery.SchemaField("last_active_at",           "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("onboarding_completed_at",  "TIMESTAMP", mode="NULLABLE"),
        ],
    },
    "goals": {
        "pk": "id",
        # Data Model V2: solo metas V1. Las metas V2 (ledger_managed=true) se
        # analizan desde el ledger en Analytics V2 (Fase 5C).
        "filters": {"ledger_managed": "eq.false"},
        "columns": [
            "id", "user_id", "title",
            "target_amount", "current_amount", "horizon_months",
            "is_primary", "archived",
            "created_at", "updated_at",
            "source", "completed_at",
        ],
        "schema": [
            bigquery.SchemaField("id",             "STRING",    mode="REQUIRED"),
            bigquery.SchemaField("user_id",        "STRING",    mode="NULLABLE"),
            bigquery.SchemaField("title",          "STRING",    mode="NULLABLE"),
            bigquery.SchemaField("target_amount",  "NUMERIC",   mode="NULLABLE"),
            bigquery.SchemaField("current_amount", "NUMERIC",   mode="NULLABLE"),
            bigquery.SchemaField("horizon_months", "INTEGER",   mode="NULLABLE"),
            bigquery.SchemaField("is_primary",     "BOOL",      mode="NULLABLE"),
            bigquery.SchemaField("archived",       "BOOL",      mode="NULLABLE"),
            bigquery.SchemaField("created_at",     "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("updated_at",     "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("source",         "STRING",    mode="NULLABLE"),
            bigquery.SchemaField("completed_at",   "TIMESTAMP", mode="NULLABLE"),
        ],
    },
    "decisions": {
        "pk": "id",
        "columns": [
            "id", "user_id", "date", "question_id", "answer_key",
            "goal_id", "delta_amount",
            "monthly_projection", "yearly_projection",
            "created_at", "updated_at",
        ],
        "schema": [
            bigquery.SchemaField("id",                 "STRING",    mode="REQUIRED"),
            bigquery.SchemaField("user_id",            "STRING",    mode="NULLABLE"),
            bigquery.SchemaField("date",               "DATE",      mode="NULLABLE"),
            bigquery.SchemaField("question_id",        "STRING",    mode="NULLABLE"),
            bigquery.SchemaField("answer_key",         "STRING",    mode="NULLABLE"),
            bigquery.SchemaField("goal_id",            "STRING",    mode="NULLABLE"),
            bigquery.SchemaField("delta_amount",       "NUMERIC",   mode="NULLABLE"),
            bigquery.SchemaField("monthly_projection", "NUMERIC",   mode="NULLABLE"),
            bigquery.SchemaField("yearly_projection",  "NUMERIC",   mode="NULLABLE"),
            bigquery.SchemaField("created_at",         "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("updated_at",         "TIMESTAMP", mode="NULLABLE"),
        ],
    },
    "hucha": {
        "pk": "user_id",
        "columns": [
            "user_id", "balance",
            "created_at", "updated_at",
        ],
        "schema": [
            bigquery.SchemaField("user_id",    "STRING",    mode="REQUIRED"),
            bigquery.SchemaField("balance",    "NUMERIC",   mode="NULLABLE"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("updated_at", "TIMESTAMP", mode="NULLABLE"),
        ],
    },
    "question_interactions": {
        "pk": "id",
        "columns": [
            "id", "user_id", "question_id",
            "local_date", "time_slot", "attempt_number",
            "responded", "answer_key", "saved_amount",
            "avatar_dominant", "avatar_secondary", "avatar_confidence",
            "ai_decision_type", "ai_decision_reason", "ai_from_model",
            "should_change_question",
            "created_at", "updated_at",
        ],
        "schema": [
            bigquery.SchemaField("id",                    "STRING",    mode="REQUIRED"),
            bigquery.SchemaField("user_id",               "STRING",    mode="NULLABLE"),
            bigquery.SchemaField("question_id",           "STRING",    mode="NULLABLE"),
            bigquery.SchemaField("local_date",            "DATE",      mode="NULLABLE"),
            bigquery.SchemaField("time_slot",             "STRING",    mode="NULLABLE"),
            bigquery.SchemaField("attempt_number",        "INTEGER",   mode="NULLABLE"),
            bigquery.SchemaField("responded",             "BOOL",      mode="NULLABLE"),
            bigquery.SchemaField("answer_key",            "STRING",    mode="NULLABLE"),
            bigquery.SchemaField("saved_amount",          "NUMERIC",   mode="NULLABLE"),
            bigquery.SchemaField("avatar_dominant",       "STRING",    mode="NULLABLE"),
            bigquery.SchemaField("avatar_secondary",      "STRING",    mode="NULLABLE"),
            bigquery.SchemaField("avatar_confidence",     "NUMERIC",   mode="NULLABLE"),
            bigquery.SchemaField("ai_decision_type",      "STRING",    mode="NULLABLE"),
            bigquery.SchemaField("ai_decision_reason",    "STRING",    mode="NULLABLE"),
            bigquery.SchemaField("ai_from_model",         "STRING",    mode="NULLABLE"),
            bigquery.SchemaField("should_change_question","BOOL",      mode="NULLABLE"),
            bigquery.SchemaField("created_at",            "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("updated_at",            "TIMESTAMP", mode="NULLABLE"),
        ],
    },
}

PAGE_SIZE = 1000  # Supabase REST max per request


# ──────────────────────────────────────────────────────────────────────────────
# Secret Manager
# ──────────────────────────────────────────────────────────────────────────────
def get_secret(secret_name: str) -> str:
    """Fetch a secret value from GCP Secret Manager."""
    client = secretmanager.SecretManagerServiceClient()
    response = client.access_secret_version(name=secret_name)
    return response.payload.data.decode("utf-8").strip()


# ──────────────────────────────────────────────────────────────────────────────
# Supabase extraction with pagination
# ──────────────────────────────────────────────────────────────────────────────
def extract_table(
    supabase_url: str,
    service_role_key: str,
    table_name: str,
    columns: list,
    pk: str,
    filters: dict | None = None,
) -> list:
    """
    Extract all rows from a Supabase table using paginated REST calls.
    Returns a list of dicts with only the requested columns.
    Never sends SELECT *.
    """
    select_cols = ",".join(columns)
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Accept": "application/json",
    }
    base_url = f"{supabase_url}/rest/v1/{table_name}"
    rows = []
    offset = 0

    while True:
        params = {
            "select": select_cols,
            "order": f"{pk}.asc",
            "limit": PAGE_SIZE,
            "offset": offset,
        }
        if filters:
            params.update(filters)
        resp = requests.get(base_url, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        page = resp.json()

        if not page:
            break

        rows.extend(page)
        log.info("  [%s] fetched offset=%d rows_this_page=%d total_so_far=%d",
                 table_name, offset, len(page), len(rows))

        if len(page) < PAGE_SIZE:
            break  # last page
        offset += PAGE_SIZE

    return rows


# ──────────────────────────────────────────────────────────────────────────────
# Validation helpers
# ──────────────────────────────────────────────────────────────────────────────
def validate_extraction(table_name: str, rows: list, pk: str) -> None:
    """Raise ValueError if extraction looks wrong."""
    if rows is None:
        raise ValueError(f"{table_name}: extraction returned None")
    pk_nulls = sum(1 for r in rows if r.get(pk) is None)
    if pk_nulls > 0:
        raise ValueError(f"{table_name}: {pk_nulls} rows with NULL primary key after extraction")
    log.info("  [%s] extraction validated: %d rows, 0 PK NULLs", table_name, len(rows))


def validate_bq_staging(
    bq_client,
    project: str,
    dataset: str,
    staging_table: str,
    expected_rows: int,
    pk_field: str,
) -> None:
    """Raise ValueError if staging table does not match expected row count or has PK NULLs."""
    full_table = f"`{project}.{dataset}.{staging_table}`"

    result = bq_client.query(f"SELECT COUNT(*) AS n FROM {full_table}").result()
    bq_count = next(iter(result))["n"]
    if bq_count != expected_rows:
        raise ValueError(
            f"{staging_table}: expected {expected_rows} rows in BQ staging, got {bq_count}"
        )

    null_result = bq_client.query(
        f"SELECT COUNT(*) AS n FROM {full_table} WHERE `{pk_field}` IS NULL"
    ).result()
    pk_nulls = next(iter(null_result))["n"]
    if pk_nulls > 0:
        raise ValueError(f"{staging_table}: {pk_nulls} NULL PKs in BQ staging")

    log.info("  [%s] BQ staging validated: %d rows, 0 PK NULLs", staging_table, bq_count)


# ──────────────────────────────────────────────────────────────────────────────
# BigQuery load: staging → swap
# ──────────────────────────────────────────────────────────────────────────────
def load_table_safe(
    bq_client,
    project: str,
    dataset: str,
    table_name: str,
    rows: list,
    schema: list,
    pk: str,
) -> int:
    """
    Safe full-refresh:
    1. Load to _staging table (WRITE_TRUNCATE)
    2. Validate staging
    3. Copy staging → final (WRITE_TRUNCATE)
    4. Delete staging
    Returns number of rows loaded.
    """
    staging_name = f"{table_name}_staging"
    dataset_ref  = f"{project}.{dataset}"
    staging_ref  = f"{dataset_ref}.{staging_name}"
    final_ref    = f"{dataset_ref}.{table_name}"

    # Step 1: Load to staging
    log.info("  [%s] loading %d rows to staging...", table_name, len(rows))
    job_config = bigquery.LoadJobConfig(
        schema=schema,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
    )
    job = bq_client.load_table_from_json(rows, staging_ref, job_config=job_config)
    job.result()
    if job.errors:
        raise RuntimeError(f"{table_name} staging load errors: {job.errors}")

    # Step 2: Validate staging
    validate_bq_staging(bq_client, project, dataset, staging_name, len(rows), pk)

    # Step 3: Copy staging → final (WRITE_TRUNCATE)
    log.info("  [%s] swapping staging → final...", table_name)
    copy_job_config = bigquery.CopyJobConfig(
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )
    copy_job = bq_client.copy_table(staging_ref, final_ref, job_config=copy_job_config)
    copy_job.result()
    if copy_job.errors:
        raise RuntimeError(f"{table_name} copy job errors: {copy_job.errors}")

    # Step 4: Delete staging
    bq_client.delete_table(staging_ref, not_found_ok=True)
    log.info("  [%s] staging deleted", table_name)

    return len(rows)


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────
def main() -> None:
    job_start = time.time()
    log.info("=== Supabase to BigQuery sync starting ===")
    log.info("UTC: %s", datetime.now(timezone.utc).isoformat())

    supabase_url     = os.environ["SUPABASE_URL"].rstrip("/")
    secret_name      = os.environ["SUPABASE_SECRET_NAME"]
    bq_project       = os.environ["BQ_PROJECT_ID"]
    bq_dataset       = os.environ.get("BQ_DATASET", "raw_supabase")

    log.info("BQ project=%s dataset=%s", bq_project, bq_dataset)

    log.info("Fetching Supabase service role key from Secret Manager...")
    service_role_key = get_secret(secret_name)
    log.info("Secret fetched OK")

    bq_client = bigquery.Client(project=bq_project)

    results = {}
    any_error = False

    for table_name, cfg in TABLE_CONFIG.items():
        t_start = time.time()
        log.info("--------------------------------------")
        log.info("[%s] starting extraction", table_name)

        try:
            rows = extract_table(
                supabase_url=supabase_url,
                service_role_key=service_role_key,
                table_name=table_name,
                columns=cfg["columns"],
                pk=cfg["pk"],
                filters=cfg.get("filters"),
            )
            supabase_count = len(rows)
            log.info("[%s] extracted %d rows from Supabase", table_name, supabase_count)

            validate_extraction(table_name, rows, cfg["pk"])

            bq_count = load_table_safe(
                bq_client=bq_client,
                project=bq_project,
                dataset=bq_dataset,
                table_name=table_name,
                rows=rows,
                schema=cfg["schema"],
                pk=cfg["pk"],
            )

            duration = round(time.time() - t_start, 1)
            log.info("[%s] SUCCESS supabase=%d bq=%d duration=%ss",
                     table_name, supabase_count, bq_count, duration)
            results[table_name] = {
                "status": "OK",
                "supabase_rows": supabase_count,
                "bq_rows": bq_count,
                "duration_s": duration,
            }

        except Exception as exc:
            duration = round(time.time() - t_start, 1)
            log.error("[%s] FAILED after %ss: %s", table_name, duration, exc, exc_info=True)
            results[table_name] = {"status": "ERROR", "error": str(exc), "duration_s": duration}
            any_error = True

    total_duration = round(time.time() - job_start, 1)
    log.info("======================================")
    log.info("SYNC SUMMARY total_duration=%ss", total_duration)
    for t, r in results.items():
        if r["status"] == "OK":
            log.info("  OK  %-28s supabase=%-5d bq=%-5d %ss",
                     t, r["supabase_rows"], r["bq_rows"], r["duration_s"])
        else:
            log.error("  ERR %-28s %s", t, r.get("error"))
    log.info("======================================")

    if any_error:
        log.error("One or more tables failed.")
        sys.exit(1)

    log.info("=== All tables synced successfully ===")


if __name__ == "__main__":
    main()
