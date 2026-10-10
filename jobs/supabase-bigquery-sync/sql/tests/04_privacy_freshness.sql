-- T04 · Privacidad, exclusión de internos/test, PostHog ↔ ledger y frescura.
-- Ningún usuario interno/test llega a las tablas modeladas.
SELECT 'no_excluded_users_in_models' AS test_name, 'critical' AS severity,
  (SELECT COUNT(*) FROM `{{project}}.{{an}}.fct_ledger` f JOIN `{{project}}.{{an}}.dim_user` u USING (user_id) WHERE u.is_excluded)
  + (SELECT COUNT(*) FROM `{{project}}.{{an}}.fct_decision` f JOIN `{{project}}.{{an}}.dim_user` u USING (user_id) WHERE u.is_excluded)
  + (SELECT COUNT(*) FROM `{{project}}.{{an}}.fct_user_day` f JOIN `{{project}}.{{an}}.dim_user` u USING (user_id) WHERE u.is_excluded)
  + (SELECT COUNT(*) FROM `{{project}}.{{an}}.mart_user_savings` f JOIN `{{project}}.{{an}}.dim_user` u USING (user_id) WHERE u.is_excluded)
  + (SELECT COUNT(*) FROM `{{project}}.{{an}}.mart_goals` f JOIN `{{project}}.{{an}}.dim_user` u USING (user_id) WHERE u.is_excluded)
    AS failures,
  CAST(NULL AS STRING) AS details
UNION ALL
-- Ningún nombre de columna sensible (email, nombre, texto libre, ingreso exacto) en raw V2 ni en analytics.
-- Coincidencia exacta de nombre; los flags booleanos (p. ej. has_custom_text) y catálogos no cuentan.
SELECT 'no_pii_columns', 'critical', COUNT(*), STRING_AGG(CONCAT(table_schema, '.', table_name, '.', column_name) LIMIT 10)
FROM (
  SELECT table_schema, table_name, column_name, data_type FROM `{{project}}.{{raw}}.INFORMATION_SCHEMA.COLUMNS`
  UNION ALL
  SELECT table_schema, table_name, column_name, data_type FROM `{{project}}.{{an}}.INFORMATION_SCHEMA.COLUMNS`
)
WHERE data_type <> 'BOOL'
  AND REGEXP_CONTAINS(LOWER(column_name),
    r'^(email|e_mail|phone|phone_number|name|full_name|first_name|last_name|display_name|title|goal_title|free_text|custom_text|answer_text|income_amount|monthly_income|income_exact|income_range|ip|ip_address|address)$')
UNION ALL
-- Usuarios marcados como internos/test (informativo: cuántos se excluyen).
SELECT 'excluded_users_info', 'info', 0,
  FORMAT('excluded=%d internal=%d suspected_test=%d real=%d',
         COUNTIF(is_excluded), COUNTIF(is_internal), COUNTIF(is_suspected_test), COUNTIF(NOT is_excluded))
FROM `{{project}}.{{an}}.dim_user`
UNION ALL
-- PostHog ↔ ledger: eventos *_confirmed de ahorro (V2 tracking) vs asientos de ahorro desde el cutover.
-- Tolerancia: 10 % o 2 asientos. Mientras el tracking V2 no emita *_confirmed, queda como warning informativo.
SELECT 'posthog_confirmed_vs_ledger', 'warning',
  IF(e.n = 0 OR ABS(e.n - l.n) <= GREATEST(2, 0.1 * l.n), 0, 1),
  FORMAT('posthog_confirmed=%d ledger_v2_live=%d%s', e.n, l.n, IF(e.n = 0, ' (tracking V2 *_confirmed aún sin eventos)', ''))
FROM (SELECT COUNT(DISTINCT transaction_id) AS n FROM `{{project}}.{{an}}.stg_events`
      WHERE event IN ('daily_decision_confirmed', 'extra_saving_confirmed') AND transaction_id IS NOT NULL
        AND event_date >= (SELECT v2_cutover_date FROM `{{project}}.{{an}}.params`)) e,
     (SELECT COUNT(*) AS n FROM `{{project}}.{{an}}.fct_ledger`
      WHERE is_v2_live AND transaction_type IN ('daily_saving', 'extra_saving')) l
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
