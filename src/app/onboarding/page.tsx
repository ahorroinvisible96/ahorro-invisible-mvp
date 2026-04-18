"use client";

import { useState, useEffect, useRef } from "react";
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

// ─── Constantes ───────────────────────────────────────────────────────────────
const MAX_INCOME    = 10_000;
const INCOME_STEP   = 50;
const SAVINGS_LIMIT = 0.30;

// ─── Tipos ────────────────────────────────────────────────────────────────────
type AvatarKey = UserAvatar;
interface OnboardingOption { value: AvatarKey; label: string; sub: string; }
interface OnboardingStep   { icon: string; label: string; question: string; options: OnboardingOption[]; }

// ─── Preguntas comportamentales (pasos 1–3) ───────────────────────────────────
const ONBOARDING_STEPS: OnboardingStep[] = [
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
      { value: 'comodo',      label: 'Ideas fáciles para gastar menos sin complicarme',                  sub: 'Quiero soluciones prácticas y rápidas' },
      { value: 'social',      label: 'Controlarme mejor en momentos concretos, como salidas o planes',   sub: 'Necesito frenar en situaciones sociales' },
      { value: 'impulsivo',   label: 'Frenar compras o decisiones impulsivas antes de hacerlas',         sub: 'Necesito ese segundo antes de actuar' },
      { value: 'desordenado', label: 'Tener más claridad y sentir que llevo el control de mis gastos',   sub: 'Quiero entender a dónde va mi dinero' },
    ],
  },
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

  if (months <= 3) {
    return [
      { label: 'Semana 1', target: Math.round(weekly),       type: 'week'  as const },
      { label: 'Semana 2', target: Math.round(weekly * 2),   type: 'week'  as const },
      ...Array.from({ length: months }, (_, i) => ({
        label: `Mes ${i + 1}`,
        target: Math.round(monthly * (i + 1)),
        type: 'month' as const,
      })),
    ];
  }
  // Para objetivos más largos: bloques de 3 meses
  const phases: { label: string; target: number; type: 'week' | 'month' }[] = [];
  const blocks = Math.ceil(months / 3);
  for (let b = 0; b < blocks; b++) {
    const base        = monthly * b * 3;
    const blockMonths = Math.min(3, months - b * 3);
    phases.push({ label: `Bloque ${b + 1} – Semana 1`, target: Math.round(base + weekly),     type: 'week' });
    phases.push({ label: `Bloque ${b + 1} – Semana 2`, target: Math.round(base + weekly * 2), type: 'week' });
    for (let m = 1; m <= blockMonths; m++) {
      phases.push({ label: `Mes ${b * 3 + m}`, target: Math.round(base + monthly * m), type: 'month' });
    }
  }
  return phases;
}

// ─── Helper de formato ────────────────────────────────────────────────────────
function fmtEUR(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n);
}

// ─── Config visual de fases ───────────────────────────────────────────────────
const PHASE_CONFIGS = [
  { emoji: '⚡', color: '#60a5fa', rgba: '96,165,250'   },
  { emoji: '🔥', color: '#818cf8', rgba: '129,140,248'  },
  { emoji: '🎯', color: '#a855f7', rgba: '168,85,247'   },
  { emoji: '💪', color: '#c084fc', rgba: '192,132,252'  },
  { emoji: '🌟', color: '#e879f9', rgba: '232,121,249'  },
  { emoji: '🚀', color: '#f472b6', rgba: '244,114,182'  },
  { emoji: '✨', color: '#fb7185', rgba: '251,113,133'  },
];

