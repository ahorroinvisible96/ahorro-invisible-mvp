-- 12 · Marts agregados de UX / Comportamiento PostHog + Impresiones (CERO user_id).
--   Explota el catálogo de 52 eventos PostHog (intenciones vs confirmaciones, drop-off, errores)
--   y las impresiones de pregunta diaria (fct_prompt_impression) para la página Negocio/UX de Looker.

CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_ux_intent_vs_confirmed_daily` AS
WITH ev AS (
  SELECT
    event_date AS date,
    COALESCE(surface, 'unspecified') AS surface,
    event,
    event_kind,
    error_code,
    step_number
  FROM `{{project}}.{{an}}.stg_events`
  WHERE NOT is_posthog_internal
)
SELECT
  date,
  surface,
  COUNT(*)                                                                            AS total_product_events,
  COUNTIF(event_kind = 'view')                                                        AS view_events,
  COUNTIF(event_kind = 'intent')                                                      AS intent_events,
  COUNTIF(event_kind = 'confirmed')                                                   AS confirmed_events,
  -- Conversión Intención → Confirmación por flujo clave
  COUNTIF(event = 'daily_answer_submitted')                                           AS daily_submitted,
  COUNTIF(event = 'daily_decision_confirmed')                                         AS daily_confirmed,
  SAFE_DIVIDE(COUNTIF(event = 'daily_decision_confirmed'), NULLIF(COUNTIF(event = 'daily_answer_submitted'), 0)) AS daily_confirm_rate,
  COUNTIF(event = 'extra_saving_submitted')                                           AS extra_submitted,
  COUNTIF(event = 'extra_saving_confirmed')                                           AS extra_confirmed,
  SAFE_DIVIDE(COUNTIF(event = 'extra_saving_confirmed'), NULLIF(COUNTIF(event = 'extra_saving_submitted'), 0)) AS extra_confirm_rate,
  COUNTIF(event = 'goal_create_submitted')                                            AS goal_create_submitted,
  COUNTIF(event = 'goal_created_confirmed')                                           AS goal_created_confirmed,
  COUNTIF(event = 'onboarding_submitted')                                             AS onboarding_submitted,
  COUNTIF(event = 'onboarding_completed_confirmed')                                   AS onboarding_confirmed,
  COUNTIF(event = 'daily_skipped')                                                    AS daily_skipped,
  COUNTIF(event IN ('signup_error', 'goal_create_error', 'extra_saving_error') OR error_code IS NOT NULL) AS client_errors
FROM ev
GROUP BY 1, 2;

-- Conversión de impresiones de pregunta diaria por fecha, franja horaria y superficie (CERO user_id).
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_ux_prompt_conversion_daily` AS
WITH imp AS (
  SELECT
    local_date AS date,
    time_slot,
    first_surface AS surface,
    COUNT(*)                                       AS prompt_impressions,
    COUNT(DISTINCT user_id)                        AS users_exposed,
    COUNTIF(did_convert)                           AS impressions_converted,
    COUNTIF(did_save)                              AS impressions_saved,
    SUM(converted_amount)                          AS converted_amount_eur
  FROM `{{project}}.{{an}}.fct_prompt_impression`
  GROUP BY 1, 2, 3
),
ph_views AS (
  SELECT
    event_date AS date,
    COUNT(*) AS posthog_daily_question_views
  FROM `{{project}}.{{an}}.stg_events`
  WHERE event = 'daily_question_viewed'
  GROUP BY 1
)
SELECT
  COALESCE(i.date, v.date)                         AS date,
  COALESCE(i.time_slot, 'posthog_only')            AS time_slot,
  COALESCE(i.surface, 'daily_page')                AS surface,
  IFNULL(i.prompt_impressions, 0)                  AS prompt_impressions,
  IFNULL(i.users_exposed, 0)                       AS users_exposed,
  IFNULL(i.impressions_converted, 0)               AS impressions_converted,
  IFNULL(i.impressions_saved, 0)                   AS impressions_saved,
  SAFE_DIVIDE(IFNULL(i.impressions_converted, 0), NULLIF(IFNULL(i.prompt_impressions, 0), 0)) AS impression_to_decision_rate,
  SAFE_DIVIDE(IFNULL(i.impressions_saved, 0), NULLIF(IFNULL(i.prompt_impressions, 0), 0))     AS impression_to_save_rate,
  IFNULL(i.converted_amount_eur, 0)                AS converted_amount_eur,
  IFNULL(v.posthog_daily_question_views, 0)        AS posthog_daily_question_views
FROM imp i
FULL OUTER JOIN ph_views v ON i.date = v.date;
