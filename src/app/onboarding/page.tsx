"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { analytics } from "@/services/analytics";
import {
  storeUpdateIncome,
  storeUpdateUserName,
  storeSetSavingsProfile,
  storeSetUserAvatar,
  AVATAR_META,
} from "@/services/dashboardStore";
import type { UserAvatar } from "@/services/dashboardStore";
import type { SavingsProfile, IncomeRange } from "@/types/Dashboard";
import { pushLocalDataToSupabase } from "@/services/syncService";

// ── Tipos ─────────────────────────────────────────────────────────────────────
type AvatarKey = UserAvatar;

interface OnboardingOption {
  value: AvatarKey;
  label: string;
  sub: string;
}

interface OnboardingStep {
  icon: string;
  label: string;
  question: string;
  options: OnboardingOption[];
}

// ── Preguntas y opciones ──────────────────────────────────────────────────────
const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    icon: '💸',
    label: 'GASTO',
    question: '¿En qué tipo de gasto sientes que más se te escapa el dinero?',
    options: [
      { value: 'comodo',      label: 'En pedir comida, delivery o pagar por comodidad',     sub: 'La opción fácil siempre acaba siendo la más cara' },
      { value: 'social',      label: 'En salir, planes, cenas o vida social',                sub: 'Disfruto, pero luego me arrepiento del gasto' },
      { value: 'impulsivo',   label: 'En caprichos, compras impulsivas o cosas no planeadas', sub: 'Lo vi y lo compré, sin pensarlo demasiado' },
      { value: 'desordenado', label: 'En pequeños gastos del día a día; no sé exactamente dónde se me va', sub: 'Al final de mes no entiendo cómo me he quedado sin nada' },
    ],
  },
  {
    icon: '🧠',
    label: 'COMPORTAMIENTO',
    question: '¿Qué suele hacer que gastes más de lo que querías?',
    options: [
      { value: 'comodo',      label: 'Que quiero la opción más fácil o rápida',   sub: 'Si es cómodo, lo hago' },
      { value: 'social',      label: 'Que me cuesta decir que no a los planes',   sub: 'No quiero quedarme fuera' },
      { value: 'impulsivo',   label: 'Que me dejo llevar por el momento',         sub: 'En el momento parecía buena idea' },
      { value: 'desordenado', label: 'Que no lo pienso demasiado y luego se me acumula', sub: 'Son gastos pequeños, pero hay muchos' },
    ],
  },
  {
    icon: '🎯',
    label: 'OBJETIVO',
    question: '¿Qué tipo de ayuda te vendría mejor para empezar a ahorrar?',
    options: [
      { value: 'comodo',      label: 'Ideas fáciles para gastar menos sin complicarme',               sub: 'Quiero soluciones prácticas y rápidas' },
      { value: 'social',      label: 'Controlarme mejor en momentos concretos, como salidas o planes', sub: 'Necesito frenar en situaciones sociales' },
      { value: 'impulsivo',   label: 'Frenar compras o decisiones impulsivas antes de hacerlas',       sub: 'Necesito ese segundo antes de actuar' },
      { value: 'desordenado', label: 'Tener más claridad y sentir que llevo el control',               sub: 'Quiero entender a dónde va mi dinero' },
    ],
  },
];

