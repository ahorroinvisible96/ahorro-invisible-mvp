-- T03 · Coherencia de KPIs y marts.
-- Σ ahorro neto diario en mart_kpi_daily = Σ ahorro neto del ledger (sin saldo de apertura V1).
SELECT 'kpi_daily_sum_equals_ledger' AS test_name, 'critical' AS severity,
  IF(ABS(k.s - l.s) > 0.005, 1, 0) AS failures,
  FORMAT('kpi_daily=%s ledger=%s', CAST(k.s AS STRING), CAST(l.s AS STRING)) AS details
FROM (SELECT IFNULL(SUM(net_saved), 0) AS s FROM `{{project}}.{{an}}.mart_kpi_daily`) k,
     (SELECT IFNULL(SUM(net_saving_amount), 0) AS s FROM `{{project}}.{{an}}.fct_ledger`
      WHERE local_date <= CURRENT_DATE('Europe/Madrid')) l
UNION ALL
-- Acumulado final = total por usuario (mart_user_savings).
SELECT 'kpi_cumulative_equals_user_totals', 'critical',
  IF(ABS(k.c - s.t) > 0.005, 1, 0),
  FORMAT('kpi_cumulative_total=%s user_total_saved=%s', CAST(k.c AS STRING), CAST(s.t AS STRING))
FROM (SELECT cumulative_total_saved AS c FROM `{{project}}.{{an}}.mart_kpi_daily`
      WHERE date = CURRENT_DATE('Europe/Madrid')) k,
     (SELECT IFNULL(SUM(total_saved), 0) AS t FROM `{{project}}.{{an}}.mart_user_savings`) s
UNION ALL
-- dau ≤ wau ≤ mau ≤ registrados; savers ≤ dau-ish (savers_30d ≤ mau).
SELECT 'kpi_active_le_registered', 'critical', COUNTIF(NOT (dau <= wau AND wau <= mau AND mau <= registered_users
                                                         AND savers_30d <= mau AND savers <= registered_users)),
  STRING_AGG(IF(NOT (dau <= wau AND wau <= mau AND mau <= registered_users), CAST(date AS STRING), NULL) LIMIT 5)
FROM `{{project}}.{{an}}.mart_kpi_daily`
UNION ALL
-- registered_users del último día = usuarios reales en dim_user.
SELECT 'kpi_registered_equals_dim_user', 'critical',
  IF(k.r <> u.n, 1, 0), FORMAT('kpi=%d dim_user=%d', k.r, u.n)
FROM (SELECT registered_users AS r FROM `{{project}}.{{an}}.mart_kpi_daily` WHERE date = CURRENT_DATE('Europe/Madrid')) k,
     (SELECT COUNT(*) AS n FROM `{{project}}.{{an}}.dim_user` WHERE NOT is_excluded) u
UNION ALL
-- Ratios en [0, 1].
SELECT 'kpi_ratios_in_unit_interval', 'critical',
  (SELECT COUNTIF(retention_rate < 0 OR retention_rate > 1) FROM `{{project}}.{{an}}.mart_cohort_retention`)
  + (SELECT COUNTIF(retention_rate < 0 OR retention_rate > 1) FROM `{{project}}.{{an}}.mart_retention_dn`)
  + (SELECT COUNTIF(stickiness_dau_mau < 0 OR stickiness_dau_mau > 1 OR daily_completion_rate < 0 OR daily_completion_rate > 1)
     FROM `{{project}}.{{an}}.mart_kpi_daily`)
  + (SELECT COUNTIF(consistency_weekly < 0 OR consistency_weekly > 1) FROM `{{project}}.{{an}}.mart_user_savings`)
  + (SELECT COUNTIF(progress_pct < 0 OR progress_pct > 1) FROM `{{project}}.{{an}}.mart_goals`)
  + (SELECT COUNTIF(conversion_from_signup < 0 OR conversion_from_signup > 1) FROM `{{project}}.{{an}}.mart_funnel`),
  NULL
UNION ALL
-- Embudo monótono: cada paso ≤ el anterior.
SELECT 'funnel_monotonic', 'warning', COUNTIF(conversion_from_previous > 1),
  STRING_AGG(IF(conversion_from_previous > 1, step_name, NULL) LIMIT 5)
FROM `{{project}}.{{an}}.mart_funnel`
UNION ALL
-- Bancos: ningún segmento publicable con < k usuarios y ninguna métrica visible en segmentos no publicables.
SELECT 'bank_k_anonymity', 'critical',
  COUNTIF((is_publishable AND users < p.k_anonymity_min)
          OR (NOT is_publishable AND (avg_run_rate_annual IS NOT NULL OR total_balance IS NOT NULL OR savers IS NOT NULL))),
  STRING_AGG(IF(NOT is_publishable AND total_balance IS NOT NULL, segment, NULL) LIMIT 5)
FROM `{{project}}.{{an}}.mart_bank_segments` CROSS JOIN `{{project}}.{{an}}.params` p
UNION ALL
SELECT 'bank_curve_k_anonymity', 'critical',
  COUNTIF(users < p.k_anonymity_min AND avg_cumulative_net_saved IS NOT NULL), NULL
FROM `{{project}}.{{an}}.mart_bank_savings_curve` CROSS JOIN `{{project}}.{{an}}.params` p
UNION ALL
-- Segmento TOTAL de bancos = nº usuarios reales.
SELECT 'bank_total_equals_users', 'critical',
  IF(IFNULL(b.users, 0) <> u.n, 1, 0), FORMAT('bank_total=%d users=%d', IFNULL(b.users, 0), u.n)
FROM (SELECT COUNT(*) AS n FROM `{{project}}.{{an}}.mart_user_savings`) u
LEFT JOIN (SELECT users FROM `{{project}}.{{an}}.mart_bank_segments` WHERE segment = 'TOTAL') b ON TRUE
UNION ALL
-- Resumen titular presente (una fila).
SELECT 'kpi_summary_single_row', 'critical', ABS(COUNT(*) - 1), NULL
FROM `{{project}}.{{an}}.mart_kpi_summary`;
