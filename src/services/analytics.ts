/**
 * Servicio de Analytics para Ahorro Invisible (tracking V2, schema_version 2).
 * Catálogo de eventos: src/services/analyticsCatalog.ts · docs/analytics/tracking_plan.md
 *
 * Los eventos de NEGOCIO (`*_confirmed`) no se emiten aquí desde la UI: los emite el outbox V2
 * (src/services/v2/outbox.ts) cuando la RPC confirma la escritura → cuadran con el ledger.
 * Desde la UI solo se emiten intenciones (`*_submitted`, `*_started`, `*_clicked`) y vistas.
 */
import { posthogCapture, getPosthogSessionId } from '@/lib/posthog';
import {
  type EventName, type ConfirmedEventName, SCHEMA_VERSION, DATA_VERSION,
  scrubProps, normalizeErrorCode, safeAnswerKey,
} from '@/services/analyticsCatalog';

/** Versión de la app: SHA corto del commit desplegado en Vercel (o versión local). */
export const ANALYTICS_APP_VERSION =
  (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || '1.2.0-v2-local';

// Propiedades globales que se añaden a todos los eventos
interface GlobalProps {
  user_id?: string;         // UUID de Supabase Auth (NUNCA email)
  supabase_user_id?: string; // Alias explícito para JOIN con BigQuery
  platform: 'web';
  app_version: string;
  schema_version: number;
  data_version: string;
  device_locale?: string;
  timezone?: string;
  screen_name?: string;
}

// Tipos de pantallas permitidas
type ScreenName =
  | 'signup'
  | 'onboarding_step_1'
  | 'onboarding_step_2'
  | 'onboarding_step_3'
  | 'create_goal'
  | 'dashboard'
  | 'daily_question'
  | 'impact'
  | 'extra_saving'
  | 'goals'
  | 'goal_detail'
  | 'history'
  | 'profile'
  | 'settings'
  | 'login';

const IS_DEV = process.env.NODE_ENV !== 'production';

// Clase principal de Analytics
class Analytics {
  private globalProps: GlobalProps = {
    platform: 'web',
    app_version: ANALYTICS_APP_VERSION,
    schema_version: SCHEMA_VERSION,
    data_version: DATA_VERSION,
    device_locale: 'es-ES', // Valor por defecto para SSR
    timezone: 'Europe/Madrid', // Valor por defecto para SSR
  };

  constructor() {
    // Solo ejecutar código del lado del cliente
    if (typeof window !== 'undefined') {
      this.globalProps.device_locale = navigator.language || 'es-ES';
      this.globalProps.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';

      // Obtener UUID de Supabase (NUNCA usar email)
      try {
        const supabaseUserId = localStorage.getItem('supabaseUserId');
        if (supabaseUserId) {
          this.globalProps.user_id = supabaseUserId;
          this.globalProps.supabase_user_id = supabaseUserId;
        }
      } catch {
        // Ignorar error de localStorage en SSR
      }
    }
  }

  // Método principal para registrar eventos (solo nombres del catálogo)
  private track(eventName: EventName, props: Record<string, unknown> = {}) {
    if (typeof window === 'undefined') return;
    const sessionId = getPosthogSessionId();
    const eventProps = scrubProps({
      ...this.globalProps,
      ...(sessionId ? { session_id: sessionId } : {}),
      ...props,
    });

    if (IS_DEV) console.log(`EVENT: ${eventName}`, eventProps);

    try { posthogCapture(eventName, eventProps); } catch { /* fallthrough */ }

    // Registro local (documentado en /privacy): últimos 200 eventos, no sale del dispositivo.
    try {
      const storedEvents = localStorage.getItem("analyticsEvents") || "[]";
      const events = JSON.parse(storedEvents);
      events.push({ name: eventName, props: eventProps, timestamp: new Date().toISOString() });
      const MAX_EVENTS = 200;
      const trimmed = events.length > MAX_EVENTS ? events.slice(events.length - MAX_EVENTS) : events;
      localStorage.setItem("analyticsEvents", JSON.stringify(trimmed));
    } catch { /* cuota / modo privado */ }
  }

  /** Eventos `*_confirmed`: SOLO desde el outbox V2 tras la confirmación de la RPC. */
  confirmed(eventName: ConfirmedEventName, props: Record<string, unknown>) {
    this.track(eventName, props);
  }

  // Establecer screen_name actual
  setScreen(screenName: ScreenName) {
    this.globalProps.screen_name = screenName;
  }

  /**
   * Actualizar el UUID de usuario en runtime.
   * Llamar inmediatamente después de login/signup exitoso.
   * NUNCA pasar email — solo el UUID de Supabase Auth.
   */
  setUserId(supabaseUserId: string) {
    this.globalProps.user_id = supabaseUserId;
    this.globalProps.supabase_user_id = supabaseUserId;
  }

  /**
   * Limpiar el user_id al hacer logout.
   */
  clearUserId() {
    this.globalProps.user_id = undefined;
    this.globalProps.supabase_user_id = undefined;
  }

  // EVENTOS DE AUTENTICACIÓN

  signupStarted() {
    this.track('signup_started', { screen_name: 'signup' });
  }

  signupSuccess() {
    this.track('signup_success', { screen_name: 'signup' });
  }

  /** Solo código normalizado: el mensaje de error puede contener datos del usuario. */
  signupError(errorCode: string, errorField?: 'email' | 'name' | 'password') {
    this.track('signup_error', { screen_name: 'signup', error_code: normalizeErrorCode(errorCode), error_field: errorField });
  }

  logoutClicked(source: 'sidebar') {
    this.track('logout_clicked', { source });
  }

  logoutSuccess() {
    this.track('logout_success');
  }

  // EVENTOS DE ONBOARDING

  onboardingStepViewed(stepNumber: number) {
    this.track('onboarding_step_viewed', { screen_name: `onboarding_step_${stepNumber}`, step_number: stepNumber });
  }

  /** `answerKey` debe ser una clave de catálogo (p. ej. 'comodo'), nunca texto libre. */
  onboardingQuestionAnswered(stepNumber: number, questionId: string, answerKey: string) {
    this.track('onboarding_question_answered', {
      screen_name: `onboarding_step_${stepNumber}`,
      step_number: stepNumber,
      question_id: questionId,
      answer_key: answerKey,
    });
  }

  /** Pulsa finalizar; la confirmación llega como `onboarding_completed_confirmed`. */
  onboardingSubmitted() {
    this.track('onboarding_submitted');
  }

  onboardingReset() {
    this.track('onboarding_reset');
  }

  // EVENTOS DE OBJETIVOS

  goalCreateStarted(source: string) {
    this.track('goal_create_started', { screen_name: 'create_goal', source });
  }

  /** Envío del formulario; la confirmación llega como `goal_created_confirmed`. */
  goalCreateSubmitted(isPrimaryGoal: boolean, targetAmount?: number, timeHorizonMonths?: number | null) {
    this.track('goal_create_submitted', {
      is_primary_goal: isPrimaryGoal,
      goal_target_amount: targetAmount,
      goal_time_horizon_months: timeHorizonMonths,
    });
  }

  goalCreateError(errorCode: string) {
    this.track('goal_create_error', { screen_name: 'create_goal', error_code: normalizeErrorCode(errorCode) });
  }

  /** Pulsa archivar/eliminar; la confirmación llega como `goal_archived_confirmed` / `goal_deleted_confirmed`. */
  goalArchiveSubmitted(goalId: string, wasPrimaryGoal: boolean) {
    this.track('goal_archive_submitted', { goal_id: goalId, was_primary_goal: wasPrimaryGoal });
  }

  // EVENTOS DE DASHBOARD

  dashboardViewed(dailyStatus: 'pending' | 'completed', goalsCountActive: number, hasPrimaryGoal: boolean, hasIncomeRange: boolean) {
    this.track('dashboard_viewed', {
      daily_status: dailyStatus,
      goals_count_active: goalsCountActive,
      has_primary_goal: hasPrimaryGoal,
      has_income_range: hasIncomeRange,
    });
  }

  dailyCtaCardViewed(dailyStatus: 'pending' | 'completed') {
    this.track('daily_cta_card_viewed', { daily_status: dailyStatus });
  }

  dailyCtaClicked(dailyStatus: 'pending' | 'completed', destination: string) {
    this.track('daily_cta_clicked', { daily_status: dailyStatus, destination });
  }

  motivationCtaClicked(dailyStatus: 'pending' | 'completed', destination: string) {
    this.track('motivation_cta_clicked', { daily_status: dailyStatus, destination });
  }

  savingsEvolutionRangeChanged(range: string, mode: 'demo' | 'live') {
    this.track('savings_evolution_range_changed', { range, mode });
  }

  // EVENTOS DE DECISIÓN DIARIA

  dailyQuestionViewed(date: string, questionId: string, dailyStatus: 'pending' | 'completed') {
    this.track('daily_question_viewed', { date, question_id: questionId, daily_status: dailyStatus });
  }

  /** Envío de la decisión; la confirmación llega como `daily_decision_confirmed`. Sin texto libre. */
  dailyAnswerSubmitted(date: string, questionId: string, answerKey: string, goalId: string, isPrimaryGoal: boolean) {
    this.track('daily_answer_submitted', {
      date,
      question_id: questionId,
      answer_key: safeAnswerKey(answerKey),
      goal_id: goalId,
      is_primary_goal: isPrimaryGoal,
    });
  }

  dailySkipped(date: string, questionId: string) {
    this.track('daily_skipped', { date, question_id: questionId });
  }

  // EVENTOS DE IMPACTO

  impactViewed(date: string, decisionId: string, questionId: string, answerKey: string, goalId: string, impactAvailable: boolean, monthlyDelta?: number | null, yearlyDelta?: number | null) {
    this.track('impact_viewed', {
      date,
      decision_id: decisionId,
      question_id: questionId,
      answer_key: safeAnswerKey(answerKey),
      goal_id: goalId,
      impact_available: impactAvailable,
      monthly_delta: monthlyDelta,
      yearly_delta: yearlyDelta,
    });
  }

  impactCtaExtraSavingsClicked(decisionId: string, goalId: string) {
    this.track('impact_cta_extra_savings_clicked', { decision_id: decisionId, goal_id: goalId, destination: 'extra_saving' });
  }

  impactCtaHistoryClicked() {
    this.track('impact_cta_history_clicked', { destination: 'history' });
  }

  // EVENTOS DE AHORRO EXTRA

  extraSavingStarted(source: string, goalId?: string) {
    this.track('extra_saving_started', { source, goal_id: goalId });
  }

  /** Envío; la confirmación llega como `extra_saving_confirmed`. La nota nunca se envía. */
  extraSavingSubmitted(date: string, goalId: string, amount: number) {
    this.track('extra_saving_submitted', { date, goal_id: goalId, amount });
  }

  extraSavingError(errorCode: string) {
    this.track('extra_saving_error', { error_code: normalizeErrorCode(errorCode) });
  }

  // EVENTOS DE HISTORIAL / PERFIL / AJUSTES

  historyViewed(source: 'sidebar') {
    this.track('history_viewed', { source });
  }

  profileViewed() {
    this.track('profile_viewed');
  }

  /** Solo nombres de campos, nunca valores. */
  profileUpdated(changedFields: string[]) {
    this.track('profile_updated', { changed_fields: changedFields });
  }

  settingsViewed() {
    this.track('settings_viewed', { source: 'sidebar' });
  }

  // EVENTOS DE WIDGETS

  goalPrimaryWidgetViewed() {
    this.track('goal_primary_widget_viewed');
  }

  incomeRangeViewed() {
    this.track('income_range_viewed');
  }

  incomeEditOpened() {
    this.track('income_edit_opened', { screen_name: 'dashboard' });
  }

  /** Sin importes: la banda declarada llega como `income_declared_confirmed`. */
  incomeUpdateSubmitted() {
    this.track('income_update_submitted', { screen_name: 'dashboard' });
  }

  goalCardViewed(goalId: string, isPrimary: boolean, pct: number) {
    this.track('goal_card_viewed', { goal_id: goalId, is_primary: isPrimary, progress_pct: pct, screen_name: 'dashboard' });
  }

  dashboardMotivationCardViewed() {
    this.track('dashboard_motivation_card_viewed');
  }
}

// Exportar una instancia única para toda la aplicación
export const analytics = new Analytics();
