# KPIs · Ahorro Invisible (Analytics V2 · Bank-Grade Governance)

Fuente interna: BigQuery `gen-lang-client-0725004018.analytics_v2` (job diario `supabase-to-bigquery`, `00:00 UTC`).
Fuente externa / bancos (aislada IAM, cero `user_id`): BigQuery `gen-lang-client-0725004018.analytics_bank_v2`.
SQL versionado en [`jobs/supabase-bigquery-sync/sql/models`](../../jobs/supabase-bigquery-sync/sql/models).
Tracking de producto: [tracking_plan.md](tracking_plan.md) · Privacidad: [privacy.md](privacy.md).

> [!WARNING]
> **Todo el ahorro es declarado por el usuario** en la app. No son movimientos bancarios verificados.
> Cualquier uso frente a bancos debe etiquetarse así y leerse exclusivamente desde el dataset aislado `analytics_bank_v2`.

## Reglas comunes de gobernanza

| Regla | Detalle |
|---|---|
| Usuarios | Solo reales: `dim_user.is_excluded = FALSE` (fuera internos `is_internal` y test sospechosos `is_suspected_test`). Todos los `fct_*`/`mart_*` vienen ya filtrados. |
| Día de referencia (portada) | `mart_kpi_summary` lee siempre el **último día cerrado** (`as_of_date = DATE_SUB(hoy Madrid, 1 DAY)`) para evitar `DAU ≈ 0` en la ejecución de las `00:00 UTC`. |
| Zona horaria | Días locales `Europe/Madrid` (`params.tz`). Nota histórica: el backfill V1 pre-`2026-10-10` provino de fechas UTC (`acquisition_era = 'v1_migrated'`). |
| Ahorro orgánico vs apertura V1 | `fct_ledger.net_saving_amount` = `daily_saving` + `extra_saving` + `amendment` + `reversal` (con resolución recursiva de `saving_kind`). Las transferencias netean `0`. El `migration_opening_balance` V1 (`opening_balance_v1`) se separa siempre del ahorro orgánico y nunca se imputa antes del `v2_cutover_date`. |
| 3 niveles de actividad | `is_app_active` (uso de app + vistas PostHog, con cobertura PostHog desde `2026-09-26`), `is_financial_active` (decisión o asiento en Supabase, continua desde el día 1), `is_saving_day` (≥1 asiento de ahorro y ahorro neto del día > 0). |
| Decisiones anuladas | `daily_decisions.status = 'voided'` no cuentan como decisión (`fct_decision.is_active = FALSE`). Su reversión sí resta en el ledger. |
| Parámetros (`analytics_v2.params`) | `mfeu_min_saving_days_30d = 2`, `habit_min_weeks_in_4w = 3`, `k_anonymity_min = 5`, `stat_min_n_indicative = 10`, `stat_min_n_robust = 30`, `bank_margin_annual_pct = 1,5 %`, `indicative_margin_years = 3`, `churn_inactive_days = 14`, `activation_window_days = 7`, `v2_cutover_date = 2026-10-10`, `posthog_start_date = 2026-09-26`. |

## 1 · Producto y Retención

| KPI | Definición | Fórmula / fuente | Granularidad |
|---|---|---|---|
| **MFEU (North Star)** | *Monthly Financial Engaged Users*: usuarios reales con **≥ 2 días distintos con ahorro orgánico neto > 0** en los últimos 30 días cerrados (`mfeu_min_saving_days_30d = 2`). Excluye vistas, logins, transferencias y saldo migrado V1. | `mart_kpi_daily.mfeu_30d` · `mart_kpi_summary.mfeu_30d` | Día cerrado |
| **Hábito activo (4 sem)** | Usuarios reales que han ahorrado en **≥ 3 de las últimas 4 semanas móviles** de 7 días (`habit_min_weeks_in_4w = 3`). Mide hábito vigente, no acumulación histórica. | `mart_kpi_daily.habit_users_4w` · `mart_kpi_summary.habit_users_4w` | Día cerrado |
| Ahorradores 30d | Usuarios reales con ≥ 1 día con ahorro neto > 0 en 30 días (métrica secundaria de amplitud). | `mart_kpi_daily.savers_30d` · `mart_kpi_summary.savers_30d` | Día cerrado |
| Usuarios registrados | Altas de Auth acumuladas (reales) + desglose `new_users_v2_native`. | `mart_kpi_daily.registered_users` · `mart_kpi_summary.registered_users` | Día |
| Actividad App (DAU / WAU / MAU) | Usuarios con `is_app_active` (incluye vistas PostHog desde `2026-09-26`). | `mart_kpi_daily.dau`, `wau`, `mau`, `stickiness_dau_mau` | Día cerrado |
| Actividad Financiera (fDAU / fWAU / fMAU) | Usuarios con `is_financial_active` (decisión o asiento en Supabase; comparable desde el día 1). | `mart_kpi_daily.financial_dau`, `financial_wau`, `financial_mau`, `financial_stickiness_dau_mau` | Día cerrado |
| Tasa de decisión diaria | % de activos que completan decisión diaria (disponible sobre App y sobre Financieros). | `daily_completion_rate` (`users_with_decision / dau`) · `daily_completion_rate_financial` | Día |
| Embudo de activación | Registro → Onboarding → 1er objetivo → 1er ahorro → **Ahorrador repetido (≥3 días acumulados)**. Segmentable por era (`all` / `v1_migrated` / `v2_native`). | `mart_funnel` · `mart_funnel_by_era` | Paso / era |
| Activación 7 d (limpia) | % de registrados cuyo primer ahorro ocurre en `[0, 7]` días tras el alta (`activated_7d_clean` excluye anomalías V1 previas al alta en Auth). | `mart_kpi_summary.activation_rate_7d_clean` · `mart_funnel_user.days_to_first_saving_clean` | Cohorte |
| Retención dual (D1 / D7 / D30 y cohortes) | Retención **de App** (`retention_rate`), **Financiera** (`financial_retention_rate`) y **de Ahorro** (`saving_retention_rate`), tanto en día exacto N como en ventana (`D1=[1..3]`, `D7=[7..13]`, `D30=[30..36]`). | `mart_retention_dn` · `mart_cohort_retention` | N / Cohorte × semana |

