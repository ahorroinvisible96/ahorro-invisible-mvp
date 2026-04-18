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
const SAVINGS_LIMIT = 0.30; // 30 % del ingreso máximo

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

// ─── Fases del objetivo de ahorro ────────────────────────────────────────────
export function computeGoalPhases(amount: number, months: number) {
  const monthly = amount / months;
  const weekly  = monthly / 4;

  if (months <= 3) {
    return [
      { label: 'Semana 1', target: Math.round(weekly),         type: 'week'  as const },
      { label: 'Semana 2', target: Math.round(weekly * 2),     type: 'week'  as const },
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
    const base       = monthly * b * 3;
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

// ─── Estilos compartidos ──────────────────────────────────────────────────────
const btnBase: React.CSSProperties = {
  border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 200ms ease',
};

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
export default function OnboardingPage() {
  const router = useRouter();

  // Paso actual: 1–3 preguntas comportamentales | 4 = ingresos + meta
  const [step,     setStep]     = useState(1);
  const [userName, setUserName] = useState('');

  // Respuestas pasos 1–3
  const [answers, setAnswers] = useState<(AvatarKey | null)[]>([null, null, null]);

  // ── Estado paso 4 ────────────────────────────────────────────────────────
  const [incomeMin,  setIncomeMin]  = useState(800);
  const [incomeMax,  setIncomeMax]  = useState(2_000);
  const [goalAmount, setGoalAmount] = useState(500);
  const [goalMonths, setGoalMonths] = useState(3);

  // ── Slider refs (pointer capture) ────────────────────────────────────────
  const trackRef     = useRef<HTMLDivElement>(null);
  const activeHandle = useRef<'min' | 'max' | null>(null);
  const minRef       = useRef(incomeMin);
  const maxRef       = useRef(incomeMax);
  useEffect(() => { minRef.current = incomeMin; }, [incomeMin]);
  useEffect(() => { maxRef.current = incomeMax; }, [incomeMax]);

  // ── Auth & analytics ─────────────────────────────────────────────────────
  useEffect(() => {
    analytics.setScreen(`onboarding_step_${step}` as any);
    if (localStorage.getItem('isAuthenticated') !== 'true') { router.replace('/signup'); return; }
    const name = localStorage.getItem('userName');
    if (name) setUserName(name);
    if (localStorage.getItem('hasCompletedOnboarding') === 'true') { router.replace('/dashboard'); return; }
    analytics.onboardingStepViewed(step);
  }, [router, step]);

  // ── Computed: validación paso 4 ──────────────────────────────────────────
  const monthlyNeeded      = goalAmount > 0 && goalMonths > 0 ? goalAmount / goalMonths : 0;
  const incomeThreshold    = incomeMax * SAVINGS_LIMIT;
  const isOverThreshold    = monthlyNeeded > incomeThreshold && incomeMax > 0 && goalAmount > 0;
  const recMonthly         = Math.floor(incomeThreshold / INCOME_STEP) * INCOME_STEP;
  const recTotal           = recMonthly * goalMonths;

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

  // ── Navegación ───────────────────────────────────────────────────────────
  const totalSteps = 4;
  const pct        = Math.round((step / totalSteps) * 100);

  function setAnswer(value: AvatarKey) {
    setAnswers(prev => { const n = [...prev]; n[step - 1] = value; return n; });
  }

  function handleNext() {
    if (step <= 3) {
      const sel = answers[step - 1];
      if (!sel) return;
      analytics.onboardingQuestionAnswered(step, `onb_q${step}`, sel);
      setStep(step + 1);
    } else {
      completeOnboarding();
    }
  }

  function handleBack() { if (step > 1) setStep(step - 1); }

  function applyRecommendation() { setGoalAmount(recTotal); }

  function completeOnboarding() {
    const finalAnswers = answers as AvatarKey[];
    const avatar  = classifyAvatar(finalAnswers);
    const phases  = computeGoalPhases(goalAmount, goalMonths);
    try {
      localStorage.setItem('hasCompletedOnboarding', 'true');
      const name = localStorage.getItem('userName');
      if (name) storeUpdateUserName(name);
      storeSetUserAvatar(avatar);
      storeSetSavingsProfile('medium' as SavingsProfile);
      storeUpdateIncome({ min: incomeMin, max: incomeMax, currency: 'EUR' } satisfies IncomeRange);
      storeCreateGoal({
        title: 'Mi primer objetivo de ahorro',
        targetAmount: goalAmount,
        currentAmount: 0,
        horizonMonths: goalMonths,
        isPrimary: true,
        source: 'onboarding',
      });
      localStorage.setItem('onboardingData', JSON.stringify({
        userAvatar: avatar, answers: finalAnswers,
        incomeMin, incomeMax, goalAmount, goalMonths, phases,
        savingsProfile: 'medium', completedAt: new Date().toISOString(),
      }));
      analytics.onboardingCompleted();
      const userId = localStorage.getItem('supabaseUserId');
      if (userId) pushLocalDataToSupabase(userId).catch(() => null);
      router.push('/dashboard');
    } catch (err) {
      console.error('Error al guardar datos:', err);
    }
  }

  // ── Helpers de render ────────────────────────────────────────────────────
  const currentStep    = step <= 3 ? ONBOARDING_STEPS[step - 1] : null;
  const selectedAnswer = step <= 3 ? answers[step - 1]           : null;
  const isDisabled     = step <= 3 ? !selectedAnswer : goalAmount <= 0 || goalMonths <= 0;

  const minPct = (incomeMin / MAX_INCOME) * 100;
  const maxPct = (incomeMax / MAX_INCOME) * 100;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: step === 4 ? 'flex-start' : 'center',
      padding: step === 4 ? '24px 16px 80px' : '24px 16px',
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

          {/* ── Progress bar ── */}
          <div style={{ marginBottom: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4].map(s => (
                  <div key={s} style={{
                    width: s === step ? 26 : 8, height: 8, borderRadius: 999,
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

          {/* ═══════════════════════════════════════════════════════════════
              PASOS 1–3: preguntas comportamentales
          ══════════════════════════════════════════════════════════════════ */}
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

          {/* ═══════════════════════════════════════════════════════════════
              PASO 4: Ingresos + Primer objetivo
          ══════════════════════════════════════════════════════════════════ */}
          {step === 4 && (
            <>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'linear-gradient(135deg, #ec4899, #a855f7, #2563eb)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0, boxShadow: '0 4px 14px rgba(168,85,247,0.3)',
                }}>💰</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  PASO 4 DE 4 · INGRESOS Y META
                </span>
              </div>

              {/* ── SECCIÓN 1: Ingresos ── */}
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px', lineHeight: 1.35 }}>
                ¿Cuáles son tus ingresos mensuales aproximados?
              </h2>
              <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.55)', margin: '0 0 22px', lineHeight: 1.5 }}>
                Selecciona un rango para que podamos recomendarte objetivos realistas y adaptados a ti.
              </p>

              {/* Valores seleccionados */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
                    Mínimo
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#ec4899', letterSpacing: '-0.5px' }}>
                    {fmtEUR(incomeMin)}
                  </div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ height: 1, background: 'linear-gradient(90deg, #ec4899, #a855f7, #60a5fa)', opacity: 0.3, margin: '0 16px' }} />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
                    Máximo
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#60a5fa', letterSpacing: '-0.5px' }}>
                    {fmtEUR(incomeMax)}
                  </div>
                </div>
              </div>

              {/* Dual-handle slider */}
              <div style={{ padding: '8px 0 24px', touchAction: 'none', userSelect: 'none' }}>
                <div
                  ref={trackRef}
                  style={{
                    position: 'relative', height: 8, borderRadius: 999,
                    background: 'rgba(255,255,255,0.07)',
                    boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.4)',
                  }}
                >
                  {/* Fill gradiente entre handles */}
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${minPct}%`, right: `${100 - maxPct}%`,
                    background: 'linear-gradient(90deg, #ec4899, #a855f7, #60a5fa)',
                    borderRadius: 999,
                    boxShadow: '0 0 12px rgba(168,85,247,0.4)',
                  }} />

                  {/* Handle MIN */}
                  <div
                    style={{
                      position: 'absolute', top: '50%',
                      left: `${minPct}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #fff 0%, #f1f5f9 100%)',
                      boxShadow: '0 0 0 3px #ec4899, 0 4px 14px rgba(236,72,153,0.5)',
                      cursor: 'grab', zIndex: 3, touchAction: 'none',
                    }}
                    onPointerDown={onHandleDown('min')}
                    onPointerMove={onHandleMove}
                    onPointerUp={onHandleUp}
                    onLostPointerCapture={onHandleUp}
                  />

                  {/* Handle MAX */}
                  <div
                    style={{
                      position: 'absolute', top: '50%',
                      left: `${maxPct}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #fff 0%, #f1f5f9 100%)',
                      boxShadow: '0 0 0 3px #60a5fa, 0 4px 14px rgba(96,165,250,0.5)',
                      cursor: 'grab', zIndex: 3, touchAction: 'none',
                    }}
                    onPointerDown={onHandleDown('max')}
                    onPointerMove={onHandleMove}
                    onPointerUp={onHandleUp}
                    onLostPointerCapture={onHandleUp}
                  />
                </div>

                {/* Límites del rango */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                  <span style={{ fontSize: 10, color: 'rgba(100,116,139,0.4)', fontWeight: 500 }}>0 €</span>
                  <span style={{ fontSize: 10, color: 'rgba(100,116,139,0.4)', fontWeight: 500 }}>10.000 €</span>
                </div>
              </div>

              {/* Divisor elegante */}
              <div style={{
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.3), transparent)',
                margin: '0 0 22px',
              }} />

              {/* ── SECCIÓN 2: Primer objetivo ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>🎯</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Tu primer objetivo de ahorro</span>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', margin: '0 0 20px', lineHeight: 1.5 }}>
                Te recomendamos empezar con un objetivo a <strong style={{ color: '#a78bfa' }}>3 meses</strong>: más fácil de cumplir, más motivador y con resultados reales desde el principio.
              </p>

              {/* Goal amount stepper */}
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
                    style={{ ...btnBase, width: 54, background: 'rgba(255,255,255,0.04)', color: 'rgba(148,163,184,0.8)', fontSize: 24 }}
                  >−</button>
                  <div style={{ flex: 1, textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 30, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.5px', lineHeight: 1 }}>
                      {fmtEUR(goalAmount)}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)', marginTop: 4 }}>objetivo total</div>
                  </div>
                  <button
                    onClick={() => setGoalAmount(a => a + 50)}
                    style={{ ...btnBase, width: 54, background: 'rgba(255,255,255,0.04)', color: 'rgba(148,163,184,0.8)', fontSize: 24 }}
                  >+</button>
                </div>
              </div>

              {/* Months selector */}
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

              {/* ── Validación / feedback ── */}
              {goalAmount > 0 && incomeMax > 0 && (
                isOverThreshold ? (
                  /* 🔴 Objetivo exigente → recomendación amable */
                  <div style={{
                    background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)',
                    borderRadius: 14, padding: '14px 16px', marginBottom: 4,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 15 }}>💡</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>
                        Recomendación de Ahorro Invisible
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(251,191,36,0.8)', margin: '0 0 6px', lineHeight: 1.6 }}>
                      Este objetivo puede ser algo exigente para empezar según el rango de ingresos que has indicado.
                      Te recomendamos comenzar con una meta de{' '}
                      <strong style={{ color: '#fbbf24' }}>{fmtEUR(recMonthly)}/mes</strong>{' '}
                      ({fmtEUR(recTotal)} en {goalMonths} meses) para que puedas mantener el ritmo y ver progreso real desde el principio.
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(251,191,36,0.45)', margin: '0 0 12px', lineHeight: 1.5 }}>
                      Más adelante, cuando consolides este hábito, podrás aumentar tu objetivo y seguir mejorando poco a poco.
                    </p>
                    <button onClick={applyRecommendation} style={{
                      ...btnBase,
                      width: '100%', padding: '10px', borderRadius: 10,
                      background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.30)',
                      color: '#fbbf24', fontSize: 12, fontWeight: 700,
                    }}>
                      Usar {fmtEUR(recTotal)} como objetivo →
                    </button>
                  </div>
                ) : (
                  /* 🟢 Objetivo realista */
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

          {/* ── Botones de navegación (comunes a todos los pasos) ── */}
          <div style={{ display: 'flex', gap: 10, marginTop: step === 4 ? 20 : 0 }}>
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
              background: isDisabled ? 'rgba(51,65,85,0.4)' : 'linear-gradient(90deg, #a855f7, #2563eb)',
              border: 'none',
              color: isDisabled ? 'rgba(100,116,139,0.6)' : '#fff',
              fontSize: 14, fontWeight: 700,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              boxShadow: isDisabled ? 'none' : '0 4px 14px rgba(168,85,247,0.35)',
            }}>
              {step < totalSteps ? 'Siguiente →' : 'Empezar 🚀'}
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
    </main>
  );
}
