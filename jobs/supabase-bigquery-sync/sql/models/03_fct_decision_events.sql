-- 03 · fct_decision (decisiones diarias activas y anuladas) y stg_events (PostHog limpio).
CREATE OR REPLACE TABLE `{{project}}.{{an}}.fct_decision` AS
SELECT d.decision_id, d.user_id, d.local_date, d.occurred_at, d.outcome, d.status, d.status = 'active' AS is_active,
  d.question_id, d.selected_option_key, d.declared_amount, d.goal_id, d.surface, d.void_reason, d.data_origin,
  d.data_origin = 'v2_live' AS is_v2_live
FROM `{{project}}.{{raw}}.daily_decisions` d
JOIN `{{project}}.{{an}}.dim_user` u ON u.user_id = d.user_id AND NOT u.is_excluded;

CREATE OR REPLACE TABLE `{{project}}.{{an}}.stg_events`
PARTITION BY event_date AS
WITH e AS (
  SELECT
    uuid AS event_id, event, timestamp AS event_ts,
    COALESCE(
      JSON_VALUE(properties, '$.supabase_user_id'),
      JSON_VALUE(properties, '$.user_id'),
      IF(REGEXP_CONTAINS(distinct_id, r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'), distinct_id, NULL)
    ) AS user_id,
    JSON_VALUE(properties, '$.app_version')  AS app_version,
    JSON_VALUE(properties, '$.screen_name')  AS screen_name,
    JSON_VALUE(properties, '$.surface')      AS surface,
    COALESCE(JSON_VALUE(properties, '$."$session_id"'), JSON_VALUE(properties, '$.session_id')) AS session_id,
    SAFE_CAST(JSON_VALUE(properties, '$.schema_version') AS INT64) AS schema_version,
    JSON_VALUE(properties, '$.decision_id')     AS decision_id,
    JSON_VALUE(properties, '$.transaction_id')  AS transaction_id,
    SAFE_CAST(JSON_VALUE(properties, '$.amount') AS NUMERIC) AS amount
  FROM `{{project}}.{{ph}}.events`
)
SELECT e.*, DATE(e.event_ts, 'Europe/Madrid') AS event_date,
  ENDS_WITH(e.event, '_confirmed') AS is_server_confirmed,
  STARTS_WITH(e.event, '$') AS is_posthog_internal
FROM e
LEFT JOIN `{{project}}.{{an}}.dim_user` u USING (user_id)
WHERE e.user_id IS NULL OR u.user_id IS NULL OR NOT u.is_excluded;
