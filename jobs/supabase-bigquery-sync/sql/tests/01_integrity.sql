-- T01 · Integridad de claves y relaciones (raw V2 + modelos).
-- Contrato de cada test: (test_name, severity, failures, details). failures = 0 → OK.
SELECT 'pk_unique_dim_user' AS test_name, 'critical' AS severity,
  COUNT(*) - COUNT(DISTINCT user_id) AS failures, CAST(NULL AS STRING) AS details
FROM `{{project}}.{{an}}.dim_user`
UNION ALL
SELECT 'pk_unique_fct_ledger', 'critical', COUNT(*) - COUNT(DISTINCT transaction_id), NULL
FROM `{{project}}.{{an}}.fct_ledger`
UNION ALL
SELECT 'pk_unique_fct_decision', 'critical', COUNT(*) - COUNT(DISTINCT decision_id), NULL
FROM `{{project}}.{{an}}.fct_decision`
UNION ALL
SELECT 'pk_unique_fct_user_day', 'critical', COUNT(*) - COUNT(DISTINCT CONCAT(user_id, '|', CAST(date AS STRING))), NULL
FROM `{{project}}.{{an}}.fct_user_day`
UNION ALL
SELECT 'pk_unique_mart_kpi_daily', 'critical', COUNT(*) - COUNT(DISTINCT date), NULL
FROM `{{project}}.{{an}}.mart_kpi_daily`
UNION ALL
SELECT 'pk_unique_mart_user_savings', 'critical', COUNT(*) - COUNT(DISTINCT user_id), NULL
FROM `{{project}}.{{an}}.mart_user_savings`
UNION ALL
-- Todo asiento del ledger pertenece a un usuario de auth existente.
SELECT 'fk_ledger_user_exists', 'critical', COUNT(*), STRING_AGG(DISTINCT t.user_id LIMIT 5)
FROM `{{project}}.{{raw}}.savings_transactions` t
LEFT JOIN `{{project}}.{{raw}}.auth_users` a ON a.user_id = t.user_id
WHERE a.user_id IS NULL
UNION ALL
-- Asientos de objetivo apuntan a un objetivo existente del mismo usuario.
SELECT 'fk_ledger_goal_exists', 'critical', COUNT(*), STRING_AGG(DISTINCT t.transaction_id LIMIT 5)
FROM `{{project}}.{{raw}}.savings_transactions` t
LEFT JOIN `{{project}}.{{raw}}.goals` g ON g.id = t.goal_id AND g.user_id = t.user_id
WHERE t.bucket_type = 'goal' AND (t.goal_id IS NULL OR g.id IS NULL)
UNION ALL
-- Una sola decisión diaria activa por usuario y día local.
SELECT 'one_active_decision_per_day', 'critical', COUNT(*), STRING_AGG(k LIMIT 5)
FROM (
  SELECT CONCAT(user_id, '|', CAST(local_date AS STRING)) AS k
  FROM `{{project}}.{{raw}}.daily_decisions` WHERE status = 'active'
  GROUP BY user_id, local_date HAVING COUNT(*) > 1
)
UNION ALL
-- Cada modelo tiene que existir y no estar vacío si hay usuarios reales.
SELECT 'models_not_empty', 'critical',
  IF((SELECT COUNT(*) FROM `{{project}}.{{an}}.dim_user` WHERE NOT is_excluded) = 0, 0,
     IF((SELECT COUNT(*) FROM `{{project}}.{{an}}.mart_kpi_daily`) = 0, 1, 0)
     + IF((SELECT COUNT(*) FROM `{{project}}.{{an}}.mart_user_savings`) = 0, 1, 0)
     + IF((SELECT COUNT(*) FROM `{{project}}.{{an}}.mart_funnel`) = 0, 1, 0)
     + IF((SELECT COUNT(*) FROM `{{project}}.{{an}}.mart_bank_segments`) = 0, 1, 0)),
  NULL;
