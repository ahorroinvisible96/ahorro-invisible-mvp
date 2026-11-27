-- 08 · mart_user_savings: perfil de ahorro por usuario real (USO INTERNO · contiene user_id).
--   NO conectar directamente a Looker Studio externo ni a informes compartidos con bancos.
--   run_rate_annual: ahorro neto orgánico declarado en los últimos 90 días cerrados anualizado
--   (ventana mínima 30 días). Separa ahorro diario recurrente vs extra y saldo migrado V1.
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_user_savings` AS
WITH p AS (SELECT * FROM `{{project}}.{{an}}.params`),
ref_day AS (SELECT DATE_SUB(CURRENT_DATE('Europe/Madrid'), INTERVAL 1 DAY) AS d),
u AS (SELECT * FROM `{{project}}.{{an}}.dim_user` WHERE NOT is_excluded),
led AS (
  SELECT
    user_id,
    SUM(net_saving_amount)                                                                         AS total_net_saved,
    SUM(opening_balance_amount)                                                                    AS opening_balance,
    SUM(IF(is_v2_live, net_saving_amount, 0))                                                      AS v2_live_net_saved,
    SUM(IF(saving_kind = 'daily_saving', net_saving_amount, 0))                                    AS daily_saved_total,
    SUM(IF(saving_kind = 'extra_saving', net_saving_amount, 0))                                    AS extra_saved_total,
    SUM(amount)                                                                                    AS current_balance,
    SUM(IF(bucket_type = 'goal', amount, 0))                                                       AS goal_balance,
    SUM(IF(bucket_type = 'hucha', amount, 0))                                                      AS hucha_balance,
    SUM(IF(local_date BETWEEN DATE_SUB((SELECT d FROM ref_day), INTERVAL 89 DAY) AND (SELECT d FROM ref_day),
           net_saving_amount, 0))                                                                  AS net_saved_90d,
    SUM(IF(local_date BETWEEN DATE_SUB((SELECT d FROM ref_day), INTERVAL 89 DAY) AND (SELECT d FROM ref_day)
           AND saving_kind = 'daily_saving', net_saving_amount, 0))                                AS daily_net_saved_90d,
    SUM(IF(local_date BETWEEN DATE_SUB((SELECT d FROM ref_day), INTERVAL 89 DAY) AND (SELECT d FROM ref_day)
           AND saving_kind = 'extra_saving', net_saving_amount, 0))                                AS extra_net_saved_90d,
    COUNTIF(transaction_type IN ('daily_saving', 'extra_saving'))                                  AS saving_entries,
    COUNTIF(transaction_type = 'reversal')                                                         AS reversals,
    MIN(IF(transaction_type IN ('daily_saving', 'extra_saving'), local_date, NULL))                AS first_saving_date
  FROM `{{project}}.{{an}}.fct_ledger`
  GROUP BY 1
),
ud AS (
  SELECT
    user_id,
    MAX(IF(is_app_active, date, NULL))                                                             AS last_active_date,
    MAX(IF(is_financial_active, date, NULL))                                                       AS last_financial_active_date,
    COUNT(DISTINCT IF(is_app_active, DATE_TRUNC(date, MONTH), NULL))                               AS active_months,
    COUNT(DISTINCT IF(is_financial_active, DATE_TRUNC(date, MONTH), NULL))                         AS financial_active_months,
    COUNT(DISTINCT IF(is_saving_day, DATE_TRUNC(date, WEEK(MONDAY)), NULL))                        AS weeks_with_saving,
    COUNTIF(is_saving_day)                                                                         AS saving_days,
    COUNT(DISTINCT IF(is_saving_day AND date BETWEEN DATE_SUB((SELECT d FROM ref_day), INTERVAL 29 DAY) AND (SELECT d FROM ref_day),
                      date, NULL))                                                                 AS saving_days_30d,
    COUNT(DISTINCT IF(is_saving_day AND date BETWEEN DATE_SUB((SELECT d FROM ref_day), INTERVAL 27 DAY) AND (SELECT d FROM ref_day),
                      DIV(DATE_DIFF((SELECT d FROM ref_day), date, DAY), 7), NULL))                AS saving_weeks_28d,
    SUM(decisions)                                                                                 AS decisions,
    SUM(zero_decisions)                                                                            AS zero_decisions
  FROM `{{project}}.{{an}}.fct_user_day`
  GROUP BY 1
),
calc AS (
  SELECT
    u.user_id,
    u.acquisition_era,
    u.cohort_date,
    u.cohort_month,
    u.income_band,
    u.income_reference_monthly,
    u.income_band_is_capped,
    u.savings_habit,
    u.avatar,
    IFNULL(led.total_net_saved, 0)                                                                 AS total_net_saved,
    IFNULL(led.opening_balance, 0)                                                                 AS opening_balance,
    IFNULL(led.v2_live_net_saved, 0)                                                               AS v2_live_net_saved,
    IFNULL(led.daily_saved_total, 0)                                                               AS daily_saved_total,
    IFNULL(led.extra_saved_total, 0)                                                               AS extra_saved_total,
    IFNULL(led.total_net_saved, 0) + IFNULL(led.opening_balance, 0)                                AS total_saved,
    IFNULL(led.current_balance, 0)                                                                 AS current_balance,
    IFNULL(led.goal_balance, 0)                                                                    AS goal_balance,
    IFNULL(led.hucha_balance, 0)                                                                   AS hucha_balance,
    IFNULL(led.saving_entries, 0)                                                                  AS saving_entries,
    IFNULL(led.reversals, 0)                                                                       AS reversals,
    IFNULL(ud.saving_days, 0)                                                                      AS saving_days,
    IFNULL(ud.saving_days_30d, 0)                                                                  AS saving_days_30d,
    IFNULL(ud.saving_weeks_28d, 0)                                                                 AS saving_weeks_28d,
    (IFNULL(ud.saving_days_30d, 0) >= p.mfeu_min_saving_days_30d)                                  AS is_mfeu_30d,
    (IFNULL(ud.saving_weeks_28d, 0) >= p.habit_min_weeks_in_4w)                                    AS is_habit_active_4w,
    IFNULL(ud.decisions, 0)                                                                        AS decisions,
    IFNULL(ud.zero_decisions, 0)                                                                   AS zero_decisions,
    led.first_saving_date,
    ud.last_active_date,
    ud.last_financial_active_date,
    GREATEST(0, DATE_DIFF(t.d, COALESCE(ud.last_active_date, u.cohort_date), DAY))                 AS days_since_last_activity,
    GREATEST(0, DATE_DIFF(t.d, COALESCE(ud.last_financial_active_date, u.cohort_date), DAY))       AS days_since_last_financial_activity,
    DATE_DIFF(t.d, COALESCE(ud.last_active_date, u.cohort_date), DAY) > p.churn_inactive_days      AS is_at_risk,
    DATE_DIFF(t.d, COALESCE(ud.last_financial_active_date, u.cohort_date), DAY) > p.churn_inactive_days AS is_financially_at_risk,
    IFNULL(ud.active_months, 0)                                                                    AS active_months,
    IFNULL(ud.financial_active_months, 0)                                                          AS financial_active_months,
    SAFE_DIVIDE(IFNULL(led.total_net_saved, 0), NULLIF(ud.active_months, 0))                       AS saved_per_active_month,
    SAFE_DIVIDE(IFNULL(led.total_net_saved, 0), NULLIF(ud.financial_active_months, 0))             AS saved_per_financial_month,
    IF(led.first_saving_date IS NULL, NULL,
       LEAST(1.0, SAFE_DIVIDE(
         IFNULL(ud.weeks_with_saving, 0),
         GREATEST(1, DATE_DIFF(DATE_TRUNC(t.d, WEEK(MONDAY)), DATE_TRUNC(led.first_saving_date, WEEK(MONDAY)), WEEK) + 1)
       )))                                                                                         AS consistency_weekly,
    GREATEST(30, LEAST(90, GREATEST(1, DATE_DIFF(t.d, u.cohort_date, DAY) + 1)))                   AS run_rate_window_days,
    IFNULL(led.net_saved_90d, 0)                                                                   AS net_saved_90d,
    IFNULL(led.daily_net_saved_90d, 0)                                                             AS daily_net_saved_90d,
    IFNULL(led.extra_net_saved_90d, 0)                                                             AS extra_net_saved_90d
  FROM u
  CROSS JOIN p
  CROSS JOIN ref_day t
  LEFT JOIN led USING (user_id)
  LEFT JOIN ud  USING (user_id)
)
SELECT
  c.* EXCEPT (run_rate_window_days),
  c.net_saved_90d * 365.0 / c.run_rate_window_days                                                 AS run_rate_annual,
  c.daily_net_saved_90d * 365.0 / c.run_rate_window_days                                           AS run_rate_daily_annual,
  c.extra_net_saved_90d * 365.0 / c.run_rate_window_days                                           AS run_rate_extra_annual,
  SAFE_DIVIDE((c.net_saved_90d * 365.0 / c.run_rate_window_days) / 12.0, c.income_reference_monthly) AS savings_rate_of_income
FROM calc c;
