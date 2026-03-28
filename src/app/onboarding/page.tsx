"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { analytics } from "@/services/analytics";
import { storeUpdateIncome, storeUpdateUserName, storeSetSavingsProfile } from "@/services/dashboardStore";
import type { SavingsProfile, IncomeRange } from "@/types/Dashboard";
import { pushLocalDataToSupabase } from "@/services/syncService";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [userName, setUserName] = useState("");
  
  // Respuestas de onboarding
  const [incomeRange, setIncomeRange] = useState("");
  const [financialMargin, setFinancialMargin] = useState("");
  
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
    if (step === 1 && !incomeRange) return;
    if (step === 2 && !financialMargin) return;
    if (step === 1) analytics.onboardingQuestionAnswered(1, "onb_income_range", incomeRange);
    if (step === 2) analytics.onboardingQuestionAnswered(2, "onb_financial_margin", financialMargin);
    if (step < 2) {
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
  
  function incomeStringToRange(value: string): IncomeRange | null {
    switch (value) {
      case 'below_800':  return { min: 0,    max: 800,  currency: 'EUR' };
      case '800_1200':   return { min: 800,  max: 1200, currency: 'EUR' };
      case '1200_2000':  return { min: 1200, max: 2000, currency: 'EUR' };
      case 'above_2000': return { min: 2000, max: 6000, currency: 'EUR' };
      default: return null;
    }
  }

  function marginToProfile(margin: string): SavingsProfile {
    if (margin === 'struggle') return 'low';
    if (margin === 'save') return 'high';
    return 'medium';
  }

  const handleComplete = () => {
    try {
      // Marcar onboarding como completado
      localStorage.setItem("hasCompletedOnboarding", "true");
      
      // Persistir datos en el store (fuente única de verdad)
      // 1. Asegurar que el nombre del registro esté en el store
      const storedName = localStorage.getItem("userName");
      if (storedName) storeUpdateUserName(storedName);

      // 2. Rango de ingresos
      const incomeObj = incomeStringToRange(incomeRange);
      if (incomeObj) storeUpdateIncome(incomeObj);

      // 3. Perfil de ahorro basado en margen financiero
      const profile = marginToProfile(financialMargin);
      storeSetSavingsProfile(profile);

      // 4. Guardar datos del onboarding para referencia
      const onboardingData = {
        incomeRange,
        financialMargin,
        savingsProfile: profile,
        completedAt: new Date().toISOString()
      };
      localStorage.setItem("onboardingData", JSON.stringify(onboardingData));
      
      // Registrar evento de onboarding completado
      analytics.onboardingCompleted();

      // Sincronizar perfil a Supabase (fire-and-forget)
      const userId = localStorage.getItem('supabaseUserId');
      if (userId) pushLocalDataToSupabase(userId).catch(() => null);

      // Redirigir a crear objetivo (marcado como onboarding)
      router.push("/goals/new?source=onboarding");
    } catch (err) {
      console.error("Error al guardar datos:", err);
    }
  };
  
  const STEP_META = [
    { icon: '💰', label: 'INGRESOS', question: '¿En qué rango están tus ingresos mensuales?' },
    { icon: '🎯', label: 'PERFIL',   question: '¿Cómo te sientes con tu margen para ahorrar?' },
  ];

  const STEP_OPTIONS = [
    [
      { value: 'below_800',  label: 'Menos de 800€',    sub: 'Ingresos hasta 800€/mes' },
      { value: '800_1200',   label: '800€ – 1.200€',    sub: 'Rango bajo-medio' },
      { value: '1200_2000',  label: '1.200€ – 2.000€',  sub: 'Rango medio' },
      { value: 'above_2000', label: 'Más de 2.000€',    sub: 'Rango medio-alto o alto' },
    ],
    [
      { value: 'struggle', label: 'Me cuesta llegar a fin de mes', sub: 'El ahorro es difícil ahora mismo' },
      { value: 'get_by',   label: 'Me defiendo pero ahorro poco',  sub: 'Tengo algo de margen' },
      { value: 'save',     label: 'Suelo ahorrar dinero',           sub: 'Tengo buen control financiero' },
    ],
  ];

  const currentValues = [incomeRange, financialMargin];
  const currentSetters = [setIncomeRange, setFinancialMargin];
  const meta = STEP_META[step - 1];
  const options = STEP_OPTIONS[step - 1];
  const selected = currentValues[step - 1];
  const setSelected = currentSetters[step - 1];

  const isDisabled = !selected;
  const pct = Math.round((step / 2) * 100);

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
                {[1, 2].map((s) => (
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
            }}>PASO {step} DE 2 · {meta.label}</span>
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
              {step < 2 ? 'Siguiente →' : 'Empezar 🚀'}
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
