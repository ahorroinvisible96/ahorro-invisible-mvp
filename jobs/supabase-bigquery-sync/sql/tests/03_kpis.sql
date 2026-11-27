-- T03 · Coherencia de KPIs, jerarquía de actividad, k-anonimato, supresión complementaria y umbrales bancarios.
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
-- Jerarquía estricta: habit_4w <= mfeu_30d <= savers_30d <= financial_mau <= mau <= registered_users; financial_dau <= dau <= wau <= mau.
SELECT 'kpi_active_le_registered', 'critical',
  COUNTIF(NOT (
    dau <= wau AND wau <= mau AND mau <= registered_users
    AND financial_dau <= dau AND financial_dau <= financial_wau AND financial_wau <= financial_mau AND financial_mau <= mau
    AND habit_users_4w <= mfeu_30d AND mfeu_30d <= savers_30d AND savers_30d <= financial_mau
    AND savers <= registered_users
  )),
  STRING_AGG(IF(NOT (
    dau <= wau AND wau <= mau AND mau <= registered_users
    AND financial_dau <= dau AND financial_wau <= financial_mau AND financial_mau <= mau
    AND habit_users_4w <= mfeu_30d AND mfeu_30d <= savers_30d AND savers_30d <= financial_mau
  ), CAST(date AS STRING), NULL) LIMIT 5)
FROM `{{project}}.{{an}}.mart_kpi_daily`
UNION ALL
-- registered_users del último día = usuarios reales en dim_user.
SELECT 'kpi_registered_equals_dim_user', 'critical',
  IF(k.r <> u.n, 1, 0), FORMAT('kpi=%d dim_user=%d', k.r, u.n)
FROM (SELECT registered_users AS r FROM `{{project}}.{{an}}.mart_kpi_daily` WHERE date = CURRENT_DATE('Europe/Madrid')) k,
     (SELECT COUNT(*) AS n FROM `{{project}}.{{an}}.dim_user` WHERE NOT is_excluded) u
UNION ALL
-- days_to_first_saving nunca negativo (corrección backfill V1).
SELECT 'funnel_no_negative_days_to_first_saving', 'critical',
  COUNTIF(days_to_first_saving < 0 OR days_to_first_saving_clean < 0),
  STRING_AGG(IF(days_to_first_saving < 0, user_id, NULL) LIMIT 5)
