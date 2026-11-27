-- T04 · Privacidad, aislamiento bancario, exclusión de internos/test, reconciliación por ID PostHog ↔ ledger y frescura.
-- Ningún usuario interno/test llega a las tablas modeladas.
SELECT 'no_excluded_users_in_models' AS test_name, 'critical' AS severity,
  (SELECT COUNT(*) FROM `{{project}}.{{an}}.fct_ledger` f JOIN `{{project}}.{{an}}.dim_user` u USING (user_id) WHERE u.is_excluded)
  + (SELECT COUNT(*) FROM `{{project}}.{{an}}.fct_decision` f JOIN `{{project}}.{{an}}.dim_user` u USING (user_id) WHERE u.is_excluded)
  + (SELECT COUNT(*) FROM `{{project}}.{{an}}.fct_prompt_impression` f JOIN `{{project}}.{{an}}.dim_user` u USING (user_id) WHERE u.is_excluded)
  + (SELECT COUNT(*) FROM `{{project}}.{{an}}.fct_user_day` f JOIN `{{project}}.{{an}}.dim_user` u USING (user_id) WHERE u.is_excluded)
  + (SELECT COUNT(*) FROM `{{project}}.{{an}}.mart_user_savings` f JOIN `{{project}}.{{an}}.dim_user` u USING (user_id) WHERE u.is_excluded)
  + (SELECT COUNT(*) FROM `{{project}}.{{an}}.mart_goals` f JOIN `{{project}}.{{an}}.dim_user` u USING (user_id) WHERE u.is_excluded)
    AS failures,
  CAST(NULL AS STRING) AS details
UNION ALL
-- Ningún nombre de columna sensible (email, nombre, texto libre, ingreso exacto, IP) en raw V2, analytics ni dataset bancos.
SELECT 'no_pii_columns', 'critical', COUNT(*), STRING_AGG(CONCAT(table_schema, '.', table_name, '.', column_name) LIMIT 10)
FROM (
  SELECT table_schema, table_name, column_name, data_type FROM `{{project}}.{{raw}}.INFORMATION_SCHEMA.COLUMNS`
  UNION ALL
  SELECT table_schema, table_name, column_name, data_type FROM `{{project}}.{{an}}.INFORMATION_SCHEMA.COLUMNS`
  UNION ALL
  SELECT table_schema, table_name, column_name, data_type FROM `{{project}}.{{bank}}.INFORMATION_SCHEMA.COLUMNS`
)
WHERE data_type <> 'BOOL'
  AND REGEXP_CONTAINS(LOWER(column_name),
    r'^(email|e_mail|phone|phone_number|name|full_name|first_name|last_name|display_name|title|goal_title|free_text|custom_text|answer_text|income_amount|monthly_income|income_exact|income_range|ip|ip_address|address)$')
UNION ALL
-- Dataset bancario aislado (`analytics_bank_v2`): PROHIBIDO cualquier identificador de usuario, sesión o entidad individual.
SELECT 'no_user_id_in_bank_dataset', 'critical', COUNT(*),
  STRING_AGG(CONCAT(table_name, '.', column_name) LIMIT 10)
FROM `{{project}}.{{bank}}.INFORMATION_SCHEMA.COLUMNS`
WHERE REGEXP_CONTAINS(LOWER(column_name),
  r'^(user_id|distinct_id|supabase_user_id|goal_id|decision_id|transaction_id|impression_id|assessment_id|session_id|command_id)$')
UNION ALL
-- Usuarios marcados como internos/test (informativo: cuántos se excluyen).
SELECT 'excluded_users_info', 'info', 0,
  FORMAT('excluded=%d internal=%d suspected_test=%d real=%d',
         COUNTIF(is_excluded), COUNTIF(is_internal), COUNTIF(is_suspected_test), COUNTIF(NOT is_excluded))
FROM `{{project}}.{{an}}.dim_user`
UNION ALL
-- PostHog ↔ ledger (recuento): eventos *_confirmed de ahorro V2 vs asientos V2 live.
-- Ya NO da PASS silencioso si PostHog cae a 0 habiendo asientos V2 live (tolerancia: 15 % o 2 asientos por adblockers).
SELECT 'posthog_confirmed_vs_ledger', 'warning',
  IF(l.n = 0 OR (e.n > 0 AND ABS(e.n - l.n) <= GREATEST(2, 0.15 * l.n)), 0, 1),
  FORMAT('posthog_confirmed=%d ledger_v2_live=%d', e.n, l.n)
