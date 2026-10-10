# Tracking plan · Ahorro Invisible (V2, `schema_version: 2`)

Fuente de verdad: [`src/services/analyticsCatalog.ts`](../../src/services/analyticsCatalog.ts).
Verificación automática: `npm run analytics:check` (catálogo ↔ código ↔ este documento).

## Principios

1. **Los eventos de negocio solo se emiten tras la confirmación del servidor.** El outbox V2
   (`src/services/v2/outbox.ts`) emite `*_confirmed` cuando la RPC devuelve OK, con los ids que
   devuelve Supabase (`decision_id`, `transaction_id`, `goal_id`, `transfer_group_id`) y el
   `command_id` (clave de idempotencia). Así cuadran 1:1 con el ledger de BigQuery.
2. La UI solo emite **intenciones** (`*_started`, `*_submitted`, `*_clicked`) y **vistas** (`*_viewed`).
   Una intención puede no llegar a confirmarse (offline, error, duplicado).
3. **Sin PII**: nunca email, nombre, títulos de objetivos, notas, texto libre, ingreso exacto ni
   mensajes de error. `scrubProps()` elimina claves prohibidas y cualquier valor con forma de email.
   Errores → `error_code` normalizado. Respuestas → claves de catálogo (`answer_key`, `option_key`).
   Detalle de la configuración de PostHog (replay, heatmaps, URLs): [`privacy.md`](./privacy.md).
4. **Usuarios internos/test**: `identifyUser(id, { email })` calcula `is_internal` en el cliente con la
   misma regex que el job de BigQuery (`INTERNAL_EMAIL_RE`) y lo guarda como propiedad de persona y
   super-propiedad. El email no sale del navegador. En BigQuery la exclusión se hace con `dim_user`.
5. **IDs solo en `*_confirmed`.** En cliente un `goal_id` puede ser local (`goal_<ts>`) y no coincidir
   con el UUID del servidor; por eso intenciones y vistas no llevan `goal_id` / `decision_id` /
   `transaction_id`. Para atribuir una intención a su confirmación se usa `surface` + tiempo.
6. **`surface`** (enum `Surface` de `src/services/v2/outbox.ts`) en las intenciones que generan un
   comando: `goal_create_submitted`, `goal_archive_submitted`, `daily_answer_submitted`,
   `extra_saving_submitted`. Es el mismo valor que lleva el `*_confirmed` correspondiente.

## Propiedades globales (todos los eventos)

| Propiedad | Valor |
|---|---|
| `user_id`, `supabase_user_id` | UUID de Supabase Auth (también `distinct_id` tras `identify`) |
| `app_version` | SHA corto del commit desplegado (`NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`) |
| `schema_version` | `2` |
| `data_version` | `v2` |
| `session_id` | Sesión real de PostHog (`posthog.get_session_id()`) |
| `platform`, `device_locale`, `timezone`, `screen_name` | Contexto del cliente |
| `is_internal` | Super-propiedad tras identificar (solo booleano) |

Eventos `*_confirmed` añaden: `command_id`, `command_type`, `surface`, `occurred_at` (momento de la acción, no del envío).

## Eventos confirmados por el servidor

