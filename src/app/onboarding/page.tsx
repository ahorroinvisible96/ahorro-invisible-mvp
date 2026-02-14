"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { analytics } from "@/services/analytics";

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
  
  const handleComplete = () => {
    try {
      // Marcar onboarding como completado
      localStorage.setItem("hasCompletedOnboarding", "true");
      
      // Inicializar datos básicos
      const onboardingData = {
        incomeRange,
        moneyFeeling,
        goalType,
        completedAt: new Date().toISOString()
      };
      
      localStorage.setItem("onboardingData", JSON.stringify(onboardingData));
      localStorage.setItem("dailyDecisions", JSON.stringify([]));
      
      // Registrar evento de onboarding completado
      analytics.onboardingCompleted();
      
      // Redirigir a crear objetivo
      router.push("/goals/new");
    } catch (err) {
      console.error("Error al guardar datos:", err);
    }
  };
  
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-card p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-secondary">Paso {step} de 3</span>
            <span className="text-sm text-text-secondary">{Math.round((step / 3) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-ahorro-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${(step / 3) * 100}%` }}
            ></div>
          </div>
        </div>
        
        {/* Título general */}
        <h1 className="text-xl font-semibold text-text-primary mb-1">
          Un minuto y empezamos
        </h1>
        <p className="text-text-secondary text-sm mb-6">
          Solo 3 preguntas para ajustar tu experiencia.
        </p>
        
        {/* Paso 1: Rango de ingresos */}
        {step === 1 && (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-medium text-text-primary mb-3">
                ¿En qué rango están tus ingresos mensuales?
              </h2>
              
              <div className="space-y-2">
                {[
                  { value: "below_1000", label: "Menos de 1.000€" },
                  { value: "1000_2000", label: "Entre 1.000€ y 2.000€" },
                  { value: "2000_3500", label: "Entre 2.000€ y 3.500€" },
                  { value: "above_3500", label: "Más de 3.500€" }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setIncomeRange(option.value)}
                    className={`w-full py-3 px-4 rounded-lg border text-left ${incomeRange === option.value
                      ? "border-ahorro-600 bg-ahorro-50 text-ahorro-700"
                      : "border-gray-200 text-text-primary hover:bg-gray-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        
        {/* Paso 2: Relación con el dinero */}
        {step === 2 && (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-medium text-text-primary mb-3">
                ¿Cómo describirías tu relación con el dinero?
              </h2>
              
              <div className="space-y-2">
                {[
                  { value: "reactive", label: "Reactiva: gasto sin pensar mucho" },
                  { value: "avoidant", label: "Evitativa: prefiero no mirar mis finanzas" },
                  { value: "anxious", label: "Ansiosa: me preocupo constantemente" },
                  { value: "planning", label: "Planificadora: intento organizarme" }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setMoneyFeeling(option.value)}
                    className={`w-full py-3 px-4 rounded-lg border text-left ${moneyFeeling === option.value
                      ? "border-ahorro-600 bg-ahorro-50 text-ahorro-700"
                      : "border-gray-200 text-text-primary hover:bg-gray-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        
        {/* Paso 3: Tipo de objetivo */}
        {step === 3 && (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-medium text-text-primary mb-3">
                ¿Qué tipo de objetivo te gustaría alcanzar primero?
              </h2>
              
              <div className="space-y-2">
                {[
                  { value: "travel", label: "Viaje" },
                  { value: "emergency", label: "Fondo de emergencia" },
                  { value: "purchase", label: "Compra importante" },
                  { value: "freedom", label: "Libertad financiera" }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setGoalType(option.value)}
                    className={`w-full py-3 px-4 rounded-lg border text-left ${goalType === option.value
                      ? "border-ahorro-600 bg-ahorro-50 text-ahorro-700"
                      : "border-gray-200 text-text-primary hover:bg-gray-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        
        {/* Botones de navegación */}
        <div className="flex space-x-3">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="w-1/3 py-3 border border-gray-300 rounded-lg text-text-primary hover:bg-gray-50 transition"
            >
              Atrás
            </button>
          )}
          
          <button
            onClick={handleNext}
            disabled={step === 1 && !incomeRange || step === 2 && !moneyFeeling || step === 3 && !goalType}
            className={`${step > 1 ? 'w-2/3' : 'w-full'} bg-ahorro-600 text-white py-3 rounded-lg font-medium hover:bg-ahorro-700 transition disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {step < 3 ? "Siguiente" : "Empezar"}
          </button>
        </div>
      </div>
    </main>
  );
}
