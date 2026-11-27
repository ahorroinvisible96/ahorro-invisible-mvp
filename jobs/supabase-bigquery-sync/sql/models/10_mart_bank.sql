-- 10 · Capa "Bancos" (SOLO agregados k-anónimos · CERO user_id / PII).
--   Se materializa en `{{an}}` y se replica de forma idéntica en el dataset aislado `{{bank}}`
--   (analytics_bank_v2) para que Looker Bank Intelligence tenga acceso IAM estrictamente limitado.
--
--   Reglas de gobernanza:
--     1. Privacidad (k >= 5) + Supresión complementaria:
--        · Bandas con < k se agrupan en 'otros'.
--        · Si 'otros' queda en (0, k-1), la banda cualificada más pequeña también se repliega en 'otros'
--          para impedir ataques de diferenciación (TOTAL - bandas_publicadas).
--        · Si TOTAL < k, todas las métricas quedan en NULL.
--     2. Estabilidad estadística (n >= 10 indicativo / n >= 30 robusto):
--        · Los recuentos (users, savers, active_users, mfeu_users, habit_active_users) requieren n >= k (5).
--        · Los importes, medias, medianas, percentiles, ratios y márgenes orientativos requieren n >= 10.
--     3. Honestidad financiera (R04):
--        · Separa ahorro orgánico declarado de saldo de apertura V1 (31 % histórico sin acciones detrás).
--        · Sustituye el término engañoso "LTV" por simulación orientativa sobre ahorro orgánico declarado.

