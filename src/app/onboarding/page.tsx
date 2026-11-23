"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { analytics } from "@/services/analytics";
import {
  storeUpdateUserName,
  storeSetSavingsProfile,
  storeSetUserAvatar,
  storeUpdateIncome,
  storeCreateGoal,
  incomeBandFromRange,
} from "@/services/dashboardStore";
import type { SavingsProfile, IncomeRange } from "@/types/Dashboard";
import { pushLocalDataToSupabase } from "@/services/syncService";
import { enqueueOnboardingComplete } from "@/services/v2/onboarding";
import {
  BoltIcon,
  TargetIcon,
  TrendingUpIcon,
  TrophyIcon,
  StarIcon,
  FlameIcon,
} from "@/components/ui/AppIcons";
import s from "./Onboarding.module.css";

// ─── Constantes ────────────────────────────────────────────────────────────────
const INCOME_OPTIONS = [
  { label: 'Menos de 1.000 €', min: 0,     max: 1_000,  mid: 1_000 }, // base: 1000
  { label: '1.000 – 1.500 €',  min: 1_000, max: 1_500,  mid: 1_500 }, // base: 1500
  { label: '1.500 – 2.000 €',  min: 1_500, max: 2_000,  mid: 2_000 }, // base: 2000
  { label: '2.000 – 2.500 €',  min: 2_000, max: 2_500,  mid: 2_500 }, // base: 2500
  { label: '2.500 – 3.000 €',  min: 2_500, max: 3_000,  mid: 3_000 }, // base: 3000
  { label: 'Más de 3.000 €',   min: 3_000, max: 10_000, mid: 3_500 }, // base: 3500
];

// ─── Tipos ─────────────────────────────────────────────────────────────────────
type AvatarKey     = 'comodo' | 'social' | 'impulsivo';
type SavingsHabit  = 'nunca' | 'algo' | 'suelo' | 'bastante';

// Porcentaje de ahorro por hábito (NUNCA se muestra al usuario)
export const SAVINGS_PCT: Record<SavingsHabit, number> = {
  nunca:    0.05,
  algo:     0.10,
  suelo:    0.15,
  bastante: 0.20,
};
export type { SavingsHabit };

// ─── Preguntas pasos 1–3 (avatar comportamental) ───────────────────────────────
interface OnboardingOption { value: AvatarKey; label: string; sub: string; }
interface OnboardingStep   { icon: string; label: string; question: string; options: OnboardingOption[]; }

const BEHAVIORAL_STEPS: OnboardingStep[] = [
  {
    icon: '💸', label: 'Gasto',
    question: '¿En qué tipo de gasto sientes que más se te escapa el dinero?',
    options: [
      { value: 'comodo',    label: 'En cosas que hago por rutina o comodidad: delivery, taxi, café fuera…',    sub: 'Sé que podría hacerlo más barato, pero elijo lo fácil' },
      { value: 'social',    label: 'En planes, salidas, cenas y todo lo que es vida social',                    sub: 'Paso un buen rato, pero la cuenta siempre me sorprende' },
      { value: 'impulsivo', label: 'En cosas que compro sin haberlo planeado: ropa, tecnología, caprichos…',    sub: 'En el momento me apetece y luego me pregunto por qué lo compré' },
    ],
  },
  {
    icon: '🧠', label: 'Comportamiento',
    question: '¿Qué suele hacer que gastes más de lo que querías?',
    options: [
      { value: 'comodo',    label: 'Que elijo lo más cómodo o rápido sin pararme a buscar algo mejor',          sub: 'La pereza me sale cara' },
      { value: 'social',    label: 'Que me cuesta decir que no cuando hay un plan o alguien propone algo',      sub: 'No quiero ser el que se queda fuera' },
      { value: 'impulsivo', label: 'Que me entra un deseo o un capricho y actúo sin pensarlo',                   sub: 'Lo quiero en ese momento y después ya veré' },
    ],
  },
  {
    icon: '⚡', label: 'Momento clave',
    question: '¿Cuándo te resulta más difícil ahorrar?',
    options: [
      { value: 'comodo',    label: 'Cuando estoy cansado, con prisa o sin ganas de complicarme',                sub: 'Si estoy agotado, elijo lo fácil sin pensar' },
      { value: 'social',    label: 'Cuando hay un plan, una quedada o gente con la que quiero estar',           sub: 'No quiero ser el que dice que no' },
      { value: 'impulsivo', label: 'Cuando veo algo que me gusta o me entra un antojo de repente',               sub: 'En ese momento lo quiero y no puedo evitarlo' },
    ],
  },
];

