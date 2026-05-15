/**
 * ═══════════════════════════════════════════════════════════
 * WIDGET CATEGORY — Clasificación funcional de widgets
 * ═══════════════════════════════════════════════════════════
 *
 * Cada widget de producto tiene una categoría que determina
 * su acento visual, intensidad de glow y peso de borde.
 *
 * REGLA: WidgetWrapper es infraestructura, no categoría propia.
 */

export type WidgetCategory =
  | 'action'
  | 'progress'
  | 'decision'
  | 'insight'
  | 'motivation'
  | 'summary'
  | 'system';

/**
 * Mapa de cada widget a su categoría funcional.
 * Usado como referencia; cada widget aplica su categoría
 * vía data-widget-cat o prop category en WidgetWrapper.
 */
export const WIDGET_CATEGORY_MAP: Record<string, WidgetCategory> = {
  // ACTION — empujan al usuario a actuar
  DailyDecisionWidget: 'action',
  DailyDecisionCardWidget: 'action',
  ProfileQuickAccessWidget: 'action',

  // PROGRESS — muestran avance hacia metas
  PrimaryGoalHeroWidget: 'progress',
  SavingsEvolutionWidget: 'progress',
  GoalsSectionWidget: 'progress',
  GoalCardWidget: 'progress',

  // DECISION — ayudan a elegir o filtrar
  DailyQuestionWidget: 'decision',
  IncomeRangeWidget: 'decision',
  HistoryFiltersWidget: 'decision',
  CollapsibleWidget: 'decision',

  // INSIGHT — explican o recomiendan
  ImpactSummaryWidget: 'insight',
  HistoryDecisionsListWidget: 'insight',
  SettingsHelpWidget: 'insight',

  // MOTIVATION — refuerzan identidad y racha
  MotivationCardWidget: 'motivation',
  ProfileHeroWidget: 'motivation',

  // SUMMARY — resumen rápido o estado general
  HeaderStatusBarWidget: 'summary',
  HistorySummaryWidget: 'summary',
  HistoryEmptyStateWidget: 'summary',
  ProfileInfoWidget: 'summary',

  // SYSTEM — navegación, configuración, cuenta
  SidebarNavigationWidget: 'system',
  ProfileAccountWidget: 'system',
  SettingsMyDataWidget: 'system',
  SettingsNotificationsWidget: 'system',
  SettingsSessionWidget: 'system',
  SettingsDangerZoneWidget: 'system',
};
