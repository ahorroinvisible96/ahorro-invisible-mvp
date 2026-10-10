-- 09 · mart_goals: estado y progreso de objetivos V2 (saldo desde el ledger, no de columnas V1).
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_goals` AS
WITH bal AS (
  SELECT goal_id, user_id, SUM(amount) AS balance
  FROM `{{project}}.{{an}}.fct_ledger` WHERE bucket_type = 'goal' AND goal_id IS NOT NULL GROUP BY 1, 2
),
ev AS (
  SELECT goal_id,
    MIN(IF(event_type = 'created', occurred_at, NULL))   AS created_at_event,
    MIN(IF(event_type = 'completed', occurred_at, NULL)) AS completed_at_event
  FROM `{{project}}.{{raw}}.goal_events` GROUP BY 1
)
SELECT
  g.id AS goal_id, g.user_id, u.cohort_month, u.income_band,
  g.status, g.is_primary, g.target_amount, g.horizon_months,
  IFNULL(b.balance, 0)                                       AS balance,
  LEAST(SAFE_DIVIDE(IFNULL(b.balance, 0), g.target_amount), 1) AS progress_pct,
  COALESCE(ev.created_at_event, g.created_at)                AS created_at,
  COALESCE(ev.completed_at_event, g.first_completed_at)      AS completed_at,
  COALESCE(ev.completed_at_event, g.first_completed_at) IS NOT NULL OR IFNULL(b.balance, 0) >= g.target_amount AS is_completed,
  TIMESTAMP_DIFF(COALESCE(ev.completed_at_event, g.first_completed_at), COALESCE(ev.created_at_event, g.created_at), DAY) AS days_to_complete,
  g.data_origin
FROM `{{project}}.{{raw}}.goals` g
JOIN `{{project}}.{{an}}.dim_user` u ON u.user_id = g.user_id AND NOT u.is_excluded
LEFT JOIN bal b ON b.goal_id = g.id AND b.user_id = g.user_id
LEFT JOIN ev ON ev.goal_id = g.id
WHERE g.status <> 'deleted';
