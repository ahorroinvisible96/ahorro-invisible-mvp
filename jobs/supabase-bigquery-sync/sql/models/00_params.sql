-- 00 · Parámetros de negocio (editables). Un único registro.
CREATE OR REPLACE TABLE `{{project}}.{{an}}.params` AS
SELECT
  'Europe/Madrid'   AS tz,
  DATE '2026-10-10' AS v2_cutover_date,      -- V2 fuente de verdad desde esta fecha
  0.015             AS bank_margin_annual_pct, -- margen anual orientativo sobre saldo captable (LTV)
  3                 AS ltv_years,              -- horizonte del LTV orientativo
  5                 AS k_anonymity_min,        -- mínimo de usuarios por segmento en la página Bancos
  14                AS churn_inactive_days,    -- días sin actividad → en riesgo
  7                 AS activation_window_days; -- ventana para "primer ahorro" tras el registro