| Evento | Propiedades | Descripción |
|---|---|---|
| `onboarding_completed_confirmed` | `goal_id`, `income_band`, `savings_habit`, `warning_shown`, `chosen_target_amount`, `horizon_months` | complete_onboarding confirmado |
| `goal_created_confirmed` | `goal_id`, `is_primary`, `target_amount`, `horizon_months`, `source` | create_goal confirmado |
| `goal_updated_confirmed` | `goal_id`, `changed` | update_goal / set_primary_goal confirmado |
| `goal_archived_confirmed` | `goal_id`, `destination_type`, `balance_moved_amount` | archive_goal confirmado |
| `goal_deleted_confirmed` | `goal_id`, `destination_type`, `balance_moved_amount` | delete_goal confirmado |
| `goal_reactivated_confirmed` | `goal_id` | reactivate_goal confirmado |
| `goal_completed_confirmed` | `goal_id`, `trigger` | El servidor marca el objetivo como completado tras un asiento |
| `hucha_transfer_confirmed` | `transfer_group_id`, `goal_id`, `amount` | Traspaso hucha → objetivo confirmado |
| `daily_decision_confirmed` | `decision_id`, `transaction_id`, `outcome`, `amount`, `question_id`, `option_key`, `goal_id`, `local_date` | record_daily_decision confirmado (`transaction_id` solo si `outcome=saved`) |
| `extra_saving_confirmed` | `transaction_id`, `amount`, `goal_id`, `local_date` | record_extra_saving confirmado |
| `saving_voided_confirmed` | `entity`, `entity_id`, `reason` | void_decision / void_extra_saving confirmado |
| `saving_amended_confirmed` | `entity`, `entity_id`, `changed`, `previous_amount`, `new_amount` | amend_* confirmado |
| `grace_day_confirmed` | `decision_id`, `local_date` | use_grace_day confirmado |
| `income_declared_confirmed` | `income_band`, `source` | declare_income confirmado (solo banda) |
| `account_reset_confirmed` | — | reset_account_data confirmado |

> Tolerancia PostHog ↔ ledger: si la respuesta de la RPC se pierde, el reintento recibe
> `already_present` y no se reemite el evento (evita duplicados). Además, bloqueadores de anuncios
> pueden impedir el envío a PostHog. El test `posthog_confirmed_vs_ledger` admite 10 % o 2 asientos.
> **El ledger de Supabase/BigQuery es siempre la fuente de verdad de importes.**

## Intenciones

| Evento | Propiedades | Descripción |
|---|---|---|
| `onboarding_question_answered` | `step_number`, `question_id`, `answer_key` | Respuesta (clave de catálogo) a pregunta de onboarding |
| `onboarding_submitted` | — | Pulsa finalizar onboarding (antes de confirmar) |
| `onboarding_reset` | — | Reinicia el onboarding desde ajustes |
| `goal_create_started` | `source` | Abre la creación de objetivo |
| `goal_create_submitted` | `is_primary_goal`, `goal_target_amount`, `goal_time_horizon_months`, `surface` | Envía el formulario de objetivo |
| `goal_create_error` | `error_code` | Fallo local al crear objetivo |
| `goal_archive_submitted` | `was_primary_goal`, `surface` | Pulsa archivar/eliminar objetivo |
| `daily_answer_submitted` | `date`, `question_id`, `answer_key`, `is_primary_goal`, `surface` | Envía la decisión diaria (antes de confirmar) |
| `daily_skipped` | `date`, `question_id` | Sale de la pregunta sin responder |
| `extra_saving_started` | `source` | Abre ahorro extra |
| `extra_saving_submitted` | `date`, `amount`, `surface` | Envía ahorro extra (antes de confirmar; página o modal del dashboard) |
| `extra_saving_error` | `error_code` | Fallo local al guardar ahorro extra |
| `impact_cta_extra_savings_clicked` | `destination` | CTA ahorro extra desde impacto |
| `impact_cta_history_clicked` | `destination` | CTA historial desde impacto |
| `daily_cta_clicked` | `daily_status`, `destination` | Pulsa CTA diaria |
| `motivation_cta_clicked` | `daily_status`, `destination` | Pulsa CTA motivacional |
| `savings_evolution_range_changed` | `range`, `mode` | Cambia rango del gráfico de evolución |
| `income_edit_opened` | — | Abre edición de ingresos |
| `income_update_submitted` | — | Guarda rango de ingresos (sin importes) |
| `profile_updated` | `changed_fields` | Guarda perfil (solo nombres de campos) |

## Vistas

