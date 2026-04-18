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
} from "@/services/dashboardStore";
import type { UserAvatar } from "@/services/dashboardStore";
import type { SavingsProfile, IncomeRange } from "@/types/Dashboard";
import { pushLocalDataToSupabase } from "@/services/syncService";

// ─── Constantes ────────────────────────────────────────────────────────────────
const INCOME_OPTIONS = [
  { label: 'Menos de 1.000 €', min: 0,     max: 1_000,  mid: 1_000 },
  { label: '1.000 – 1.500 €',  min: 1_000, max: 1_500,  mid: 1_250 },
  { label: '1.500 – 2.000 €',  min: 1_500, max: 2_000,  mid: 1_750 },
  { label: '2.000 – 2.500 €',  min: 2_000, max: 2_500,  mid: 2_250 },
  { label: '2.500 – 3.000 €',  min: 2_500, max: 3_000,  mid: 2_750 },
  { label: 'Más de 3.000 €',   min: 3_000, max: 10_000, mid: 4_000 },
];

// ─── Tipos ─────────────────────────────────────────────────────────────────────
type AvatarKey     = UserAvatar;
type SavingsHabit  = 'nunca' | 'algo' | 'suelo' | 'bastante';

// Porcentaje de ahorro por hábito (NUNCA se muestra al usuario)
const SAVINGS_PCT: Record<SavingsHabit, number> = {
  nunca:    0.05,
  algo:     0.10,
  suelo:    0.15,
  bastante: 0.20,
};

// ─── Preguntas pasos 1–3 (avatar comportamental) ───────────────────────────────
interface OnboardingOption { value: AvatarKey; label: string; sub: string; }
interface OnboardingStep   { icon: string; label: string; question: string; options: OnboardingOption[]; }

