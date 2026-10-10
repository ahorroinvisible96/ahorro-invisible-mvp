-- 06 · mart_funnel_user: embudo de activación por usuario real.
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_funnel_user` AS
WITH p AS (SELECT * FROM `{{project}}.{{an}}.params`),
u AS (SELECT * FROM `{{project}}.{{an}}.dim_user` WHERE NOT is_excluded),
fg AS (SELECT user_id, MIN(occurred_at) AS first_goal_at FROM `{{project}}.{{raw}}.goal_events` WHERE event_type = 'created' GROUP BY 1),
fd AS (SELECT user_id, MIN(occurred_at) AS first_decision_at FROM `{{project}}.{{an}}.fct_decision` GROUP BY 1),
fs AS (SELECT user_id, MIN(occurred_at) AS first_saving_at FROM `{{project}}.{{an}}.fct_ledger`
       WHERE transaction_type IN ('daily_saving', 'extra_saving') GROUP BY 1),
sd AS (SELECT user_id, COUNT(DISTINCT date) AS saving_days FROM `{{project}}.{{an}}.fct_user_day` WHERE is_saving_day GROUP BY 1)
SELECT
  u.user_id, u.cohort_date, u.cohort_week, u.cohort_month, u.income_band, u.signup_at,
  u.onboarding_completed_at, fg.first_goal_at, fd.first_decision_at, fs.first_saving_at,
  TRUE                                         AS step_1_signup,
  -- V1 casi nunca guardó onboarding_completed_at; el onboarding termina creando el primer objetivo,
  -- así que tener objetivo implica onboarding completado.
  (u.onboarding_completed_at IS NOT NULL OR fg.first_goal_at IS NOT NULL) AS step_2_onboarding,
  fg.first_goal_at IS NOT NULL                 AS step_3_first_goal,
  fs.first_saving_at IS NOT NULL               AS step_4_first_saving,
  IFNULL(sd.saving_days, 0) >= 3               AS step_5_habit_3_days,
  fs.first_saving_at IS NOT NULL
    AND TIMESTAMP_DIFF(fs.first_saving_at, u.signup_at, HOUR) <= 24 * p.activation_window_days AS activated_7d,
  TIMESTAMP_DIFF(fs.first_saving_at, u.signup_at, HOUR) / 24.0 AS days_to_first_saving
FROM u CROSS JOIN p
LEFT JOIN fg USING (user_id) LEFT JOIN fd USING (user_id) LEFT JOIN fs USING (user_id) LEFT JOIN sd USING (user_id);

-- Resumen del embudo (una fila por paso) para Looker.
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_funnel` AS
WITH f AS (SELECT * FROM `{{project}}.{{an}}.mart_funnel_user`),
steps AS (
  SELECT 1 AS step, 'Registro' AS step_name, COUNTIF(step_1_signup) AS users FROM f UNION ALL
  SELECT 2, 'Onboarding completado', COUNTIF(step_2_onboarding) FROM f UNION ALL
  SELECT 3, 'Primer objetivo', COUNTIF(step_3_first_goal) FROM f UNION ALL
  SELECT 4, 'Primer ahorro', COUNTIF(step_4_first_saving) FROM f UNION ALL
  SELECT 5, 'Hábito (≥3 días con ahorro)', COUNTIF(step_5_habit_3_days) FROM f
)
SELECT step, step_name, users,
  SAFE_DIVIDE(users, FIRST_VALUE(users) OVER (ORDER BY step)) AS conversion_from_signup,
  SAFE_DIVIDE(users, LAG(users) OVER (ORDER BY step))         AS conversion_from_previous
FROM steps;
