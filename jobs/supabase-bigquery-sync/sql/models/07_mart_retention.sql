-- 07 · mart_cohort_retention: retención semanal por cohorte de registro (usuarios reales).
--   active = cualquier actividad (decisión, ahorro o evento de producto) en la semana N tras el registro.
--   Solo semanas observables (la semana N ya ha terminado o es la actual).
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_cohort_retention` AS
WITH u AS (SELECT user_id, cohort_week FROM `{{project}}.{{an}}.dim_user` WHERE NOT is_excluded),
size AS (SELECT cohort_week, COUNT(*) AS cohort_size FROM u GROUP BY 1),
act AS (
  SELECT DISTINCT u.cohort_week, d.user_id,
    DATE_DIFF(DATE_TRUNC(d.date, WEEK(MONDAY)), u.cohort_week, WEEK) AS week_n
  FROM `{{project}}.{{an}}.fct_user_day` d JOIN u USING (user_id) WHERE d.is_active
),
grid AS (
  SELECT s.cohort_week, s.cohort_size, n AS week_n
  FROM size s, UNNEST(GENERATE_ARRAY(0, DATE_DIFF(DATE_TRUNC(CURRENT_DATE('Europe/Madrid'), WEEK(MONDAY)), s.cohort_week, WEEK))) n
)
SELECT g.cohort_week, g.cohort_size, g.week_n,
  COUNT(DISTINCT a.user_id)                          AS active_users,
  SAFE_DIVIDE(COUNT(DISTINCT a.user_id), g.cohort_size) AS retention_rate
FROM grid g LEFT JOIN act a ON a.cohort_week = g.cohort_week AND a.week_n = g.week_n
GROUP BY 1, 2, 3;

-- Retención D1/D7/D30 clásica (sobre usuarios con la fecha objetivo ya observable).
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_retention_dn` AS
WITH u AS (SELECT user_id, cohort_date FROM `{{project}}.{{an}}.dim_user` WHERE NOT is_excluded),
a AS (SELECT user_id, date FROM `{{project}}.{{an}}.fct_user_day` WHERE is_active),
n AS (SELECT * FROM UNNEST([1, 7, 30]) AS dn)
SELECT n.dn,
  COUNT(DISTINCT IF(DATE_ADD(u.cohort_date, INTERVAL n.dn DAY) < CURRENT_DATE('Europe/Madrid'), u.user_id, NULL)) AS eligible_users,
  COUNT(DISTINCT IF(DATE_ADD(u.cohort_date, INTERVAL n.dn DAY) < CURRENT_DATE('Europe/Madrid') AND a.user_id IS NOT NULL, u.user_id, NULL)) AS retained_users,
  SAFE_DIVIDE(
    COUNT(DISTINCT IF(DATE_ADD(u.cohort_date, INTERVAL n.dn DAY) < CURRENT_DATE('Europe/Madrid') AND a.user_id IS NOT NULL, u.user_id, NULL)),
    COUNT(DISTINCT IF(DATE_ADD(u.cohort_date, INTERVAL n.dn DAY) < CURRENT_DATE('Europe/Madrid'), u.user_id, NULL))) AS retention_rate
FROM n CROSS JOIN u
LEFT JOIN a ON a.user_id = u.user_id AND a.date = DATE_ADD(u.cohort_date, INTERVAL n.dn DAY)
GROUP BY 1;