const BEHAVIORAL_STEPS: OnboardingStep[] = [
  {
    icon: '💸', label: 'GASTO',
    question: '¿En qué tipo de gasto sientes que más se te escapa el dinero?',
    options: [
      { value: 'comodo',      label: 'En pedir delivery, transporte o pagar por comodidad',             sub: 'La opción fácil siempre acaba siendo la más cara' },
      { value: 'social',      label: 'En salir, planes, cenas o vida social',                           sub: 'Disfruto, pero luego me arrepiento del gasto' },
      { value: 'impulsivo',   label: 'En caprichos, compras impulsivas o cosas que no pensaba comprar', sub: 'Lo vi y lo compré, sin pensarlo demasiado' },
      { value: 'desordenado', label: 'En pequeños gastos del día a día; no sé exactamente dónde se me va', sub: 'Al final de mes no entiendo cómo me he quedado sin nada' },
    ],
  },
  {
    icon: '🧠', label: 'COMPORTAMIENTO',
    question: '¿Qué suele hacer que gastes más de lo que querías?',
    options: [
      { value: 'comodo',      label: 'Que quiero la opción más fácil o rápida',           sub: 'Si es cómodo, lo hago' },
      { value: 'social',      label: 'Que me cuesta decir que no a los planes',           sub: 'No quiero quedarme fuera' },
      { value: 'impulsivo',   label: 'Que me dejo llevar por el momento',                 sub: 'En el momento parecía buena idea' },
      { value: 'desordenado', label: 'Que no lo pienso demasiado y luego se me acumula', sub: 'Son gastos pequeños, pero hay muchos' },
    ],
  },
  {
    icon: '🎯', label: 'OBJETIVO',
    question: '¿Qué tipo de ayuda te vendría mejor para empezar a ahorrar?',
    options: [
      { value: 'comodo',      label: 'Ideas fáciles para gastar menos sin complicarme',                sub: 'Quiero soluciones prácticas y rápidas' },
      { value: 'social',      label: 'Controlarme mejor en salidas o planes concretos',                sub: 'Necesito frenar en situaciones sociales' },
      { value: 'impulsivo',   label: 'Frenar compras o decisiones impulsivas antes de hacerlas',       sub: 'Necesito ese segundo antes de actuar' },
      { value: 'desordenado', label: 'Tener más claridad y sentir que llevo el control de mis gastos', sub: 'Quiero entender a dónde va mi dinero' },
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

// ─── Clasificación de avatar ──────────────────────────────────────────────────
function classifyAvatar(answers: AvatarKey[]): AvatarKey {
  const counts: Record<AvatarKey, number> = { comodo: 0, social: 0, impulsivo: 0, desordenado: 0 };
  for (const a of answers) counts[a]++;
  const max     = Math.max(...Object.values(counts));
  const winners = (Object.keys(counts) as AvatarKey[]).filter(k => counts[k] === max);
  const tieBreak: AvatarKey[] = ['impulsivo', 'social', 'comodo', 'desordenado'];
  return winners.length === 1 ? winners[0] : tieBreak.find(k => winners.includes(k)) ?? 'desordenado';
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
function fmtEUR(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n);
}

const PHASE_CONFIGS = [
  { emoji: '⚡', color: '#60a5fa', rgba: '96,165,250'  },
  { emoji: '🔥', color: '#818cf8', rgba: '129,140,248' },
  { emoji: '🎯', color: '#a855f7', rgba: '168,85,247'  },
  { emoji: '💪', color: '#c084fc', rgba: '192,132,252' },
  { emoji: '🌟', color: '#e879f9', rgba: '232,121,249' },
  { emoji: '🚀', color: '#f472b6', rgba: '244,114,182' },
  { emoji: '✨', color: '#fb7185', rgba: '251,113,133' },
];

const btnBase: React.CSSProperties = {
  border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 200ms ease',
};

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
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start', padding: '24px 16px 80px',
      fontFamily: 'var(--font-geist-sans, Arial, sans-serif)',
    }}>
      <div style={{ position: 'fixed', top: '15%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 500, background: 'radial-gradient(ellipse, rgba(251,191,36,0.06) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div style={{ width: '100%', maxWidth: 480, position: 'relative' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #a855f7, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18, boxShadow: '0 4px 14px rgba(168,85,247,0.4)' }}>A</div>
          <div><span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16 }}>Ahorro </span><span style={{ color: '#a855f7', fontWeight: 700, fontSize: 16 }}>Invisible</span></div>
        </div>

        {/* Pill de objetivo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, padding: '10px 16px', marginBottom: 20 }}>
          <span style={{ fontSize: 18 }}>🏆</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>{goalName || 'Mi primer objetivo de ahorro'}</div>
            <div style={{ fontSize: 11, color: 'rgba(251,191,36,0.6)' }}>{fmtEUR(goalAmount)} · {goalMonths} {goalMonths === 1 ? 'mes' : 'meses'}</div>
          </div>
        </div>

        {/* Card principal */}
        <div style={{
          borderRadius: 20, background: 'linear-gradient(160deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid rgba(51,65,85,0.6)', boxShadow: '0 25px 60px rgba(2,6,23,0.7)',
          overflow: 'hidden', padding: '28px 24px', position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: -50, left: -50, width: 220, height: 220, background: 'radial-gradient(ellipse, rgba(251,191,36,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #fbbf24, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, boxShadow: '0 4px 14px rgba(251,191,36,0.35)' }}>🗺️</div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>TU RECORRIDO</span>
          </div>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px', lineHeight: 1.35 }}>Así vas a alcanzar tu objetivo</h2>
          <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.55)', margin: '0 0 22px', lineHeight: 1.5 }}>
            Hemos dividido tu reto en pequeñas fases para que el progreso sea visible desde el primer día. No tienes que conseguirlo todo de golpe.
          </p>

          {/* Timeline */}
          <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 2 }}>
            {phases.map((phase, i) => {
              const isLast    = i === phases.length - 1;
              const conf      = isLast ? { emoji: '🏆', color: '#fbbf24', rgba: '251,191,36' } : PHASE_CONFIGS[Math.min(i, PHASE_CONFIGS.length - 1)];
              const nextConf  = PHASE_CONFIGS[Math.min(i + 1, PHASE_CONFIGS.length - 1)];
              const prevTarget = i > 0 ? phases[i - 1].target : 0;
              const increment  = phase.target - prevTarget;
              return (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: isLast ? 'linear-gradient(135deg, #fbbf24, #f97316)' : `rgba(${conf.rgba},0.15)`, border: `2px solid rgba(${conf.rgba},${isLast ? 0.8 : 0.4})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, boxShadow: isLast ? '0 0 18px rgba(251,191,36,0.4)' : `0 0 8px rgba(${conf.rgba},0.2)` }}>
                      {conf.emoji}
                    </div>
                    {!isLast && <div style={{ width: 2, flex: 1, minHeight: 20, background: `linear-gradient(to bottom, rgba(${conf.rgba},0.4), rgba(${nextConf.rgba},0.25))`, margin: '3px 0' }} />}
                  </div>
                  <div style={{ flex: 1, paddingTop: 6, paddingBottom: isLast ? 4 : 18 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: `rgba(${conf.rgba},0.85)`, textTransform: 'uppercase' }}>{phase.label}</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: isLast ? '#fbbf24' : conf.color, flexShrink: 0 }}>{fmtEUR(phase.target)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)', lineHeight: 1.4 }}>
                      {isLast ? '🏆 ¡Objetivo alcanzado!' : phase.type === 'week' ? `Ahorra ${fmtEUR(increment)} esta semana` : `+${fmtEUR(increment)} este mes · acumulas ${fmtEUR(phase.target)}`}
                    </div>
                    {!isLast && <div style={{ height: 1, background: `rgba(${conf.rgba},0.1)`, marginTop: 10 }} />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Nota motivacional */}
          <div style={{ marginTop: 20, background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>💜</span>
            <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.7)', margin: 0, lineHeight: 1.5 }}>
              Cada pequeña fase que superes es una victoria real. Ahorro Invisible te acompañará en cada paso del camino.
            </p>
          </div>

          {/* CTA */}
          <button onClick={onContinue} style={{
            ...btnBase, width: '100%', marginTop: 20, padding: '14px 0', borderRadius: 12,
            background: 'linear-gradient(90deg, #fbbf24, #f97316)',
            color: '#0f172a', fontSize: 15, fontWeight: 800,
            boxShadow: '0 4px 20px rgba(251,191,36,0.4)',
            letterSpacing: '-0.2px',
          }}>
            Comenzar mi recorrido 🚀
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
    analytics.setScreen(`onboarding_step_${step}` as any);
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
      const monthly = Math.max(50, Math.round(mid * pct / 50) * 50);
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
  const recMonthly  = Math.max(50, Math.round(incomeMid * savingsPct / 50) * 50);
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
    }
  }

  function saveOnboardingData(resolvedAmount: number) {
    const finalAnswers   = answers as AvatarKey[];
    const avatar         = classifyAvatar(finalAnswers);
    const resolvedPhases = computeGoalPhases(resolvedAmount, goalMonths);
    const resolvedName   = goalName.trim() || 'Mi primer objetivo de ahorro';

    try {
      localStorage.setItem('hasCompletedOnboarding', 'true');
      const name = localStorage.getItem('userName');
      if (name) storeUpdateUserName(name);
      storeSetUserAvatar(avatar);
      storeSetSavingsProfile('medium' as SavingsProfile);
      const incomeOpt = selectedIncomeIdx !== null ? INCOME_OPTIONS[selectedIncomeIdx] : INCOME_OPTIONS[1];
      storeUpdateIncome({ min: incomeOpt.min, max: incomeOpt.max, currency: 'EUR' } satisfies IncomeRange);
      storeCreateGoal({
        title: resolvedName,
        targetAmount: resolvedAmount,
        currentAmount: 0,
        horizonMonths: goalMonths,
        isPrimary: true,
        source: 'onboarding',
      });
      localStorage.setItem('onboardingData', JSON.stringify({
        userAvatar: avatar, answers: finalAnswers,
        savingsHabit,
        incomeMin: incomeOpt.min, incomeMax: incomeOpt.max, incomeMid: incomeOpt.mid,
        goalName: resolvedName, goalAmount: resolvedAmount, goalMonths,
        phases: resolvedPhases,
        savingsProfile: 'medium',
        completedAt: new Date().toISOString(),
      }));
      analytics.onboardingCompleted();
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
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: step >= 5 ? 'flex-start' : 'center',
      padding: step >= 5 ? '24px 16px 80px' : '24px 16px',
      fontFamily: 'var(--font-geist-sans, Arial, sans-serif)',
    }}>
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 500, background: 'radial-gradient(ellipse, rgba(168,85,247,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 480, position: 'relative' }}>

        {/* ── Logo ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #a855f7, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18, boxShadow: '0 4px 14px rgba(168,85,247,0.4)' }}>A</div>
          <div><span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16 }}>Ahorro </span><span style={{ color: '#a855f7', fontWeight: 700, fontSize: 16 }}>Invisible</span></div>
        </div>

        {/* ── Card ── */}
        <div style={{ position: 'relative', borderRadius: 20, background: 'linear-gradient(160deg, #1e293b 0%, #0f172a 100%)', border: '1px solid rgba(51,65,85,0.6)', boxShadow: '0 25px 60px rgba(2,6,23,0.7)', overflow: 'hidden', padding: '28px 24px' }}>
          <div style={{ position: 'absolute', top: -50, left: -50, width: 220, height: 220, background: 'radial-gradient(ellipse, rgba(168,85,247,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

          {/* ── Barra de progreso ── */}
          <div style={{ marginBottom: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {[1, 2, 3, 4, 5].map(s => (
                  <div key={s} style={{ width: s === step ? 24 : 7, height: 7, borderRadius: 999, background: s <= step ? 'linear-gradient(90deg, #a855f7, #2563eb)' : 'rgba(51,65,85,0.6)', transition: 'all 300ms ease', boxShadow: s <= step ? '0 0 8px rgba(168,85,247,0.5)' : 'none' }} />
                ))}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,0.5)', letterSpacing: '0.08em' }}>{pct}% COMPLETADO</span>
            </div>
            <div style={{ height: 3, borderRadius: 999, background: 'rgba(51,65,85,0.5)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #a855f7, #2563eb)', borderRadius: 999, transition: 'width 400ms ease', boxShadow: '0 0 8px rgba(168,85,247,0.5)' }} />
            </div>
          </div>

          {/* ══════════════════════════════
              PASOS 1–3: preguntas de avatar
          ══════════════════════════════ */}
          {step <= 3 && currentStep && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #a855f7, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, boxShadow: '0 4px 14px rgba(168,85,247,0.3)' }}>{currentStep.icon}</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  PASO {step} DE {totalSteps} · {currentStep.label}
                </span>
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', margin: '0 0 22px', lineHeight: 1.35 }}>{currentStep.question}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {currentStep.options.map((opt, i) => {
                  const isActive = selectedAnswer === opt.value;
                  return (
                    <button key={opt.value} onClick={() => setAnswer(opt.value)} style={{ ...btnBase, display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', padding: '13px 14px', borderRadius: 12, textAlign: 'left', background: isActive ? 'linear-gradient(135deg,rgba(168,85,247,0.18),rgba(37,99,235,0.18))' : 'rgba(15,23,42,0.5)', border: isActive ? '1px solid rgba(168,85,247,0.55)' : '1px solid rgba(51,65,85,0.5)', boxShadow: isActive ? '0 0 16px rgba(168,85,247,0.15)' : 'none' }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, marginTop: 1, background: isActive ? 'linear-gradient(135deg, #a855f7, #2563eb)' : 'rgba(51,65,85,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: isActive ? '#fff' : 'rgba(148,163,184,0.6)', transition: 'all 180ms ease' }}>
                        {['A', 'B', 'C', 'D'][i]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#f1f5f9' : '#cbd5e1', marginBottom: 2, lineHeight: 1.3 }}>{opt.label}</div>
                        <div style={{ fontSize: 11, color: isActive ? 'rgba(196,181,253,0.7)' : 'rgba(100,116,139,0.6)', lineHeight: 1.3 }}>{opt.sub}</div>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }}>💰</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>PASO 4 DE {totalSteps} · SITUACIÓN ACTUAL</span>
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', margin: '0 0 6px', lineHeight: 1.35 }}>¿Cómo dirías que es tu ahorro actualmente?</h2>
              <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', margin: '0 0 22px', lineHeight: 1.5 }}>
                No hay respuesta correcta ni incorrecta. Esto nos ayuda a proponerte un buen punto de partida.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {HABIT_OPTIONS.map((opt, i) => {
                  const isActive = savingsHabit === opt.value;
                  return (
                    <button key={opt.value} onClick={() => setSavingsHabit(opt.value)} style={{ ...btnBase, display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', padding: '13px 14px', borderRadius: 12, textAlign: 'left', background: isActive ? 'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(5,150,105,0.15))' : 'rgba(15,23,42,0.5)', border: isActive ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(51,65,85,0.5)', boxShadow: isActive ? '0 0 16px rgba(16,185,129,0.12)' : 'none' }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, marginTop: 1, background: isActive ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(51,65,85,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: isActive ? '#fff' : 'rgba(148,163,184,0.6)', transition: 'all 180ms ease' }}>
                        {['A', 'B', 'C', 'D'][i]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#f1f5f9' : '#cbd5e1', marginBottom: 2, lineHeight: 1.3 }}>{opt.label}</div>
                        <div style={{ fontSize: 11, color: isActive ? 'rgba(110,231,183,0.65)' : 'rgba(100,116,139,0.6)', lineHeight: 1.3 }}>{opt.sub}</div>
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
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #ec4899, #a855f7, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, boxShadow: '0 4px 14px rgba(168,85,247,0.3)' }}>🎯</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>PASO 5 DE {totalSteps} · TU OBJETIVO</span>
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px', lineHeight: 1.35 }}>Cuéntanos sobre tu objetivo</h2>
              <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.55)', margin: '0 0 22px', lineHeight: 1.5 }}>
                Vamos a proponerte un punto de partida adaptado a tu situación. Siempre puedes cambiarlo.
              </p>

              {/* Ingresos — 6 opciones en grid 2 columnas */}
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>¿Cuáles son tus ingresos netos aproximados?</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                {INCOME_OPTIONS.map((opt, i) => {
                  const isSel = selectedIncomeIdx === i;
                  return (
                    <button
                      key={i}
                      onClick={() => { setSelectedIncomeIdx(i); setHasAutoFilled(false); }}
                      style={{
                        ...btnBase,
                        padding: '11px 10px',
                        borderRadius: 12,
                        textAlign: 'center',
                        background: isSel
                          ? 'linear-gradient(135deg,rgba(236,72,153,0.22),rgba(168,85,247,0.22))'
                          : 'rgba(15,23,42,0.5)',
                        border: isSel
                          ? '1px solid rgba(168,85,247,0.55)'
                          : '1px solid rgba(51,65,85,0.5)',
                        color: isSel ? '#f1f5f9' : '#94a3b8',
                        fontSize: 12,
                        fontWeight: isSel ? 700 : 500,
                        boxShadow: isSel ? '0 0 14px rgba(168,85,247,0.15)' : 'none',
                        lineHeight: 1.35,
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.3), transparent)', margin: '0 0 20px' }} />

              {/* Nombre del objetivo */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>¿Cómo se llama tu objetivo?</div>
                <input
                  type="text"
                  value={goalName}
                  onChange={e => setGoalName(e.target.value)}
                  placeholder="Viaje, fondo de emergencia, coche..."
                  style={{ width: '100%', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 12, padding: '11px 14px', color: '#f1f5f9', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 200ms ease' }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(168,85,247,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(51,65,85,0.5)')}
                />
              </div>

              {/* Duración */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>¿En cuántos meses?</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 6, 12].map(m => {
                    const isSel = goalMonths === m;
                    const isRec = m === 3;
                    return (
                      <button key={m} onClick={() => setGoalMonths(m)} style={{ ...btnBase, flex: 1, padding: '10px 0', borderRadius: 10, position: 'relative', background: isSel ? 'linear-gradient(135deg, #a855f7, #2563eb)' : 'rgba(15,23,42,0.5)', border: isSel ? 'none' : isRec ? '1px solid rgba(168,85,247,0.35)' : '1px solid rgba(51,65,85,0.5)', color: isSel ? '#fff' : isRec ? '#c4b5fd' : 'rgba(148,163,184,0.55)', fontSize: 13, fontWeight: isSel ? 800 : 600, boxShadow: isSel ? '0 4px 14px rgba(168,85,247,0.3)' : 'none' }}>
                        {m}m
                        {isRec && !isSel && <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg, #a855f7, #2563eb)', borderRadius: 999, padding: '1px 6px', fontSize: 7, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', pointerEvents: 'none' }}>★ REC</div>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cantidad: stepper + input manual */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>¿Cuánto quieres ahorrar?</div>
                  <div style={{ fontSize: 11, color: 'rgba(168,85,247,0.7)', fontWeight: 600 }}>Recomendamos: {fmtEUR(recTotal)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'stretch', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 14, overflow: 'hidden' }}>
                  <button onClick={() => setGoalAmount(a => Math.max(50, a - 50))} style={{ ...btnBase, width: 52, background: 'rgba(255,255,255,0.04)', color: 'rgba(148,163,184,0.8)', fontSize: 26, flexShrink: 0 }}>−</button>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                      <input
                        type="number" inputMode="numeric" value={goalInputValue}
                        onChange={e => setGoalInputValue(e.target.value)}
                        onBlur={handleGoalInputBlur}
                        style={{ background: 'transparent', border: 'none', outline: 'none', color: '#f1f5f9', fontWeight: 800, fontSize: 26, letterSpacing: '-0.5px', fontFamily: 'inherit', textAlign: 'right', width: `${Math.max(3, String(goalInputValue).length)}ch`, minWidth: '3ch', maxWidth: '10ch' } as React.CSSProperties}
                      />
                      <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(241,245,249,0.5)', flexShrink: 0 }}>€</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.3)', marginTop: 2 }}>toca para escribir · o usa los botones</div>
                  </div>
                  <button onClick={() => setGoalAmount(a => a + 50)} style={{ ...btnBase, width: 52, background: 'rgba(255,255,255,0.04)', color: 'rgba(148,163,184,0.8)', fontSize: 26, flexShrink: 0 }}>+</button>
                </div>
              </div>

              {/* Mensaje de validación */}
              {goalAmount > 0 && (
                isOver30 ? (
                  /* Nivel 2: supera el 30% — amable pero notable */
                  <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: 14, padding: '14px 16px', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 16 }}>💡</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>Una meta muy ambiciosa</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(251,191,36,0.8)', margin: '0 0 8px', lineHeight: 1.6 }}>
                      Es una meta muy ambiciosa y puede ser difícil mantenerla en el tiempo. Te recomendamos empezar con una cantidad más cómoda y, más adelante, ir ajustándola si te ves con margen.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(251,191,36,0.08)', borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: 'rgba(251,191,36,0.6)' }}>Referencia para tu perfil</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24' }}>{fmtEUR(recTotal)}</span>
                    </div>
                    <button onClick={() => { setGoalAmount(recTotal); setGoalInputValue(String(recTotal)); }} style={{ ...btnBase, width: '100%', padding: '9px', borderRadius: 10, background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.28)', color: '#fbbf24', fontSize: 12, fontWeight: 700 }}>
                      Empezar con {fmtEUR(recTotal)} →
                    </button>
                  </div>
                ) : isOverRec ? (
                  /* Nivel 1: supera recomendación pero no el 30% — tono suave */
                  <div style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 14, padding: '14px 16px', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 16 }}>💜</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd' }}>Una propuesta amigable</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(196,181,253,0.8)', margin: '0 0 10px', lineHeight: 1.6 }}>
                      Esta meta es un poco más ambiciosa que la que te recomendamos para empezar. Puedes seguir con ella, aunque empezar con una cantidad más realista puede ayudarte a mantener el ritmo mejor.
                    </p>
                    <button onClick={() => { setGoalAmount(recTotal); setGoalInputValue(String(recTotal)); }} style={{ ...btnBase, width: '100%', padding: '9px', borderRadius: 10, background: 'rgba(168,85,247,0.10)', border: '1px solid rgba(168,85,247,0.28)', color: '#c4b5fd', fontSize: 12, fontWeight: 700 }}>
                      Usar {fmtEUR(recTotal)} como objetivo →
                    </button>
                  </div>
                ) : (
                  /* Dentro de la recomendación — feedback positivo */
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: 10, padding: '10px 14px', marginBottom: 4 }}>
                    <span style={{ fontSize: 15 }}>✅</span>
                    <span style={{ fontSize: 12, color: '#34d399', lineHeight: 1.4 }}>
                      Un objetivo bien ajustado a tu situación. ¡Buen punto de partida!
                    </span>
                  </div>
                )
              )}
            </>
          )}

          {/* ── Botones de navegación ── */}
          <div style={{ display: 'flex', gap: 10, marginTop: step >= 4 ? 20 : 0 }}>
            {step > 1 && (
              <button onClick={handleBack} style={{ ...btnBase, flex: 1, padding: '12px 0', borderRadius: 10, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.5)', color: 'rgba(148,163,184,0.8)', fontSize: 14, fontWeight: 600 }}>
                Atrás
              </button>
            )}
            <button onClick={handleNext} disabled={isDisabled} style={{ ...btnBase, flex: step > 1 ? 2 : 1, padding: '12px 0', borderRadius: 10, background: isDisabled ? 'rgba(51,65,85,0.4)' : 'linear-gradient(90deg, #a855f7, #2563eb)', border: 'none', color: isDisabled ? 'rgba(100,116,139,0.6)' : '#fff', fontSize: 14, fontWeight: 700, cursor: isDisabled ? 'not-allowed' : 'pointer', boxShadow: isDisabled ? 'none' : '0 4px 14px rgba(168,85,247,0.35)' }}>
              {step < totalSteps ? 'Siguiente →' : 'Ver mi plan →'}
            </button>
          </div>
        </div>

        {/* Saludo personalizado */}
        {userName && (
          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'rgba(148,163,184,0.4)' }}>
            Preparando tu experiencia, {userName} ✨
          </p>
        )}
      </div>

      {/* Ocultar flechas del input number */}
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </main>
  );
}
