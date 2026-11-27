# Looker · Informe B (Externo / Comercial): «Ahorro Invisible · Bank Intelligence»

> [!CAUTION]
> **Aislamiento obligatorio:** Este informe debe crearse como un **informe de Looker Studio físicamente separado** del informe interno y conectarse **EXCLUSIVAMENTE** al dataset de BigQuery **`gen-lang-client-0725004018.analytics_bank_v2`** usando una cuenta de servicio o credenciales con permiso IAM de solo lectura limitado a ese único dataset. **Nunca** conectar `analytics_v2` ni `raw_*`.

## Fuentes permitidas (5 tablas en `analytics_bank_v2` · 0 columnas `user_id` / PII)
1. `analytics_bank_v2.bank_governance_metadata`
2. `analytics_bank_v2.mart_bank_segments`
3. `analytics_bank_v2.mart_bank_savings_curve`
4. `analytics_bank_v2.mart_bank_goals_profile`
5. `analytics_bank_v2.mart_bank_behavioral_segments`

Lienzo: `1200 × 1400 px`, estética ejecutiva bancaria (fondo `#FFFFFF`, primario `#0F172A`, teal `#0F9D8A`, gris pizarra `#475569`).

---

## Cabecera de Cumplimiento y Transparencia (obligatoria)
- **Título:** «Ahorro Invisible · Bank Intelligence (Panel Agregado k-Anónimo)»
- **Banda de gobernanza (conectada a `bank_governance_metadata`):** muestra dinámicamente `as_of_date` («Datos cerrados al…»), `k_anonymity_min` (`k ≥ 5` + supresión complementaria), `stat_min_n_indicative` (`n ≥ 10`), `stat_min_n_robust` (`n ≥ 30`) y el campo `governance_disclaimer`:
  > *«Dataset 100 % agregado y k-anónimo. Todo el ahorro es declarado por el usuario en la app, no corresponde a movimientos bancarios verificados. Las simulaciones de margen son orientativas sobre ahorro orgánico neto (excluyen saldo migrado V1) y no constituyen LTV real.»*

---

## BLOQUE 1 · Resumen de Cartera Agregada (Filtro `segment = 'TOTAL'` en `mart_bank_segments`)

| # | Título | Campo (`MAX`) | Formato | Etiqueta de confianza |
|---|---|---|---|---|
| 1 | Base real analizada | `users` | Entero | Mostrar junto a `sample_confidence_tier` |
| 2 | Ahorradores activos (`MFEU ≥2d/30d`) | `mfeu_rate` | % (1 dec.) | Con `mfeu_users` debajo |
| 3 | Hábito recurrente (`≥3/4 sem`) | `habit_active_rate` | % (1 dec.) | Con `habit_active_users` debajo |
| 4 | Velocidad anual mediana (ahorradores) | `median_run_rate_annual_savers` | €/año | Subtítulo: `P25`–`P75` |
| 5 | Ahorro orgánico declarado total | `total_organic_net_saved` | € | Separado de `total_opening_balance_v1` |

*(Si `is_statistically_publishable = FALSE`, configurar Looker para mostrar `N/A (n<10)` — nunca sustituir nulos por `0`.)*

---

## BLOQUE 2 · Segmentación por Banda Salarial (`mart_bank_segments`, filtro `segment <> 'TOTAL'`, orden `sort_order ASC`)

- **Tabla ejecutiva bancaria (`1200 × 280`):**
  - Columnas: `segment` (Banda ingreso), `users`, `sample_confidence_tier` (semáforo: `robust_n30` verde, `indicative_n10` ámbar, `privacy_ok_low_n` gris), `savers`, `mfeu_rate`, `habit_active_rate`, `median_run_rate_annual_savers`, `p25_run_rate_annual_savers`, `p75_run_rate_annual_savers`, `avg_run_rate_daily_savers` (hábito) vs `avg_run_rate_extra_savers` (puntual), `avg_savings_rate_of_income`, `total_organic_net_saved`, `hucha_balance_share`.