## 2 · Negocio, Ahorro y Comportamiento UX (PostHog + Ledger)

| KPI | Definición | Fórmula / fuente | Granularidad |
|---|---|---|---|
| **Ahorro neto orgánico declarado** | Ahorro explicado por decisiones diarias + ahorros extra ± correcciones/anulaciones (sin saldo de apertura V1). | `mart_kpi_daily.net_saved`, `cumulative_net_saved` · `mart_kpi_summary.total_net_saved_declared` | Día / total |
| **Ahorro V2 Live** | Ahorro neto orgánico generado exclusivamente bajo el ledger V2 desde `2026-10-10`. | `mart_kpi_daily.v2_live_net_saved`, `cumulative_v2_live_net_saved` · `mart_kpi_summary.net_saved_since_cutover` | Día / total |
| Saldo de apertura V1 (separado) | `migration_opening_balance` (backfill). Se muestra aparte únicamente para cuadrar el saldo total en balance. | `mart_kpi_summary.opening_balance_v1` | Total |
| Saldo actual (objetivos + hucha) | Σ todos los asientos del ledger (= `goal_balance + hucha_balance`). | `mart_kpi_summary.total_balance`, `total_hucha_balance` | Total |
| Desglose Diario vs Extra | Ahorro orgánico separado por raíz (`daily_saving` vs `extra_saving`), reconciliado recursivamente ante enmiendas encadenadas. | `mart_kpi_daily.daily_saved`, `extra_saved` | Día |
| Objetivos (desambiguados) | **Completados históricamente** (`was_ever_completed`) vs **Financiados al 100 % hoy** (`is_currently_at_target`), agregados sin `user_id` por horizonte (`1-3m`, `4-6m`, `7-12m+`). | `mart_goals_summary` · `mart_kpi_summary.goals_ever_completed`, `goals_currently_at_target` | Estado × horizonte |
| Conversión Intención → Confirmación (PostHog) | Relación entre `*_submitted` (UI) y `*_confirmed` (servidor) por `surface`, más `daily_skipped` y `client_errors`. | `mart_ux_intent_vs_confirmed_daily` | Día × superficie |
| Conversión Impresión → Decisión → Ahorro | Ratio de `daily_prompt_impressions` que terminan en decisión activa y en ahorro, por franja horaria (`manana`/`tarde`/`noche`) y superficie. | `mart_ux_prompt_conversion_daily` | Día × franja × superficie |

## 3 · Bancos (`analytics_bank_v2` · CERO `user_id`, k ≥ 5 + supresión complementaria + n ≥ 10/30)

Todas las tablas de banca viven replicadas en el dataset aislado **`analytics_bank_v2`** (verificado por test crítico `no_user_id_in_bank_dataset`):
1. `mart_bank_segments` (bandas de ingreso + `TOTAL`)
2. `mart_bank_savings_curve` (curva acumulada orgánica `M0..Mn` con media, `P25`, mediana `P50`, `P75`)
3. `mart_bank_goals_profile` (demanda de metas por horizonte mapeada a producto bancario)
4. `mart_bank_behavioral_segments` (propensión de ahorro por avatar conductual)
5. `bank_governance_metadata` (parámetros, fecha cerrada y aviso legal en cabecera)

