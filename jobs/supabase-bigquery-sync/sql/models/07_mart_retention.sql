-- 07 · mart_cohort_retention y mart_retention_dn: retención DUAL (App vs Financiera vs Ahorro).
--   Separa retención de abrir la app (PostHog desde 2026-09-26) de retención financiera real
--   (decisiones/asientos en Supabase, continua desde el día 1) y retención de día con ahorro.
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_cohort_retention` AS
WITH u AS (
  SELECT user_id, cohort_week
  FROM `{{project}}.{{an}}.dim_user`
  WHERE NOT is_excluded
),
size AS (
  SELECT cohort_week, COUNT(*) AS cohort_size
  FROM u
  GROUP BY 1
),
act AS (
  SELECT
    u.cohort_week,
    d.user_id,
    DATE_DIFF(DATE_TRUNC(d.date, WEEK(MONDAY)), u.cohort_week, WEEK) AS week_n,
    LOGICAL_OR(d.is_app_active)       AS app_active,
    LOGICAL_OR(d.is_financial_active) AS financial_active,
    LOGICAL_OR(d.is_saving_day)       AS saving_active
  FROM `{{project}}.{{an}}.fct_user_day` d
  JOIN u USING (user_id)
  WHERE d.is_app_active OR d.is_financial_active OR d.is_saving_day
  GROUP BY 1, 2, 3
),
grid AS (
  SELECT s.cohort_week, s.cohort_size, n AS week_n
  FROM size s,
       UNNEST(GENERATE_ARRAY(0, DATE_DIFF(DATE_TRUNC(CURRENT_DATE('Europe/Madrid'), WEEK(MONDAY)), s.cohort_week, WEEK))) n
)
SELECT
  g.cohort_week,
  g.cohort_size,
  g.week_n,
  COUNT(DISTINCT IF(a.app_active, a.user_id, NULL))                                    AS active_users,
  SAFE_DIVIDE(COUNT(DISTINCT IF(a.app_active, a.user_id, NULL)), g.cohort_size)        AS retention_rate,
  COUNT(DISTINCT IF(a.financial_active, a.user_id, NULL))                              AS financial_active_users,
  SAFE_DIVIDE(COUNT(DISTINCT IF(a.financial_active, a.user_id, NULL)), g.cohort_size)  AS financial_retention_rate,
  COUNT(DISTINCT IF(a.saving_active, a.user_id, NULL))                                 AS saving_users,
  SAFE_DIVIDE(COUNT(DISTINCT IF(a.saving_active, a.user_id, NULL)), g.cohort_size)     AS saving_retention_rate
FROM grid g
LEFT JOIN act a ON a.cohort_week = g.cohort_week AND a.week_n = g.week_n
GROUP BY 1, 2, 3;

-- Retención D1 / D7 / D30 (día exacto + ventana móvil: D1=[1..3], D7=[7..13], D30=[30..36]).
-- Solo cohortes ya observables (< hoy).
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_retention_dn` AS
WITH u AS (
  SELECT user_id, cohort_date
  FROM `{{project}}.{{an}}.dim_user`
  WHERE NOT is_excluded
),
a AS (
  SELECT user_id, date, is_app_active, is_financial_active, is_saving_day
  FROM `{{project}}.{{an}}.fct_user_day`
),
specs AS (
  SELECT 1 AS dn, 3 AS dn_end UNION ALL
  SELECT 7, 13 UNION ALL
  SELECT 30, 36
),
exact_hits AS (
  SELECT
    s.dn,
    u.user_id,
    (DATE_ADD(u.cohort_date, INTERVAL s.dn DAY) < CURRENT_DATE('Europe/Madrid')) AS is_eligible,
    IFNULL(a.is_app_active, FALSE)       AS app_hit,
    IFNULL(a.is_financial_active, FALSE) AS fin_hit,
    IFNULL(a.is_saving_day, FALSE)       AS sav_hit
  FROM specs s
  CROSS JOIN u
  LEFT JOIN a ON a.user_id = u.user_id AND a.date = DATE_ADD(u.cohort_date, INTERVAL s.dn DAY)
),
window_hits AS (
  SELECT
    s.dn,
    u.user_id,
    (DATE_ADD(u.cohort_date, INTERVAL s.dn_end DAY) < CURRENT_DATE('Europe/Madrid')) AS is_window_eligible,
    IFNULL(LOGICAL_OR(a.is_app_active), FALSE)       AS app_win_hit,
    IFNULL(LOGICAL_OR(a.is_financial_active), FALSE) AS fin_win_hit,
    IFNULL(LOGICAL_OR(a.is_saving_day), FALSE)       AS sav_win_hit
  FROM specs s
  CROSS JOIN u
  LEFT JOIN a
    ON a.user_id = u.user_id
   AND a.date BETWEEN DATE_ADD(u.cohort_date, INTERVAL s.dn DAY) AND DATE_ADD(u.cohort_date, INTERVAL s.dn_end DAY)
  GROUP BY 1, 2, 3
),
e_agg AS (
  SELECT
    dn,
    COUNTIF(is_eligible)                  AS eligible_users,
    COUNTIF(is_eligible AND app_hit)      AS retained_users,
    COUNTIF(is_eligible AND fin_hit)      AS financial_retained_users,
    COUNTIF(is_eligible AND sav_hit)      AS saving_retained_users
  FROM exact_hits
  GROUP BY 1
),
w_agg AS (
  SELECT
    dn,
    COUNTIF(is_window_eligible)                  AS eligible_window_users,
    COUNTIF(is_window_eligible AND app_win_hit)  AS retained_window_users,
    COUNTIF(is_window_eligible AND fin_win_hit)  AS financial_retained_window_users,
    COUNTIF(is_window_eligible AND sav_win_hit)  AS saving_retained_window_users
  FROM window_hits
  GROUP BY 1
)
SELECT
  e.dn,
  e.eligible_users,
  e.retained_users,
  SAFE_DIVIDE(e.retained_users, e.eligible_users)                         AS retention_rate,
  e.financial_retained_users,
  SAFE_DIVIDE(e.financial_retained_users, e.eligible_users)               AS financial_retention_rate,
  e.saving_retained_users,
  SAFE_DIVIDE(e.saving_retained_users, e.eligible_users)                  AS saving_retention_rate,
  w.eligible_window_users,
  w.retained_window_users,
  SAFE_DIVIDE(w.retained_window_users, w.eligible_window_users)           AS retention_window_rate,
  w.financial_retained_window_users,
  SAFE_DIVIDE(w.financial_retained_window_users, w.eligible_window_users) AS financial_retention_window_rate,
  w.saving_retained_window_users,
  SAFE_DIVIDE(w.saving_retained_window_users, w.eligible_window_users)    AS saving_retention_window_rate
FROM e_agg e
JOIN w_agg w USING (dn);
