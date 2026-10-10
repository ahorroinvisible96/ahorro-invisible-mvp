/**
 * Catálogo único de eventos de producto (tracking V2, schema_version 2).
 * Documentado en docs/analytics/tracking_plan.md · verificado por `npm run analytics:check`.
 *
 * Reglas:
 *  - Nombre `objeto_acción` en snake_case.
 *  - `kind`:
 *      confirmed → se emite SOLO cuando la RPC V2 ha confirmado la escritura (outbox). Cuadra con el ledger.
 *      intent    → el usuario ha pulsado / enviado; puede no llegar a confirmarse.
 *      view      → pantalla o widget visto.
 *      auth      → ciclo de sesión.
 *  - Nunca: email, nombre, títulos de objetivos, notas, texto libre, ingreso exacto, mensajes de error.
 */

export const SCHEMA_VERSION = 2;
export const DATA_VERSION = 'v2';

export type EventKind = 'confirmed' | 'intent' | 'view' | 'auth';

type Def = { kind: EventKind; props: readonly string[]; desc: string };

export const EVENT_CATALOG = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  signup_started:            { kind: 'auth', props: [], desc: 'Pantalla de registro abierta' },
  signup_success:            { kind: 'auth', props: [], desc: 'Supabase Auth ha creado la cuenta' },
  signup_error:              { kind: 'auth', props: ['error_code', 'error_field'], desc: 'Error de validación o de Auth (código normalizado; error_field = email|name|password, nunca el valor)' },
  logout_clicked:            { kind: 'auth', props: ['source'], desc: 'Pulsa cerrar sesión' },
  logout_success:            { kind: 'auth', props: [], desc: 'Sesión cerrada' },

  // ── Onboarding ────────────────────────────────────────────────────────────
  onboarding_step_viewed:        { kind: 'view',   props: ['step_number'], desc: 'Paso de onboarding visto' },
  onboarding_question_answered:  { kind: 'intent', props: ['step_number', 'question_id', 'answer_key'], desc: 'Respuesta (clave de catálogo) a pregunta de onboarding' },
  onboarding_submitted:          { kind: 'intent', props: [], desc: 'Pulsa finalizar onboarding (antes de confirmar)' },
  onboarding_reset:              { kind: 'intent', props: [], desc: 'Reinicia el onboarding desde ajustes' },
  onboarding_completed_confirmed:{ kind: 'confirmed', props: ['goal_id', 'income_band', 'savings_habit', 'warning_shown', 'chosen_target_amount', 'horizon_months'], desc: 'complete_onboarding confirmado' },

  // ── Objetivos ─────────────────────────────────────────────────────────────
  goal_create_started:       { kind: 'intent', props: ['source'], desc: 'Abre la creación de objetivo' },
  goal_create_submitted:     { kind: 'intent', props: ['is_primary_goal', 'goal_target_amount', 'goal_time_horizon_months', 'surface'], desc: 'Envía el formulario de objetivo' },
  goal_create_error:         { kind: 'intent', props: ['error_code'], desc: 'Fallo local al crear objetivo' },
  goal_archive_submitted:    { kind: 'intent', props: ['was_primary_goal', 'surface'], desc: 'Pulsa archivar/eliminar objetivo' },
  goal_created_confirmed:    { kind: 'confirmed', props: ['goal_id', 'is_primary', 'target_amount', 'horizon_months', 'source'], desc: 'create_goal confirmado' },
  goal_updated_confirmed:    { kind: 'confirmed', props: ['goal_id', 'changed'], desc: 'update_goal / set_primary_goal confirmado' },
  goal_archived_confirmed:   { kind: 'confirmed', props: ['goal_id', 'destination_type', 'balance_moved_amount'], desc: 'archive_goal confirmado' },
  goal_deleted_confirmed:    { kind: 'confirmed', props: ['goal_id', 'destination_type', 'balance_moved_amount'], desc: 'delete_goal confirmado' },
  goal_reactivated_confirmed:{ kind: 'confirmed', props: ['goal_id'], desc: 'reactivate_goal confirmado' },
  goal_completed_confirmed:  { kind: 'confirmed', props: ['goal_id', 'trigger'], desc: 'El servidor marca el objetivo como completado tras un asiento' },
  hucha_transfer_confirmed:  { kind: 'confirmed', props: ['transfer_group_id', 'goal_id', 'amount'], desc: 'Traspaso hucha → objetivo confirmado' },

  // ── Decisión diaria / ahorro ──────────────────────────────────────────────
  daily_question_viewed:     { kind: 'view',   props: ['date', 'question_id', 'daily_status'], desc: 'Pregunta diaria vista' },
  daily_answer_submitted:    { kind: 'intent', props: ['date', 'question_id', 'answer_key', 'is_primary_goal', 'surface'], desc: 'Envía la decisión diaria (antes de confirmar)' },
  daily_skipped:             { kind: 'intent', props: ['date', 'question_id'], desc: 'Sale de la pregunta sin responder' },
  daily_decision_confirmed:  { kind: 'confirmed', props: ['decision_id', 'transaction_id', 'outcome', 'amount', 'question_id', 'option_key', 'goal_id', 'local_date'], desc: 'record_daily_decision confirmado (transaction_id solo si outcome=saved)' },
  extra_saving_started:      { kind: 'intent', props: ['source'], desc: 'Abre ahorro extra' },
  extra_saving_submitted:    { kind: 'intent', props: ['date', 'amount', 'surface'], desc: 'Envía ahorro extra (antes de confirmar; página o modal del dashboard)' },
  extra_saving_error:        { kind: 'intent', props: ['error_code'], desc: 'Fallo local al guardar ahorro extra' },
  extra_saving_confirmed:    { kind: 'confirmed', props: ['transaction_id', 'amount', 'goal_id', 'local_date'], desc: 'record_extra_saving confirmado' },
  saving_voided_confirmed:   { kind: 'confirmed', props: ['entity', 'entity_id', 'reason'], desc: 'void_decision / void_extra_saving confirmado' },
  saving_amended_confirmed:  { kind: 'confirmed', props: ['entity', 'entity_id', 'changed', 'previous_amount', 'new_amount'], desc: 'amend_* confirmado' },
  grace_day_confirmed:       { kind: 'confirmed', props: ['decision_id', 'local_date'], desc: 'use_grace_day confirmado' },
  income_declared_confirmed: { kind: 'confirmed', props: ['income_band', 'source'], desc: 'declare_income confirmado (solo banda)' },
  account_reset_confirmed:   { kind: 'confirmed', props: [], desc: 'reset_account_data confirmado' },

  // ── Impacto ───────────────────────────────────────────────────────────────
  impact_viewed:                    { kind: 'view',   props: ['date', 'question_id', 'answer_key', 'impact_available'], desc: 'Pantalla de impacto vista' },
  impact_cta_extra_savings_clicked: { kind: 'intent', props: ['destination'], desc: 'CTA ahorro extra desde impacto' },
  impact_cta_history_clicked:       { kind: 'intent', props: ['destination'], desc: 'CTA historial desde impacto' },

  // ── Dashboard y widgets ───────────────────────────────────────────────────
  dashboard_viewed:                 { kind: 'view',   props: ['daily_status', 'goals_count_active', 'has_primary_goal', 'has_income_range'], desc: 'Dashboard visto' },
  daily_cta_card_viewed:            { kind: 'view',   props: ['daily_status'], desc: 'Tarjeta CTA diaria vista' },
  daily_cta_clicked:                { kind: 'intent', props: ['daily_status', 'destination'], desc: 'Pulsa CTA diaria' },
  motivation_cta_clicked:           { kind: 'intent', props: ['daily_status', 'destination'], desc: 'Pulsa CTA motivacional' },
  dashboard_motivation_card_viewed: { kind: 'view',   props: [], desc: 'Tarjeta motivacional vista' },
  goal_primary_widget_viewed:       { kind: 'view',   props: [], desc: 'Widget de objetivo principal visto' },
  goal_card_viewed:                 { kind: 'view',   props: ['is_primary', 'progress_pct'], desc: 'Tarjeta de objetivo vista' },
  savings_evolution_range_changed:  { kind: 'intent', props: ['range', 'mode'], desc: 'Cambia rango del gráfico de evolución' },
  income_range_viewed:              { kind: 'view',   props: [], desc: 'Widget de ingresos visto' },
  income_edit_opened:               { kind: 'intent', props: [], desc: 'Abre edición de ingresos' },
  income_update_submitted:          { kind: 'intent', props: [], desc: 'Guarda rango de ingresos (sin importes)' },

  // ── Navegación / cuenta ───────────────────────────────────────────────────
  history_viewed:            { kind: 'view',   props: ['source'], desc: 'Historial visto' },
  profile_viewed:            { kind: 'view',   props: [], desc: 'Perfil visto' },
  profile_updated:           { kind: 'intent', props: ['changed_fields'], desc: 'Guarda perfil (solo nombres de campos)' },
  settings_viewed:           { kind: 'view',   props: ['source'], desc: 'Ajustes vistos' },
} as const satisfies Record<string, Def>;