FROM (SELECT COUNT(DISTINCT transaction_id) AS n FROM `{{project}}.{{an}}.stg_events`
      WHERE event IN ('daily_decision_confirmed', 'extra_saving_confirmed') AND transaction_id IS NOT NULL
        AND event_date >= (SELECT v2_cutover_date FROM `{{project}}.{{an}}.params`)) e,
     (SELECT COUNT(*) AS n FROM `{{project}}.{{an}}.fct_ledger`
      WHERE is_v2_live AND transaction_type IN ('daily_saving', 'extra_saving')) l
UNION ALL
-- Reconciliación por ID exacto: todo evento *_confirmed con transaction_id debe existir en fct_ledger (cero huérfanos).
SELECT 'posthog_confirmed_orphan_txns', 'warning', COUNT(*), STRING_AGG(e.transaction_id LIMIT 5)
FROM (
  SELECT DISTINCT transaction_id
  FROM `{{project}}.{{an}}.stg_events`
  WHERE event IN ('daily_decision_confirmed', 'extra_saving_confirmed')
    AND transaction_id IS NOT NULL
    AND event_date >= (SELECT v2_cutover_date FROM `{{project}}.{{an}}.params`)
) e
LEFT JOIN `{{project}}.{{an}}.fct_ledger` l ON l.transaction_id = e.transaction_id
WHERE l.transaction_id IS NULL
UNION ALL
-- Reconciliación por ID exacto: todo evento daily_decision_confirmed / grace_day_confirmed debe existir en fct_decision.
SELECT 'posthog_confirmed_orphan_decisions', 'warning', COUNT(*), STRING_AGG(e.decision_id LIMIT 5)
FROM (
  SELECT DISTINCT decision_id
  FROM `{{project}}.{{an}}.stg_events`
  WHERE event IN ('daily_decision_confirmed', 'grace_day_confirmed')
    AND decision_id IS NOT NULL
    AND event_date >= (SELECT v2_cutover_date FROM `{{project}}.{{an}}.params`)
) e
LEFT JOIN `{{project}}.{{an}}.fct_decision` d ON d.decision_id = e.decision_id
WHERE d.decision_id IS NULL
UNION ALL
-- Privacidad PostHog: detectar si eventos recientes (últimos 7d) siguen llegando con $geoip/$ip del servidor PostHog.
SELECT 'posthog_geoip_recent_check', 'warning',
  COUNTIF(has_geoip_or_ip),
  FORMAT('recent_7d_with_geoip_or_ip=%d/%d', COUNTIF(has_geoip_or_ip), COUNT(*))
FROM `{{project}}.{{an}}.stg_events`
WHERE event_date >= DATE_SUB(CURRENT_DATE('Europe/Madrid'), INTERVAL 7 DAY)
UNION ALL
-- Frescura PostHog: último evento hace < 26 h (si hay export activo).
SELECT 'freshness_posthog_26h', 'warning',
  IF(MAX(timestamp) IS NULL OR TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(timestamp), HOUR) >= 26, 1, 0),
  FORMAT('last_event=%s', IFNULL(CAST(MAX(timestamp) AS STRING), 'none'))
FROM `{{project}}.{{ph}}.events`
UNION ALL
-- Frescura de la carga raw: la tabla del ledger se ha reescrito en las últimas 26 h.
SELECT 'freshness_raw_load_26h', 'critical',
  IF(TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), TIMESTAMP_MILLIS(last_modified_time), HOUR) >= 26, 1, 0),
  FORMAT('raw_supabase_v2.savings_transactions modified=%s', CAST(TIMESTAMP_MILLIS(last_modified_time) AS STRING))
FROM `{{project}}.{{raw}}.__TABLES__` WHERE table_id = 'savings_transactions'
UNION ALL
-- Actividad del ledger: algún asiento en los últimos 7 días (aviso de posible rotura del flujo de escritura).
SELECT 'ledger_activity_7d', 'warning',
  IF(MAX(recorded_at) IS NULL OR TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(recorded_at), DAY) >= 7, 1, 0),
  FORMAT('last_recorded_at=%s', IFNULL(CAST(MAX(recorded_at) AS STRING), 'none'))
FROM `{{project}}.{{raw}}.savings_transactions`;
