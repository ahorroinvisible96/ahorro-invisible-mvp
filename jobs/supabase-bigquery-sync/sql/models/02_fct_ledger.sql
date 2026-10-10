-- 02 · fct_ledger: asientos del ledger V2 de usuarios reales (excluye internos/test).
--   net_saving_amount: ahorro declarado neto (diario/extra + correcciones y anulaciones).
--   Las transferencias (hucha↔objetivo) netean 0 y no son ahorro nuevo.
--   migration_opening_balance: saldo V1 no explicado por decisiones (histórico, se reporta aparte).
CREATE OR REPLACE TABLE `{{project}}.{{an}}.fct_ledger` AS
WITH t AS (SELECT * FROM `{{project}}.{{raw}}.savings_transactions`),
root AS (  -- tipo de ahorro original para correcciones/anulaciones (diario vs extra)
  SELECT c.transaction_id, o.transaction_type AS root_type
  FROM t c JOIN t o ON o.transaction_id = COALESCE(c.reverses_transaction_id, c.amends_transaction_id)
)
SELECT
  t.transaction_id, t.user_id, t.transaction_type, t.bucket_type, t.goal_id, t.amount, t.currency,
  t.decision_id, t.transfer_group_id, t.reason, t.occurred_at, t.local_date, t.recorded_at, t.data_origin,
  CASE
    WHEN t.transaction_type IN ('daily_saving', 'extra_saving') THEN t.transaction_type
    WHEN t.transaction_type IN ('amendment', 'reversal') THEN COALESCE(root.root_type, 'daily_saving')
  END                                                                     AS saving_kind,
  IF(t.transaction_type IN ('daily_saving', 'extra_saving', 'amendment', 'reversal'), t.amount, 0) AS net_saving_amount,
  IF(t.transaction_type = 'migration_opening_balance', t.amount, 0)       AS opening_balance_amount,
  t.transaction_type IN ('transfer_in', 'transfer_out')                   AS is_transfer,
  t.data_origin = 'v2_live'                                               AS is_v2_live
FROM t
JOIN `{{project}}.{{an}}.dim_user` u ON u.user_id = t.user_id AND NOT u.is_excluded
LEFT JOIN root USING (transaction_id);