export type EventName = keyof typeof EVENT_CATALOG;
export type ConfirmedEventName = {
  [K in EventName]: (typeof EVENT_CATALOG)[K]['kind'] extends 'confirmed' ? K : never
}[EventName];

/** Eventos retirados en V2 (se marcan como obsoletos en PostHog). */
export const DEPRECATED_EVENTS: Record<string, string> = {
  goal_created: 'goal_create_submitted (intento) / goal_created_confirmed (servidor)',
  first_goal_created: 'derivado en BigQuery (mart_funnel) desde goal_created_confirmed',
  goal_archived: 'goal_archive_submitted / goal_archived_confirmed / goal_deleted_confirmed',
  daily_completed: 'daily_decision_confirmed',
  first_daily_completed: 'derivado en BigQuery (mart_funnel)',
  onboarding_completed: 'onboarding_submitted / onboarding_completed_confirmed',
  income_updated: 'income_update_submitted / income_declared_confirmed',
  daily_answer_selected: 'sin uso',
  daily_submit_error: 'sin uso',
  goal_card_clicked: 'sin uso',
  history_item_opened: 'sin uso',
  profile_photo_updated: 'sin uso',
  settings_updated: 'sin uso',
  income_update_error: 'sin uso',
  goals_widget_viewed: 'sin uso',
  savings_evolution_viewed: 'sin uso',
};

