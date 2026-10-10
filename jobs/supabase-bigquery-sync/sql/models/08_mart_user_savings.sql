-- 08 · mart_user_savings: perfil de ahorro por usuario real (base de KPIs de negocio y banca).
--   run_rate_annual: ahorro neto declarado en los últimos 90 días anualizado; ventana mínima 30 días
--   para no inflar usuarios recién llegados. Todo es ahorro DECLARADO (no movimientos bancarios).
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_user_savings` AS
WITH p AS (SELECT * FROM `{{project}}.{{an}}.params`),
today AS (SELECT CURRENT_DATE('Europe/Madrid') AS d),
u AS (SELECT * FROM `{{project}}.{{an}}.dim_user` WHERE NOT is_excluded),
led AS (
  SELECT user_id,
    SUM(net_saving_amount)                                       AS total_net_saved,
    SUM(opening_balance_amount)                                  AS opening_balance,
    SUM(amount)                                                  AS current_balance,
    SUM(IF(bucket_type = 'goal', amount, 0))                     AS goal_balance,
    SUM(IF(bucket_type = 'hucha', amount, 0))                    AS hucha_balance,
    SUM(IF(local_date > DATE_SUB((SELECT d FROM today), INTERVAL 90 DAY), net_saving_amount, 0)) AS net_saved_90d,
    COUNTIF(transaction_type IN ('daily_saving', 'extra_saving')) AS saving_entries,
    COUNTIF(transaction_type = 'reversal')                       AS reversals,
    MIN(IF(transaction_type IN ('daily_saving', 'extra_saving'), local_date, NULL)) AS first_saving_date
  FROM `{{project}}.{{an}}.fct_ledger` GROUP BY 1
),
ud AS (
  SELECT user_id,
    MAX(IF(is_active, date, NULL))                                AS last_active_date,
    COUNT(DISTINCT IF(is_active, DATE_TRUNC(date, MONTH), NULL))  AS active_months,
    COUNT(DISTINCT IF(is_saving_day, DATE_TRUNC(date, WEEK(MONDAY)), NULL)) AS weeks_with_saving,
    COUNTIF(is_saving_day)                                        AS saving_days,
    SUM(decisions)                                                AS decisions,
    SUM(zero_decisions)                                           AS zero_decisions
  FROM `{{project}}.{{an}}.fct_user_day` GROUP BY 1
)
SELECT
  u.user_id, u.cohort_date, u.cohort_month, u.income_band, u.income_reference_monthly, u.savings_habit, u.avatar,
  IFNULL(led.total_net_saved, 0)  AS total_net_saved,
  IFNULL(led.opening_balance, 0)  AS opening_balance,
  IFNULL(led.total_net_saved, 0) + IFNULL(led.opening_balance, 0) AS total_saved,
  IFNULL(led.current_balance, 0)  AS current_balance,
  IFNULL(led.goal_balance, 0)     AS goal_balance,
  IFNULL(led.hucha_balance, 0)    AS hucha_balance,
  IFNULL(led.saving_entries, 0)   AS saving_entries,
  IFNULL(led.reversals, 0)        AS reversals,
  IFNULL(ud.saving_days, 0)       AS saving_days,
  IFNULL(ud.decisions, 0)         AS decisions,
  IFNULL(ud.zero_decisions, 0)    AS zero_decisions,
  led.first_saving_date,
  ud.last_active_date,
  DATE_DIFF(t.d, COALESCE(ud.last_active_date, u.cohort_date), DAY) AS days_since_last_activity,
  DATE_DIFF(t.d, COALESCE(ud.last_active_date, u.cohort_date), DAY) > p.churn_inactive_days AS is_at_risk,
  IFNULL(ud.active_months, 0)     AS active_months,
  SAFE_DIVIDE(IFNULL(led.total_net_saved, 0), NULLIF(ud.active_months, 0)) AS saved_per_active_month,
  IF(led.first_saving_date IS NULL, NULL,
     SAFE_DIVIDE(IFNULL(ud.weeks_with_saving, 0),
                 DATE_DIFF(DATE_TRUNC(t.d, WEEK(MONDAY)), DATE_TRUNC(led.first_saving_date, WEEK(MONDAY)), WEEK) + 1)) AS consistency_weekly,
  IFNULL(led.net_saved_90d, 0) * 365.0
    / GREATEST(30, LEAST(90, DATE_DIFF(t.d, u.cohort_date, DAY) + 1)) AS run_rate_annual,
  SAFE_DIVIDE(IFNULL(led.net_saved_90d, 0) * 365.0 / GREATEST(30, LEAST(90, DATE_DIFF(t.d, u.cohort_date, DAY) + 1)) / 12,
              u.income_reference_monthly) AS savings_rate_of_income
FROM u CROSS JOIN p CROSS JOIN today t
LEFT JOIN led USING (user_id)
LEFT JOIN ud  USING (user_id);