- **Nota metodológica al pie:** «En bandas `lt_1000` y `gt_3000` el ingreso de referencia está acotado (`500 €` / `3.000 €`). Bandas con `< 5` usuarios se agrupan en `otros` con supresión complementaria. Ratios y cuantiles requieren `n ≥ 10`.»

---

## BLOQUE 3 · Curva de Acumulación Orgánica (`mart_bank_savings_curve`)
- **Gráfico de líneas (`720 × 280`):** eje X `month_n` (`M0, M1, M2…`), filtro `is_statistically_publishable = TRUE`:
  - `p75_cumulative_net_saved` (P75 — línea fina `#94A3B8`)
  - `median_cumulative_net_saved` (**Mediana P50** — trazo principal `#0F9D8A`, 3 px)
  - `p25_cumulative_net_saved` (P25 — línea fina `#94A3B8`)
  - `avg_cumulative_net_saved` (Media — discontinua `#0F172A`)
- **Bloque lateral (`450 × 280` · Simulación orientativa de margen de pasivo):**
  - Fuente: `mart_bank_segments` (`segment = 'TOTAL'`).
  - Muestra `indicative_annual_deposit_margin_organic_eur` y `indicative_3y_deposit_margin_organic_eur` junto a `bank_margin_annual_pct` (`1,5 %`) e `indicative_margin_years` (`3 años`) de `bank_governance_metadata`, etiquetado explícitamente como **«Simulación orientativa sobre ahorro orgánico declarado (no es LTV real)»**.

---

## BLOQUE 4 · Encaje de Productos Bancarios por Horizonte (`mart_bank_goals_profile`)
- **Tabla / barras (`680 × 260`):** filtro `horizon_segment <> 'TOTAL'`, orden `sort_order ASC`.
  - Dimensiones: `banking_product_fit` (*Liquidez / Cuenta remunerada 1-3m*, *Hucha / Depósito corto 4-6m*, *Ahorro periódico / Inversión 7-12m+*).
  - Métricas: `users`, `goals_count`, `median_target_amount`, `median_progress_pct`, `ever_completed_rate`, `median_days_to_complete`, `total_goal_balance`.
- **Utilidad comercial:** demuestra al banco qué parte de la base demanda cuenta remunerada de corto plazo frente a productos de ahorro sistemático a 6–12 meses.

---

## BLOQUE 5 · Inteligencia Conductual por Avatar (`mart_bank_behavioral_segments`)
- **Tabla comparativa (`500 × 260`):** filtro `avatar_segment <> 'TOTAL'`, orden `sort_order ASC`.
  - Dimensiones: `avatar_segment` (`comodo`, `social`, `impulsivo`, `sin_evaluar`, `otros`).
  - Métricas: `users`, `sample_confidence_tier`, `mfeu_rate`, `habit_active_rate`, `median_run_rate_annual_savers`, `avg_consistency_weekly`, `total_organic_net_saved`.
- **Nota:** se iluminará automáticamente por avatar a medida que crezcan las cohortes nativas V2 (`avatar_assessments`) superando `k >= 5` y `n >= 10`.

---

## Checklist obligatorio antes de compartir con un banco
- [ ] Verificar en Looker → *Recurso → Gestionar fuentes de datos añadidas* que **todas** apuntan a `analytics_bank_v2.*` (cero tablas de `analytics_v2` o `raw_*`).
- [ ] Confirmar en `analytics_v2.dq_results` último run: `no_user_id_in_bank_dataset = PASS`, `bank_k_anonymity = PASS`, `bank_complementary_suppression = PASS`, `no_pii_columns = PASS`.
- [ ] Desactivar en Looker la descarga de datos subyacentes si no aplica y activar marca de agua / fecha cerrada visible.
- [ ] Confirmar que `sample_confidence_tier` está visible junto a cualquier cifra con `n < 30`.
