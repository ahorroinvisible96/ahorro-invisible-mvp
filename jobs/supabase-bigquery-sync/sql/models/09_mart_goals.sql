-- 09 · mart_goals (USO INTERNO · contiene user_id) y mart_goals_summary (AGREGADO sin user_id para Looker).
--   Separa claramente was_ever_completed (hito alcanzado históricamente) de is_currently_at_target (saldo actual >= meta).
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_goals` AS
WITH bal AS (
  SELECT goal_id, user_id, SUM(amount) AS balance
  FROM `{{project}}.{{an}}.fct_ledger`
  WHERE bucket_type = 'goal' AND goal_id IS NOT NULL
  GROUP BY 1, 2
),
ev AS (
  SELECT
    goal_id,
    MIN(IF(event_type = 'created', occurred_at, NULL))   AS created_at_event,
    MIN(IF(event_type = 'completed', occurred_at, NULL)) AS completed_at_event
  FROM `{{project}}.{{raw}}.goal_events`
  GROUP BY 1
)
SELECT
  g.id                                                                 AS goal_id,
  g.user_id,
  u.cohort_month,
  u.income_band,
  u.acquisition_era,
  g.status,
  g.is_primary,
  g.target_amount,
  g.horizon_months,
  CASE
    WHEN g.horizon_months <= 3 THEN 'short_1_3m'
    WHEN g.horizon_months <= 6 THEN 'medium_4_6m'
    ELSE 'long_7_12m_plus'
  END                                                                  AS horizon_bucket,
  IFNULL(b.balance, 0)                                                 AS balance,
  LEAST(GREATEST(SAFE_DIVIDE(IFNULL(b.balance, 0), g.target_amount), 0), 1) AS progress_pct,
  COALESCE(ev.created_at_event, g.created_at)                          AS created_at,
  COALESCE(ev.completed_at_event, g.first_completed_at)                AS completed_at,
  COALESCE(ev.completed_at_event, g.first_completed_at) IS NOT NULL    AS was_ever_completed,
  (IFNULL(b.balance, 0) >= g.target_amount AND g.target_amount > 0)    AS is_currently_at_target,
  (COALESCE(ev.completed_at_event, g.first_completed_at) IS NOT NULL
    OR (IFNULL(b.balance, 0) >= g.target_amount AND g.target_amount > 0)) AS is_completed,
  IF(COALESCE(ev.completed_at_event, g.first_completed_at) IS NULL, NULL,
     GREATEST(0, TIMESTAMP_DIFF(COALESCE(ev.completed_at_event, g.first_completed_at),
                                COALESCE(ev.created_at_event, g.created_at), DAY))) AS days_to_complete,
  g.data_origin
FROM `{{project}}.{{raw}}.goals` g
JOIN `{{project}}.{{an}}.dim_user` u ON u.user_id = g.user_id AND NOT u.is_excluded
LEFT JOIN bal b ON b.goal_id = g.id AND b.user_id = g.user_id
LEFT JOIN ev ON ev.goal_id = g.id
WHERE g.status <> 'deleted';

-- Resumen agregado de objetivos para Looker interno (CERO user_id, CERO goal_id).
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_goals_summary` AS
SELECT
  status,
  horizon_bucket,
  data_origin,
  COUNT(*)                                                             AS goals_count,
  COUNT(DISTINCT user_id)                                              AS distinct_users,
  COUNTIF(is_primary)                                                  AS primary_goals_count,
  COUNTIF(was_ever_completed)                                          AS goals_ever_completed,
  COUNTIF(is_currently_at_target)                                      AS goals_currently_at_target,
  SUM(target_amount)                                                   AS total_target_amount,
  SUM(balance)                                                         AS total_balance,
  AVG(target_amount)                                                   AS avg_target_amount,
  APPROX_QUANTILES(target_amount, 2)[SAFE_OFFSET(1)]                   AS median_target_amount,
  AVG(progress_pct)                                                    AS avg_progress_pct,
  APPROX_QUANTILES(progress_pct, 2)[SAFE_OFFSET(1)]                    AS median_progress_pct,
  APPROX_QUANTILES(days_to_complete, 2)[SAFE_OFFSET(1)]                AS median_days_to_complete
FROM `{{project}}.{{an}}.mart_goals`
GROUP BY 1, 2, 3;
