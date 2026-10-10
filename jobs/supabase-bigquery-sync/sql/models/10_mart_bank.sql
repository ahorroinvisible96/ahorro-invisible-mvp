-- 10 · Páginas "Bancos": SOLO agregados anonimizados. Segmentos con < k usuarios se agrupan en
--      'otros'; si aun así < k, se suprimen las métricas (NULL). Nunca hay filas por usuario.
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_bank_segments` AS
WITH p AS (SELECT * FROM `{{project}}.{{an}}.params`),
s AS (SELECT * FROM `{{project}}.{{an}}.mart_user_savings`),
band_n AS (SELECT income_band, COUNT(*) AS n FROM s GROUP BY 1),
seg AS (
  SELECT s.*, IF(b.n >= p.k_anonymity_min, s.income_band, 'otros') AS segment
  FROM s JOIN band_n b USING (income_band) CROSS JOIN p
),
agg AS (
  SELECT segment,
    COUNT(*)                                            AS users,
    COUNTIF(first_saving_date IS NOT NULL)              AS savers,
    COUNTIF(NOT is_at_risk)                             AS active_users,
    AVG(run_rate_annual)                                AS avg_run_rate_annual,
    APPROX_QUANTILES(run_rate_annual, 2)[OFFSET(1)]     AS median_run_rate_annual,
    AVG(consistency_weekly)                             AS avg_consistency_weekly,
    AVG(savings_rate_of_income)                         AS avg_savings_rate_of_income,
    SUM(current_balance)                                AS total_balance,
    AVG(current_balance)                                AS avg_balance,
    SAFE_DIVIDE(COUNTIF(is_at_risk), COUNT(*))          AS at_risk_share
  FROM (SELECT * FROM seg UNION ALL SELECT * REPLACE ('TOTAL' AS segment) FROM seg)
  GROUP BY 1
)
SELECT
  a.segment,
  a.users,
  a.users >= p.k_anonymity_min AS is_publishable,
  IF(a.users >= p.k_anonymity_min, a.savers, NULL)                     AS savers,
  IF(a.users >= p.k_anonymity_min, a.active_users, NULL)               AS active_users,
  IF(a.users >= p.k_anonymity_min, a.avg_run_rate_annual, NULL)        AS avg_run_rate_annual,
  IF(a.users >= p.k_anonymity_min, a.median_run_rate_annual, NULL)     AS median_run_rate_annual,
  IF(a.users >= p.k_anonymity_min, a.avg_consistency_weekly, NULL)     AS avg_consistency_weekly,
  IF(a.users >= p.k_anonymity_min, a.avg_savings_rate_of_income, NULL) AS avg_savings_rate_of_income,
  IF(a.users >= p.k_anonymity_min, a.total_balance, NULL)              AS total_balance,
  IF(a.users >= p.k_anonymity_min, a.avg_balance, NULL)                AS avg_balance,
  IF(a.users >= p.k_anonymity_min, a.at_risk_share, NULL)              AS at_risk_share,
  IF(a.users >= p.k_anonymity_min, a.total_balance * p.bank_margin_annual_pct, NULL)               AS est_annual_margin,
  IF(a.users >= p.k_anonymity_min, a.total_balance * p.bank_margin_annual_pct * p.ltv_years, NULL) AS est_ltv,
  CASE a.segment WHEN 'lt_1000' THEN 1 WHEN '1000_1500' THEN 2 WHEN '1500_2000' THEN 3 WHEN '2000_2500' THEN 4
    WHEN '2500_3000' THEN 5 WHEN 'gt_3000' THEN 6 WHEN 'sin_declarar' THEN 7 WHEN 'otros' THEN 8 ELSE 9 END AS sort_order
FROM agg a CROSS JOIN p;

-- Curva de ahorro acumulado medio por usuario según meses desde el registro (k-anónima).
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_bank_savings_curve` AS
WITH p AS (SELECT * FROM `{{project}}.{{an}}.params`),
u AS (SELECT user_id, cohort_date FROM `{{project}}.{{an}}.dim_user` WHERE NOT is_excluded),
m AS (
  SELECT u.user_id, n AS month_n
  FROM u, UNNEST(GENERATE_ARRAY(0, DATE_DIFF(CURRENT_DATE('Europe/Madrid'), u.cohort_date, MONTH))) n
),
cum AS (
  SELECT m.user_id, m.month_n, IFNULL(SUM(d.net_saved), 0) AS cumulative_net_saved
  FROM m JOIN u USING (user_id)
  LEFT JOIN `{{project}}.{{an}}.fct_user_day` d
    ON d.user_id = m.user_id AND d.date < DATE_ADD(u.cohort_date, INTERVAL m.month_n + 1 MONTH)
  GROUP BY 1, 2
)
SELECT month_n, COUNT(*) AS users,
  IF(COUNT(*) >= ANY_VALUE(p.k_anonymity_min), AVG(cumulative_net_saved), NULL) AS avg_cumulative_net_saved,
  IF(COUNT(*) >= ANY_VALUE(p.k_anonymity_min), APPROX_QUANTILES(cumulative_net_saved, 2)[OFFSET(1)], NULL) AS median_cumulative_net_saved
FROM cum CROSS JOIN p GROUP BY 1;
