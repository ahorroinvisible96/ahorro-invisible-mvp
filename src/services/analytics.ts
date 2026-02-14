/**
 * Servicio de Analytics para Ahorro Invisible MVP
 * Implementa los eventos definidos en 08_ANALYTICS_EVENT_SCHEMA
 */

// Propiedades globales que se añaden a todos los eventos
interface GlobalProps {
  user_id?: string;
  session_id?: string;
  platform?: 'ios' | 'android' | 'web';
  app_version?: string;
  device_locale?: string;
  timezone?: string;
  screen_name?: string;
}

// Contexto de navegación
interface NavigationContext {
  source?: 'sidebar' | 'dashboard_card' | 'motivation_card' | 'system_redirect' | 'onboarding' | 'unknown';
  destination?: string;
}

// Contexto de objetivo
interface GoalContext {
  goal_id?: string;
  is_primary_goal?: boolean;
}

// Contexto de decisión diaria
interface DailyContext {
  date?: string;
  question_id?: string;
  answer_key?: string;
  decision_id?: string;
}

// Contexto de impacto
interface ImpactContext {
  impact_available?: boolean;
  monthly_delta?: number | null;
  yearly_delta?: number | null;
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
  | 'settings';

// Clase principal de Analytics
class Analytics {
  private globalProps: GlobalProps = {
    platform: 'web',
    app_version: '1.0.0',
    device_locale: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };

  constructor() {
    // Generar session_id al iniciar
    this.globalProps.session_id = `session_${Date.now()}`;
    
    // Intentar obtener user_id si está autenticado
    try {
      const userEmail = localStorage.getItem("userEmail");
      if (userEmail) {
        // Usar email como user_id simplificado para el MVP
        this.globalProps.user_id = userEmail;
      }
    } catch (err) {
      console.error("Error al obtener user_id:", err);
    }
  }