// ─── Estilos base ─────────────────────────────────────────────────────────────
const btnBase: React.CSSProperties = {
  border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 200ms ease',
};

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
export default function OnboardingPage() {
  const router = useRouter();

  const [step,     setStep]     = useState(1);   // 1–5
  const [userName, setUserName] = useState('');

  // Respuestas pasos 1–3
  const [answers, setAnswers] = useState<(AvatarKey | null)[]>([null, null, null]);

  // Ingresos (paso 4)
  const [incomeMin, setIncomeMin] = useState(800);
  const [incomeMax, setIncomeMax] = useState(2_000);

  // Objetivo (paso 4)
  const [goalAmount,     setGoalAmount]     = useState(500);
  const [goalMonths,     setGoalMonths]     = useState(3);
  const [goalInputValue, setGoalInputValue] = useState('500'); // texto del input manual

  // Slider refs (pointer capture)
  const trackRef     = useRef<HTMLDivElement>(null);
  const activeHandle = useRef<'min' | 'max' | null>(null);
  const minRef       = useRef(incomeMin);
  const maxRef       = useRef(incomeMax);
  useEffect(() => { minRef.current = incomeMin; }, [incomeMin]);
  useEffect(() => { maxRef.current = incomeMax; }, [incomeMax]);

  // Sincronizar input cuando cambia goalAmount por botones +/-
  useEffect(() => { setGoalInputValue(String(goalAmount)); }, [goalAmount]);

  // Auth check
  useEffect(() => {
    analytics.setScreen(`onboarding_step_${step}` as any);
    if (localStorage.getItem('isAuthenticated') !== 'true') { router.replace('/signup'); return; }
    const name = localStorage.getItem('userName');
    if (name) setUserName(name);
    if (localStorage.getItem('hasCompletedOnboarding') === 'true') { router.replace('/dashboard'); return; }
    analytics.onboardingStepViewed(step);
  }, [router, step]);

  // Computed validación paso 4
  const monthlyNeeded   = goalAmount > 0 && goalMonths > 0 ? goalAmount / goalMonths : 0;
  const incomeThreshold = incomeMax * SAVINGS_LIMIT;
  const isOverThreshold = monthlyNeeded > incomeThreshold && incomeMax > 0 && goalAmount > 0;
  const recMonthly      = Math.floor(incomeThreshold / INCOME_STEP) * INCOME_STEP;
  const recTotal        = recMonthly * goalMonths;

  // Fases calculadas (usadas en paso 5)
  const phases = computeGoalPhases(goalAmount, goalMonths);

  // ── Slider handlers ──────────────────────────────────────────────────────
  function valueFromPointer(clientX: number): number {
    if (!trackRef.current) return 0;
    const rect  = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * MAX_INCOME / INCOME_STEP) * INCOME_STEP;
  }
  function onHandleDown(handle: 'min' | 'max') {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      activeHandle.current = handle;
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    };
  }
  function onHandleMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!activeHandle.current) return;
    const val = valueFromPointer(e.clientX);
    if (activeHandle.current === 'min') setIncomeMin(Math.min(val, maxRef.current - INCOME_STEP));
    else                                setIncomeMax(Math.max(val, minRef.current + INCOME_STEP));
  }
  function onHandleUp() { activeHandle.current = null; }

  // ── Input manual del objetivo ─────────────────────────────────────────────
  function handleGoalInput(e: React.ChangeEvent<HTMLInputElement>) {
    setGoalInputValue(e.target.value);
  }
  function handleGoalInputBlur() {
    const num = parseInt(goalInputValue.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num >= 50) {
      setGoalAmount(num);
    } else {
      setGoalInputValue(String(goalAmount));
    }
  }
  function applyRecommendation() { setGoalAmount(recTotal); }

  // ── Navegación ────────────────────────────────────────────────────────────
  const totalSteps = 5;
  const pct        = Math.round((step / totalSteps) * 100);
  const minPct     = (incomeMin / MAX_INCOME) * 100;
  const maxPct     = (incomeMax / MAX_INCOME) * 100;

  const currentStep    = step <= 3 ? ONBOARDING_STEPS[step - 1] : null;
  const selectedAnswer = step <= 3 ? answers[step - 1]           : null;
  const isDisabled     = step <= 3 ? !selectedAnswer
                       : step === 4 ? goalAmount <= 0 || goalMonths <= 0
                       : false; // paso 5 siempre habilitado

  function setAnswer(value: AvatarKey) {
    setAnswers(prev => { const n = [...prev]; n[step - 1] = value; return n; });
  }

  function handleNext() {
    if (step <= 3) {
      const sel = answers[step - 1];
      if (!sel) return;
      analytics.onboardingQuestionAnswered(step, `onb_q${step}`, sel);
      setStep(step + 1);
    } else if (step === 4) {
      // Flush input manual antes de ir a paso 5
      const num = parseInt(goalInputValue.replace(/\D/g, ''), 10);
      if (!isNaN(num) && num >= 50) setGoalAmount(num);
      setStep(5);
    } else {
      // Paso 5: completar onboarding
      completeOnboarding();
    }
  }

  function handleBack() { if (step > 1) setStep(step - 1); }

  function completeOnboarding() {
    const finalAnswers   = answers as AvatarKey[];
    const avatar         = classifyAvatar(finalAnswers);
    const num            = parseInt(goalInputValue.replace(/\D/g, ''), 10);
    const resolvedAmount = !isNaN(num) && num >= 50 ? num : goalAmount;
    const resolvedPhases = computeGoalPhases(resolvedAmount, goalMonths);

    try {
      localStorage.setItem('hasCompletedOnboarding', 'true');
      const name = localStorage.getItem('userName');
      if (name) storeUpdateUserName(name);
      storeSetUserAvatar(avatar);
      storeSetSavingsProfile('medium' as SavingsProfile);
      storeUpdateIncome({ min: incomeMin, max: incomeMax, currency: 'EUR' } satisfies IncomeRange);
      storeCreateGoal({
        title: 'Mi primer objetivo de ahorro',
        targetAmount: resolvedAmount,
        currentAmount: 0,
        horizonMonths: goalMonths,
        isPrimary: true,
        source: 'onboarding',
      });
      localStorage.setItem('onboardingData', JSON.stringify({
        userAvatar: avatar, answers: finalAnswers,
        incomeMin, incomeMax,
        goalAmount: resolvedAmount, goalMonths,
        phases: resolvedPhases,
        savingsProfile: 'medium',
        completedAt: new Date().toISOString(),
      }));
      analytics.onboardingCompleted();
      const userId = localStorage.getItem('supabaseUserId');
      if (userId) pushLocalDataToSupabase(userId).catch(() => null);
      router.push('/dashboard');
    } catch (err) {
      console.error('Error al guardar datos:', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: step >= 4 ? 'flex-start' : 'center',
      padding: step >= 4 ? '24px 16px 80px' : '24px 16px',
      fontFamily: 'var(--font-geist-sans, Arial, sans-serif)',
    }}>

      {/* Glow fondo */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 700, height: 500,
        background: 'radial-gradient(ellipse, rgba(168,85,247,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 480, position: 'relative' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #a855f7, #2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 18,
            boxShadow: '0 4px 14px rgba(168,85,247,0.4)',
          }}>A</div>
          <div>
            <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16 }}>Ahorro </span>
            <span style={{ color: '#a855f7', fontWeight: 700, fontSize: 16 }}>Invisible</span>
          </div>
        </div>

        {/* Card */}
        <div style={{
          position: 'relative', borderRadius: 20,
          background: 'linear-gradient(160deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid rgba(51,65,85,0.6)',
          boxShadow: '0 25px 60px rgba(2,6,23,0.7)',
          overflow: 'hidden', padding: '28px 24px',
        }}>

          {/* Glow interior */}
          <div style={{
            position: 'absolute', top: -50, left: -50, width: 220, height: 220,
            background: 'radial-gradient(ellipse, rgba(168,85,247,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* ── Barra de progreso ── */}
          <div style={{ marginBottom: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {[1, 2, 3, 4, 5].map(s => (
                  <div key={s} style={{
                    width: s === step ? 24 : 7, height: 7, borderRadius: 999,
                    background: s <= step ? 'linear-gradient(90deg, #a855f7, #2563eb)' : 'rgba(51,65,85,0.6)',
                    transition: 'all 300ms ease',
                    boxShadow: s <= step ? '0 0 8px rgba(168,85,247,0.5)' : 'none',
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,0.5)', letterSpacing: '0.08em' }}>
                {pct}% COMPLETADO
              </span>
            </div>
            <div style={{ height: 3, borderRadius: 999, background: 'rgba(51,65,85,0.5)', overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%',
                background: 'linear-gradient(90deg, #a855f7, #2563eb)',
                borderRadius: 999, transition: 'width 400ms ease',
                boxShadow: '0 0 8px rgba(168,85,247,0.5)',
              }} />
            </div>
          </div>

          {/* ══════════════════════════════════════
              PASOS 1–3: preguntas comportamentales
          ══════════════════════════════════════ */}
          {step <= 3 && currentStep && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'linear-gradient(135deg, #a855f7, #2563eb)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0,
                  boxShadow: '0 4px 14px rgba(168,85,247,0.3)',
                }}>{currentStep.icon}</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  PASO {step} DE {totalSteps} · {currentStep.label}
                </span>
              </div>

              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', margin: '0 0 22px', lineHeight: 1.35 }}>
                {currentStep.question}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {currentStep.options.map((opt, i) => {
                  const isActive = selectedAnswer === opt.value;
                  return (
                    <button key={opt.value} onClick={() => setAnswer(opt.value)} style={{
                      ...btnBase,
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      width: '100%', padding: '13px 14px', borderRadius: 12, textAlign: 'left',
                      background: isActive ? 'linear-gradient(135deg,rgba(168,85,247,0.18),rgba(37,99,235,0.18))' : 'rgba(15,23,42,0.5)',
                      border: isActive ? '1px solid rgba(168,85,247,0.55)' : '1px solid rgba(51,65,85,0.5)',
                      boxShadow: isActive ? '0 0 16px rgba(168,85,247,0.15)' : 'none',
                    }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 8, flexShrink: 0, marginTop: 1,
                        background: isActive ? 'linear-gradient(135deg, #a855f7, #2563eb)' : 'rgba(51,65,85,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, color: isActive ? '#fff' : 'rgba(148,163,184,0.6)',
                        transition: 'all 180ms ease',
                      }}>
                        {['A', 'B', 'C', 'D'][i]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#f1f5f9' : '#cbd5e1', marginBottom: 2, lineHeight: 1.3 }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: 11, color: isActive ? 'rgba(196,181,253,0.7)' : 'rgba(100,116,139,0.6)', lineHeight: 1.3 }}>
                          {opt.sub}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ══════════════════════════════════════
              PASO 4: Ingresos + Primer objetivo
          ══════════════════════════════════════ */}
          {step === 4 && (
            <>
              {/* Header paso 4 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'linear-gradient(135deg, #ec4899, #a855f7, #2563eb)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0, boxShadow: '0 4px 14px rgba(168,85,247,0.3)',
                }}>💰</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  PASO 4 DE 5 · INGRESOS Y META
                </span>
              </div>

              {/* Sección ingresos */}
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px', lineHeight: 1.35 }}>
                ¿Cuáles son tus ingresos mensuales aproximados?
              </h2>
              <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.55)', margin: '0 0 22px', lineHeight: 1.5 }}>
                Selecciona un rango para que podamos recomendarte objetivos realistas y adaptados a ti.
              </p>

              {/* Min/Max display */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Mínimo</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#ec4899', letterSpacing: '-0.5px' }}>{fmtEUR(incomeMin)}</div>
                </div>
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #ec4899, #a855f7, #60a5fa)', opacity: 0.25, margin: '0 14px', alignSelf: 'center' }} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Máximo</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#60a5fa', letterSpacing: '-0.5px' }}>{fmtEUR(incomeMax)}</div>
                </div>
              </div>

              {/* Dual-handle slider */}
              <div style={{ padding: '8px 0 24px', touchAction: 'none', userSelect: 'none' }}>
                <div ref={trackRef} style={{
                  position: 'relative', height: 8, borderRadius: 999,
                  background: 'rgba(255,255,255,0.07)',
                  boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.4)',
                }}>
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${minPct}%`, right: `${100 - maxPct}%`,
                    background: 'linear-gradient(90deg, #ec4899, #a855f7, #60a5fa)',
                    borderRadius: 999, boxShadow: '0 0 12px rgba(168,85,247,0.4)',
                  }} />
                  {/* Handle MIN */}
                  <div style={{
                    position: 'absolute', top: '50%', left: `${minPct}%`,
                    transform: 'translate(-50%,-50%)', width: 28, height: 28, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #fff, #f1f5f9)',
                    boxShadow: '0 0 0 3px #ec4899, 0 4px 14px rgba(236,72,153,0.5)',
                    cursor: 'grab', zIndex: 3, touchAction: 'none',
                  }}
                    onPointerDown={onHandleDown('min')}
                    onPointerMove={onHandleMove}
                    onPointerUp={onHandleUp}
                    onLostPointerCapture={onHandleUp}
                  />
                  {/* Handle MAX */}
                  <div style={{
                    position: 'absolute', top: '50%', left: `${maxPct}%`,
                    transform: 'translate(-50%,-50%)', width: 28, height: 28, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #fff, #f1f5f9)',
                    boxShadow: '0 0 0 3px #60a5fa, 0 4px 14px rgba(96,165,250,0.5)',
                    cursor: 'grab', zIndex: 3, touchAction: 'none',
                  }}
                    onPointerDown={onHandleDown('max')}
                    onPointerMove={onHandleMove}
                    onPointerUp={onHandleUp}
                    onLostPointerCapture={onHandleUp}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                  <span style={{ fontSize: 10, color: 'rgba(100,116,139,0.4)', fontWeight: 500 }}>0 €</span>
                  <span style={{ fontSize: 10, color: 'rgba(100,116,139,0.4)', fontWeight: 500 }}>10.000 €</span>
                </div>
              </div>

              {/* Divisor elegante */}
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.3), transparent)', margin: '0 0 22px' }} />

              {/* Sección objetivo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>🎯</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Tu primer objetivo de ahorro</span>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', margin: '0 0 20px', lineHeight: 1.5 }}>
                Te recomendamos empezar con un objetivo a <strong style={{ color: '#a78bfa' }}>3 meses</strong>: más fácil de cumplir y con resultados reales desde el principio.
              </p>

              {/* Cantidad: stepper + input manual */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                  ¿Cuánto quieres ahorrar?
                </div>
                <div style={{
                  display: 'flex', alignItems: 'stretch',
                  background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.5)',
                  borderRadius: 14, overflow: 'hidden',
                }}>
                  <button
                    onClick={() => setGoalAmount(a => Math.max(50, a - 50))}
                    style={{ ...btnBase, width: 54, background: 'rgba(255,255,255,0.04)', color: 'rgba(148,163,184,0.8)', fontSize: 26, flexShrink: 0 }}
                  >−</button>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={goalInputValue}
                        onChange={handleGoalInput}
                        onBlur={handleGoalInputBlur}
                        style={{
                          background: 'transparent', border: 'none', outline: 'none',
                          color: '#f1f5f9', fontWeight: 800, fontSize: 28,
                          letterSpacing: '-0.5px', fontFamily: 'inherit',
                          textAlign: 'right',
                          width: `${Math.max(2, String(goalInputValue).length)}ch`,
                          minWidth: '3ch', maxWidth: '10ch',
                          /* Ocultar flechas del input number */
                          MozAppearance: 'textfield',
                        } as React.CSSProperties}
                      />
                      <span style={{ fontSize: 18, fontWeight: 700, color: 'rgba(241,245,249,0.5)', flexShrink: 0 }}>€</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.3)', marginTop: 3 }}>toca para escribir · o usa los botones</div>
                  </div>
                  <button
                    onClick={() => setGoalAmount(a => a + 50)}
                    style={{ ...btnBase, width: 54, background: 'rgba(255,255,255,0.04)', color: 'rgba(148,163,184,0.8)', fontSize: 26, flexShrink: 0 }}
                  >+</button>
                </div>
              </div>

              {/* Selector de meses */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                  ¿En cuántos meses?
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 6, 12].map(m => {
                    const isSel = goalMonths === m;
                    const isRec = m === 3;
                    return (
                      <button key={m} onClick={() => setGoalMonths(m)} style={{
                        ...btnBase,
                        flex: 1, padding: '10px 0', borderRadius: 10, position: 'relative',
                        background: isSel ? 'linear-gradient(135deg, #a855f7, #2563eb)' : 'rgba(15,23,42,0.5)',
                        border: isSel ? 'none' : isRec ? '1px solid rgba(168,85,247,0.35)' : '1px solid rgba(51,65,85,0.5)',
                        color: isSel ? '#fff' : isRec ? '#c4b5fd' : 'rgba(148,163,184,0.55)',
                        fontSize: 13, fontWeight: isSel ? 800 : 600,
                        boxShadow: isSel ? '0 4px 14px rgba(168,85,247,0.3)' : 'none',
                      }}>
                        {m}m
                        {isRec && !isSel && (
                          <div style={{
                            position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
                            background: 'linear-gradient(90deg, #a855f7, #2563eb)',
                            borderRadius: 999, padding: '1px 6px',
                            fontSize: 7, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap',
                            pointerEvents: 'none',
                          }}>★ REC</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ahorro mensual estimado */}
              {goalAmount > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.2)',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 14,
                }}>
                  <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.65)' }}>Ahorro mensual estimado</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#a78bfa' }}>
                    {fmtEUR(Math.ceil(monthlyNeeded))}/mes
                  </span>
                </div>
              )}

              {/* Validación 30% */}
              {goalAmount > 0 && incomeMax > 0 && (
                isOverThreshold ? (
                  <div style={{
                    background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)',
                    borderRadius: 14, padding: '14px 16px', marginBottom: 4,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 15 }}>💡</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>Recomendación de Ahorro Invisible</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(251,191,36,0.8)', margin: '0 0 6px', lineHeight: 1.6 }}>
                      Este objetivo puede ser algo exigente. Te recomendamos comenzar con{' '}
                      <strong style={{ color: '#fbbf24' }}>{fmtEUR(recMonthly)}/mes</strong>{' '}
                      ({fmtEUR(recTotal)} en {goalMonths} meses) para mantener el ritmo y ver progreso real.
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(251,191,36,0.45)', margin: '0 0 12px', lineHeight: 1.5 }}>
                      Más adelante podrás aumentar tu objetivo cuando consolides el hábito.
                    </p>
                    <button onClick={applyRecommendation} style={{
                      ...btnBase, width: '100%', padding: '10px', borderRadius: 10,
                      background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.30)',
                      color: '#fbbf24', fontSize: 12, fontWeight: 700,
                    }}>
                      Usar {fmtEUR(recTotal)} como objetivo →
                    </button>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)',
                    borderRadius: 10, padding: '10px 14px', marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 15 }}>✅</span>
                    <span style={{ fontSize: 12, color: '#34d399', lineHeight: 1.4 }}>
                      Tu objetivo parece realista y bien ajustado. ¡Buen punto de partida!
                    </span>
                  </div>
                )
              )}
            </>
          )}

          {/* ══════════════════════════════════════
              PASO 5: Roadmap visual de fases
          ══════════════════════════════════════ */}
          {step === 5 && (
            <>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'linear-gradient(135deg, #fbbf24, #f97316)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0, boxShadow: '0 4px 14px rgba(251,191,36,0.35)',
                }}>🗺️</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  PASO 5 DE 5 · TU RECORRIDO
                </span>
              </div>

              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px', lineHeight: 1.35 }}>
                Así vas a alcanzar tu objetivo
              </h2>
              <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.55)', margin: '0 0 20px', lineHeight: 1.5 }}>
                Hemos dividido <strong style={{ color: '#a78bfa' }}>{fmtEUR(goalAmount)}</strong> en{' '}
                <strong style={{ color: '#a78bfa' }}>{goalMonths} {goalMonths === 1 ? 'mes' : 'meses'}</strong> en fases pequeñas para que el progreso sea visible desde el primer día.
              </p>

              {/* Timeline de fases */}
              <div style={{ maxHeight: 380, overflowY: 'auto', paddingRight: 2 }}>
                {phases.map((phase, i) => {
                  const isLast    = i === phases.length - 1;
                  const conf      = isLast
                    ? { emoji: '🏆', color: '#fbbf24', rgba: '251,191,36' }
                    : PHASE_CONFIGS[Math.min(i, PHASE_CONFIGS.length - 1)];
                  const nextConf  = PHASE_CONFIGS[Math.min(i + 1, PHASE_CONFIGS.length - 1)];
                  const prevTarget = i > 0 ? phases[i - 1].target : 0;
                  const increment  = phase.target - prevTarget;

                  return (
                    <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      {/* Nodo + conector */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                          background: isLast
                            ? 'linear-gradient(135deg, #fbbf24, #f97316)'
                            : `rgba(${conf.rgba},0.15)`,
                          border: `2px solid rgba(${conf.rgba},${isLast ? 0.8 : 0.45})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                          boxShadow: isLast
                            ? '0 0 18px rgba(251,191,36,0.4)'
                            : `0 0 8px rgba(${conf.rgba},0.25)`,
                        }}>
                          {conf.emoji}
                        </div>
                        {!isLast && (
                          <div style={{
                            width: 2, flex: 1, minHeight: 20,
                            background: `linear-gradient(to bottom, rgba(${conf.rgba},0.4), rgba(${nextConf.rgba},0.25))`,
                            margin: '3px 0',
                          }} />
                        )}
                      </div>

                      {/* Info de la fase */}
                      <div style={{ flex: 1, paddingTop: 6, paddingBottom: isLast ? 4 : 18 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                            color: `rgba(${conf.rgba},0.85)`, textTransform: 'uppercase',
                          }}>
                            {phase.label}
                          </span>
                          <span style={{ fontSize: 16, fontWeight: 800, color: isLast ? '#fbbf24' : conf.color, flexShrink: 0 }}>
                            {fmtEUR(phase.target)}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)', lineHeight: 1.4 }}>
                          {isLast
                            ? '🏆 ¡Objetivo alcanzado!'
                            : phase.type === 'week'
                              ? `Ahorra ${fmtEUR(increment)} esta semana`
                              : `+${fmtEUR(increment)} este mes · acumulas ${fmtEUR(phase.target)}`}
                        </div>
                        {!isLast && (
                          <div style={{ height: 1, background: `rgba(${conf.rgba},0.1)`, marginTop: 10 }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Nota motivacional */}
              <div style={{
                marginTop: 16,
                background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.2)',
                borderRadius: 12, padding: '12px 14px',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>💜</span>
                <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.7)', margin: 0, lineHeight: 1.5 }}>
                  No tienes que conseguirlo todo de golpe. Cada fase que superes es una victoria real. Ahorro Invisible te guiará en cada paso del camino.
                </p>
              </div>
            </>
          )}

          {/* ── Botones de navegación ── */}
          <div style={{ display: 'flex', gap: 10, marginTop: step >= 4 ? 20 : 0 }}>
            {step > 1 && (
              <button onClick={handleBack} style={{
                ...btnBase,
                flex: 1, padding: '12px 0', borderRadius: 10,
                background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.5)',
                color: 'rgba(148,163,184,0.8)', fontSize: 14, fontWeight: 600,
              }}>
                Atrás
              </button>
            )}
            <button onClick={handleNext} disabled={isDisabled} style={{
              ...btnBase,
              flex: step > 1 ? 2 : 1, padding: '12px 0', borderRadius: 10,
              background: isDisabled
                ? 'rgba(51,65,85,0.4)'
                : step === 5
                  ? 'linear-gradient(90deg, #fbbf24, #f97316)'
                  : 'linear-gradient(90deg, #a855f7, #2563eb)',
              border: 'none',
              color: isDisabled ? 'rgba(100,116,139,0.6)' : '#fff',
              fontSize: 14, fontWeight: 700,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              boxShadow: isDisabled
                ? 'none'
                : step === 5
                  ? '0 4px 14px rgba(251,191,36,0.35)'
                  : '0 4px 14px rgba(168,85,247,0.35)',
            }}>
              {step < totalSteps ? 'Siguiente →' : 'Empezar mi recorrido 🚀'}
            </button>
          </div>

        </div>

        {/* Saludo personalizado */}
        {userName && (
          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'rgba(148,163,184,0.45)' }}>
            Configurando tu experiencia, {userName} ✨
          </p>
        )}

      </div>

      {/* Fix para input number: ocultar flechas en WebKit */}
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </main>
  );
}
