-- 00 · Parámetros de negocio y gobernanza (editables). Un único registro.
CREATE OR REPLACE TABLE `{{project}}.{{an}}.params` AS
SELECT
  'Europe/Madrid'   AS tz,
  DATE '2026-10-10' AS v2_cutover_date,           -- V2 fuente de verdad desde esta fecha
  DATE '2026-09-26' AS posthog_start_date,        -- inicio real del batch export de PostHog (ruptura estructural)
  2                 AS mfeu_min_saving_days_30d,  -- MFEU real: ≥2 días distintos con ahorro neto > 0 en 30d
  3                 AS habit_min_weeks_in_4w,     -- Hábito activo: ≥3 de las últimas 4 semanas móviles con ahorro
  0.015             AS bank_margin_annual_pct,    -- margen anual orientativo sobre saldo orgánico declarado (simulación, NO LTV real)
  3                 AS indicative_margin_years,   -- horizonte de simulación orientativa en años
  3                 AS ltv_years,                 -- alias de compatibilidad con consultas existentes (= indicative_margin_years)
  5                 AS k_anonymity_min,           -- mínimo estricto de privacidad k-anonimato + supresión complementaria
  10                AS stat_min_n_indicative,     -- mínimo muestral para publicar ratios/medianas indicativas
  30                AS stat_min_n_robust,         -- umbral comercial bancario de estabilidad estadística
  14                AS churn_inactive_days,       -- días sin actividad → en riesgo
  7                 AS activation_window_days;    -- ventana para "primer ahorro" tras el registro
