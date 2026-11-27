-- 06 · mart_funnel_user, mart_funnel y mart_funnel_by_era: embudo de activación limpio.
--   Corrige los días negativos del backfill V1 (usa effective_cohort_at y marca is_clean_signup_timing)
--   y renombra el paso 5 con honestidad: "Ahorrador repetido (≥3 días acumulados)" (no "Hábito").
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_funnel_user` AS
WITH p AS (SELECT * FROM `{{project}}.{{an}}.params`),
u AS (SELECT * FROM `{{project}}.{{an}}.dim_user` WHERE NOT is_excluded),
fg AS (
  SELECT user_id, MIN(occurred_at) AS first_goal_at
  FROM `{{project}}.{{raw}}.goal_events`
  WHERE event_type = 'created'
  GROUP BY 1
),
fd AS (
  SELECT user_id, MIN(occurred_at) AS first_decision_at
  FROM `{{project}}.{{an}}.fct_decision`
  WHERE is_active
  GROUP BY 1
),
fs AS (
  SELECT user_id, MIN(occurred_at) AS first_saving_at
  FROM `{{project}}.{{an}}.fct_ledger`
  WHERE transaction_type IN ('daily_saving', 'extra_saving')
  GROUP BY 1
),
sd AS (
  SELECT user_id, COUNT(DISTINCT date) AS saving_days
  FROM `{{project}}.{{an}}.fct_user_day`
  WHERE is_saving_day
  GROUP BY 1
)
SELECT
  u.user_id,
  u.acquisition_era,
  u.cohort_date,
  u.cohort_week,
  u.cohort_month,
  u.income_band,
  u.signup_at,
  u.effective_cohort_at,
  u.onboarding_completed_at,
  fg.first_goal_at,
  fd.first_decision_at,
  fs.first_saving_at,
  TRUE                                                                          AS step_1_signup,
  -- V1 casi nunca guardó onboarding_completed_at; el onboarding termina creando el primer objetivo.
  (u.onboarding_completed_at IS NOT NULL OR fg.first_goal_at IS NOT NULL)       AS step_2_onboarding,
  fg.first_goal_at IS NOT NULL                                                  AS step_3_first_goal,
  fs.first_saving_at IS NOT NULL                                                AS step_4_first_saving,
  IFNULL(sd.saving_days, 0) >= 3                                                AS step_5_repeat_saver_3_days,
  IFNULL(sd.saving_days, 0) >= 3                                                AS step_5_habit_3_days,
  -- Tiempos limpios (nunca negativos por backfill anterior al alta en auth)
  (fs.first_saving_at IS NOT NULL AND fs.first_saving_at >= u.signup_at)        AS is_clean_signup_timing,
  fs.first_saving_at IS NOT NULL
    AND TIMESTAMP_DIFF(fs.first_saving_at, u.effective_cohort_at, HOUR) BETWEEN 0 AND 24 * p.activation_window_days
                                                                                AS activated_7d,
  fs.first_saving_at IS NOT NULL
    AND fs.first_saving_at >= u.signup_at
    AND TIMESTAMP_DIFF(fs.first_saving_at, u.signup_at, HOUR) <= 24 * p.activation_window_days
                                                                                AS activated_7d_clean,
  IF(fs.first_saving_at IS NULL, NULL,
     GREATEST(0.0, TIMESTAMP_DIFF(fs.first_saving_at, u.effective_cohort_at, HOUR) / 24.0)) AS days_to_first_saving,
  IF(fs.first_saving_at IS NULL OR fs.first_saving_at < u.signup_at, NULL,
     TIMESTAMP_DIFF(fs.first_saving_at, u.signup_at, HOUR) / 24.0)              AS days_to_first_saving_clean
FROM u
CROSS JOIN p
LEFT JOIN fg USING (user_id)
LEFT JOIN fd USING (user_id)
LEFT JOIN fs USING (user_id)
LEFT JOIN sd USING (user_id);

-- Resumen del embudo total (una fila por paso) para Looker.
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_funnel` AS
WITH f AS (SELECT * FROM `{{project}}.{{an}}.mart_funnel_user`),
steps AS (
  SELECT 1 AS step, 'Registro'                                 AS step_name, COUNTIF(step_1_signup)              AS users FROM f UNION ALL
  SELECT 2,         'Onboarding completado',                                 COUNTIF(step_2_onboarding)                   FROM f UNION ALL
  SELECT 3,         'Primer objetivo',                                       COUNTIF(step_3_first_goal)                   FROM f UNION ALL
  SELECT 4,         'Primer ahorro',                                         COUNTIF(step_4_first_saving)                 FROM f UNION ALL
  SELECT 5,         'Ahorrador repetido (≥3 días acumulados)',               COUNTIF(step_5_repeat_saver_3_days)          FROM f
)
SELECT
  step,
  step_name,
  users,
  SAFE_DIVIDE(users, FIRST_VALUE(users) OVER (ORDER BY step)) AS conversion_from_signup,
  SAFE_DIVIDE(users, LAG(users) OVER (ORDER BY step))         AS conversion_from_previous
FROM steps;

-- Embudo segmentado por era (all | v1_migrated | v2_native) para separar cohortes V2 limpias.
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_funnel_by_era` AS
WITH f_eras AS (
  SELECT acquisition_era AS era, * FROM `{{project}}.{{an}}.mart_funnel_user`
  UNION ALL
  SELECT 'all' AS era, * FROM `{{project}}.{{an}}.mart_funnel_user`
),
steps AS (
  SELECT era, 1 AS step, 'Registro'                                 AS step_name, COUNTIF(step_1_signup)              AS users FROM f_eras GROUP BY 1 UNION ALL
  SELECT era, 2,         'Onboarding completado',                                 COUNTIF(step_2_onboarding)                   FROM f_eras GROUP BY 1 UNION ALL
  SELECT era, 3,         'Primer objetivo',                                       COUNTIF(step_3_first_goal)                   FROM f_eras GROUP BY 1 UNION ALL
  SELECT era, 4,         'Primer ahorro',                                         COUNTIF(step_4_first_saving)                 FROM f_eras GROUP BY 1 UNION ALL
  SELECT era, 5,         'Ahorrador repetido (≥3 días acumulados)',               COUNTIF(step_5_repeat_saver_3_days)          FROM f_eras GROUP BY 1
)
SELECT
  era,
  step,
  step_name,
  users,
  SAFE_DIVIDE(users, FIRST_VALUE(users) OVER (PARTITION BY era ORDER BY step)) AS conversion_from_signup,
  SAFE_DIVIDE(users, LAG(users) OVER (PARTITION BY era ORDER BY step))         AS conversion_from_previous
FROM steps;
