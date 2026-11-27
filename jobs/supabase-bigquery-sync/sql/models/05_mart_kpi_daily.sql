-- 05 · mart_kpi_daily: serie diaria de KPIs de producto y ahorro (usuarios reales).
--   Separa actividad de App vs actividad Financiera, distingue Ahorradores 30d (≥1d) de MFEU real (≥2d/30d)
--   y Hábito Activo (≥3 de las últimas 4 semanas), y no suma el saldo migrado V1 antes del cutover.
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_kpi_daily` AS
WITH p AS (SELECT * FROM `{{project}}.{{an}}.params`),
users AS (SELECT * FROM `{{project}}.{{an}}.dim_user` WHERE NOT is_excluded),
bounds AS (
  SELECT
    LEAST(
      IFNULL((SELECT MIN(cohort_date) FROM users), CURRENT_DATE('Europe/Madrid')),
      IFNULL((SELECT MIN(date) FROM `{{project}}.{{an}}.fct_user_day`), CURRENT_DATE('Europe/Madrid'))
    ) AS d0,
    CURRENT_DATE('Europe/Madrid') AS d1
),
days AS (SELECT d AS date FROM bounds, UNNEST(GENERATE_DATE_ARRAY(bounds.d0, bounds.d1)) d),
ud AS (SELECT * FROM `{{project}}.{{an}}.fct_user_day`),
reg AS (
  SELECT
    cohort_date AS date,
    COUNT(*) AS new_users,
    COUNTIF(acquisition_era = 'v2_native') AS new_users_v2_native
  FROM users
  GROUP BY 1
),
act AS (
  SELECT
    d.date,
    -- Actividad de App (incluye vistas PostHog desde 2026-09-26)
    COUNT(DISTINCT IF(ud.date = d.date AND ud.is_app_active, ud.user_id, NULL))                                             AS dau,
    COUNT(DISTINCT IF(ud.date BETWEEN DATE_SUB(d.date, INTERVAL 6 DAY) AND d.date AND ud.is_app_active, ud.user_id, NULL))  AS wau,
    COUNT(DISTINCT IF(ud.date BETWEEN DATE_SUB(d.date, INTERVAL 29 DAY) AND d.date AND ud.is_app_active, ud.user_id, NULL)) AS mau,
    -- Actividad Financiera (decisión o asiento en Supabase; continua desde el día 1)
    COUNT(DISTINCT IF(ud.date = d.date AND ud.is_financial_active, ud.user_id, NULL))                                             AS financial_dau,
    COUNT(DISTINCT IF(ud.date BETWEEN DATE_SUB(d.date, INTERVAL 6 DAY) AND d.date AND ud.is_financial_active, ud.user_id, NULL))  AS financial_wau,
    COUNT(DISTINCT IF(ud.date BETWEEN DATE_SUB(d.date, INTERVAL 29 DAY) AND d.date AND ud.is_financial_active, ud.user_id, NULL)) AS financial_mau,
    -- Ahorradores 30d (≥1 día con ahorro neto > 0 en 30d)
    COUNT(DISTINCT IF(ud.date BETWEEN DATE_SUB(d.date, INTERVAL 29 DAY) AND d.date AND ud.is_saving_day, ud.user_id, NULL)) AS savers_30d
  FROM days d
  LEFT JOIN ud ON ud.date BETWEEN DATE_SUB(d.date, INTERVAL 29 DAY) AND d.date
  GROUP BY 1
),
mfeu_habit AS (
  SELECT
    date,
    COUNTIF(saving_days_30d >= p.mfeu_min_saving_days_30d) AS mfeu_30d,
    COUNTIF(saving_weeks_28d >= p.habit_min_weeks_in_4w)   AS habit_users_4w
  FROM (
    SELECT
      d.date,
      ud.user_id,
      COUNT(DISTINCT IF(ud.date BETWEEN DATE_SUB(d.date, INTERVAL 29 DAY) AND d.date, ud.date, NULL)) AS saving_days_30d,
      COUNT(DISTINCT IF(ud.date BETWEEN DATE_SUB(d.date, INTERVAL 27 DAY) AND d.date,
                        DIV(DATE_DIFF(d.date, ud.date, DAY), 7), NULL)) AS saving_weeks_28d
    FROM days d
    JOIN ud ON ud.date BETWEEN DATE_SUB(d.date, INTERVAL 29 DAY) AND d.date
    WHERE ud.is_saving_day
    GROUP BY 1, 2
  )
  CROSS JOIN p
  GROUP BY 1
),
day AS (
  SELECT
    date,
    SUM(decisions)            AS decisions,
    SUM(saved_decisions)      AS saved_decisions,
    SUM(zero_decisions)       AS zero_decisions,
    COUNTIF(decisions > 0)    AS users_with_decision,
    SUM(net_saved)            AS net_saved,
    SUM(daily_saved)          AS daily_saved,
    SUM(extra_saved)          AS extra_saved,
    SUM(v2_live_net_saved)    AS v2_live_net_saved,
    SUM(extra_savings_count)  AS extra_savings,
    COUNTIF(is_saving_day)    AS savers,
    SUM(prompt_impressions)   AS prompt_impressions
  FROM ud
  GROUP BY 1
),
opening AS (
  SELECT IFNULL(SUM(opening_balance_amount), 0) AS opening_total
  FROM `{{project}}.{{an}}.fct_ledger`
),
goals AS (
  SELECT
    local_date AS date,
    COUNTIF(event_type = 'created')   AS goals_created,
    COUNTIF(event_type = 'completed') AS goals_completed,
    COUNTIF(event_type = 'archived')  AS goals_archived
  FROM `{{project}}.{{raw}}.goal_events` ge
  JOIN users u USING (user_id)
  GROUP BY 1
)
SELECT
  d.date,
  (d.date < CURRENT_DATE('Europe/Madrid'))                                            AS is_closed_day,
  (d.date >= p.posthog_start_date)                                                    AS has_posthog_coverage,
  (d.date >= p.v2_cutover_date)                                                       AS is_v2_era,
  IFNULL(reg.new_users, 0)                                                            AS new_users,
  IFNULL(reg.new_users_v2_native, 0)                                                  AS new_users_v2_native,
  SUM(IFNULL(reg.new_users, 0)) OVER (ORDER BY d.date)                                AS registered_users,
  act.dau,
  act.wau,
  act.mau,
  act.financial_dau,
  act.financial_wau,
  act.financial_mau,
  act.savers_30d,
  IFNULL(mh.mfeu_30d, 0)                                                              AS mfeu_30d,
  IFNULL(mh.habit_users_4w, 0)                                                        AS habit_users_4w,
  SAFE_DIVIDE(act.dau, act.mau)                                                       AS stickiness_dau_mau,
  SAFE_DIVIDE(act.financial_dau, act.financial_mau)                                   AS financial_stickiness_dau_mau,
  IFNULL(day.decisions, 0)                                                            AS decisions,
  IFNULL(day.saved_decisions, 0)                                                      AS saved_decisions,
  IFNULL(day.zero_decisions, 0)                                                       AS zero_decisions,
  IFNULL(day.users_with_decision, 0)                                                  AS users_with_decision,
  SAFE_DIVIDE(day.users_with_decision, act.dau)                                       AS daily_completion_rate,
  SAFE_DIVIDE(day.users_with_decision, act.financial_dau)                             AS daily_completion_rate_financial,
  IFNULL(day.prompt_impressions, 0)                                                   AS prompt_impressions,
  IFNULL(day.net_saved, 0)                                                            AS net_saved,
  IFNULL(day.daily_saved, 0)                                                          AS daily_saved,
  IFNULL(day.extra_saved, 0)                                                          AS extra_saved,
  IFNULL(day.v2_live_net_saved, 0)                                                    AS v2_live_net_saved,
  IFNULL(day.extra_savings, 0)                                                        AS extra_savings,
  IFNULL(day.savers, 0)                                                               AS savers,
  SUM(IFNULL(day.net_saved, 0)) OVER (ORDER BY d.date)                                AS cumulative_net_saved,
  SUM(IFNULL(day.v2_live_net_saved, 0)) OVER (ORDER BY d.date)                        AS cumulative_v2_live_net_saved,
  IF(d.date >= p.v2_cutover_date, opening.opening_total, 0)                           AS opening_balance_total,
  SUM(IFNULL(day.net_saved, 0)) OVER (ORDER BY d.date)
    + IF(d.date >= p.v2_cutover_date, opening.opening_total, 0)                       AS cumulative_total_saved,
  IFNULL(goals.goals_created, 0)                                                      AS goals_created,
  IFNULL(goals.goals_completed, 0)                                                    AS goals_completed,
  IFNULL(goals.goals_archived, 0)                                                     AS goals_archived
FROM days d
CROSS JOIN p
CROSS JOIN opening
LEFT JOIN reg        USING (date)
LEFT JOIN act        USING (date)
LEFT JOIN mfeu_habit mh USING (date)
LEFT JOIN day        USING (date)
LEFT JOIN goals      USING (date);
