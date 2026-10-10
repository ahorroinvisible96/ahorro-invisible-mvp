-- 04 · fct_user_day: actividad y ahorro por usuario real y día local (Europe/Madrid).
--   Activo = ≥1 decisión diaria activa, ≥1 asiento de ahorro o ≥1 evento de producto en PostHog.
CREATE OR REPLACE TABLE `{{project}}.{{an}}.fct_user_day` AS
WITH led AS (
  SELECT user_id, local_date AS date,
    SUM(net_saving_amount)                                        AS net_saved,
    SUM(IF(saving_kind = 'daily_saving', net_saving_amount, 0))   AS daily_saved,
    SUM(IF(saving_kind = 'extra_saving', net_saving_amount, 0))   AS extra_saved,
    COUNTIF(transaction_type = 'extra_saving')                    AS extra_savings_count,
    COUNTIF(transaction_type IN ('daily_saving', 'extra_saving')) AS saving_entries
  FROM `{{project}}.{{an}}.fct_ledger` WHERE NOT is_transfer AND opening_balance_amount = 0
  GROUP BY 1, 2
),
dec AS (
  SELECT user_id, local_date AS date,
    COUNTIF(is_active)                        AS decisions,
    COUNTIF(is_active AND outcome = 'saved')  AS saved_decisions,
    COUNTIF(is_active AND outcome = 'zero')   AS zero_decisions
  FROM `{{project}}.{{an}}.fct_decision` GROUP BY 1, 2
),
ev AS (
  SELECT e.user_id, e.event_date AS date, COUNT(*) AS product_events
  FROM `{{project}}.{{an}}.stg_events` e
  JOIN `{{project}}.{{an}}.dim_user` u ON u.user_id = e.user_id AND NOT u.is_excluded
  WHERE NOT e.is_posthog_internal GROUP BY 1, 2
),
spine AS (
  SELECT user_id, date FROM led UNION DISTINCT
  SELECT user_id, date FROM dec UNION DISTINCT
  SELECT user_id, date FROM ev
)
SELECT
  s.user_id, s.date,
  IFNULL(dec.decisions, 0)          AS decisions,
  IFNULL(dec.saved_decisions, 0)    AS saved_decisions,
  IFNULL(dec.zero_decisions, 0)     AS zero_decisions,
  IFNULL(led.net_saved, 0)          AS net_saved,
  IFNULL(led.daily_saved, 0)        AS daily_saved,
  IFNULL(led.extra_saved, 0)        AS extra_saved,
  IFNULL(led.extra_savings_count, 0) AS extra_savings_count,
  IFNULL(ev.product_events, 0)      AS product_events,
  (IFNULL(dec.decisions, 0) > 0 OR IFNULL(led.saving_entries, 0) > 0 OR IFNULL(ev.product_events, 0) > 0) AS is_active,
  (IFNULL(led.saving_entries, 0) > 0 AND IFNULL(led.net_saved, 0) > 0) AS is_saving_day
FROM spine s
LEFT JOIN led USING (user_id, date)
LEFT JOIN dec USING (user_id, date)
LEFT JOIN ev  USING (user_id, date);