-- 10.1 · Segmentación por banda de ingresos (k-anónima + supresión complementaria + n>=10/30)
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_bank_segments` AS
WITH p AS (SELECT * FROM `{{project}}.{{an}}.params`),
s AS (SELECT * FROM `{{project}}.{{an}}.mart_user_savings`),
band_n AS (
  SELECT income_band, COUNT(*) AS n
  FROM s
  GROUP BY 1
),
step1 AS (
  SELECT
    s.*,
    IF(b.n >= p.k_anonymity_min, s.income_band, 'otros') AS seg_1
  FROM s
  JOIN band_n b USING (income_band)
  CROSS JOIN p
),
seg1_counts AS (
  SELECT seg_1, COUNT(*) AS n
  FROM step1
  GROUP BY 1
),
otros_meta AS (
  SELECT
    IFNULL((SELECT n FROM seg1_counts WHERE seg_1 = 'otros'), 0) AS otros_n,
    (SELECT seg_1 FROM seg1_counts WHERE seg_1 <> 'otros' ORDER BY n ASC, seg_1 ASC LIMIT 1) AS smallest_band
),
seg AS (
  SELECT
    st.*,
    IF(om.otros_n > 0 AND om.otros_n < p.k_anonymity_min AND st.seg_1 = om.smallest_band,
       'otros', st.seg_1) AS segment
  FROM step1 st
  CROSS JOIN otros_meta om
  CROSS JOIN p
),
agg AS (
  SELECT
    segment,
    COUNT(*)                                                                                   AS users,
    COUNTIF(first_saving_date IS NOT NULL)                                                     AS savers,
    COUNTIF(NOT is_at_risk)                                                                    AS active_users,
    COUNTIF(NOT is_financially_at_risk)                                                        AS financial_active_users,
    COUNTIF(is_mfeu_30d)                                                                       AS mfeu_users,
    COUNTIF(is_habit_active_4w)                                                                AS habit_active_users,
    -- Velocidad de ahorro orgánico (todos los usuarios vs solo ahorradores)
    AVG(run_rate_annual)                                                                       AS avg_run_rate_annual_all,
    APPROX_QUANTILES(run_rate_annual, 2)[SAFE_OFFSET(1)]                                       AS median_run_rate_annual_all,
    AVG(IF(first_saving_date IS NOT NULL, run_rate_annual, NULL))                              AS avg_run_rate_annual_savers,
    APPROX_QUANTILES(IF(first_saving_date IS NOT NULL, run_rate_annual, NULL), 4)[SAFE_OFFSET(1)] AS p25_run_rate_annual_savers,
    APPROX_QUANTILES(IF(first_saving_date IS NOT NULL, run_rate_annual, NULL), 4)[SAFE_OFFSET(2)] AS median_run_rate_annual_savers,
    APPROX_QUANTILES(IF(first_saving_date IS NOT NULL, run_rate_annual, NULL), 4)[SAFE_OFFSET(3)] AS p75_run_rate_annual_savers,
    AVG(IF(first_saving_date IS NOT NULL, run_rate_daily_annual, NULL))                        AS avg_run_rate_daily_savers,
    AVG(IF(first_saving_date IS NOT NULL, run_rate_extra_annual, NULL))                        AS avg_run_rate_extra_savers,
    -- Hábito y esfuerzo sobre ingreso de referencia
    AVG(consistency_weekly)                                                                    AS avg_consistency_weekly,
    AVG(savings_rate_of_income)                                                                AS avg_savings_rate_of_income,
    SAFE_DIVIDE(COUNTIF(is_mfeu_30d), COUNT(*))                                                AS mfeu_rate,
    SAFE_DIVIDE(COUNTIF(is_habit_active_4w), COUNT(*))                                         AS habit_active_rate,
    -- Separación estricta de saldos: orgánico declarado vs apertura V1 vs V2 live
    SUM(total_net_saved)                                                                       AS total_organic_net_saved,
    AVG(total_net_saved)                                                                       AS avg_organic_net_saved,
    APPROX_QUANTILES(total_net_saved, 2)[SAFE_OFFSET(1)]                                       AS median_organic_net_saved,
    SUM(opening_balance)                                                                       AS total_opening_balance_v1,
    SUM(v2_live_net_saved)                                                                     AS total_v2_live_net_saved,
    SUM(current_balance)                                                                       AS total_balance,
    AVG(current_balance)                                                                       AS avg_balance,
    SAFE_DIVIDE(SUM(hucha_balance), NULLIF(SUM(current_balance), 0))                           AS hucha_balance_share,
    SAFE_DIVIDE(COUNTIF(is_at_risk), COUNT(*))                                                 AS at_risk_share,
    SAFE_DIVIDE(COUNTIF(is_financially_at_risk), COUNT(*))                                     AS financially_at_risk_share
  FROM (SELECT * FROM seg UNION ALL SELECT * REPLACE ('TOTAL' AS segment) FROM seg)
  GROUP BY 1
)
SELECT
  a.segment,
  a.users,
  (a.users >= p.k_anonymity_min)                                                               AS is_publishable,
  (a.users >= p.k_anonymity_min)                                                               AS is_privacy_publishable,
  (a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative))                            AS is_statistically_publishable,
  (a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_robust))                                AS is_statistically_robust,
  CASE
    WHEN a.users < p.k_anonymity_min THEN 'suppressed_privacy'
    WHEN a.users < p.stat_min_n_indicative THEN 'privacy_ok_low_n'
    WHEN a.users < p.stat_min_n_robust THEN 'indicative_n10'
    ELSE 'robust_n30'
  END                                                                                          AS sample_confidence_tier,
  -- Recuentos: publicados si >= k (5)
  IF(a.users >= p.k_anonymity_min, a.savers, NULL)                                             AS savers,
  IF(a.users >= p.k_anonymity_min, a.active_users, NULL)                                       AS active_users,
  IF(a.users >= p.k_anonymity_min, a.financial_active_users, NULL)                             AS financial_active_users,
  IF(a.users >= p.k_anonymity_min, a.mfeu_users, NULL)                                         AS mfeu_users,
  IF(a.users >= p.k_anonymity_min, a.habit_active_users, NULL)                                 AS habit_active_users,
  -- Ratios, cuantiles, importes y márgenes orientativos: publicados si >= n_indicative (10)
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.avg_run_rate_annual_all, NULL)       AS avg_run_rate_annual,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.median_run_rate_annual_all, NULL)    AS median_run_rate_annual,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.avg_run_rate_annual_savers, NULL)    AS avg_run_rate_annual_savers,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.p25_run_rate_annual_savers, NULL)    AS p25_run_rate_annual_savers,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.median_run_rate_annual_savers, NULL) AS median_run_rate_annual_savers,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.p75_run_rate_annual_savers, NULL)    AS p75_run_rate_annual_savers,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.avg_run_rate_daily_savers, NULL)     AS avg_run_rate_daily_savers,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.avg_run_rate_extra_savers, NULL)     AS avg_run_rate_extra_savers,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.avg_consistency_weekly, NULL)        AS avg_consistency_weekly,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.avg_savings_rate_of_income, NULL)    AS avg_savings_rate_of_income,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.mfeu_rate, NULL)                     AS mfeu_rate,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.habit_active_rate, NULL)             AS habit_active_rate,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.total_organic_net_saved, NULL)       AS total_organic_net_saved,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.avg_organic_net_saved, NULL)         AS avg_organic_net_saved,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.median_organic_net_saved, NULL)      AS median_organic_net_saved,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.total_opening_balance_v1, NULL)      AS total_opening_balance_v1,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.total_v2_live_net_saved, NULL)       AS total_v2_live_net_saved,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.total_balance, NULL)                 AS total_balance,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.avg_balance, NULL)                   AS avg_balance,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.hucha_balance_share, NULL)           AS hucha_balance_share,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.at_risk_share, NULL)                 AS at_risk_share,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.financially_at_risk_share, NULL)     AS financially_at_risk_share,
  -- Simulación orientativa de margen sobre ahorro orgánico declarado (NO LTV real ni depósitos verificados)
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative),
     a.total_organic_net_saved * p.bank_margin_annual_pct, NULL)                                             AS indicative_annual_deposit_margin_organic_eur,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative),
     a.total_organic_net_saved * p.bank_margin_annual_pct * p.indicative_margin_years, NULL)                 AS indicative_3y_deposit_margin_organic_eur,
  'Ahorro declarado por usuario (no movimientos bancarios verificados). Simulación orientativa sobre ahorro orgánico neto (excluye saldo migrado V1); no es LTV real.' AS methodology_disclaimer,
  CASE a.segment
    WHEN 'lt_1000' THEN 1 WHEN '1000_1500' THEN 2 WHEN '1500_2000' THEN 3 WHEN '2000_2500' THEN 4
    WHEN '2500_3000' THEN 5 WHEN 'gt_3000' THEN 6 WHEN 'sin_declarar' THEN 7 WHEN 'otros' THEN 8 ELSE 9
  END                                                                                                        AS sort_order
FROM agg a
CROSS JOIN p;

-- 10.2 · Curva de ahorro orgánico acumulado por meses desde el alta (P25 / Mediana / P75 + media)
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_bank_savings_curve` AS
WITH p AS (SELECT * FROM `{{project}}.{{an}}.params`),
u AS (SELECT user_id, cohort_date FROM `{{project}}.{{an}}.dim_user` WHERE NOT is_excluded),
m AS (
  SELECT u.user_id, n AS month_n
  FROM u, UNNEST(GENERATE_ARRAY(0, DATE_DIFF(DATE_SUB(CURRENT_DATE('Europe/Madrid'), INTERVAL 1 DAY), u.cohort_date, MONTH))) n
),
cum AS (
  SELECT m.user_id, m.month_n, IFNULL(SUM(d.net_saved), 0) AS cumulative_net_saved
  FROM m
  JOIN u USING (user_id)
  LEFT JOIN `{{project}}.{{an}}.fct_user_day` d
    ON d.user_id = m.user_id AND d.date < DATE_ADD(u.cohort_date, INTERVAL m.month_n + 1 MONTH)
  GROUP BY 1, 2
)
SELECT
  month_n,
  COUNT(*)                                                                                          AS users,
  (COUNT(*) >= ANY_VALUE(p.k_anonymity_min))                                                        AS is_privacy_publishable,
  (COUNT(*) >= GREATEST(ANY_VALUE(p.k_anonymity_min), ANY_VALUE(p.stat_min_n_indicative)))          AS is_statistically_publishable,
  CASE
    WHEN COUNT(*) < ANY_VALUE(p.k_anonymity_min) THEN 'suppressed_privacy'
    WHEN COUNT(*) < ANY_VALUE(p.stat_min_n_indicative) THEN 'privacy_ok_low_n'
    WHEN COUNT(*) < ANY_VALUE(p.stat_min_n_robust) THEN 'indicative_n10'
    ELSE 'robust_n30'
  END                                                                                               AS sample_confidence_tier,
  IF(COUNT(*) >= GREATEST(ANY_VALUE(p.k_anonymity_min), ANY_VALUE(p.stat_min_n_indicative)),
     AVG(cumulative_net_saved), NULL)                                                               AS avg_cumulative_net_saved,
  IF(COUNT(*) >= GREATEST(ANY_VALUE(p.k_anonymity_min), ANY_VALUE(p.stat_min_n_indicative)),
     APPROX_QUANTILES(cumulative_net_saved, 4)[SAFE_OFFSET(1)], NULL)                               AS p25_cumulative_net_saved,
  IF(COUNT(*) >= GREATEST(ANY_VALUE(p.k_anonymity_min), ANY_VALUE(p.stat_min_n_indicative)),
     APPROX_QUANTILES(cumulative_net_saved, 4)[SAFE_OFFSET(2)], NULL)                               AS median_cumulative_net_saved,
  IF(COUNT(*) >= GREATEST(ANY_VALUE(p.k_anonymity_min), ANY_VALUE(p.stat_min_n_indicative)),
     APPROX_QUANTILES(cumulative_net_saved, 4)[SAFE_OFFSET(3)], NULL)                               AS p75_cumulative_net_saved