// ─── Pregunta paso 4 (hábito de ahorro) ───────────────────────────────────────
const HABIT_OPTIONS: { value: SavingsHabit; label: string; sub: string }[] = [
  { value: 'nunca',    label: 'Casi nunca consigo ahorrar',                  sub: 'El dinero se va antes de que pueda guardarlo' },
  { value: 'algo',     label: 'Ahorro algo, pero me cuesta mantenerlo',      sub: 'Algunos meses sí, otros no' },
  { value: 'suelo',    label: 'Suelo ahorrar todos los meses',               sub: 'Con cierta regularidad, aunque no siempre igual' },
  { value: 'bastante', label: 'Ahorro bastante y llevo buen control',        sub: 'Tengo el hábito asentado' },
];

// ─── Clasificación de avatar (puntuación ponderada) ───────────────────────────
// Q1 = 1 punto (síntoma), Q2 = 2 puntos (mecanismo), Q3 = 2 puntos (disparador)
// Puntuaciones conservadas únicamente como dato informativo.
const ONBOARDING_WEIGHTS = [1, 2, 2];

function classifyAvatar(answers: AvatarKey[]): { avatar: AvatarKey; scores: Record<AvatarKey, number> } {
  const scores: Record<AvatarKey, number> = { comodo: 0, social: 0, impulsivo: 0 };
  for (let i = 0; i < answers.length; i++) {
    scores[answers[i]] += ONBOARDING_WEIGHTS[i] ?? 1;
  }
  const max     = Math.max(...Object.values(scores));
  const winners = (Object.keys(scores) as AvatarKey[]).filter(k => scores[k] === max);
  const tieBreak: AvatarKey[] = ['impulsivo', 'social', 'comodo'];
  const avatar = winners.length === 1 ? winners[0] : tieBreak.find(k => winners.includes(k)) ?? 'comodo';
  return { avatar, scores };
}