| Evento | Propiedades | Descripción |
|---|---|---|
| `onboarding_step_viewed` | `step_number` | Paso de onboarding visto |
| `daily_question_viewed` | `date`, `question_id`, `daily_status` | Pregunta diaria vista |
| `impact_viewed` | `date`, `question_id`, `answer_key`, `impact_available` | Pantalla de impacto vista |
| `dashboard_viewed` | `daily_status`, `goals_count_active`, `has_primary_goal`, `has_income_range` | Dashboard visto |
| `daily_cta_card_viewed` | `daily_status` | Tarjeta CTA diaria vista |
| `dashboard_motivation_card_viewed` | — | Tarjeta motivacional vista |
| `goal_primary_widget_viewed` | — | Widget de objetivo principal visto |
| `goal_card_viewed` | `is_primary`, `progress_pct` | Tarjeta de objetivo vista |
| `income_range_viewed` | — | Widget de ingresos visto |
| `history_viewed` | `source` | Historial visto |
| `profile_viewed` | — | Perfil visto |
| `settings_viewed` | `source` | Ajustes vistos |

## Autenticación

| Evento | Propiedades | Descripción |
|---|---|---|
| `signup_started` | — | Pantalla de registro abierta |
| `signup_success` | — | Supabase Auth ha creado la cuenta |
| `signup_error` | `error_code`, `error_field` | Error de validación o de Auth (código normalizado; `error_field` = email/name/password, nunca el valor) |
| `logout_clicked` | `source` | Pulsa cerrar sesión |
| `logout_success` | — | Sesión cerrada |

## Eventos obsoletos (V1)

Marcados como obsoletos en PostHog. Siguen en `raw_posthog.events` para histórico, pero ningún KPI V2 los usa.

| Evento | Estado | Sustituto |
|---|---|---|
| `goal_created` | obsoleto | `goal_create_submitted` / `goal_created_confirmed` |
| `first_goal_created` | obsoleto | derivado en BigQuery (`mart_funnel`) |
| `goal_archived` | obsoleto | `goal_archive_submitted` / `goal_archived_confirmed` / `goal_deleted_confirmed` |
| `daily_completed` | obsoleto | `daily_decision_confirmed` |
| `first_daily_completed` | obsoleto | derivado en BigQuery (`mart_funnel`) |
| `onboarding_completed` | obsoleto | `onboarding_submitted` / `onboarding_completed_confirmed` |
| `income_updated` | obsoleto | `income_update_submitted` / `income_declared_confirmed` |
| `daily_answer_selected`, `daily_submit_error`, `goal_card_clicked`, `history_item_opened`, `profile_photo_updated`, `settings_updated`, `income_update_error`, `goals_widget_viewed`, `savings_evolution_viewed` | obsoleto | sin uso, eliminados |

## Cambios respecto a V1 (5C.1)

- `app_version` fijo `1.1.0` → SHA real del despliegue. `session_id` `session_<ts>` → sesión de PostHog.
- `error_message` (texto libre) eliminado de todos los eventos.
- `daily_answer_submitted` / `impact_viewed` enviaban `answer_key = custom:<texto del usuario>` → ahora `__custom__`.
- `onboarding_question_answered.answer_value` → `answer_key`.
- `income_updated` enviaba `min`/`max` de ingresos → sin importes.
- `extra_saving_submitted.note_length` eliminado.

## Cambios de privacidad y atribución (5C.4)

- IDs fuera de intenciones/vistas: `goal_archive_submitted`, `daily_answer_submitted`,
  `extra_saving_started`, `extra_saving_submitted`, `impact_viewed`,
  `impact_cta_extra_savings_clicked` y `goal_card_viewed` ya no envían `goal_id` / `decision_id`.
- `impact_viewed` deja de enviar `monthly_delta` / `yearly_delta` (derivables del ledger).
- `surface` añadido a las cuatro intenciones que generan comando; el modal de ahorro extra del
  dashboard ahora emite `extra_saving_submitted` (`surface = extra_saving_modal`), igual que la página.
- `signup_error.error_field` (solo el nombre del campo).
- PostHog: Session Replay, heatmaps, dead clicks, excepciones automáticas, encuestas y
  `$pageleave` desactivados en código; `before_send` quita query string y hash de las URLs.
- `analytics:check` verifica además: propiedades emitidas ⊆ catálogo, IDs solo en `*_confirmed`,
  enum `surface` / `screen_name`, configuración de privacidad de PostHog y que las propiedades de
  este documento coinciden con el catálogo.
