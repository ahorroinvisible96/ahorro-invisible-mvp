"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card/Card";
import { Button } from "@/components/ui/Button/Button";
import { Progress } from "@/components/ui/Progress/Progress";
import { OptionButton } from "@/components/ui/OptionButton";
import { analytics } from "@/services/analytics";
import { storeUpdateIncome, storeUpdateUserName, storeUpdateMoneyFeeling } from "@/services/dashboardStore";
import type { IncomeRange } from "@/types/Dashboard";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [userName, setUserName] = useState("");
  
  // Respuestas de onboarding
  const [incomeRange, setIncomeRange] = useState("");
  const [moneyFeeling, setMoneyFeeling] = useState("");
  const [goalType, setGoalType] = useState("");
  
  useEffect(() => {
    // Establecer el nombre de la pantalla para analytics
    analytics.setScreen(`onboarding_step_${step}` as any);
    
    // Verificar autenticación
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated !== "true") {
      router.replace("/signup");
      return;
    }
    
    // Cargar nombre de usuario
    const storedName = localStorage.getItem("userName");
    if (storedName) {
      setUserName(storedName);
    }
    
    // Verificar si ya completó el onboarding
    const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding");
    if (hasCompletedOnboarding === "true") {
      router.replace("/dashboard");
    }
    
    // Registrar evento de visualización
    analytics.onboardingStepViewed(step);
  }, [router, step]);
  
  const handleNext = () => {
    // Validar que haya seleccionado una opción
    if (step === 1 && !incomeRange) {
      return;
    } else if (step === 2 && !moneyFeeling) {
      return;
    } else if (step === 3 && !goalType) {
      return;
    }
    
    // Guardar respuesta actual
    if (step === 1) {
      localStorage.setItem("onboarding_income_range", incomeRange);
      analytics.onboardingQuestionAnswered(1, "onb_income_range", incomeRange);
    } else if (step === 2) {
      localStorage.setItem("onboarding_money_feeling", moneyFeeling);
      analytics.onboardingQuestionAnswered(2, "onb_money_feeling", moneyFeeling);
    } else if (step === 3) {
      localStorage.setItem("onboarding_goal_type", goalType);
      analytics.onboardingQuestionAnswered(3, "onb_goal_type", goalType);
    }
    
    // Avanzar al siguiente paso o completar
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };
  
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };
  
  // Convierte el string del selector de ingresos a IncomeRange { min, max, currency }
  function incomeStringToRange(value: string): IncomeRange | null {
    switch (value) {
      case 'below_1000': return { min: 0,    max: 1000, currency: 'EUR' };
      case '1000_2000':  return { min: 1000, max: 2000, currency: 'EUR' };
      case '2000_3500':  return { min: 2000, max: 3500, currency: 'EUR' };
      case 'above_3500': return { min: 3500, max: 6000, currency: 'EUR' };
      default: return null;
    }
  }

  const handleComplete = () => {
    try {
      // Marcar onboarding como completado
      localStorage.setItem("hasCompletedOnboarding", "true");
      
      // Persistir datos en el store (fuente única de verdad)
      // 1. Asegurar que el nombre del registro esté en el store
      const storedName = localStorage.getItem("userName");
      if (storedName) storeUpdateUserName(storedName);

      // 2. Convertir y persistir el rango de ingresos en el store
      const incomeObj = incomeStringToRange(incomeRange);
      if (incomeObj) storeUpdateIncome(incomeObj);

      // 3. Persistir relación con el dinero en el store
      if (moneyFeeling) storeUpdateMoneyFeeling(moneyFeeling);

      // 3. Guardar datos completos del onboarding para referencia
      const onboardingData = {
        incomeRange,
        moneyFeeling,
        goalType,
        completedAt: new Date().toISOString()
      };
      localStorage.setItem("onboardingData", JSON.stringify(onboardingData));
      
      // Registrar evento de onboarding completado
      analytics.onboardingCompleted();
      
      // Redirigir a crear objetivo
      router.push("/goals/new");
    } catch (err) {
      console.error("Error al guardar datos:", err);
    }
  };
  
  const STEP_META = [
    { icon: '💰', label: 'INGRESOS',  question: '¿En qué rango están tus ingresos mensuales?' },
    { icon: '🧠', label: 'PERFIL',    question: '¿Cómo describirías tu relación con el dinero?' },
    { icon: '🎯', label: 'OBJETIVO',  question: '¿Qué tipo de objetivo te gustaría alcanzar primero?' },
  ];

  const STEP_OPTIONS = [
    [
      { value: 'below_1000', label: 'Menos de 1.000€',        sub: 'Ingresos hasta 1.000€/mes' },
      { value: '1000_2000',  label: 'Entre 1.000€ y 2.000€', sub: 'Rango medio-bajo' },
      { value: '2000_3500',  label: 'Entre 2.000€ y 3.500€', sub: 'Rango medio' },
      { value: 'above_3500', label: 'Más de 3.500€',          sub: 'Rango medio-alto' },
    ],
    [
      { value: 'reactive',  label: 'Reactiva',      sub: 'Gasto sin pensar mucho' },
      { value: 'avoidant',  label: 'Evitativa',     sub: 'Prefiero no mirar mis finanzas' },
      { value: 'anxious',   label: 'Ansiosa',        sub: 'Me preocupo constantemente' },
      { value: 'planning',  label: 'Planificadora',  sub: 'Intento organizarme' },
    ],
    [
      { value: 'travel',    label: 'Viaje',                  sub: 'Escapadas, aventuras, escapadas' },
      { value: 'emergency', label: 'Fondo de emergencia',    sub: 'Colchón para imprevistos' },
      { value: 'purchase',  label: 'Compra importante',      sub: 'Coche, tecnología, hogar...' },
      { value: 'freedom',   label: 'Libertad financiera',    sub: 'Independencia económica' },
    ],
  ];

  const currentValues = [incomeRange, moneyFeeling, goalType];
  const currentSetters = [setIncomeRange, setMoneyFeeling, setGoalType];
  const meta = STEP_META[step - 1];
  const options = STEP_OPTIONS[step - 1];
  const selected = currentValues[step - 1];
  const setSelected = currentSetters[step - 1];

  const isDisabled = !selected;
  const pct = Math.round((step / 3) * 100);

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {[1, 2, 3].map((s) => (
                  <div key={s} style={{
                    width: s === step ? 28 : 8,
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
            <div style={{
              height: 3, borderRadius: 999,
              background: 'rgba(51,65,85,0.5)',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #a855f7, #2563eb)',
                borderRadius: 999,
                transition: 'width 400ms ease',
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
            }}>{meta.icon}</div>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: 'rgba(148,163,184,0.7)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>PASO {step} DE 3 · {meta.label}</span>
          </div>

          <h2 style={{
            fontSize: 18, fontWeight: 700,
            color: '#f1f5f9', margin: '0 0 24px',
            lineHeight: 1.3,
          }}>{meta.question}</h2>

          {/* Opciones */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {options.map((opt) => {
              const isActive = selected === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setSelected(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '14px 16px',
                    borderRadius: 12,
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(37,99,235,0.2))'
                      : 'rgba(15,23,42,0.5)',
                    border: isActive
                      ? '1px solid rgba(168,85,247,0.55)'
                      : '1px solid rgba(51,65,85,0.5)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 180ms ease',
                    boxShadow: isActive ? '0 0 16px rgba(168,85,247,0.15)' : 'none',
                    fontFamily: 'inherit',
                  }}
                >
                  <div>
                    <div style={{
                      fontSize: 14, fontWeight: 600,
                      color: isActive ? '#f1f5f9' : '#cbd5e1',
                      marginBottom: 2,
                    }}>{opt.label}</div>
                    <div style={{
                      fontSize: 12,
                      color: isActive ? 'rgba(196,181,253,0.8)' : 'rgba(100,116,139,0.7)',
                    }}>{opt.sub}</div>
                  </div>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    border: isActive ? '2px solid #a855f7' : '2px solid rgba(51,65,85,0.7)',
                    background: isActive ? 'linear-gradient(135deg, #a855f7, #2563eb)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 180ms ease',
                    boxShadow: isActive ? '0 0 8px rgba(168,85,247,0.5)' : 'none',
                  }}>
                    {isActive && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
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
                  flex: 1, padding: '12px 0',
                  borderRadius: 10,
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
                flex: step > 1 ? 2 : 1, padding: '12px 0',
                borderRadius: 10,
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
              {step < 3 ? 'Siguiente →' : 'Empezar 🚀'}
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
