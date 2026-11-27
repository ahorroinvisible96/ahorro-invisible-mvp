-- 02 · fct_ledger: asientos del ledger V2 de usuarios reales (excluye internos/test).
--   net_saving_amount: ahorro declarado neto orgánico (diario/extra + correcciones y anulaciones).
--   saving_kind: resuelve RECURSIVAMENTE el tipo raíz (daily_saving vs extra_saving) incluso en
--   correcciones/anulaciones encadenadas (amendment sobre amendment o reversal de amendment).
--   Las transferencias (hucha↔objetivo) netean 0 y no son ahorro nuevo.
--   migration_opening_balance: saldo V1 no explicado por decisiones (se reporta siempre aparte).
CREATE OR REPLACE TABLE `{{project}}.{{an}}.fct_ledger` AS
WITH RECURSIVE
t AS (
  SELECT * FROM `{{project}}.{{raw}}.savings_transactions`
),
chain AS (
  SELECT
    transaction_id AS start_id,
    transaction_id AS cur_id,
    transaction_type AS cur_type,
    COALESCE(reverses_transaction_id, amends_transaction_id) AS parent_id,
    0 AS depth
  FROM t
  WHERE transaction_type IN ('amendment', 'reversal')
  UNION ALL
  SELECT
    c.start_id,
    p.transaction_id AS cur_id,
    p.transaction_type AS cur_type,
    COALESCE(p.reverses_transaction_id, p.amends_transaction_id) AS parent_id,
    c.depth + 1 AS depth
  FROM chain c
  JOIN t p ON p.transaction_id = c.parent_id
  WHERE c.parent_id IS NOT NULL AND c.depth < 20
),
root AS (
  SELECT
    start_id AS transaction_id,
    cur_type AS root_type
  FROM chain
  WHERE cur_type IN ('daily_saving', 'extra_saving')
  QUALIFY ROW_NUMBER() OVER (PARTITION BY start_id ORDER BY depth ASC) = 1
)
SELECT
  t.transaction_id, t.user_id, t.transaction_type, t.bucket_type, t.goal_id, t.amount, t.currency,
  t.decision_id, t.transfer_group_id, t.reason, t.occurred_at, t.local_date, t.recorded_at, t.data_origin,
  CASE
    WHEN t.data_origin = 'v2_live' THEN 'v2_live'
    WHEN t.transaction_type = 'migration_opening_balance' OR t.data_origin = 'migration_adjustment' THEN 'migration_adjustment'
    ELSE 'v1_reconstructed'
  END                                                                     AS data_era,
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