FROM cum
CROSS JOIN p
GROUP BY 1;

-- 10.3 · Demanda de objetivos por horizonte temporal (mapeo directo a productos bancarios · k-anónimo)
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_bank_goals_profile` AS
WITH p AS (SELECT * FROM `{{project}}.{{an}}.params`),
g AS (SELECT * FROM `{{project}}.{{an}}.mart_goals`),
bucket_users AS (
  SELECT horizon_bucket, COUNT(DISTINCT user_id) AS n_users
  FROM g
  GROUP BY 1
),
step1 AS (
  SELECT g.*, IF(bu.n_users >= p.k_anonymity_min, g.horizon_bucket, 'otros') AS hb_1
  FROM g
  JOIN bucket_users bu USING (horizon_bucket)
  CROSS JOIN p
),
hb1_counts AS (
  SELECT hb_1, COUNT(DISTINCT user_id) AS n_users
  FROM step1
  GROUP BY 1
),
otros_meta AS (
  SELECT
    IFNULL((SELECT n_users FROM hb1_counts WHERE hb_1 = 'otros'), 0) AS otros_n,
    (SELECT hb_1 FROM hb1_counts WHERE hb_1 <> 'otros' ORDER BY n_users ASC, hb_1 ASC LIMIT 1) AS smallest_hb
),
seg AS (
  SELECT
    st.*,
    IF(om.otros_n > 0 AND om.otros_n < p.k_anonymity_min AND st.hb_1 = om.smallest_hb,
       'otros', st.hb_1) AS horizon_segment
  FROM step1 st
  CROSS JOIN otros_meta om
  CROSS JOIN p
),
agg AS (
  SELECT
    horizon_segment,
    COUNT(DISTINCT user_id)                                              AS users,
    COUNT(*)                                                             AS goals_count,
    COUNTIF(status = 'active')                                           AS active_goals,
    SAFE_DIVIDE(COUNTIF(was_ever_completed), COUNT(*))                   AS ever_completed_rate,
    SAFE_DIVIDE(COUNTIF(is_currently_at_target), COUNT(*))               AS currently_at_target_rate,
    APPROX_QUANTILES(target_amount, 2)[SAFE_OFFSET(1)]                   AS median_target_amount,
    APPROX_QUANTILES(progress_pct, 2)[SAFE_OFFSET(1)]                    AS median_progress_pct,
    APPROX_QUANTILES(days_to_complete, 2)[SAFE_OFFSET(1)]                AS median_days_to_complete,
    SUM(balance)                                                         AS total_goal_balance
  FROM (SELECT * FROM seg UNION ALL SELECT * REPLACE ('TOTAL' AS horizon_segment) FROM seg)
  GROUP BY 1
)
SELECT
  a.horizon_segment,
  CASE a.horizon_segment
    WHEN 'short_1_3m' THEN 'Liquidez / Cuenta remunerada (1-3m)'
    WHEN 'medium_4_6m' THEN 'Hucha / Depósito corto (4-6m)'
    WHEN 'long_7_12m_plus' THEN 'Ahorro periódico / Inversión (7-12m+)'
    WHEN 'otros' THEN 'Horizontes agrupados (<k)'
    ELSE 'Total cartera de metas'
  END                                                                    AS banking_product_fit,
  a.users,
  (a.users >= p.k_anonymity_min)                                         AS is_privacy_publishable,
  (a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative))      AS is_statistically_publishable,
  CASE
    WHEN a.users < p.k_anonymity_min THEN 'suppressed_privacy'
    WHEN a.users < p.stat_min_n_indicative THEN 'privacy_ok_low_n'
    WHEN a.users < p.stat_min_n_robust THEN 'indicative_n10'
    ELSE 'robust_n30'
  END                                                                    AS sample_confidence_tier,
  IF(a.users >= p.k_anonymity_min, a.goals_count, NULL)                  AS goals_count,
  IF(a.users >= p.k_anonymity_min, a.active_goals, NULL)                 AS active_goals,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.ever_completed_rate, NULL)      AS ever_completed_rate,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.currently_at_target_rate, NULL) AS currently_at_target_rate,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.median_target_amount, NULL)     AS median_target_amount,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.median_progress_pct, NULL)      AS median_progress_pct,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.median_days_to_complete, NULL)  AS median_days_to_complete,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.total_goal_balance, NULL)       AS total_goal_balance,
  CASE a.horizon_segment WHEN 'short_1_3m' THEN 1 WHEN 'medium_4_6m' THEN 2 WHEN 'long_7_12m_plus' THEN 3 WHEN 'otros' THEN 4 ELSE 5 END AS sort_order
FROM agg a
CROSS JOIN p;

-- 10.4 · Inteligencia conductual por avatar (k-anónimo + supresión complementaria · listo para cohortes V2)
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_bank_behavioral_segments` AS
WITH p AS (SELECT * FROM `{{project}}.{{an}}.params`),
s AS (
  SELECT *, COALESCE(avatar, 'sin_evaluar') AS avatar_raw
  FROM `{{project}}.{{an}}.mart_user_savings`
),
av_n AS (
  SELECT avatar_raw, COUNT(*) AS n
  FROM s
  GROUP BY 1
),
step1 AS (
  SELECT s.*, IF(a.n >= p.k_anonymity_min, s.avatar_raw, 'otros') AS av_1
  FROM s
  JOIN av_n a USING (avatar_raw)
  CROSS JOIN p
),
av1_counts AS (
  SELECT av_1, COUNT(*) AS n
  FROM step1
  GROUP BY 1
),
otros_meta AS (
  SELECT
    IFNULL((SELECT n FROM av1_counts WHERE av_1 = 'otros'), 0) AS otros_n,
    (SELECT av_1 FROM av1_counts WHERE av_1 <> 'otros' ORDER BY n ASC, av_1 ASC LIMIT 1) AS smallest_av
),
seg AS (
  SELECT
    st.*,
    IF(om.otros_n > 0 AND om.otros_n < p.k_anonymity_min AND st.av_1 = om.smallest_av,
       'otros', st.av_1) AS avatar_segment
  FROM step1 st
  CROSS JOIN otros_meta om
  CROSS JOIN p
),
agg AS (
  SELECT
    avatar_segment,
    COUNT(*)                                                                                   AS users,
    COUNTIF(first_saving_date IS NOT NULL)                                                     AS savers,
    COUNTIF(is_mfeu_30d)                                                                       AS mfeu_users,
    COUNTIF(is_habit_active_4w)                                                                AS habit_active_users,
    SAFE_DIVIDE(COUNTIF(is_mfeu_30d), COUNT(*))                                                AS mfeu_rate,
    SAFE_DIVIDE(COUNTIF(is_habit_active_4w), COUNT(*))                                         AS habit_active_rate,
    APPROX_QUANTILES(IF(first_saving_date IS NOT NULL, run_rate_annual, NULL), 2)[SAFE_OFFSET(1)] AS median_run_rate_annual_savers,
    AVG(consistency_weekly)                                                                    AS avg_consistency_weekly,
    AVG(savings_rate_of_income)                                                                AS avg_savings_rate_of_income,
    SUM(total_net_saved)                                                                       AS total_organic_net_saved
  FROM (SELECT * FROM seg UNION ALL SELECT * REPLACE ('TOTAL' AS avatar_segment) FROM seg)
  GROUP BY 1
)
SELECT
  a.avatar_segment,
  a.users,
  (a.users >= p.k_anonymity_min)                                                               AS is_privacy_publishable,
  (a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative))                            AS is_statistically_publishable,
  CASE
    WHEN a.users < p.k_anonymity_min THEN 'suppressed_privacy'
    WHEN a.users < p.stat_min_n_indicative THEN 'privacy_ok_low_n'
    WHEN a.users < p.stat_min_n_robust THEN 'indicative_n10'
    ELSE 'robust_n30'
  END                                                                                          AS sample_confidence_tier,
  IF(a.users >= p.k_anonymity_min, a.savers, NULL)                                             AS savers,
  IF(a.users >= p.k_anonymity_min, a.mfeu_users, NULL)                                         AS mfeu_users,
  IF(a.users >= p.k_anonymity_min, a.habit_active_users, NULL)                                 AS habit_active_users,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.mfeu_rate, NULL)       AS mfeu_rate,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.habit_active_rate, NULL) AS habit_active_rate,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.median_run_rate_annual_savers, NULL) AS median_run_rate_annual_savers,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.avg_consistency_weekly, NULL) AS avg_consistency_weekly,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.avg_savings_rate_of_income, NULL) AS avg_savings_rate_of_income,
  IF(a.users >= GREATEST(p.k_anonymity_min, p.stat_min_n_indicative), a.total_organic_net_saved, NULL) AS total_organic_net_saved,
  CASE a.avatar_segment WHEN 'comodo' THEN 1 WHEN 'social' THEN 2 WHEN 'impulsivo' THEN 3 WHEN 'sin_evaluar' THEN 4 WHEN 'otros' THEN 5 ELSE 6 END AS sort_order
