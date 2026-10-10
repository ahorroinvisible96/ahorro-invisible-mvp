"use client";
// ─── Onboarding → V2 (comando onboarding.complete) ──────────────────────────────
// El objetivo inicial NO se encola como goal.create: lo crea complete_onboarding junto con la
// sesión, el avatar y la declaración de ingresos (dashboardStore omite goal.create si source='onboarding').
//
// El snapshot de recomendación se calcula con los catálogos inmutables publicados en V2
// (income_ref_v1 + rec_v1, migración 006): el RPC lo recalcula y rechaza cualquier diferencia
// (recommendation_mismatch). El aviso (warning) es el que vio el usuario en la UI.

import { enqueue, type CommandPayloads } from './outbox';
import { newUuid, isLegacyId, isUuid } from './ids';

type Band = 'lt_1000' | '1000_1500' | '1500_2000' | '2000_2500' | '2500_3000' | 'gt_3000';
type Habit = CommandPayloads['onboarding.complete']['habit'];
type Answer = CommandPayloads['onboarding.complete']['answers'][number];
type Warning = CommandPayloads['onboarding.complete']['warning'];

/** income_ref_v1.reference_income_amount */
export const INCOME_REF_V1: Record<Band, number> = {
  lt_1000: 500, '1000_1500': 1250, '1500_2000': 1750, '2000_2500': 2250, '2500_3000': 2750, gt_3000: 3000,
};
/** rec_v1.savings_rate_pct / monthly_floor_amount */
export const REC_V1_PCT: Record<Habit, number> = { nunca: 5, algo: 10, suelo: 15, bastante: 20 };
export const REC_V1_FLOOR = 50;
const HORIZONS = [1, 2, 3, 6, 12];

export function recommendationV1(band: Band, habit: Habit, horizon: number) {
  const ref = INCOME_REF_V1[band];
  const pct = REC_V1_PCT[habit];
  const recMonthly = Math.max(REC_V1_FLOOR, Math.round((ref * pct) / 100));
  return { ref, pct, floor: REC_V1_FLOOR, recMonthly, recTarget: recMonthly * horizon };
}

export function enqueueOnboardingComplete(i: {
  goalId: string; title: string; band: string; answers: Answer[]; habit: Habit | null;
  chosenTarget: number; horizon: number; warning: Warning;
}) {
  const valid = i.band in INCOME_REF_V1 && !!i.habit && i.habit in REC_V1_PCT && HORIZONS.includes(i.horizon)
    && i.answers.length === 3 && (isLegacyId('goal', i.goalId) || isUuid(i.goalId));
  if (!valid || !i.habit) {
    // Sin sesión de onboarding V2 válida: el objetivo inicial NUNCA debe faltar en V2.
    return enqueue('goal.create', {
      goal: i.goalId, title: i.title, target: i.chosenTarget, horizon: i.horizon, source: 'goals_page',
      setPrimary: true, final: null, step: null, realismUnrealistic: null, surface: 'goals_page',
    });
  }
  const rec = recommendationV1(i.band as Band, i.habit, i.horizon);
  return enqueue('onboarding.complete', {
    session: newUuid(), assessment: newUuid(), income: newUuid(), goal: i.goalId,
    answers: i.answers, habit: i.habit, band: i.band, ...rec,
    chosenTarget: i.chosenTarget, horizon: i.horizon, warning: i.warning, title: i.title,
  });
}
