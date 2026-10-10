# KPIs · Ahorro Invisible (Analytics V2)

Fuente: BigQuery `gen-lang-client-0725004018.analytics_v2` (job diario `supabase-to-bigquery`, 00:00 UTC).
SQL versionado en [`jobs/supabase-bigquery-sync/sql/models`](../../jobs/supabase-bigquery-sync/sql/models).
Tracking de producto: [tracking_plan.md](tracking_plan.md).

> [!WARNING]
> **Todo el ahorro es declarado por el usuario** en la app. No son movimientos bancarios verificados.
> Cualquier uso frente a bancos debe etiquetarse así.

## Reglas comunes

| Regla | Detalle |
|---|---|
| Usuarios | Solo reales: `dim_user.is_excluded = FALSE` (fuera internos `is_internal` y test sospechosos `is_suspected_test`). Todos los `fct_*`/`mart_*` ya vienen filtrados. |
| Zona horaria | Días locales `Europe/Madrid` (`params.tz`). El ledger guarda además `local_date` del usuario. |
| Ahorro neto | `fct_ledger.net_saving_amount` = `daily_saving` + `extra_saving` + `amendment` + `reversal`. Las transferencias hucha↔objetivo netean 0 y **no** son ahorro nuevo. |
| Saldo de apertura V1 | `migration_opening_balance` (backfill del cutover 2026-10-10): saldo V1 no explicado por decisiones. Se reporta aparte (`opening_balance_*`) y se suma solo en "ahorro total". |
| Activo (día) | `fct_user_day.is_active`: ≥1 decisión diaria activa, ≥1 asiento de ahorro o ≥1 evento de producto en PostHog. |
| Día con ahorro | `fct_user_day.is_saving_day`: ≥1 asiento de ahorro y ahorro neto del día > 0. |
| Decisiones anuladas | `daily_decisions.status = 'voided'` no cuentan como decisión (`fct_decision.is_active`). Su reversión sí resta en el ledger. |
| Parámetros | `analytics_v2.params` (editables): `bank_margin_annual_pct = 1,5 %`, `ltv_years = 3`, `k_anonymity_min = 5`, `churn_inactive_days = 14`, `activation_window_days = 7`, `v2_cutover_date = 2026-10-10`. |

## 1 · Producto

| KPI | Definición | Fórmula / fuente | Granularidad | Línea base 2026-10-10 |
|---|---|---|---|---|
| Usuarios registrados | Altas de auth acumuladas (reales) | `mart_kpi_daily.registered_users` = Σ `new_users` hasta la fecha | Día | 22 |
| DAU / WAU / MAU | Usuarios activos en el día / 7 d / 30 d móviles | `mart_kpi_daily.dau`, `wau`, `mau` (sobre `fct_user_day.is_active`) | Día | MAU 2 · WAU 2 |
| Stickiness | Frecuencia de uso | `dau / mau` (`stickiness_dau_mau`) | Día | 0,50 |
| Tasa de decisión diaria completada | % de activos del día que registran su decisión | `users_with_decision / dau` (`daily_completion_rate`) | Día | — |
| Embudo de activación | Registro → onboarding → 1er objetivo → 1er ahorro → hábito (≥3 días con ahorro) | `mart_funnel` (`conversion_from_signup`, `conversion_from_previous`) · por usuario en `mart_funnel_user` | Paso / cohorte | 1er ahorro 63,6 % |
| Activación 7 d | % de registrados con 1er ahorro ≤ 7 días tras el alta | `COUNTIF(activated_7d) / COUNT(*)` en `mart_funnel_user` | Cohorte | 63,6 % |
| Tiempo hasta 1er ahorro | Días desde el alta al primer asiento de ahorro | `mart_funnel_user.days_to_first_saving` (mediana en Looker) | Usuario | — |
| Retención D1 / D7 / D30 | % de usuarios activos exactamente N días tras el alta (solo elegibles: alta + N < hoy) | `mart_retention_dn.retention_rate` | N | D7 18,2 % · D30 0 % |
| Retención por cohorte | % de la cohorte semanal activa en la semana N | `mart_cohort_retention.retention_rate` | Cohorte × semana | — |
| Rachas / días con ahorro | Días distintos con ahorro por usuario | `mart_user_savings.saving_days` | Usuario | — |

## 2 · Ahorro (negocio)

| KPI | Definición | Fórmula / fuente | Granularidad | Línea base |
|---|---|---|---|---|
| Ahorro neto declarado | Ahorro registrado en la app (sin saldo de apertura) | Σ `fct_ledger.net_saving_amount` · `mart_kpi_summary.total_net_saved_declared` | Día / total | 14.445,35 € |
| Ahorro total | Neto declarado + saldo de apertura V1 | `total_saved` = `total_net_saved` + `opening_balance` | Total | 20.989,55 € |
| Ahorro desde el cutover V2 | Solo asientos `data_origin = 'v2_live'` | `net_saved_since_cutover` | Total | 0 € (cutover hoy) |
| Saldo actual | Σ de todos los asientos (objetivos + hucha) | `mart_user_savings.current_balance` (= `goal_balance` + `hucha_balance`) | Usuario / total | 20.989,55 € |
| Ahorro por usuario activo/mes | Ahorro neto / meses con actividad | `mart_user_savings.saved_per_active_month` | Usuario | — |
| Importe por decisión | Importe declarado en decisiones con ahorro | `fct_decision.declared_amount WHERE outcome='saved' AND is_active` (mediana) | Decisión | — |
| Tasa de días "cero" | % de decisiones sin ahorro | `zero_decisions / decisions` (`mart_kpi_daily` o `mart_user_savings`) | Día / usuario | — |
| Tasa de reversiones | Asientos anulados sobre asientos de ahorro | `reversals / saving_entries` (`mart_user_savings`) | Usuario / total | — |
| Ahorro extra | Importe y nº de ahorros extra | `mart_kpi_daily.extra_saved`, `extra_savings` | Día | — |
| Objetivos activos / completados | Estado V2; completado = evento `completed` o saldo ≥ objetivo | `mart_goals.status`, `is_completed` | Objetivo | 37 activos · 4 completados |
| Progreso medio de objetivos | Saldo del ledger / importe objetivo (máx. 100 %) | `AVG(mart_goals.progress_pct) WHERE status='active'` | Objetivo | 22,7 % |
| Tiempo hasta objetivo | Días de creación a completado | `mart_goals.days_to_complete` | Objetivo | — |
| Saldo en hucha | Ahorro sin asignar a objetivo | Σ `mart_user_savings.hucha_balance` | Total | — |
| Creación/archivo de objetivos | Eventos de ciclo de vida del servidor | `mart_kpi_daily.goals_created`, `goals_completed`, `goals_archived` (de `goal_events`) | Día | — |