// ── Privacidad ───────────────────────────────────────────────────────────────

/** Claves que nunca deben salir hacia PostHog aunque alguien las pase por error. */
export const FORBIDDEN_PROP_KEYS = new Set([
  'email', 'user_email', 'name', 'user_name', 'full_name', 'title', 'goal_title', 'goal_name', 'note',
  'custom_text', 'free_text', 'error_message', 'message', 'answer_value', 'income', 'income_amount',
  'income_min', 'income_max', 'min', 'max', 'password', 'phone',
]);

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/** Elimina claves prohibidas y cualquier string con aspecto de email. */
export function scrubProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || FORBIDDEN_PROP_KEYS.has(k)) continue;
    if (typeof v === 'string' && EMAIL_RE.test(v)) continue;
    out[k] = v;
  }
  return out;
}

/** Código de error estable y sin texto libre (máx. 40 chars, [a-z0-9_]). */
export function normalizeErrorCode(code: string | null | undefined): string {
  const c = (code ?? 'unknown').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return (c || 'unknown').slice(0, 40);
}

/** Clave de respuesta diaria sin texto libre: `saved|opt_x`, `zero|__custom__`… */
export function safeAnswerKey(answerKey: string): string {
  return answerKey.replace(/custom:[\s\S]*$/, '__custom__');
}

/**
 * Misma regla que el job de BigQuery (jobs/supabase-bigquery-sync/main.py · DEFAULT_INTERNAL_RE).
 * Se evalúa en el cliente; el email nunca se envía.
 */
export const INTERNAL_EMAIL_RE =
  /(\.test$|\.invalid$|\.local$|@example\.(com|org|net)$|@test\.com$|^ahorroinvisible|\+test@|^e2e_|^t_[0-9a-f]{8}@)/i;

export function isInternalEmail(email: string | null | undefined): boolean {
  return !!email && INTERNAL_EMAIL_RE.test(email.trim());
}
