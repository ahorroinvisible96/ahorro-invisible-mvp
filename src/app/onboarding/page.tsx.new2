"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card/Card";
import { Button } from "@/components/ui/Button/Button";
import { Progress } from "@/components/ui/Progress/Progress";
import { OptionButton } from "@/components/ui/OptionButton";
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
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-0">
      <div className="w-full">
        <div className="flex items-center gap-2 mb-8 px-4">
          <div className="w-8 h-8 rounded-md bg-black flex items-center justify-center text-white font-bold">
            A
          </div>
          <div className="font-semibold">
            <div>Ahorro</div>
            <div className="text-lg text-indigo-400">Invisible</div>
          </div>
        </div>
        
        <Card variant="default" size="md" className="rounded-none md:rounded-xl">
          <Card.Content>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-secondary">Paso {step} de 3</span>
                <span className="text-sm text-text-secondary">{Math.round((step / 3) * 100)}%</span>
              </div>
              <Progress 
                value={(step / 3) * 100} 
                className="mb-4" 
                size="sm" 
                color="blue" 
              />
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
                      <OptionButton
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        selected={incomeRange === option.value}
                        onClick={() => setIncomeRange(option.value)}
                      />
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
                      <OptionButton
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        selected={moneyFeeling === option.value}
                        onClick={() => setMoneyFeeling(option.value)}
                      />
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
                      <OptionButton
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        selected={goalType === option.value}
                        onClick={() => setGoalType(option.value)}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
            
            {/* Botones de navegación */}
            <div className="flex space-x-3">
              {step > 1 && (
                <Button
                  onClick={handleBack}
                  variant="outline"
                  size="md"
                  className="w-1/3"
                >
                  Atrás
                </Button>
              )}
              
              <Button
                onClick={handleNext}
                variant="primary"
                size="md"
                className={step > 1 ? 'w-2/3' : 'w-full'}
                disabled={step === 1 && !incomeRange || step === 2 && !moneyFeeling || step === 3 && !goalType}
              >
                {step < 3 ? "Siguiente" : "Empezar"}
              </Button>
            </div>
          </Card.Content>
        </Card>
      </div>
    </main>
  );
}