// ─── Fases del objetivo ───────────────────────────────────────────────────────
export function computeGoalPhases(amount: number, months: number) {
  const monthly = amount / months;
  const weekly  = monthly / 4;

  if (months === 1) {
    return [
      { label: 'Semana 1',   target: Math.round(weekly * 1), type: 'week'  as const },
      { label: 'Semana 2',   target: Math.round(weekly * 2), type: 'week'  as const },
      { label: 'Semana 3',   target: Math.round(weekly * 3), type: 'week'  as const },
      { label: 'Meta final', target: amount,                 type: 'final' as const },
    ];
  }
  return [
    { label: 'Semana 1',   target: Math.round(weekly * 1), type: 'week'  as const },
    { label: 'Semana 2',   target: Math.round(weekly * 2), type: 'week'  as const },
    ...Array.from({ length: months - 1 }, (_, i) => ({
      label: `Mes ${i + 1}`,
      target: Math.round(monthly * (i + 1)),
      type: 'month' as const,
    })),
    { label: 'Meta final', target: amount,                  type: 'final' as const },
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function fmtEUR(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n);
}

export const PHASE_CONFIGS = [
  { emoji: '⚡', color: '#60a5fa', rgba: '96,165,250'  },
  { emoji: '🔥', color: '#818cf8', rgba: '129,140,248' },
  { emoji: '🎯', color: '#a855f7', rgba: '168,85,247'  },
  { emoji: '💪', color: '#c084fc', rgba: '192,132,252' },
  { emoji: '🌟', color: '#e879f9', rgba: '232,121,249' },
  { emoji: '🚀', color: '#f472b6', rgba: '244,114,182' },
  { emoji: '✨', color: '#fb7185', rgba: '251,113,133' },
];

const PHASE_PALETTE = ['#5b6cf9', '#14a3f6', '#a855f7', '#10b5ce', '#ec4899', '#12c48b'];

// ─── Pantalla "Tu recorrido" (post-onboarding, no es un paso) ─────────────────
function RoadmapScreen({
  phases,
  goalName,
  goalAmount,
  goalMonths,
  onContinue,
}: {
  phases: ReturnType<typeof computeGoalPhases>;
  goalName: string;
  goalAmount: number;
  goalMonths: number;
  onContinue: () => void;
}) {
  return (
    <main className={`${s.page} ${s.pageTop}`}>
      <div className={`${s.sky} ${s.skyRoadmap}`} />
      <div className={s.container}>
        {/* Top brand */}
        <div className={s.brandRow}>
          <div className={s.brand}>
            <div className={s.brandMark}>A</div>
            <div>
              <span className={s.brandName}>Ahorro </span>
              <span className={s.brandAccent}>Invisible</span>
            </div>
          </div>
          <span className={s.stepCounterPill}>Tu plan listo</span>
        </div>

        {/* Open celebratory hero */}
        <div className={s.roadmapHero}>
          <div className={s.roadmapPill}>
            <span className={s.roadmapPillDot}><TrophyIcon size={13} /></span>
            <span className={s.roadmapPillText}>{goalName || 'Mi primer objetivo de ahorro'}</span>
          </div>
          <p className={s.roadmapHeroAmount}>{fmtEUR(goalAmount)}</p>
          <p className={s.roadmapHeroSub}>
            En {goalMonths} {goalMonths === 1 ? 'mes' : 'meses'} · {phases.length} hitos progresivos
          </p>
        </div>

        {/* Velvety Timeline Card */}
        <div className={s.card}>
          <div className={s.stepHead}>
            <div className={`${s.stepMedallion} ${s.stepMedallionEmerald}`}>
              <TrendingUpIcon size={16} />
            </div>
            <span className={s.stepLabel}>Tu recorrido</span>
          </div>

          <h2 className={s.questionTitle}>Así vas a alcanzar tu objetivo</h2>
          <p className={s.questionSub}>
            Hemos dividido tu reto en pequeñas fases para que el progreso sea visible desde el primer día. No tienes que conseguirlo todo de golpe.
          </p>

          <div className={s.timelineScroll}>
            {phases.map((phase, i) => {
              const isLast = i === phases.length - 1;
              const color = isLast ? '#12c48b' : PHASE_PALETTE[i % PHASE_PALETTE.length];
              const prevTarget = i > 0 ? phases[i - 1].target : 0;
              const increment = phase.target - prevTarget;
              return (
                <div key={i} className={s.phaseRow}>
                  <div className={s.phaseRail}>
                    <div
                      className={s.phaseNode}
                      style={{ background: color }}
                    >
                      {isLast ? <TrophyIcon size={16} /> : i === 0 ? <BoltIcon size={15} /> : <FlameIcon size={15} />}
                    </div>
                    {!isLast && (
                      <div
                        className={s.phaseLine}
                        style={{ background: `linear-gradient(to bottom, ${color}, rgba(255,255,255,0.12))` }}
                      />
                    )}
                  </div>
                  <div className={`${s.phaseBody} ${isLast ? s.phaseBodyLast : ''}`}>
                    <div className={s.phaseHead}>
                      <span className={s.phaseLabel} style={{ color }}>{phase.label}</span>
                      <span className={s.phaseTarget} style={{ color: isLast ? '#12c48b' : undefined }}>
                        {fmtEUR(phase.target)}
                      </span>
                    </div>
                    <div className={s.phaseDesc}>
                      {isLast
                        ? '¡Objetivo alcanzado!'
                        : phase.type === 'week'
                          ? `Ahorra ${fmtEUR(increment)} esta semana`
                          : `+${fmtEUR(increment)} este mes · acumulas ${fmtEUR(phase.target)}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={s.roadmapNote}>
            <span className={s.roadmapNoteIcon}><StarIcon size={14} /></span>
            <p className={s.roadmapNoteText}>
              Cada pequeña fase que superes es una victoria real. Ahorro Invisible te acompañará en cada paso del camino.
            </p>
          </div>

          <button onClick={onContinue} className={s.roadmapCta}>
            Comenzar mi recorrido →
          </button>
        </div>
      </div>
    </main>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
export default function OnboardingPage() {
  const router = useRouter();

  // ── Navegación ─────────────────────────────────────────────────────────────
  const [step,        setStep]        = useState(1);    // 1–5
  const [showRoadmap, setShowRoadmap] = useState(false); // pantalla previa al dashboard
  const [userName,    setUserName]    = useState('');

  // ── Pasos 1–3: respuestas comportamentales (avatar) ────────────────────────
  const [answers, setAnswers] = useState<(AvatarKey | null)[]>([null, null, null]);

  // ── Paso 4: hábito de ahorro ───────────────────────────────────────────────
  const [savingsHabit, setSavingsHabit] = useState<SavingsHabit | null>(null);

  // ── Paso 5: ingresos + objetivo ────────────────────────────────────────────
  const [selectedIncomeIdx, setSelectedIncomeIdx] = useState<number | null>(null);
  const [goalName,          setGoalName]           = useState('Mi primer objetivo de ahorro');
  const [goalAmount,        setGoalAmount]          = useState(0);
  const [goalInputValue,    setGoalInputValue]      = useState('');
  const [goalMonths,        setGoalMonths]          = useState(3);
  const [hasAutoFilled,     setHasAutoFilled]       = useState(false);

  // Sync input visual cuando goalAmount cambia por botones
  useEffect(() => { if (goalAmount > 0) setGoalInputValue(String(goalAmount)); }, [goalAmount]);

  // ── Auth & analytics ────────────────────────────────────────────────────────
  useEffect(() => {
    analytics.setScreen(`onboarding_step_${step}` as Parameters<typeof analytics.setScreen>[0]);
    if (localStorage.getItem('isAuthenticated') !== 'true') { router.replace('/signup'); return; }
    const name = localStorage.getItem('userName');
    if (name) setUserName(name);
    if (localStorage.getItem('hasCompletedOnboarding') === 'true') { router.replace('/dashboard'); return; }
    analytics.onboardingStepViewed(step);
  }, [router, step]);

  // ── Auto-fill recomendación al entrar en paso 5 ────────────────────────────
  useEffect(() => {
    if (step === 5 && !hasAutoFilled && savingsHabit && selectedIncomeIdx !== null) {
      const mid     = INCOME_OPTIONS[selectedIncomeIdx].mid;
      const pct     = SAVINGS_PCT[savingsHabit];
      const monthly = Math.max(50, Math.round(mid * pct));
      const total   = monthly * goalMonths;
      setGoalAmount(total);
      setGoalInputValue(String(total));
      setHasAutoFilled(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Valores calculados para el paso 5 ──────────────────────────────────────
  const incomeMid   = selectedIncomeIdx !== null ? INCOME_OPTIONS[selectedIncomeIdx].mid : 1_750;
  const savingsPct  = savingsHabit ? SAVINGS_PCT[savingsHabit] : 0.10;
  const recMonthly  = Math.max(50, Math.round(incomeMid * savingsPct));
  const recTotal    = recMonthly * goalMonths;
  const monthlyGoal = goalAmount > 0 ? goalAmount / goalMonths : 0;
  const isOver30    = goalAmount > 0 && monthlyGoal > incomeMid * 0.30;
  const isOverRec   = goalAmount > 0 && goalAmount > recTotal && !isOver30;

  const phases  = computeGoalPhases(Math.max(50, goalAmount || recTotal), goalMonths);
  // ── Input manual del objetivo ──────────────────────────────────────────────
  function handleGoalInputBlur() {
    const num = parseInt(goalInputValue.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num >= 50) setGoalAmount(num);
    else setGoalInputValue(String(goalAmount));
  }

  // ── Navegación ─────────────────────────────────────────────────────────────
  const totalSteps     = 5;
  const pct            = Math.round((step / totalSteps) * 100);
  const currentStep    = step <= 3 ? BEHAVIORAL_STEPS[step - 1] : null;
  const selectedAnswer = step <= 3 ? answers[step - 1]           : null;
  const isDisabled     = step <= 3 ? !selectedAnswer
                       : step === 4 ? !savingsHabit
                       : step === 5 ? (!goalName.trim() || goalAmount <= 0 || selectedIncomeIdx === null)
                       : false;

  function setAnswer(value: AvatarKey) {
    setAnswers(prev => { const n = [...prev]; n[step - 1] = value; return n; });
  }

  function handleBack() {
    if (step > 1) {
      if (step === 5) setHasAutoFilled(false); // permite re-autofill si vuelven a paso 5
      setStep(step - 1);
    }
  }

  function handleNext() {
    if (step <= 3) {
      if (!answers[step - 1]) return;
      analytics.onboardingQuestionAnswered(step, `onb_q${step}`, answers[step - 1]!);
      setStep(step + 1);

    } else if (step === 4) {
      if (!savingsHabit) return;
      setStep(5);

    } else if (step === 5) {
      const num            = parseInt(goalInputValue.replace(/\D/g, ''), 10);
      const resolvedAmount = !isNaN(num) && num >= 50 ? num : goalAmount;
      setGoalAmount(resolvedAmount);
      saveOnboardingData(resolvedAmount);
      setShowRoadmap(true);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }

  function saveOnboardingData(resolvedAmount: number) {
    const finalAnswers   = answers as AvatarKey[];
    const { avatar, scores: onbScores } = classifyAvatar(finalAnswers);
    const resolvedPhases = computeGoalPhases(resolvedAmount, goalMonths);
    const resolvedName   = goalName.trim() || 'Mi primer objetivo de ahorro';

    try {
      localStorage.setItem('hasCompletedOnboarding', 'true');
      const name = localStorage.getItem('userName');
      if (name) storeUpdateUserName(name);
      storeSetUserAvatar(avatar);
      storeSetSavingsProfile('medium' as SavingsProfile);
      const incomeOpt = selectedIncomeIdx !== null ? INCOME_OPTIONS[selectedIncomeIdx] : INCOME_OPTIONS[1];
      const incomeRange = { min: incomeOpt.min, max: incomeOpt.max, currency: 'EUR' } satisfies IncomeRange;
      // V2: la declaración de ingresos del onboarding la registra complete_onboarding.
      storeUpdateIncome(incomeRange, '30d', { skipV2: true });
      const goalId = `goal_${Date.now()}`;
      const summary = storeCreateGoal({
        title: resolvedName,
        targetAmount: resolvedAmount,
        currentAmount: 0,
        horizonMonths: goalMonths,
        isPrimary: true,
        source: 'onboarding',
      }, '30d', { id: goalId });
      const created = summary.goals.find((g) => g.id === goalId);
      if (created) {
        const monthly = resolvedAmount / goalMonths;
        const recT    = savingsHabit ? Math.max(50, Math.round(incomeOpt.mid * SAVINGS_PCT[savingsHabit])) * goalMonths : Infinity;
        const warning = monthly > incomeOpt.mid * 0.30 ? 'over_30pct_reference_income'
                      : resolvedAmount > recT ? 'over_recommendation' : 'none';
        enqueueOnboardingComplete({
          goalId, title: created.title, band: incomeBandFromRange(incomeRange),
          answers: finalAnswers, habit: savingsHabit,
          chosenTarget: created.targetAmount, horizon: created.horizonMonths, warning,
        });
      }
      localStorage.setItem('onboardingData', JSON.stringify({
        userAvatar: avatar, answers: finalAnswers,
        avatarScores: onbScores,
        savingsHabit,
        incomeMin: incomeOpt.min, incomeMax: incomeOpt.max, incomeMid: incomeOpt.mid,
        goalName: resolvedName, goalAmount: resolvedAmount, goalMonths,
        phases: resolvedPhases,
        savingsProfile: 'medium',
        completedAt: new Date().toISOString(),
      }));
      analytics.onboardingSubmitted();
      const userId = localStorage.getItem('supabaseUserId');
      if (userId) pushLocalDataToSupabase(userId).catch(() => null);
    } catch (err) {
      console.error('[onboarding] Error al guardar:', err);
    }
  }

  // ── Pantalla de recorrido (después de paso 5) ──────────────────────────────
  if (showRoadmap) {
    return (
      <RoadmapScreen
        phases={phases}
        goalName={goalName}
        goalAmount={goalAmount}
        goalMonths={goalMonths}
        onContinue={() => router.push('/dashboard')}
      />
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL (pasos 1–5)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <main className={`${s.page} ${step >= 5 ? s.pageTop : ''}`}>
      <div className={s.sky} />

      <div className={s.container}>
        {/* ── Logo + Step pill ── */}
        <div className={s.brandRow}>
          <div className={s.brand}>
            <div className={s.brandMark}>A</div>
            <div>
              <span className={s.brandName}>Ahorro </span>
              <span className={s.brandAccent}>Invisible</span>
            </div>
          </div>
          <span className={s.stepCounterPill}>Paso {step} de {totalSteps}</span>
        </div>

        {/* ── Card aterciopelada ── */}
        <div className={s.card}>
          {/* ── Barra de progreso ── */}
          <div className={s.progressWrap}>
            <div className={s.progressTop}>
              <div className={s.progressDots}>
                {[1, 2, 3, 4, 5].map(idx => (
                  <div
                    key={idx}
                    className={`${s.progressDot} ${idx === step ? s.progressDotCurrent : idx < step ? s.progressDotDone : ''}`}
                  />
                ))}
              </div>
              <span className={s.progressPct}>{pct}% completado</span>
            </div>
            <div className={s.progressTrack}>
              <div className={s.progressFill} style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* ══════════════════════════════
              PASOS 1–3: preguntas de avatar
          ══════════════════════════════ */}
          {step <= 3 && currentStep && (
            <>
              <div className={s.stepHead}>
                <div className={s.stepMedallion}>
                  {step === 1 ? <BoltIcon size={16} /> : step === 2 ? <StarIcon size={16} /> : <FlameIcon size={16} />}
                </div>
                <span className={s.stepLabel}>Paso {step} de {totalSteps} · {currentStep.label}</span>
              </div>
              <h2 className={`${s.questionTitle} ${s.questionTitleSpacing}`}>{currentStep.question}</h2>
              <div className={s.optionsList}>
                {currentStep.options.map((opt, i) => {
                  const isActive = selectedAnswer === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAnswer(opt.value)}
                      className={`${s.optionBtn} ${isActive ? s.optionBtnActive : ''}`}
                    >
                      <div className={`${s.optionBadge} ${isActive ? s.optionBadgeActive : ''}`}>
                        {['A', 'B', 'C', 'D'][i]}
                      </div>
                      <div className={s.optionContent}>
                        <div className={s.optionTitle}>{opt.label}</div>
                        <div className={s.optionSub}>{opt.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ══════════════════════════════
              PASO 4: hábito de ahorro actual
          ══════════════════════════════ */}
          {step === 4 && (
            <>
              <div className={s.stepHead}>
                <div className={`${s.stepMedallion} ${s.stepMedallionEmerald}`}>
                  <TrendingUpIcon size={16} />
                </div>
                <span className={s.stepLabel}>Paso 4 de {totalSteps} · Situación actual</span>
              </div>
              <h2 className={s.questionTitle}>¿Cómo dirías que es tu ahorro actualmente?</h2>
              <p className={s.questionSub}>
                No hay respuesta correcta ni incorrecta. Esto nos ayuda a proponerte un buen punto de partida.
              </p>
              <div className={s.optionsList}>
                {HABIT_OPTIONS.map((opt, i) => {
                  const isActive = savingsHabit === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSavingsHabit(opt.value)}
                      className={`${s.optionBtn} ${isActive ? s.optionBtnActiveEmerald : ''}`}
                    >
                      <div className={`${s.optionBadge} ${isActive ? s.optionBadgeActiveEmerald : ''}`}>
                        {['A', 'B', 'C', 'D'][i]}
                      </div>
                      <div className={s.optionContent}>
                        <div className={s.optionTitle}>{opt.label}</div>
                        <div className={s.optionSub}>{opt.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ══════════════════════════════
              PASO 5: ingresos + objetivo
          ══════════════════════════════ */}
          {step === 5 && (
            <>
              <div className={s.stepHead}>
                <div className={`${s.stepMedallion} ${s.stepMedallionViolet}`}>
                  <TargetIcon size={16} />
                </div>
                <span className={s.stepLabel}>Paso 5 de {totalSteps} · Tu objetivo</span>
              </div>
              <h2 className={s.questionTitle}>Cuéntanos sobre tu objetivo</h2>
              <p className={s.questionSub}>
                Vamos a proponerte un punto de partida adaptado a tu situación. Siempre puedes cambiarlo.
              </p>

              {/* Ingresos — 6 opciones en grid 2 columnas */}
              <div className={s.fieldLabel}>¿Cuáles son tus ingresos netos aproximados?</div>
              <div className={s.incomeGrid}>
                {INCOME_OPTIONS.map((opt, i) => {
                  const isSel = selectedIncomeIdx === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setSelectedIncomeIdx(i); setHasAutoFilled(false); }}
                      className={`${s.incomeBtn} ${isSel ? s.incomeBtnSelected : ''}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className={s.softDivider} />

              {/* Nombre del objetivo */}
              <div className={s.fieldBlock}>
                <label className={s.fieldLabel} htmlFor="onb-goal-name">¿Cómo se llama tu objetivo?</label>
                <input
                  id="onb-goal-name"
                  type="text"
                  value={goalName}
                  onChange={e => setGoalName(e.target.value)}
                  placeholder="Viaje, fondo de emergencia, coche..."
                  className={s.textInput}
                />
              </div>

              {/* Duración */}
              <div className={s.fieldBlock}>
                <div className={s.fieldLabel}>¿En cuántos meses?</div>
                <div className={s.monthsRow}>
                  {[1, 2, 3, 6, 12].map(m => {
                    const isSel = goalMonths === m;
                    const isRec = m === 3;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setGoalMonths(m)}
                        className={`${s.monthBtn} ${isSel ? s.monthBtnSelected : isRec ? s.monthBtnRec : ''}`}
                      >
                        {m}m
                        {isRec && !isSel && <span className={s.recTag}>REC</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cantidad: stepper + input manual */}
              <div className={s.fieldBlock}>
                <div className={s.fieldLabelRow}>
                  <span className={s.fieldLabel}>¿Cuánto quieres ahorrar?</span>
                  <span className={s.recHint}>Recomendamos: {fmtEUR(recTotal)}</span>
                </div>
                <div className={s.stepperWrap}>
                  <button
                    type="button"
                    onClick={() => setGoalAmount(a => Math.max(50, a - 50))}
                    className={s.stepperBtn}
                    aria-label="Restar 50 euros"
                  >
                    −
                  </button>
                  <div className={s.stepperCenter}>
                    <div className={s.stepperInputRow}>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={goalInputValue}
                        onChange={e => setGoalInputValue(e.target.value)}
                        onBlur={handleGoalInputBlur}
                        className={s.stepperInput}
                        style={{ width: `${Math.max(4, String(goalInputValue).length + 1)}ch` }}
                        aria-label="Cantidad del objetivo en euros"
                      />
                      <span className={s.stepperCurrency}>€</span>
                    </div>
                    <div className={s.stepperHint}>toca para escribir · o usa los botones</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGoalAmount(a => a + 50)}
                    className={s.stepperBtn}
                    aria-label="Sumar 50 euros"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Mensaje de validación */}
              {goalAmount > 0 && (
                isOver30 ? (
                  <div className={s.feedbackAmber}>
                    <p className={s.feedbackTitleAmber}>Una meta muy ambiciosa</p>
                    <p className={s.feedbackBody}>
                      Es una meta muy ambiciosa y puede ser difícil mantenerla en el tiempo. Te recomendamos empezar con una cantidad más cómoda y, más adelante, ir ajustándola si te ves con margen.
                    </p>
                    <div className={s.feedbackRefRow}>
                      <span className={s.feedbackRefLabel}>Referencia para tu perfil</span>
                      <span className={s.feedbackRefVal}>{fmtEUR(recTotal)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setGoalAmount(recTotal); setGoalInputValue(String(recTotal)); }}
                      className={s.feedbackActionBtn}
                    >
                      Empezar con {fmtEUR(recTotal)} →
                    </button>
                  </div>
                ) : isOverRec ? (
                  <div className={s.feedbackIndigo}>
                    <p className={s.feedbackTitleIndigo}>Una propuesta amigable</p>
                    <p className={s.feedbackBody}>
                      Esta meta es un poco más ambiciosa que la que te recomendamos para empezar. Puedes seguir con ella, aunque empezar con una cantidad más realista puede ayudarte a mantener el ritmo mejor.
                    </p>
                    <button
                      type="button"
                      onClick={() => { setGoalAmount(recTotal); setGoalInputValue(String(recTotal)); }}
                      className={`${s.feedbackActionBtn} ${s.feedbackActionBtnIndigo}`}
                    >
                      Usar {fmtEUR(recTotal)} como objetivo →
                    </button>
                  </div>
                ) : (
                  <div className={s.feedbackEmerald}>
                    <span className={s.feedbackBodyEmerald}>
                      Un objetivo bien ajustado a tu situación. ¡Buen punto de partida!
                    </span>
                  </div>
                )
              )}
            </>
          )}

          {/* ── Botones de navegación ── */}
          <div className={`${s.navFooter} ${step < 4 ? s.navFooterCompact : ''}`}>
            {step > 1 && (
              <button type="button" onClick={handleBack} className={s.backBtn}>
                Atrás
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={isDisabled}
              className={`${s.nextBtn} ${step === 1 ? s.nextBtnFull : ''}`}
            >
              {step < totalSteps ? 'Siguiente →' : 'Ver mi plan →'}
            </button>
          </div>
        </div>

        {/* Saludo personalizado */}
        {userName && (
          <p className={s.greeting}>
            Preparando tu experiencia, {userName}
          </p>
        )}
      </div>
    </main>
  );
}
