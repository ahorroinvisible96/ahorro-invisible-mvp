-- 11 · mart_kpi_summary: una fila con los KPIs titulares (scorecards de Looker).
--   Lee SIEMPRE el último día CERRADO (DATE_SUB(hoy, 1 DAY)) para evitar DAU/stickiness ≈ 0
--   en la ejecución de las 00:00 UTC (01:00–02:00 Madrid).
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_kpi_summary` AS
WITH p AS (SELECT * FROM `{{project}}.{{an}}.params`),
k AS (
  SELECT *
  FROM `{{project}}.{{an}}.mart_kpi_daily`
  WHERE date <= DATE_SUB(CURRENT_DATE('Europe/Madrid'), INTERVAL 1 DAY)
  ORDER BY date DESC
  LIMIT 1
),
k_latest AS (
  SELECT *
  FROM `{{project}}.{{an}}.mart_kpi_daily`
  ORDER BY date DESC
  LIMIT 1
),
s AS (SELECT * FROM `{{project}}.{{an}}.mart_user_savings`),
f AS (SELECT * FROM `{{project}}.{{an}}.mart_funnel_user`),
g AS (SELECT * FROM `{{project}}.{{an}}.mart_goals`),
r AS (SELECT * FROM `{{project}}.{{an}}.mart_retention_dn`),
l AS (SELECT * FROM `{{project}}.{{an}}.fct_ledger`)
SELECT
  CURRENT_TIMESTAMP()                                                                              AS computed_at,
  COALESCE((SELECT date FROM k), (SELECT date FROM k_latest))                                      AS as_of_date,
  COALESCE((SELECT registered_users FROM k_latest), 0)                                             AS registered_users,
  -- Actividad de App (último día cerrado)
  COALESCE((SELECT dau FROM k), 0)                                                                 AS active_users_1d,
  COALESCE((SELECT wau FROM k), 0)                                                                 AS active_users_7d,
  COALESCE((SELECT mau FROM k), 0)                                                                 AS active_users_30d,
  (SELECT stickiness_dau_mau FROM k)                                                               AS stickiness_dau_mau,
  -- Actividad Financiera (último día cerrado · continua desde día 1)
  COALESCE((SELECT financial_dau FROM k), 0)                                                       AS financial_active_users_1d,
  COALESCE((SELECT financial_wau FROM k), 0)                                                       AS financial_active_users_7d,
  COALESCE((SELECT financial_mau FROM k), 0)                                                       AS financial_active_users_30d,
  (SELECT financial_stickiness_dau_mau FROM k)                                                     AS financial_stickiness_dau_mau,
  -- Compromiso real de ahorro: North Star MFEU (≥2 días/30d), Ahorradores 30d (≥1d) y Hábito activo (≥3/4 sem)
  COALESCE((SELECT mfeu_30d FROM k), 0)                                                            AS mfeu_30d,
  COALESCE((SELECT savers_30d FROM k), 0)                                                          AS savers_30d,
  COALESCE((SELECT habit_users_4w FROM k), 0)                                                      AS habit_users_4w,
  -- Separación estricta de ahorro declarado orgánico vs saldo migrado V1 vs V2 live
  IFNULL((SELECT SUM(total_net_saved) FROM s), 0)                                                  AS total_net_saved_declared,
  IFNULL((SELECT SUM(opening_balance) FROM s), 0)                                                  AS opening_balance_v1,
  IFNULL((SELECT SUM(total_saved) FROM s), 0)                                                      AS total_saved,
  IFNULL((SELECT SUM(net_saving_amount) FROM l WHERE is_v2_live), 0)                               AS net_saved_since_cutover,
  IFNULL((SELECT SUM(current_balance) FROM s), 0)                                                  AS total_balance,
  IFNULL((SELECT SUM(hucha_balance) FROM s), 0)                                                    AS total_hucha_balance,
  -- Velocidad y consistencia (ahorradores)
  (SELECT AVG(run_rate_annual) FROM s WHERE first_saving_date IS NOT NULL)                         AS avg_run_rate_annual_savers,
  (SELECT APPROX_QUANTILES(run_rate_annual, 2)[SAFE_OFFSET(1)] FROM s WHERE first_saving_date IS NOT NULL) AS median_run_rate_annual_savers,
  (SELECT AVG(consistency_weekly) FROM s WHERE first_saving_date IS NOT NULL)                      AS avg_consistency_weekly,
  (SELECT AVG(savings_rate_of_income) FROM s WHERE savings_rate_of_income IS NOT NULL)             AS avg_savings_rate_of_income,
  -- Activación y retención (dual)
  (SELECT SAFE_DIVIDE(COUNTIF(activated_7d), COUNT(*)) FROM f)                                     AS activation_rate_7d,
  (SELECT SAFE_DIVIDE(COUNTIF(activated_7d_clean), COUNTIF(is_clean_signup_timing OR first_saving_at IS NULL)) FROM f) AS activation_rate_7d_clean,
  (SELECT SAFE_DIVIDE(COUNTIF(step_4_first_saving), COUNT(*)) FROM f)                              AS saver_conversion,
  (SELECT retention_rate FROM r WHERE dn = 7)                                                      AS retention_d7,
  (SELECT financial_retention_rate FROM r WHERE dn = 7)                                            AS financial_retention_d7,
  (SELECT retention_rate FROM r WHERE dn = 30)                                                     AS retention_d30,
  (SELECT financial_retention_rate FROM r WHERE dn = 30)                                           AS financial_retention_d30,
  -- Objetivos (desambiguados: alguna vez completado vs financiado al 100 % ahora)
  (SELECT COUNTIF(status = 'active') FROM g)                                                       AS goals_active,
  (SELECT COUNTIF(was_ever_completed) FROM g)                                                      AS goals_ever_completed,
  (SELECT COUNTIF(is_currently_at_target) FROM g)                                                  AS goals_currently_at_target,
  (SELECT COUNTIF(is_completed) FROM g)                                                            AS goals_completed,
  (SELECT AVG(progress_pct) FROM g WHERE status = 'active')                                        AS avg_goal_progress,
  -- Riesgo de abandono (App vs Financiero)
  (SELECT SAFE_DIVIDE(COUNTIF(is_at_risk), COUNT(*)) FROM s)                                       AS at_risk_share,
  (SELECT SAFE_DIVIDE(COUNTIF(is_financially_at_risk), COUNT(*)) FROM s)                           AS financially_at_risk_share,
  -- Simulación orientativa de margen sobre ahorro ORGÁNICO declarado (excluye apertura V1 · NO es LTV real)
  IFNULL((SELECT SUM(total_net_saved) FROM s), 0) * (SELECT bank_margin_annual_pct FROM p) * (SELECT indicative_margin_years FROM p)
                                                                                                   AS indicative_3y_deposit_margin_organic_eur,
  -- Frescura operacional
  (SELECT MAX(recorded_at) FROM `{{project}}.{{raw}}.savings_transactions`)                        AS last_ledger_record_at,
  (SELECT MAX(event_ts) FROM `{{project}}.{{an}}.stg_events`)                                      AS last_posthog_event_at;