**Regla de doble umbral y supresión complementaria:**
- **Privacidad (`k = 5`):** cualquier segmento con `< 5` usuarios se agrupa en `otros`. Si `otros` quedase entre `1` y `4`, el segmento cualificado más pequeño también se repliega en `otros`, garantizando matemáticamente que ningún ataque de resta (`TOTAL - publicados`) pueda reconstruir un grupo `< 5`. Solo con `users >= 5` se muestran recuentos (`users`, `savers`, `mfeu_users`, `habit_active_users`).
- **Estabilidad estadística (`n = 10` / `n = 30`):** los importes, medias, medianas, percentiles, ratios y simulaciones de margen solo se publican con `users >= 10` (`sample_confidence_tier = 'indicative_n10'`), y se etiquetan como comercialmente robustos a partir de `users >= 30` (`robust_n30`).

| KPI Bancario | Definición | Campos principales |
|---|---|---|
| Velocidad de ahorro anualizada (ahorradores) | `run_rate_annual` orgánico (últimos 90d cerrados, mínimo 30d) con **P25 / Mediana / P75 + media**, desglosado en **diario recurrente** vs **extra**, y separado de la media sobre todos los usuarios. | `p25_`/`median_`/`p75_`/`avg_run_rate_annual_savers`, `avg_run_rate_daily_savers`, `avg_run_rate_extra_savers`, `avg_run_rate_annual` |
| Compromiso y hábito bancario | % de usuarios MFEU (`≥2d/30d`), % con Hábito Activo (`≥3/4 sem`), consistencia semanal y riesgo financiero (`>14d` sin acción financiera). | `mfeu_rate`, `habit_active_rate`, `avg_consistency_weekly`, `financially_at_risk_share` |
| Ahorro orgánico y liquidez en hucha | Ahorro orgánico acumulado (total/media/mediana), V2 live, apertura V1 separada y % de saldo en hucha sin asignar. | `total_organic_net_saved`, `median_organic_net_saved`, `total_v2_live_net_saved`, `total_opening_balance_v1`, `hucha_balance_share` |
| Esfuerzo sobre ingreso de referencia | `run_rate_annual / 12 / income_reference_monthly` (nota: `lt_1000` y `gt_3000` están acotados en `income_ref_v1`). | `avg_savings_rate_of_income` |
| Encaje de producto por horizonte | Distribución de metas (`1-3m` liquidez/cuenta remunerada, `4-6m` hucha/depósito corto, `7-12m+` ahorro periódico), mediana de meta y tasa de cumplimiento. | `mart_bank_goals_profile` |
| Simulación orientativa de margen de pasivo | **No es LTV real.** `total_organic_net_saved × bank_margin_annual_pct` (1 año y 3 años), calculado **solo sobre ahorro orgánico declarado** (excluyendo apertura V1). | `indicative_annual_deposit_margin_organic_eur`, `indicative_3y_deposit_margin_organic_eur` |

## 4 · Calidad de datos automatizada (`analytics_v2.dq_results`)

Cada ejecución del Cloud Run Job ejecuta **> 60 controles** en 4 suites + reconciliación Supabase ↔ BigQuery. Un fallo `critical` detiene el job (`exit 1`):

| Suite | Controles clave |
|---|---|
| `01_integrity.sql` | PK únicas (`dim_user`, `fct_ledger`, `fct_decision`, `fct_prompt_impression`, `stg_events` deduplicado, `fct_user_day`, marts), FKs, 1 decisión activa/día, existencia de tablas internas y de `analytics_bank_v2`. |
| `02_ledger.sql` | Transferencias suman `0`, sin saldos negativos, referencias de anulación/enmienda válidas, `ledger_saving_kind_reconciles` (`daily + extra = net`), `Σ ledger = objetivos + hucha`. |
| `03_kpis.sql` | Cuadre diario/acumulado, jerarquía estricta `habit_4w ≤ mfeu_30d ≤ savers_30d ≤ financial_mau ≤ mau ≤ registrados`, cero `days_to_first_saving < 0`, ratios ∈ `[0, 1]`, **k-anonimato + supresión complementaria + umbral `n >= 10`**, paridad exacta `analytics_v2 ↔ analytics_bank_v2`. |
| `04_privacy_freshness.sql` | Cero internos en modelos, cero columnas PII en `raw`/`an`/`bank`, **`no_user_id_in_bank_dataset` (critical)**, reconciliación PostHog ↔ Ledger **sin bypass `e.n = 0`** + detección por **ID exacto** de transacciones/decisiones huérfanas, detector `posthog_geoip_recent_check`, frescura `< 26h`. |

## 5 · Limitaciones conocidas (declaración honesta `R04`)

- Mientras la muestra V2 nativa sea reducida, los segmentos con `5 ≤ n < 10` muestran recuentos pero suprimen ratios/medianas (`privacy_ok_low_n`), y los de `10 ≤ n < 30` se etiquetan `indicative_n10`.
- PostHog tiene eventos desde `2026-09-26`: comparar `is_app_active` antes y después de esa fecha mezcla bases distintas; para series largas consistentes usar `is_financial_active`.
- En bandas extremas (`lt_1000` ref `500 €`, `gt_3000` ref `3.000 €`), `savings_rate_of_income` es una aproximación acotada.
