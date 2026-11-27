-- 01 · dim_user: una fila por usuario de auth (incluye internos, marcados con is_excluded).
--    cohort_date = LEAST(alta en auth, primera decisión/asiento). Algunos usuarios V1 tienen
--    decisiones con fecha anterior a su alta en auth (datos históricos del backfill).
CREATE OR REPLACE TABLE `{{project}}.{{an}}.dim_user` AS
WITH p AS (SELECT * FROM `{{project}}.{{an}}.params`),
first_act AS (
  SELECT
    user_id,
    MIN(d)  AS first_activity_date,
    MIN(ts) AS first_activity_at
  FROM (
    SELECT user_id, local_date AS d, occurred_at AS ts
    FROM `{{project}}.{{raw}}.daily_decisions`
    UNION ALL
    SELECT user_id, local_date AS d, occurred_at AS ts
    FROM `{{project}}.{{raw}}.savings_transactions`
    WHERE transaction_type <> 'migration_opening_balance'
  )
  GROUP BY user_id
),
inc AS (
  SELECT
    user_id,
    ARRAY_AGG(STRUCT(income_band_code, band_catalog_version) ORDER BY declared_at DESC LIMIT 1)[OFFSET(0)] AS last
  FROM `{{project}}.{{raw}}.income_declarations`
  GROUP BY user_id
),
onb AS (
  SELECT
    user_id,
    MIN(completed_at) AS onboarding_completed_at,
    ARRAY_AGG(
      STRUCT(savings_habit, warning_shown, recommended_monthly_amount, recommended_target_amount, chosen_target_amount, chosen_horizon_months)
      ORDER BY completed_at DESC LIMIT 1
    )[SAFE_OFFSET(0)] AS last
  FROM `{{project}}.{{raw}}.onboarding_sessions`
  WHERE completed_at IS NOT NULL
  GROUP BY user_id
),
av AS (
  SELECT
    user_id,
    ARRAY_AGG(result_avatar ORDER BY completed_at DESC LIMIT 1)[OFFSET(0)] AS avatar
  FROM `{{project}}.{{raw}}.avatar_assessments`
  GROUP BY user_id
)
SELECT
  a.user_id,
  a.created_at                                                                                         AS signup_at,
  DATE(a.created_at, p.tz)                                                                             AS signup_date,
  fa.first_activity_at,
  LEAST(a.created_at, IFNULL(fa.first_activity_at, a.created_at))                                      AS effective_cohort_at,
  LEAST(DATE(a.created_at, p.tz), IFNULL(fa.first_activity_date, DATE(a.created_at, p.tz)))            AS cohort_date,
  DATE_TRUNC(LEAST(DATE(a.created_at, p.tz), IFNULL(fa.first_activity_date, DATE(a.created_at, p.tz))), WEEK(MONDAY)) AS cohort_week,
  DATE_TRUNC(LEAST(DATE(a.created_at, p.tz), IFNULL(fa.first_activity_date, DATE(a.created_at, p.tz))), MONTH)        AS cohort_month,
  IF(LEAST(DATE(a.created_at, p.tz), IFNULL(fa.first_activity_date, DATE(a.created_at, p.tz))) >= p.v2_cutover_date,
     'v2_native', 'v1_migrated')                                                                       AS acquisition_era,
  a.last_sign_in_at,
  a.email_confirmed,
  a.is_internal,
  a.is_suspected_test,
  (a.is_internal OR a.is_suspected_test)                                                               AS is_excluded,
  up.money_feeling,
  COALESCE(onb.onboarding_completed_at, up.onboarding_completed_at)                                    AS onboarding_completed_at,
  onb.last.savings_habit                                                                               AS savings_habit,
  onb.last.warning_shown                                                                               AS onboarding_warning_shown,
  onb.last.recommended_monthly_amount                                                                  AS onboarding_rec_monthly,
  onb.last.chosen_target_amount                                                                        AS onboarding_chosen_target,
  av.avatar,
  COALESCE(inc.last.income_band_code, 'sin_declarar')                                                  AS income_band,
  b.reference_income_amount                                                                            AS income_reference_monthly,
  COALESCE(inc.last.income_band_code, 'sin_declarar') IN ('lt_1000', 'gt_3000')                        AS income_band_is_capped,
  up.id IS NOT NULL                                                                                    AS has_profile
FROM `{{project}}.{{raw}}.auth_users` a
CROSS JOIN p
LEFT JOIN `{{project}}.{{raw}}.user_profiles` up ON up.id = a.user_id
LEFT JOIN inc USING (user_id)
LEFT JOIN onb USING (user_id)
LEFT JOIN av  USING (user_id)
LEFT JOIN first_act fa ON fa.user_id = a.user_id
LEFT JOIN `{{project}}.{{raw}}.cat_income_bands` b
  ON b.band_code = inc.last.income_band_code AND b.catalog_version = inc.last.band_catalog_version;