FROM agg a
CROSS JOIN p;

-- 10.5 · Réplica aislada en dataset bancario dedicado (`{{bank}}` = analytics_bank_v2)
--        Permite conceder IAM de solo lectura a Looker Bank Intelligence SIN acceso a `analytics_v2` ni `raw_*`.
CREATE OR REPLACE TABLE `{{project}}.{{bank}}.mart_bank_segments` AS
SELECT * FROM `{{project}}.{{an}}.mart_bank_segments`;

CREATE OR REPLACE TABLE `{{project}}.{{bank}}.mart_bank_savings_curve` AS
SELECT * FROM `{{project}}.{{an}}.mart_bank_savings_curve`;

CREATE OR REPLACE TABLE `{{project}}.{{bank}}.mart_bank_goals_profile` AS
SELECT * FROM `{{project}}.{{an}}.mart_bank_goals_profile`;

CREATE OR REPLACE TABLE `{{project}}.{{bank}}.mart_bank_behavioral_segments` AS
SELECT * FROM `{{project}}.{{an}}.mart_bank_behavioral_segments`;

CREATE OR REPLACE TABLE `{{project}}.{{bank}}.bank_governance_metadata` AS
SELECT
  CURRENT_TIMESTAMP()                                        AS computed_at,
  DATE_SUB(CURRENT_DATE('Europe/Madrid'), INTERVAL 1 DAY)    AS as_of_date,
  p.v2_cutover_date,
  p.k_anonymity_min,
  p.stat_min_n_indicative,
  p.stat_min_n_robust,
  p.bank_margin_annual_pct,
  p.indicative_margin_years,
  'Dataset 100 % agregado y k-anónimo (k>=5 con supresión complementaria; ratios y cuantiles publicados con n>=10 indicativo / n>=30 robusto). Todo el ahorro es declarado por el usuario en la app, no corresponde a movimientos bancarios verificados.' AS governance_disclaimer
FROM `{{project}}.{{an}}.params` p;