// ── Clasificación ─────────────────────────────────────────────────────────────
function classifyAvatar(answers: AvatarKey[]): AvatarKey {
  const counts: Record<AvatarKey, number> = {
    comodo: 0, social: 0, impulsivo: 0, desordenado: 0,
  };
  for (const a of answers) counts[a]++;
  // Encontrar máximo
  const max = Math.max(...Object.values(counts));
  const winners = (Object.keys(counts) as AvatarKey[]).filter(k => counts[k] === max);
  // Si hay empate, prioridad: impulsivo > social > comodo > desordenado
  const tieBreak: AvatarKey[] = ['impulsivo', 'social', 'comodo', 'desordenado'];
  if (winners.length === 1) return winners[0];
  return tieBreak.find(k => winners.includes(k)) ?? 'desordenado';
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);       // 1-3 preguntas, 4 = reveal avatar
  const [userName, setUserName] = useState("");
  const [answers, setAnswers] = useState<(AvatarKey | null)[]>([null, null, null]);
  const [avatar, setAvatar] = useState<AvatarKey | null>(null);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    analytics.setScreen(`onboarding_step_${step}` as any);
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated !== "true") { router.replace("/signup"); return; }
    const storedName = localStorage.getItem("userName");
    if (storedName) setUserName(storedName);
    const hasCompleted = localStorage.getItem("hasCompletedOnboarding");
    if (hasCompleted === "true") { router.replace("/dashboard"); return; }
    analytics.onboardingStepViewed(step);
  }, [router, step]);

  const currentStep = ONBOARDING_STEPS[step - 1];
  const selectedAnswer = answers[step - 1];
  const isDisabled = !selectedAnswer;
  const totalSteps = ONBOARDING_STEPS.length;
  const pct = Math.round((step / totalSteps) * 100);

  function setAnswer(value: AvatarKey) {
    setAnswers(prev => {
      const next = [...prev];
      next[step - 1] = value;
      return next;
    });
  }

  function handleNext() {
    if (!selectedAnswer) return;
    analytics.onboardingQuestionAnswered(step, `onb_q${step}`, selectedAnswer);
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      // Clasificar y mostrar reveal
      const finalAnswers = answers as AvatarKey[];
      const result = classifyAvatar(finalAnswers);
      setAvatar(result);
      setRevealing(true);
      setStep(4);
    }
  }

  function handleBack() {
    if (step > 1 && step <= totalSteps) setStep(step - 1);
  }

  function handleComplete() {
    if (!avatar) return;
    try {
      localStorage.setItem("hasCompletedOnboarding", "true");
      const storedName = localStorage.getItem("userName");
      if (storedName) storeUpdateUserName(storedName);
      // Guardar avatar en el store
      storeSetUserAvatar(avatar);
      // Perfil de ahorro por defecto (medium)
      storeSetSavingsProfile('medium' as SavingsProfile);
      // Guardar datos del onboarding
      localStorage.setItem("onboardingData", JSON.stringify({
        userAvatar: avatar,
        answers,
        savingsProfile: 'medium',
        completedAt: new Date().toISOString(),
      }));
      analytics.onboardingCompleted();
      const userId = localStorage.getItem('supabaseUserId');
      if (userId) pushLocalDataToSupabase(userId).catch(() => null);
      router.push("/goals/new?source=onboarding");
    } catch (err) {
      console.error("Error al guardar datos:", err);
    }
  }

  // ── Pantalla reveal del avatar ──────────────────────────────────────────────
  if (step === 4 && avatar) {
    const meta = AVATAR_META[avatar];
    return (
      <main style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: 'var(--font-geist-sans, Arial, sans-serif)',
      }}>
        {/* Glow con el color del avatar */}
        <div style={{
          position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 400,
          background: `radial-gradient(ellipse, ${meta.color}22 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <div style={{ width: '100%', maxWidth: 480 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
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

          {/* Card reveal */}
          <div style={{
            position: 'relative', borderRadius: 20,
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: `1px solid ${meta.color}44`,
            boxShadow: `0 25px 50px rgba(2,6,23,0.7), 0 0 40px ${meta.color}18`,
            overflow: 'hidden', padding: '32px 24px',
            animation: 'revealCard 500ms cubic-bezier(0.22,1,0.36,1) both',
          }}>
            {/* Glow interior */}
            <div style={{
              position: 'absolute', top: -60, right: -60,
              width: 200, height: 200,
              background: `radial-gradient(ellipse, ${meta.color}22 0%, transparent 70%)`,
              pointerEvents: 'none',
            }} />

            {/* Etiqueta */}
            <div style={{
              display: 'inline-block',
              background: `${meta.color}22`,
              border: `1px solid ${meta.color}55`,
              borderRadius: 999,
              padding: '4px 12px',
              marginBottom: 20,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Tu perfil de ahorro
              </span>
            </div>

            {/* Emoji + avatar name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <div style={{
                width: 72, height: 72, borderRadius: 20,
                background: `${meta.color}20`,
                border: `2px solid ${meta.color}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, flexShrink: 0,
              }}>
                {meta.emoji}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                  Eres el tipo...
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, color: meta.color, letterSpacing: '-0.5px', lineHeight: 1 }}>
                  {meta.label}
                </div>
              </div>
            </div>

            {/* Tagline */}
            <p style={{
              fontSize: 15, fontWeight: 600,
              color: 'rgba(241,245,249,0.9)',
              margin: '0 0 12px', lineHeight: 1.4,
            }}>
              {meta.tagline}
            </p>

            {/* Description */}
            <p style={{
              fontSize: 13,
              color: 'rgba(148,163,184,0.75)',
              margin: '0 0 28px', lineHeight: 1.6,
            }}>
              {meta.description}
            </p>

            {/* CTA */}
            <button
              onClick={handleComplete}
              style={{
                width: '100%', padding: '14px 0',
                borderRadius: 12, border: 'none',
                background: `linear-gradient(90deg, ${meta.color}, ${meta.color}bb)`,
                color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: `0 4px 18px ${meta.color}44`,
                transition: 'all 200ms ease',
              }}
            >
              Empezar mi plan personalizado 🚀
            </button>

            {/* Nota discreta */}
            <p style={{
              textAlign: 'center', marginTop: 14,
              fontSize: 12, color: 'rgba(100,116,139,0.6)', lineHeight: 1.5,
            }}>
              Tus preguntas diarias estarán adaptadas<br />a tu perfil <strong style={{ color: meta.color }}>{meta.label}</strong>
            </p>
          </div>

          {/* Saludo */}
          {userName && (
            <p style={{
              textAlign: 'center', marginTop: 20,
              fontSize: 13, color: 'rgba(148,163,184,0.5)',
            }}>
              Perfil listo, {userName} ✨
            </p>
          )}
        </div>

        <style>{`
          @keyframes revealCard {
            from { opacity: 0; transform: scale(0.94) translateY(16px); }
            to   { opacity: 1; transform: scale(1)    translateY(0); }
          }
        `}</style>
      </main>
    );
  }

  // ── Pantalla de preguntas ────────────────────────────────────────────────────
  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: 'var(--font-geist-sans, Arial, sans-serif)',
    }}>
      {/* Glow decorativo */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 400,
        background: 'radial-gradient(ellipse, rgba(168,85,247,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 480, position: 'relative' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
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

        {/* Card principal */}
        <div style={{
          position: 'relative',
          borderRadius: 20,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid rgba(51,65,85,0.6)',
          boxShadow: '0 25px 50px rgba(2,6,23,0.7)',
          overflow: 'hidden',
          padding: '28px 24px',
        }}>
          {/* Glow interior */}
          <div style={{
            position: 'absolute', top: -40, left: -40,
            width: 200, height: 200,
            background: 'radial-gradient(ellipse, rgba(168,85,247,0.1) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Barra de progreso */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              {/* Dots */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {[1, 2, 3].map((s) => (
                  <div key={s} style={{
                    width: s === step ? 24 : 8,
                    height: 8,
                    borderRadius: 999,
                    background: s < step
                      ? 'linear-gradient(90deg, #a855f7, #2563eb)'
                      : s === step
                        ? 'linear-gradient(90deg, #a855f7, #2563eb)'
                        : 'rgba(51,65,85,0.6)',
                    transition: 'all 300ms ease',
                    boxShadow: s <= step ? '0 0 8px rgba(168,85,247,0.5)' : 'none',
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.08em' }}>
                {pct}% COMPLETADO
              </span>
            </div>
            <div style={{ height: 3, borderRadius: 999, background: 'rgba(51,65,85,0.5)', overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%',
                background: 'linear-gradient(90deg, #a855f7, #2563eb)',
                borderRadius: 999, transition: 'width 400ms ease',
                boxShadow: '0 0 8px rgba(168,85,247,0.6)',
              }} />
            </div>
          </div>

          {/* Header del paso */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #a855f7, #2563eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
              boxShadow: '0 4px 14px rgba(168,85,247,0.3)',
            }}>{currentStep.icon}</div>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: 'rgba(148,163,184,0.7)',
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>PASO {step} DE {totalSteps} · {currentStep.label}</span>
          </div>

          <h2 style={{
            fontSize: 17, fontWeight: 700,
            color: '#f1f5f9', margin: '0 0 22px', lineHeight: 1.35,
          }}>{currentStep.question}</h2>

          {/* Opciones */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {currentStep.options.map((opt, i) => {
              const isActive = selectedAnswer === opt.value;
              const letters = ['A', 'B', 'C', 'D'];
              return (
                <button
                  key={opt.value}
                  onClick={() => setAnswer(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    width: '100%', padding: '13px 14px',
                    borderRadius: 12,
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(37,99,235,0.18))'
                      : 'rgba(15,23,42,0.5)',
                    border: isActive
                      ? '1px solid rgba(168,85,247,0.55)'
                      : '1px solid rgba(51,65,85,0.5)',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 180ms ease',
                    boxShadow: isActive ? '0 0 16px rgba(168,85,247,0.15)' : 'none',
                    fontFamily: 'inherit',
                  }}
                >
                  {/* Letra */}
                  <div style={{
                    width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                    background: isActive ? 'linear-gradient(135deg, #a855f7, #2563eb)' : 'rgba(51,65,85,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: isActive ? '#fff' : 'rgba(148,163,184,0.6)',
                    transition: 'all 180ms ease',
                    marginTop: 1,
                  }}>{letters[i]}</div>

                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: isActive ? '#f1f5f9' : '#cbd5e1',
                      marginBottom: 2, lineHeight: 1.3,
                    }}>{opt.label}</div>
                    <div style={{
                      fontSize: 11,
                      color: isActive ? 'rgba(196,181,253,0.7)' : 'rgba(100,116,139,0.6)',
                      lineHeight: 1.3,
                    }}>{opt.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Botones navegación */}
          <div style={{ display: 'flex', gap: 10 }}>
            {step > 1 && (
              <button
                onClick={handleBack}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 10,
                  background: 'rgba(15,23,42,0.5)',
                  border: '1px solid rgba(51,65,85,0.5)',
                  color: 'rgba(148,163,184,0.8)',
                  fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 180ms ease',
                }}
              >
                Atrás
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={isDisabled}
              style={{
                flex: step > 1 ? 2 : 1, padding: '12px 0', borderRadius: 10,
                background: isDisabled
                  ? 'rgba(51,65,85,0.4)'
                  : 'linear-gradient(90deg, #a855f7, #2563eb)',
                border: 'none',
                color: isDisabled ? 'rgba(100,116,139,0.6)' : '#fff',
                fontSize: 14, fontWeight: 700,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                transition: 'all 200ms ease',
                boxShadow: isDisabled ? 'none' : '0 4px 14px rgba(168,85,247,0.35)',
              }}
            >
              {step < totalSteps ? 'Siguiente →' : 'Ver mi perfil ✨'}
            </button>
          </div>

        </div>

        {/* Saludo personalizado */}
        {userName && (
          <p style={{
            textAlign: 'center', marginTop: 20,
            fontSize: 13, color: 'rgba(148,163,184,0.5)',
          }}>
            Configurando tu experiencia, {userName} ✨
          </p>
        )}

      </div>
    </main>
  );
}
