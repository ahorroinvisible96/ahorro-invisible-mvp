# Looker · Informe A (Interno) · Páginas 2 y 3: NEGOCIO/UX y CALIDAD DE DATOS (DQ)

Continuación del informe **«Ahorro Invisible · Operación Interna (Analytics V2)»**.
Todas las fuentes de estas dos páginas son **agregadas (cero `user_id`)**.

---

## Página 2 · NEGOCIO, AHORRO Y COMPORTAMIENTO UX (PostHog + Ledger)

Fuentes: `mart_kpi_summary`, `mart_kpi_daily`, `mart_goals_summary`, `mart_ux_intent_vs_confirmed_daily`, `mart_ux_prompt_conversion_daily`.

### FILA 1 · Balance y Ahorro Limpio (5 scorecards · `mart_kpi_summary`, `MAX`, sin fecha)
| # | Título | Campo | Formato | Aclaración obligatoria |
|---|---|---|---|---|
| 1 | **Ahorro orgánico declarado** | `total_net_saved_declared` | € (2 dec.) | Solo decisiones + ahorro extra ± ajustes |
| 2 | **Ahorro V2 Live (post-10/10)** | `net_saved_since_cutover` | € (2 dec.) | Generado bajo ledger V2 real |
| 3 | Saldo apertura V1 (heredado) | `opening_balance_v1` | € (2 dec.) | Separado; sin acciones V1 detrás |
| 4 | Saldo en Hucha (sin asignar) | `total_hucha_balance` | € (2 dec.) | Liquidez pendiente de asignar a meta |
| 5 | Run-rate anual mediano (ahorradores) | `median_run_rate_annual_savers` | €/año | Ventana 90d orgánico |

### FILA 2 · Evolución del ahorro diario vs extra (`1200 × 280`)
- Fuente: `mart_kpi_daily` (`is_closed_day = TRUE`), dimensión `date`.
- Gráfico combinado: barras apiladas `daily_saved` (`#0F9D8A`) + `extra_saved` (`#4F46E5`); línea eje derecho `cumulative_net_saved` («Acumulado orgánico», `#1F2A44`) y `cumulative_v2_live_net_saved` («Acumulado V2 Live», `#10B981`). **No mezclar `opening_balance_total` en la barra diaria.**

### FILA 3 · Objetivos agregados por horizonte (sin `user_id`, `mart_goals_summary`)
- **Scorecards (`mart_kpi_summary`, `MAX`):** `goals_active` · `goals_ever_completed` («Completados alguna vez») · `goals_currently_at_target` («Al 100 % hoy») · `avg_goal_progress` (%).
- **Tabla / barras (`mart_goals_summary`):** dimensión `horizon_bucket` (`short_1_3m`, `medium_4_6m`, `long_7_12m_plus`), métricas `goals_count` (`SUM`), `total_balance` (`SUM`), `median_target_amount` (`AVG`/`MAX`), `goals_ever_completed` (`SUM`).

### FILA 4 · Comportamiento PostHog & Fricción UX
- **Gráfico izquierdo (`mart_ux_intent_vs_confirmed_daily`, `580 × 260`):** barras/líneas diarias comparando `daily_submitted` vs `daily_confirmed`, `extra_submitted` vs `extra_confirmed`, `daily_skipped` y `client_errors` (desglosable por `surface`). Detecta de inmediato pérdidas del outbox o fricción de UI.
- **Gráfico derecho (`mart_ux_prompt_conversion_daily`, `580 × 260`):** tabla/barras por `time_slot` (`manana` / `tarde` / `noche`) y `surface` (`dashboard_widget` / `daily_page`) con `prompt_impressions`, `impressions_converted`, `impression_to_decision_rate` e `impression_to_save_rate`.

---

## Página 3 · SALUD DEL PIPELINE Y CALIDAD DE DATOS (`dq_results`)

Fuentes: `analytics_v2.dq_results`, `mart_kpi_summary`.

### FILA 1 · Estado del último run (`mart_kpi_summary` + `dq_results`)
- Tarjetas de frescura (`mart_kpi_summary`): `as_of_date`, `computed_at`, `last_ledger_record_at`, `last_posthog_event_at`.
- Filtro global de página (o tabla ordenada por `run_at DESC`): último `run_id` de `dq_results`.
- 3 Scorecards sobre el último `run_id`:
  - **Tests totales** (`COUNT(test_name)`)
  - **Fallos CRITICAL** (`COUNTIF(NOT passed AND severity = 'critical')` — debe ser **`0`**, semáforo rojo si > 0)
  - **Avisos WARNING** (`COUNTIF(NOT passed AND severity = 'warning')`)

### FILA 2 · Tabla de control de calidad en vivo (`dq_results`)
- Columnas: `test_name`, `severity`, `passed`, `failures`, `details`, `run_at`.
- Orden: `passed ASC`, `severity ASC`, `test_name ASC` (los avisos o fallos suben arriba del todo).
- Controles críticos a vigilar para auditoría bancaria:
  - `no_user_id_in_bank_dataset`
  - `no_pii_columns`
  - `bank_k_anonymity` y `bank_complementary_suppression`
  - `ledger_equals_goal_plus_hucha` y `ledger_saving_kind_reconciles`
  - `posthog_confirmed_orphan_txns`, `posthog_confirmed_vs_ledger` y `posthog_geoip_recent_check`
