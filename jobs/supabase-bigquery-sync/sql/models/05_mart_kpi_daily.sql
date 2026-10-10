-- 05 · mart_kpi_daily: serie diaria de KPIs de producto y ahorro (usuarios reales).
CREATE OR REPLACE TABLE `{{project}}.{{an}}.mart_kpi_daily` AS
WITH users AS (SELECT * FROM `{{project}}.{{an}}.dim_user` WHERE NOT is_excluded),
bounds AS (
  SELECT LEAST(IFNULL((SELECT MIN(cohort_date) FROM users), CURRENT_DATE('Europe/Madrid')),
               IFNULL((SELECT MIN(date) FROM `{{project}}.{{an}}.fct_user_day`), CURRENT_DATE('Europe/Madrid'))) AS d0,
         CURRENT_DATE('Europe/Madrid') AS d1
),
days AS (SELECT d AS date FROM bounds, UNNEST(GENERATE_DATE_ARRAY(bounds.d0, bounds.d1)) d),
ud AS (SELECT * FROM `{{project}}.{{an}}.fct_user_day`),
reg AS (SELECT cohort_date AS date, COUNT(*) AS new_users FROM users GROUP BY 1),
act AS (
  SELECT d.date,
    COUNT(DISTINCT IF(ud.date = d.date AND ud.is_active, ud.user_id, NULL))                                  AS dau,
    COUNT(DISTINCT IF(ud.date BETWEEN DATE_SUB(d.date, INTERVAL 6 DAY) AND d.date AND ud.is_active, ud.user_id, NULL))  AS wau,
    COUNT(DISTINCT IF(ud.date BETWEEN DATE_SUB(d.date, INTERVAL 29 DAY) AND d.date AND ud.is_active, ud.user_id, NULL)) AS mau,
    COUNT(DISTINCT IF(ud.date BETWEEN DATE_SUB(d.date, INTERVAL 29 DAY) AND d.date AND ud.is_saving_day, ud.user_id, NULL)) AS savers_30d
  FROM days d LEFT JOIN ud ON ud.date BETWEEN DATE_SUB(d.date, INTERVAL 29 DAY) AND d.date
  GROUP BY 1
),
day AS (
  SELECT date,
    SUM(decisions) AS decisions, SUM(saved_decisions) AS saved_decisions, SUM(zero_decisions) AS zero_decisions,
    COUNTIF(decisions > 0) AS users_with_decision,
    SUM(net_saved) AS net_saved, SUM(daily_saved) AS daily_saved, SUM(extra_saved) AS extra_saved,
    SUM(extra_savings_count) AS extra_savings, COUNTIF(is_saving_day) AS savers
  FROM ud GROUP BY 1
),
opening AS (SELECT IFNULL(SUM(opening_balance_amount), 0) AS opening_total FROM `{{project}}.{{an}}.fct_ledger`),
goals AS (
  SELECT local_date AS date,
    COUNTIF(event_type = 'created')   AS goals_created,
    COUNTIF(event_type = 'completed') AS goals_completed,
    COUNTIF(event_type = 'archived')  AS goals_archived
  FROM `{{project}}.{{raw}}.goal_events` ge
  JOIN users u USING (user_id) GROUP BY 1
)
SELECT
  d.date,
  IFNULL(reg.new_users, 0)                                                     AS new_users,
  SUM(IFNULL(reg.new_users, 0)) OVER (ORDER BY d.date)                         AS registered_users,
  act.dau, act.wau, act.mau, act.savers_30d,
  SAFE_DIVIDE(act.dau, act.mau)                                                AS stickiness_dau_mau,
  IFNULL(day.decisions, 0)          AS decisions,
  IFNULL(day.saved_decisions, 0)    AS saved_decisions,
  IFNULL(day.zero_decisions, 0)     AS zero_decisions,
  IFNULL(day.users_with_decision, 0) AS users_with_decision,
  SAFE_DIVIDE(day.users_with_decision, act.dau)                                AS daily_completion_rate,
  IFNULL(day.net_saved, 0)          AS net_saved,
  IFNULL(day.daily_saved, 0)        AS daily_saved,
  IFNULL(day.extra_saved, 0)        AS extra_saved,
  IFNULL(day.extra_savings, 0)      AS extra_savings,
  IFNULL(day.savers, 0)             AS savers,
  SUM(IFNULL(day.net_saved, 0)) OVER (ORDER BY d.date)                         AS cumulative_net_saved,
  opening.opening_total                                                        AS opening_balance_total,
  SUM(IFNULL(day.net_saved, 0)) OVER (ORDER BY d.date) + opening.opening_total AS cumulative_total_saved,
  IFNULL(goals.goals_created, 0)    AS goals_created,
  IFNULL(goals.goals_completed, 0)  AS goals_completed,
  IFNULL(goals.goals_archived, 0)   AS goals_archived
FROM days d
CROSS JOIN opening
LEFT JOIN reg   USING (date)
LEFT JOIN act   USING (date)
LEFT JOIN day   USING (date)
LEFT JOIN goals USING (date);
