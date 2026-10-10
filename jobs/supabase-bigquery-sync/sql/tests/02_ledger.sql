-- T02 · Coherencia del ledger V2 (sobre raw, todos los usuarios, y sobre los modelos).
-- Transferencias hucha↔objetivo: cada transfer_group_id suma exactamente 0.
SELECT 'ledger_transfer_groups_sum_zero' AS test_name, 'critical' AS severity, COUNT(*) AS failures,
  STRING_AGG(transfer_group_id LIMIT 5) AS details
FROM (
  SELECT transfer_group_id
  FROM `{{project}}.{{raw}}.savings_transactions`
  WHERE transaction_type IN ('transfer_in', 'transfer_out')
  GROUP BY transfer_group_id
  HAVING transfer_group_id IS NULL OR SUM(amount) <> 0 OR COUNT(*) < 2
)
UNION ALL
-- Ningún bucket (hucha / objetivo) con saldo negativo.
SELECT 'ledger_no_negative_balances', 'critical', COUNT(*),
  STRING_AGG(CONCAT(bucket_type, ':', IFNULL(goal_id, '-'), '=', CAST(bal AS STRING)) LIMIT 5)
FROM (
  SELECT user_id, bucket_type, goal_id, SUM(amount) AS bal
  FROM `{{project}}.{{raw}}.savings_transactions`
  GROUP BY 1, 2, 3 HAVING SUM(amount) < 0
)
UNION ALL
-- Anulaciones/correcciones referencian un asiento existente del mismo usuario.
SELECT 'ledger_reversal_refs_valid', 'critical', COUNT(*), STRING_AGG(c.transaction_id LIMIT 5)
FROM `{{project}}.{{raw}}.savings_transactions` c
LEFT JOIN `{{project}}.{{raw}}.savings_transactions` o
  ON o.transaction_id = COALESCE(c.reverses_transaction_id, c.amends_transaction_id) AND o.user_id = c.user_id
WHERE c.transaction_type IN ('reversal', 'amendment') AND o.transaction_id IS NULL
UNION ALL
-- Un asiento no se anula más de una vez.
SELECT 'ledger_single_reversal', 'critical', COUNT(*), STRING_AGG(reverses_transaction_id LIMIT 5)
FROM (
  SELECT reverses_transaction_id FROM `{{project}}.{{raw}}.savings_transactions`
  WHERE reverses_transaction_id IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1
)
UNION ALL
-- Σ ledger (usuarios reales) = Σ saldos de objetivos + hucha en mart_user_savings.
SELECT 'ledger_equals_goal_plus_hucha', 'critical',
  IF(ABS(l.total - (s.goal + s.hucha)) > 0.005 OR ABS(l.total - s.cur) > 0.005, 1, 0),
  FORMAT('ledger=%s goals=%s hucha=%s current=%s', CAST(l.total AS STRING), CAST(s.goal AS STRING),
         CAST(s.hucha AS STRING), CAST(s.cur AS STRING))
FROM (SELECT IFNULL(SUM(amount), 0) AS total FROM `{{project}}.{{an}}.fct_ledger`) l,
     (SELECT IFNULL(SUM(goal_balance), 0) AS goal, IFNULL(SUM(hucha_balance), 0) AS hucha,
             IFNULL(SUM(current_balance), 0) AS cur FROM `{{project}}.{{an}}.mart_user_savings`) s
UNION ALL
-- Saldo de objetivos en mart_goals cuadra con el ledger (objetivos no borrados).
SELECT 'mart_goals_balance_matches_ledger', 'critical',
  IF(ABS(g.bal - l.bal) > 0.005, 1, 0),
  FORMAT('mart_goals=%s ledger=%s', CAST(g.bal AS STRING), CAST(l.bal AS STRING))
FROM (SELECT IFNULL(SUM(balance), 0) AS bal FROM `{{project}}.{{an}}.mart_goals`) g,
     (SELECT IFNULL(SUM(f.amount), 0) AS bal FROM `{{project}}.{{an}}.fct_ledger` f
      JOIN `{{project}}.{{raw}}.goals` rg ON rg.id = f.goal_id
      WHERE f.bucket_type = 'goal' AND rg.status <> 'deleted') l
UNION ALL
-- Decisiones 'saved' activas tienen su asiento daily_saving.
SELECT 'decision_saved_has_ledger_entry', 'warning', COUNT(*), STRING_AGG(d.decision_id LIMIT 5)
FROM `{{project}}.{{raw}}.daily_decisions` d
LEFT JOIN `{{project}}.{{raw}}.savings_transactions` t
  ON t.decision_id = d.decision_id AND t.transaction_type = 'daily_saving'
WHERE d.status = 'active' AND d.outcome = 'saved' AND IFNULL(d.declared_amount, 0) > 0 AND t.transaction_id IS NULL;
