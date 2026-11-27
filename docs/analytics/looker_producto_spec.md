# Looker · Informe A (Interno) · Página 1: PRODUCTO & RETENCIÓN

Informe: **«Ahorro Invisible · Operación Interna (Analytics V2)»** (solo acceso equipo).
Fuentes autorizadas en esta página: `mart_kpi_summary`, `mart_kpi_daily`, `mart_funnel`, `mart_funnel_by_era`, `mart_retention_dn`, `mart_cohort_retention`.

> [!IMPORTANT]
> **Gobernanza obligatoria:** Desconectar `mart_user_savings` y `mart_goals` (contienen `user_id`) de este informe. Ningún gráfico ni fuente de Looker interno debe exponer `user_id`, email, nombre, títulos de objetivos ni texto libre.

Lienzo recomendado: `1200 × 1200 px`, fondo blanco, paleta: azul marino `#1F2A44`, acento teal `#0F9D8A`, índigo `#4F46E5`, gris `#6B7280`.

## Cabecera
| Elemento | Configuración |
|---|---|
| Título | «Ahorro Invisible · Producto y Retención» (`22 px`, negrita, `#1F2A44`) |
| Subtítulo dinámico | «Usuarios reales (sin internos ni test). Datos cerrados al `as_of_date` (`mart_kpi_summary`). Ahorro declarado por el usuario.» |
| Selector de periodo | Control «Filtro por periodo» arriba a la derecha. Dimensión `date` de `mart_kpi_daily`. **Afecta solo a FILA 3.** |

> **Regla de scorecards:** Ningún scorecard conectado a `mart_kpi_summary`, `mart_funnel` o `mart_retention_dn` debe llevar dimensión de periodo (`computed_at` eliminado!) y todos usan agregación **`MAX`** (nunca `SUM`).

## FILA 1 · Scorecards titulares (5 tarjetas · día cerrado)

| # | Título | Fuente | Métrica (`MAX`) | Filtro | Nota visual |
|---|---|---|---|---|---|
| 1 | Usuarios registrados | `mart_kpi_summary` | `registered_users` | — | Entero `#1F2A44` |
| 2 | Activación 7d (limpia) | `mart_kpi_summary` | `activation_rate_7d_clean` | — | Porcentaje 1 dec. |
| 3 | **MFEU · NORTH STAR** | `mart_kpi_summary` | `mfeu_30d` | — | **Tarjeta destacada** borde `#0F9D8A`, subtítulo «≥2 días con ahorro neto en 30d» |
| 4 | Hábito activo (4 sem) | `mart_kpi_summary` | `habit_users_4w` | — | Entero `#4F46E5`, subtítulo «Ahorro en ≥3 de las últimas 4 semanas» |
| 5 | Ahorradores 30d (≥1d) | `mart_kpi_summary` | `savers_30d` | — | Entero `#6B7280` |

Fila secundaria compacta (derecha/debajo): `financial_active_users_30d` («MAU Financiero»), `active_users_30d` («MAU App»), `financial_stickiness_dau_mau` («Stickiness Financiera · día cerrado»).

## FILA 2 · Embudo de activación (Total vs Era V2 Nativa)
- **Control superior del bloque:** selector `era` sobre `mart_funnel_by_era` (`all` por defecto, conmutable a `v2_native` / `v1_migrated`).
- **Gráfico de barras horizontales (`760 × 260`):** fuente `mart_funnel_by_era`, dimensión `step_name`, métrica `users` (`MAX`), orden `step` ascendente:
  1. Registro → 2. Onboarding completado → 3. Primer objetivo → 4. Primer ahorro → 5. **Ahorrador repetido (≥3 días acumulados)**.
- **Tabla de conversión (`420 × 260`):** `step_name`, `% sobre registro` (`conversion_from_signup`), `% sobre paso anterior` (`conversion_from_previous`).

## FILA 3 · Series temporales: Actividad App vs Financiera vs MFEU (`1200 × 300`)
- Fuente: `mart_kpi_daily`, filtro `is_closed_day = TRUE` (evita caída artificial del día en curso).
- Dimensión de fecha: `date`.
- Series (un único eje Y, agregación `MAX`):
  - `mau` («MAU App · incluye vistas PostHog») — `#9CA3AF` línea discontinua
  - `financial_mau` («MAU Financiero · continuo día 1») — `#1F2A44`
  - `savers_30d` («Ahorradores 30d ≥1d») — `#4F46E5`
  - `mfeu_30d` («MFEU North Star ≥2d/30d») — `#0F9D8A` (trazo 3 px)
  - `habit_users_4w` («Hábito activo ≥3/4 sem») — `#059669`
- Nota al pie (`10 px`): «PostHog activo desde 2026-09-26 (solo afecta a MAU App). Cutover V2 el 2026-10-10. Solo días cerrados.»

## FILA 4 · Retención Dual (App vs Financiera)
- **Bloque izquierdo (6 tarjetas compactas, `mart_retention_dn`, agregación `MAX`, nulos como `N/A`):**
  - Fila superior (Retención Financiera — verdad de negocio): `D1`, `D7`, `D30` usando `financial_retention_rate` (y subtítulo con ventana `financial_retention_window_rate`).
  - Fila inferior (Retención App): `D1`, `D7`, `D30` usando `retention_rate`.
- **Bloque derecho (Heatmap semanal, `mart_cohort_retention`):**
  - Tabla dinámica: filas `cohort_week`, columnas `week_n` (0..12), valor `financial_retention_rate` (`MAX`, escala de color teal). Conmutable a `saving_retention_rate`.