  // Método principal para registrar eventos
  private track(eventName: string, props: any = {}) {
    // Combinar propiedades globales con las específicas del evento
    const eventProps = {
      ...this.globalProps,
      ...props,
      timestamp: new Date().toISOString()
    };
    
    // En un entorno real, aquí se enviarían los datos a un servicio de analytics
    // Para el MVP, solo los mostramos en la consola
    console.log(`EVENT: ${eventName}`, eventProps);
    
    // También se podrían guardar localmente para análisis posterior
    try {
      const storedEvents = localStorage.getItem("analyticsEvents") || "[]";
      const events = JSON.parse(storedEvents);
      events.push({
        name: eventName,
        props: eventProps,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem("analyticsEvents", JSON.stringify(events));
    } catch (err) {
      console.error("Error al guardar evento:", err);
    }
  }

  // Establecer screen_name actual
  setScreen(screenName: ScreenName) {
    this.globalProps.screen_name = screenName;
  }

  // EVENTOS DE AUTENTICACIÓN

  // Inicio de signup
  signupStarted() {
    this.track('signup_started', { screen_name: 'signup' });
  }

  // Signup exitoso
  signupSuccess() {
    this.track('signup_success', { screen_name: 'signup' });
  }

  // Error en signup
  signupError(errorCode: string, errorMessage: string, errorField?: string) {
    this.track('signup_error', {
      screen_name: 'signup',
      error_code: errorCode,
      error_message: errorMessage,
      error_field: errorField
    });
  }

  // Click en cerrar sesión
  logoutClicked(source: 'sidebar') {
    this.track('logout_clicked', { source });
  }

  // Sesión cerrada exitosamente
  logoutSuccess() {
    this.track('logout_success');
  }

  // EVENTOS DE ONBOARDING

  // Visualización de paso de onboarding
  onboardingStepViewed(stepNumber: number) {
    this.track('onboarding_step_viewed', {
      screen_name: `onboarding_step_${stepNumber}`,
      step_number: stepNumber
    });
  }

  // Respuesta a pregunta de onboarding
  onboardingQuestionAnswered(stepNumber: number, questionId: string, answerValue: string, answerType?: string) {
    this.track('onboarding_question_answered', {
      screen_name: `onboarding_step_${stepNumber}`,
      step_number: stepNumber,
      question_id: questionId,
      answer_value: answerValue,
      answer_type: answerType
    });
  }

  // Onboarding completado
  onboardingCompleted() {
    this.track('onboarding_completed', { screen_name: 'onboarding_step_3' });
  }

  // EVENTOS DE OBJETIVOS

  // Inicio de creación de objetivo
  goalCreateStarted(source: string) {
    this.track('goal_create_started', {
      screen_name: 'create_goal',
      source
    });
  }

  // Objetivo creado exitosamente
  goalCreated(goalId: string, isPrimaryGoal: boolean, targetAmount?: number, timeHorizonMonths?: number | null) {
    this.track('goal_created', {
      goal_id: goalId,
      is_primary_goal: isPrimaryGoal,
      goal_target_amount: targetAmount,
      goal_time_horizon_months: timeHorizonMonths
    });
  }

  // Error al crear objetivo
  goalCreateError(errorCode: string, errorMessage: string) {
    this.track('goal_create_error', {
      screen_name: 'create_goal',
      error_code: errorCode,
      error_message: errorMessage
    });
  }

  // Objetivo archivado
  goalArchived(goalId: string, wasPrimaryGoal: boolean) {
    this.track('goal_archived', {
      goal_id: goalId,
      was_primary_goal: wasPrimaryGoal,
      screen_name: 'dashboard'
    });
  }

  // Click en tarjeta de objetivo
  goalCardClicked(goalId: string) {
    this.track('goal_card_clicked', {
      goal_id: goalId,
      screen_name: 'dashboard',
      destination: 'goal_detail'
    });
  }

  // EVENTOS DE DASHBOARD

  // Visualización del dashboard
  dashboardViewed(dailyStatus: 'pending' | 'completed', goalsCountActive: number, hasPrimaryGoal: boolean, hasIncomeRange: boolean) {
    this.track('dashboard_viewed', {
      daily_status: dailyStatus,
      goals_count_active: goalsCountActive,
      has_primary_goal: hasPrimaryGoal,
      has_income_range: hasIncomeRange
    });
  }

  // Visualización de tarjeta CTA diaria
  dailyCtaCardViewed(dailyStatus: 'pending' | 'completed') {
    this.track('daily_cta_card_viewed', { daily_status: dailyStatus });
  }

  // Click en CTA de tarjeta diaria
  dailyCtaClicked(dailyStatus: 'pending' | 'completed', destination: string) {
    this.track('daily_cta_clicked', { daily_status: dailyStatus, destination });
  }

  // Click en CTA de tarjeta motivacional
  motivationCtaClicked(dailyStatus: 'pending' | 'completed', destination: string) {
    this.track('motivation_cta_clicked', { daily_status: dailyStatus, destination });
  }

  // Cambio de rango en evolución de ahorro
  savingsEvolutionRangeChanged(range: string, mode: 'demo' | 'live') {
    this.track('savings_evolution_range_changed', { range, mode });
  }

  // EVENTOS DE DECISIÓN DIARIA (NSM)

  // Visualización de pregunta diaria
  dailyQuestionViewed(date: string, questionId: string, dailyStatus: 'pending' | 'completed') {
    this.track('daily_question_viewed', { date, question_id: questionId, daily_status: dailyStatus });
  }

  // Selección de respuesta diaria
  dailyAnswerSelected(date: string, questionId: string, answerKey: string) {
    this.track('daily_answer_selected', { date, question_id: questionId, answer_key: answerKey });
  }

  // Envío de respuesta diaria
  dailyAnswerSubmitted(date: string, questionId: string, answerKey: string, goalId: string, isPrimaryGoal: boolean) {
    this.track('daily_answer_submitted', {
      date,
      question_id: questionId,
      answer_key: answerKey,
      goal_id: goalId,
      is_primary_goal: isPrimaryGoal
    });
  }

  // Decisión diaria completada (NSM + crítico)
  dailyCompleted(date: string, decisionId: string, questionId: string, answerKey: string, goalId: string, impactAvailable: boolean, monthlyDelta?: number, yearlyDelta?: number, isPrimaryGoal?: boolean) {
    this.track('daily_completed', {
      date,
      decision_id: decisionId,
      question_id: questionId,
      answer_key: answerKey,
      goal_id: goalId,
      impact_available: impactAvailable,
      monthly_delta: monthlyDelta,
      yearly_delta: yearlyDelta,
      is_primary_goal: isPrimaryGoal
    });
  }

  // Error al enviar decisión diaria
  dailySubmitError(date: string, questionId: string, answerKey: string | null, errorCode: string, errorMessage: string) {
    this.track('daily_submit_error', {
      date,
      question_id: questionId,
      answer_key: answerKey,
      error_code: errorCode,
      error_message: errorMessage
    });
  }

  // EVENTOS DE IMPACTO

  // Visualización de impacto
  impactViewed(date: string, decisionId: string, questionId: string, answerKey: string, goalId: string, impactAvailable: boolean, monthlyDelta?: number | null, yearlyDelta?: number | null) {
    this.track('impact_viewed', {
      date,
      decision_id: decisionId,
      question_id: questionId,
      answer_key: answerKey,
      goal_id: goalId,
      impact_available: impactAvailable,
      monthly_delta: monthlyDelta,
      yearly_delta: yearlyDelta
    });
  }

  // Click en CTA de acción extra
  impactCtaExtraSavingsClicked(decisionId: string, goalId: string) {
    this.track('impact_cta_extra_savings_clicked', {
      decision_id: decisionId,
      goal_id: goalId,
      destination: 'extra_saving'
    });
  }

  // Click en CTA de historial
  impactCtaHistoryClicked() {
    this.track('impact_cta_history_clicked', { destination: 'history' });
  }

  // EVENTOS DE ACCIÓN EXTRA

  // Inicio de acción extra
  extraSavingStarted(source: string, goalId?: string) {
    this.track('extra_saving_started', {
      source,
      goal_id: goalId
    });
  }

  // Envío de acción extra
  extraSavingSubmitted(date: string, goalId: string, amount: number, noteLength: number) {
    this.track('extra_saving_submitted', {
      date,
      goal_id: goalId,
      amount,
      note_length: noteLength
    });
  }

  // Error en acción extra
  extraSavingError(date: string, goalId: string, errorCode: string, errorMessage: string) {
    this.track('extra_saving_error', {
      date,
      goal_id: goalId,
      error_code: errorCode,
      error_message: errorMessage
    });
  }

  // EVENTOS DE HISTORIAL / PERFIL / AJUSTES

  // Visualización de historial
  historyViewed(source: 'sidebar') {
    this.track('history_viewed', { source });
  }

  // Apertura de elemento de historial
  historyItemOpened(itemType: 'daily_decision', itemId: string) {
    this.track('history_item_opened', { item_type: itemType, item_id: itemId });
  }

  // Visualización de perfil
  profileViewed() {
    this.track('profile_viewed');
  }

  // Actualización de perfil
  profileUpdated(changedFields: string[]) {
    this.track('profile_updated', { changed_fields: changedFields });
  }

  // Actualización de foto de perfil
  profilePhotoUpdated() {
    this.track('profile_photo_updated');
  }

  // Visualización de ajustes
  settingsViewed() {
    this.track('settings_viewed', { source: 'sidebar' });
  }

  // EVENTOS DE WIDGETS

  // Visualización de widget de objetivo principal
  goalPrimaryWidgetViewed() {
    this.track('goal_primary_widget_viewed');
  }

  // Visualización de rango de ingresos
  incomeRangeViewed() {
    this.track('income_range_viewed');
  }

  // Visualización de widget de objetivos
  goalsWidgetViewed() {
    this.track('goals_widget_viewed');
  }

  // Visualización de evolución de ahorro
  savingsEvolutionViewed() {
    this.track('savings_evolution_viewed');
  }

  // Visualización de tarjeta de motivación
  dashboardMotivationCardViewed() {
    this.track('dashboard_motivation_card_viewed');
  }
}

// Exportar una instancia única para toda la aplicación
export const analytics = new Analytics();