FROM `{{project}}.{{an}}.mart_funnel_user`
UNION ALL
-- Ratios en [0, 1].
SELECT 'kpi_ratios_in_unit_interval', 'critical',
  (SELECT COUNTIF(retention_rate < 0 OR retention_rate > 1
                  OR financial_retention_rate < 0 OR financial_retention_rate > 1
                  OR saving_retention_rate < 0 OR saving_retention_rate > 1)
     FROM `{{project}}.{{an}}.mart_cohort_retention`)
  + (SELECT COUNTIF(retention_rate < 0 OR retention_rate > 1
                    OR financial_retention_rate < 0 OR financial_retention_rate > 1
                    OR retention_window_rate < 0 OR retention_window_rate > 1
                    OR financial_retention_window_rate < 0 OR financial_retention_window_rate > 1)
     FROM `{{project}}.{{an}}.mart_retention_dn`)
  + (SELECT COUNTIF(stickiness_dau_mau < 0 OR stickiness_dau_mau > 1
                    OR financial_stickiness_dau_mau < 0 OR financial_stickiness_dau_mau > 1
                    OR daily_completion_rate < 0 OR daily_completion_rate > 1
                    OR daily_completion_rate_financial < 0 OR daily_completion_rate_financial > 1)
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
-- Bancos: k-anonimato (k>=5) + umbral estadístico (n>=10) en mart_bank_segments.
SELECT 'bank_k_anonymity', 'critical',
  COUNTIF(
    (is_privacy_publishable AND users < p.k_anonymity_min)
    OR (NOT is_privacy_publishable AND (savers IS NOT NULL OR total_organic_net_saved IS NOT NULL OR total_balance IS NOT NULL))
    OR (is_statistically_publishable AND users < GREATEST(p.k_anonymity_min, p.stat_min_n_indicative))
    OR (NOT is_statistically_publishable AND (
         avg_run_rate_annual IS NOT NULL OR median_run_rate_annual_savers IS NOT NULL
         OR total_organic_net_saved IS NOT NULL OR total_balance IS NOT NULL
         OR indicative_3y_deposit_margin_organic_eur IS NOT NULL))
  ),
  STRING_AGG(IF(NOT is_statistically_publishable AND total_organic_net_saved IS NOT NULL, segment, NULL) LIMIT 5)
FROM `{{project}}.{{an}}.mart_bank_segments` CROSS JOIN `{{project}}.{{an}}.params` p
UNION ALL
-- Supresión complementaria: si TOTAL >= k, ningún segmento no-TOTAL puede quedar con < k usuarios (cero differencing attack).
SELECT 'bank_complementary_suppression', 'critical',
  IF(IFNULL((SELECT users FROM `{{project}}.{{an}}.mart_bank_segments` WHERE segment = 'TOTAL'), 0) < (SELECT k_anonymity_min FROM `{{project}}.{{an}}.params`),
     0,
     (SELECT COUNTIF(segment <> 'TOTAL' AND users < p.k_anonymity_min)
      FROM `{{project}}.{{an}}.mart_bank_segments` CROSS JOIN `{{project}}.{{an}}.params` p)
     + (SELECT COUNTIF(avatar_segment <> 'TOTAL' AND users < p.k_anonymity_min)
        FROM `{{project}}.{{an}}.mart_bank_behavioral_segments` CROSS JOIN `{{project}}.{{an}}.params` p)
     + IF(IFNULL((SELECT users FROM `{{project}}.{{an}}.mart_bank_goals_profile` WHERE horizon_segment = 'TOTAL'), 0) < (SELECT k_anonymity_min FROM `{{project}}.{{an}}.params`),
          0,
          (SELECT COUNTIF(horizon_segment <> 'TOTAL' AND users < p.k_anonymity_min)
           FROM `{{project}}.{{an}}.mart_bank_goals_profile` CROSS JOIN `{{project}}.{{an}}.params` p))),
  NULL
UNION ALL
SELECT 'bank_curve_k_anonymity', 'critical',
  COUNTIF(users < GREATEST(p.k_anonymity_min, p.stat_min_n_indicative)
          AND (avg_cumulative_net_saved IS NOT NULL OR median_cumulative_net_saved IS NOT NULL)),
  NULL
FROM `{{project}}.{{an}}.mart_bank_savings_curve` CROSS JOIN `{{project}}.{{an}}.params` p
UNION ALL
SELECT 'bank_goals_k_anonymity', 'critical',
  COUNTIF(
    (NOT is_privacy_publishable AND goals_count IS NOT NULL)
    OR (NOT is_statistically_publishable AND (median_target_amount IS NOT NULL OR total_goal_balance IS NOT NULL))
  ),
  NULL
FROM `{{project}}.{{an}}.mart_bank_goals_profile`
UNION ALL
SELECT 'bank_behavioral_k_anonymity', 'critical',
  COUNTIF(
    (NOT is_privacy_publishable AND savers IS NOT NULL)
    OR (NOT is_statistically_publishable AND (median_run_rate_annual_savers IS NOT NULL OR total_organic_net_saved IS NOT NULL))
  ),
  NULL
FROM `{{project}}.{{an}}.mart_bank_behavioral_segments`
UNION ALL
-- Paridad exacta entre analytics_v2 y el dataset bancario aislado analytics_bank_v2.
SELECT 'bank_isolated_dataset_parity', 'critical',
  ABS((SELECT COUNT(*) FROM `{{project}}.{{an}}.mart_bank_segments`) - (SELECT COUNT(*) FROM `{{project}}.{{bank}}.mart_bank_segments`))
  + ABS((SELECT COUNT(*) FROM `{{project}}.{{an}}.mart_bank_savings_curve`) - (SELECT COUNT(*) FROM `{{project}}.{{bank}}.mart_bank_savings_curve`))
  + ABS((SELECT COUNT(*) FROM `{{project}}.{{an}}.mart_bank_goals_profile`) - (SELECT COUNT(*) FROM `{{project}}.{{bank}}.mart_bank_goals_profile`))
  + ABS((SELECT COUNT(*) FROM `{{project}}.{{an}}.mart_bank_behavioral_segments`) - (SELECT COUNT(*) FROM `{{project}}.{{bank}}.mart_bank_behavioral_segments`)),
  NULL
UNION ALL
-- Segmento TOTAL de bancos = nº usuarios reales.
SELECT 'bank_total_equals_users', 'critical',
  IF(IFNULL(b.users, 0) <> u.n, 1, 0), FORMAT('bank_total=%d users=%d', IFNULL(b.users, 0), u.n)
FROM (SELECT COUNT(*) AS n FROM `{{project}}.{{an}}.mart_user_savings`) u
LEFT JOIN (SELECT users FROM `{{project}}.{{an}}.mart_bank_segments` WHERE segment = 'TOTAL') b ON TRUE
UNION ALL
-- Resumen titular presente (una fila) y referido a día cerrado (o único día disponible).
SELECT 'kpi_summary_single_row', 'critical', ABS(COUNT(*) - 1), NULL
FROM `{{project}}.{{an}}.mart_kpi_summary`;
