-- 03 · fct_decision, fct_prompt_impression y stg_events (PostHog deduplicado y tipado).
CREATE OR REPLACE TABLE `{{project}}.{{an}}.fct_decision` AS
SELECT
  d.decision_id, d.user_id, d.local_date, d.occurred_at, d.outcome, d.status,
  d.status = 'active' AS is_active,
  d.question_bank_version, d.question_id, d.selected_option_key, d.has_custom_text,
  d.declared_amount, d.goal_id, d.impression_id, d.surface, d.void_reason, d.data_origin,
  d.data_origin = 'v2_live' AS is_v2_live
FROM `{{project}}.{{raw}}.daily_decisions` d
JOIN `{{project}}.{{an}}.dim_user` u ON u.user_id = d.user_id AND NOT u.is_excluded;

-- Impresiones de pregunta diaria (usuarios reales), enlazadas con su decisión activa si convirtió.
CREATE OR REPLACE TABLE `{{project}}.{{an}}.fct_prompt_impression` AS
WITH dec_by_imp AS (
  SELECT
    impression_id,
    decision_id,
    outcome,
    declared_amount
  FROM `{{project}}.{{an}}.fct_decision`
  WHERE is_active AND impression_id IS NOT NULL
  QUALIFY ROW_NUMBER() OVER (PARTITION BY impression_id ORDER BY occurred_at DESC) = 1
),
dec_by_day_q AS (
  SELECT
    user_id,
    local_date,
    question_id,
    decision_id,
    outcome,
    declared_amount
  FROM `{{project}}.{{an}}.fct_decision`
  WHERE is_active
  QUALIFY ROW_NUMBER() OVER (PARTITION BY user_id, local_date, question_id ORDER BY occurred_at DESC) = 1
)
SELECT
  i.impression_id,
  i.user_id,
  i.local_date,
  i.shown_at,
  i.question_bank_version,
  i.question_id,
  i.avatar_used,
  i.time_slot,
  i.selection_reason,
  i.replaces_impression_id,
  i.first_surface,
  i.data_origin,
  COALESCE(di.decision_id, dq.decision_id)                       AS converted_decision_id,
  COALESCE(di.decision_id, dq.decision_id) IS NOT NULL           AS did_convert,
  COALESCE(di.outcome, dq.outcome) = 'saved'                     AS did_save,
  IFNULL(COALESCE(di.declared_amount, dq.declared_amount), 0)    AS converted_amount
FROM `{{project}}.{{raw}}.daily_prompt_impressions` i
JOIN `{{project}}.{{an}}.dim_user` u ON u.user_id = i.user_id AND NOT u.is_excluded
LEFT JOIN dec_by_imp di ON di.impression_id = i.impression_id
LEFT JOIN dec_by_day_q dq
  ON di.decision_id IS NULL
 AND dq.user_id = i.user_id
 AND dq.local_date = i.local_date
 AND dq.question_id = i.question_id;

-- PostHog limpio: deduplicado por UUID (PostHog batch export es at-least-once) y con propiedades tipadas.
CREATE OR REPLACE TABLE `{{project}}.{{an}}.stg_events`
PARTITION BY event_date AS
WITH dedup_raw AS (
  SELECT
    COALESCE(
      NULLIF(uuid, ''),
      CONCAT(event, '|', CAST(timestamp AS STRING), '|', IFNULL(distinct_id, ''))
    ) AS event_id,
    event,
    timestamp AS event_ts,
    distinct_id,
    properties
  FROM `{{project}}.{{ph}}.events`
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY COALESCE(
      NULLIF(uuid, ''),
      CONCAT(event, '|', CAST(timestamp AS STRING), '|', IFNULL(distinct_id, ''))
    )
    ORDER BY timestamp ASC
  ) = 1
),
e AS (
  SELECT
    event_id,
    event,
    event_ts,
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
    JSON_VALUE(properties, '$.goal_id')         AS goal_id,
    JSON_VALUE(properties, '$.question_id')     AS question_id,
    JSON_VALUE(properties, '$.option_key')      AS option_key,
    JSON_VALUE(properties, '$.outcome')         AS outcome,
    JSON_VALUE(properties, '$.error_code')      AS error_code,
    SAFE_CAST(JSON_VALUE(properties, '$.step_number') AS INT64) AS step_number,
    JSON_VALUE(properties, '$.income_band')     AS income_band,
    JSON_VALUE(properties, '$.savings_habit')   AS savings_habit,
    JSON_VALUE(properties, '$.destination_type') AS destination_type,
    JSON_VALUE(properties, '$.daily_status')    AS daily_status,
    SAFE_CAST(JSON_VALUE(properties, '$.amount') AS NUMERIC) AS amount,
    JSON_VALUE(properties, '$.command_id')      AS command_id,
    IFNULL(SAFE_CAST(JSON_VALUE(properties, '$.is_internal') AS BOOL), FALSE) AS client_is_internal,
    (JSON_VALUE(properties, '$."$geoip_country_code"') IS NOT NULL
      OR JSON_VALUE(properties, '$."$ip"') IS NOT NULL) AS has_geoip_or_ip
  FROM dedup_raw
)
SELECT
  e.*,
  DATE(e.event_ts, 'Europe/Madrid') AS event_date,
  ENDS_WITH(e.event, '_confirmed')  AS is_server_confirmed,
  STARTS_WITH(e.event, '$')         AS is_posthog_internal,
  CASE
    WHEN STARTS_WITH(e.event, '$') THEN 'posthog_internal'
    WHEN ENDS_WITH(e.event, '_confirmed') THEN 'confirmed'
    WHEN ENDS_WITH(e.event, '_viewed') THEN 'view'
    WHEN e.event IN ('signup_started', 'signup_success', 'signup_error', 'logout_clicked', 'logout_success') THEN 'auth'
    WHEN ENDS_WITH(e.event, '_submitted')
      OR ENDS_WITH(e.event, '_started')
      OR ENDS_WITH(e.event, '_clicked')
      OR ENDS_WITH(e.event, '_answered')
      OR ENDS_WITH(e.event, '_error')
      OR ENDS_WITH(e.event, '_skipped')
      OR ENDS_WITH(e.event, '_changed')
      OR ENDS_WITH(e.event, '_opened')
      OR ENDS_WITH(e.event, '_updated')
      OR ENDS_WITH(e.event, '_reset') THEN 'intent'
    ELSE 'legacy_or_other'
  END AS event_kind
FROM e
LEFT JOIN `{{project}}.{{an}}.dim_user` u USING (user_id)
WHERE NOT e.client_is_internal
  AND (e.user_id IS NULL OR u.user_id IS NULL OR NOT u.is_excluded);