## 3 · Bancos (solo agregados, k ≥ 5)

Todas las métricas bancarias salen de `mart_bank_segments` / `mart_bank_savings_curve`: **nunca filas por usuario**.
Segmentos de banda de ingreso con < 5 usuarios se agrupan en `otros`; si aun así < 5, las métricas se suprimen (`NULL`, `is_publishable = FALSE`).

| KPI | Definición | Fórmula / fuente | Línea base |
|---|---|---|---|
| Run-rate anualizado | Ahorro neto de los últimos 90 días anualizado; ventana mínima 30 días para no inflar recién llegados | `net_saved_90d × 365 / GREATEST(30, LEAST(90, días desde alta + 1))` → `avg_/median_run_rate_annual` | Media ahorradores 75,58 €/año · mediana 0 € |
| Consistencia semanal | % de semanas con ≥1 día de ahorro desde la primera semana con ahorro | `weeks_with_saving / semanas desde 1er ahorro` → `avg_consistency_weekly` | 9,8 % |
| Curva de ahorro acumulado | Ahorro neto acumulado medio/mediano por usuario a N meses del alta | `mart_bank_savings_curve` | — |
| Ahorro como % del ingreso | Run-rate mensual / ingreso de referencia de la banda declarada (punto medio del catálogo `income_ref_v1`) | `run_rate_annual / 12 / income_reference_monthly` → `avg_savings_rate_of_income` | 0,28 % |
| Distribución por banda | Usuarios por banda de ingreso (k-anónima) | `mart_bank_segments.users` por `segment` | 2000_2500: 6 · otros: 16 |
| Saldo potencial captable | Saldo declarado acumulado (equivalente depósito) | `total_balance`, `avg_balance` | 20.989,55 € |
| Riesgo de abandono | % sin actividad > 14 días | `at_risk_share` (`is_at_risk`) | 90,9 % |
| Margen anual estimado | Saldo × margen anual orientativo | `total_balance × bank_margin_annual_pct` → `est_annual_margin` | — |
| LTV orientativo | Margen anual × años | `total_balance × bank_margin_annual_pct × ltv_years` → `est_ltv` | 944,53 € (total) |

> [!IMPORTANT]
> `est_annual_margin` y `est_ltv` son **orientativos** y dependen de parámetros editables en `analytics_v2.params`
> (1,5 % anual, 3 años). No son ingresos reales ni previsiones.

## 4 · Calidad de datos

Cada ejecución del job escribe `analytics_v2.dq_results` (50 tests en la versión actual). Un fallo `critical` hace
fallar la ejecución (visible en Cloud Run / Cloud Logging). Resumen de controles:

| Bloque | Tests |
|---|---|
| Reconciliación | Supabase ↔ BigQuery por tabla: filas, Σ importes, último `created_at` |
| Integridad | PK únicas y no nulas, FKs (usuario/objetivo), catálogos válidos |
| Ledger | Σ ledger = Σ saldos objetivos + hucha; transferencias suman 0; sin saldos negativos |
| KPIs | Σ diario = total del periodo; activos ≤ registrados; retención ∈ [0, 1]; segmentos bancarios con k ≥ 5 |
| Privacidad | Sin columnas PII; ningún usuario excluido en `fct_*`/`mart_*` |
| PostHog ↔ ledger | `transaction_id` distintos en `daily_decision_confirmed` + `extra_saving_confirmed` ≈ asientos de ahorro V2 (tolerancia 10 % o 2) |
| Frescura | Carga raw < 26 h (critical); último evento PostHog < 26 h (warning) |

Consulta rápida del último resultado:

```sql
SELECT test_name, severity, failures, details
FROM `gen-lang-client-0725004018.analytics_v2.dq_results`
WHERE run_id = (SELECT run_id FROM `gen-lang-client-0725004018.analytics_v2.dq_results` ORDER BY run_at DESC LIMIT 1)
ORDER BY failures DESC, severity;
```

## 5 · Limitaciones conocidas

- Muestra pequeña (22 usuarios reales): porcentajes muy volátiles; la página Bancos suprime segmentos con < 5 usuarios.
- PostHog solo tiene eventos desde 2026-09-26 (export activo) y los `*_confirmed` desde el despliegue de 5C.1; los KPIs de
  producto anteriores se apoyan en Supabase (decisiones/ledger), no en eventos.
- Retención D30 = 0 % porque casi ninguna cohorte es aún elegible con actividad en su día 30.
- El histórico V1 (`raw_supabase`) está congelado desde el cutover y no se mezcla con KPIs V2 salvo el saldo de apertura.
