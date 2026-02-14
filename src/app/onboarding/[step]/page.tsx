"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Banco de preguntas para onboarding (en un entorno real, esto vendría de una API)
const onboardingQuestions = [
  {
    id: "onboarding_1",
    question: "¿Cuál es tu situación financiera actual?",
    options: [
      { key: "stable", label: "Tengo ingresos estables" },
      { key: "variable", label: "Mis ingresos son variables" },
      { key: "improving", label: "Estoy mejorando mis finanzas" },
      { key: "struggling", label: "Tengo dificultades financieras" }
    ]
  },
  {
    id: "onboarding_2",
    question: "¿Cuáles son tus ingresos mensuales aproximados?",
    options: [
      { key: "income_1", label: "Menos de 1.000€" },
      { key: "income_2", label: "Entre 1.000€ y 2.000€" },
      { key: "income_3", label: "Entre 2.000€ y 3.000€" },
      { key: "income_4", label: "Más de 3.000€" }
    ]
  },
  {
    id: "onboarding_3",
    question: "¿Cuál es tu principal objetivo de ahorro?",
    options: [
      { key: "emergency", label: "Crear un fondo de emergencia" },
      { key: "travel", label: "Ahorrar para un viaje" },
      { key: "purchase", label: "Comprar algo importante" },
      { key: "future", label: "Asegurar mi futuro financiero" }
    ]
  }
];

export default function OnboardingStep({ params }: { params: { step: string } }) {
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const stepNumber = parseInt(params.step);
  
  // Verificar autenticación
  useEffect(() => {
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated !== "true") {
      router.replace("/signup");
      return;
    }
    
    // Verificar si ya completó el onboarding
    const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding");
    if (hasCompletedOnboarding === "true") {
      router.replace("/dashboard");
      return;
    }
    
    // Verificar si puede acceder a este paso
    const currentStep = parseInt(localStorage.getItem("onboardingStep") || "1");
    if (stepNumber > currentStep && stepNumber > 1) {
      router.replace(`/onboarding/${currentStep}`);
    }
    
    // Evento de analytics: onboarding_step_viewed
    console.log(`Analytics: onboarding_step_viewed (step_number: ${stepNumber})`);
  }, [router, stepNumber]);
  
  // Validar que el paso sea válido (1, 2 o 3)
  if (stepNumber < 1 || stepNumber > 3) {
    router.replace("/onboarding/1");
    return null;
  }
  
  const currentQuestion = onboardingQuestions[stepNumber - 1];
  
  const handleNext = () => {
    if (!selectedOption) return;
    
    setIsLoading(true);
    
    try {
      // Guardar respuesta en localStorage
      const onboardingAnswers = JSON.parse(localStorage.getItem("onboardingAnswers") || "{}");
      onboardingAnswers[currentQuestion.id] = selectedOption;
      localStorage.setItem("onboardingAnswers", JSON.stringify(onboardingAnswers));
      
      // Actualizar paso actual
      localStorage.setItem("onboardingStep", (stepNumber + 1).toString());
      
      // Evento de analytics: onboarding_question_answered
      console.log(`Analytics: onboarding_question_answered (question_id: ${currentQuestion.id}, answer_value_type: ${selectedOption})`);
      
      // Si es el último paso, marcar onboarding como completado
      if (stepNumber === 3) {
        localStorage.setItem("hasCompletedOnboarding", "true");
        
        // Evento de analytics: onboarding_completed
        console.log("Analytics: onboarding_completed");
        
        // Redirigir a crear objetivo
        router.push("/goals/new");
      } else {
        // Redirigir al siguiente paso
        router.push(`/onboarding/${stepNumber + 1}`);
      }
    } catch (err) {
      console.error("Error al guardar respuesta:", err);
      setIsLoading(false);
    }
  };
  
  const handleBack = () => {
    if (stepNumber > 1) {
      router.push(`/onboarding/${stepNumber - 1}`);
    }
  };
  
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-md bg-ahorro-700 flex items-center justify-center text-white font-bold">
            AI
          </div>
          <div className="font-semibold">
            <div>Ahorro</div>
            <div className="text-xs text-ahorro-700/80">INVISIBLE</div>
          </div>
        </div>
        
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text-secondary">Paso {stepNumber} de 3</span>
            <div className="flex gap-1">
              {[1, 2, 3].map((step) => (
                <div 
                  key={step} 
                  className={`w-8 h-1 rounded-full ${
                    step === stepNumber ? 'bg-ahorro-600' : 
                    step < stepNumber ? 'bg-ahorro-300' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
        
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-text-primary mb-6">{currentQuestion.question}</h2>
            
            <div className="space-y-3">
              {currentQuestion.options.map((option) => (
                <div 
                  key={option.key}
                  onClick={() => setSelectedOption(option.key)}
                  className={`p-4 border rounded-xl cursor-pointer transition-all ${
                    selectedOption === option.key 
                      ? 'border-ahorro-600 bg-ahorro-50' 
                      : 'border-gray-200 hover:border-ahorro-300'
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 ${
                      selectedOption === option.key 
                        ? 'border-ahorro-600 bg-ahorro-600' 
                        : 'border-gray-300'
                    }`}>
                      {selectedOption === option.key && (
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                      )}
                    </div>
                    <span className="text-text-primary">{option.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <div className="flex justify-between">
          {stepNumber > 1 ? (
            <Button 
              variant="outline" 
              onClick={handleBack}
              disabled={isLoading}
            >
              Atrás
            </Button>
          ) : (
            <div></div>
          )}
          
          <Button 
            variant="primary" 
            onClick={handleNext}
            disabled={!selectedOption || isLoading}
          >
            {isLoading ? "Guardando..." : stepNumber === 3 ? "Finalizar" : "Siguiente"}
          </Button>
        </div>
      </div>
    </div>
  );
}
