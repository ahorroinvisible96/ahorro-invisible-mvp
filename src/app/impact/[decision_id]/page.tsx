"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { analytics } from "@/services/analytics";

// Banco de preguntas diarias (simulado, en producción vendría del backend)
const QUESTION_BANK = [
  {
    question_id: "dly_delivery_vs_cook",
    text: "Hoy, ¿qué eliges?",
    options: [
      { answer_key: "delivery", label: "Pido delivery" },
      { answer_key: "cook", label: "Cocino en casa" }
    ]
  },
  {
    question_id: "dly_coffee_out_vs_home",
    text: "¿Café fuera o en casa?",
    options: [
      { answer_key: "out", label: "Lo compro fuera" },
      { answer_key: "home", label: "Lo preparo en casa" }
    ]
  },
  {
    question_id: "dly_impulse_vs_wait",
    text: "¿Comprar por impulso o esperar?",
    options: [
      { answer_key: "impulse", label: "Compro ahora" },
      { answer_key: "wait", label: "Espero 24h" }
    ]
  }
];

interface Goal {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  time_horizon_months: number | null;
  is_primary: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

interface Decision {
  id: string;
  date: string;
  question_id: string;
  answer_key: string;
  goal_id: string;
  impact: {
    monthly_delta: number;
    yearly_delta: number;
    label?: string;
  };
  created_at: string;
}

export default function ImpactPage({ params }: { params: { decision_id: string } }) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [question, setQuestion] = useState<any>(null);
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  useEffect(() => {
    // Establecer el nombre de la pantalla para analytics
    analytics.setScreen('impact');
    
    // Verificar autenticación
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated !== "true") {
      router.replace("/signup");
      return;
    }
    
    // Verificar onboarding
    const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding");
    if (hasCompletedOnboarding !== "true") {
      router.replace("/onboarding");
      return;
    }
    
    // Cargar datos
    loadData();
  }, [router, params.decision_id]);
  
  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Cargar decisión
      const storedDecisions = localStorage.getItem("dailyDecisions");
      if (!storedDecisions) {
        setError("No se encontró la decisión");
        return;
      }
      
      const decisions = JSON.parse(storedDecisions);
      const foundDecision = decisions.find((d: Decision) => d.id === params.decision_id);
      
      if (!foundDecision) {
        setError("No se encontró la decisión");
        return;
      }
      
      setDecision(foundDecision);
      
      // Cargar objetivo asociado
      const storedGoals = localStorage.getItem("goals");
      if (storedGoals) {
        const goals = JSON.parse(storedGoals);
        const foundGoal = goals.find((g: Goal) => g.id === foundDecision.goal_id);
        
        if (foundGoal) {
          setGoal(foundGoal);
        }
      }
      
      // Cargar pregunta
      const foundQuestion = QUESTION_BANK.find(q => q.question_id === foundDecision.question_id);
      if (foundQuestion) {
        setQuestion(foundQuestion);
        setSelectedOption(foundQuestion.options.find(o => o.answer_key === foundDecision.answer_key));
      }
      
      // Registrar evento de visualización de impacto
      analytics.impactViewed(
        foundDecision.date,
        foundDecision.id,
        foundDecision.question_id,
        foundDecision.answer_key,
        foundDecision.goal_id,
        !!foundDecision.impact,
        foundDecision.impact?.monthly_delta,
        foundDecision.impact?.yearly_delta
      );
      
    } catch (error) {
      console.error("Error al cargar datos:", error);
      setError("No se pudo cargar el impacto. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleExtraSaving = () => {
    if (decision && goal) {
      analytics.impactCtaExtraSavingsClicked(decision.id, goal.id);
    }
    router.push("/extra-saving");
  };
  
  const handleViewHistory = () => {
    analytics.impactCtaHistoryClicked();
    router.push("/history");
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ahorro-500"></div>
      </div>
    );
  }
  
  if (error || !decision || !goal) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="p-6 text-center">
            <h1 className="text-xl font-semibold text-text-primary mb-2">
              {error || "No se encontró la decisión"}
            </h1>
            <p className="text-text-secondary mb-6">
              Vuelve al dashboard para continuar.
            </p>
            <Button 
              variant="primary" 
              onClick={() => router.push("/dashboard")}
            >
              Volver al dashboard
            </Button>
          </Card>
        </div>
      </main>
    );
  }
  
  const progressPercentage = Math.min(100, Math.max(0, (goal.current_amount / goal.target_amount) * 100));
  
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-text-primary mb-2">Impacto</h1>
            <p className="text-text-secondary">El impacto de tu decisión en tu objetivo.</p>
          </div>
          {/* Resumen de la decisión */}
          <div className="mb-6 p-4 bg-ahorro-50 rounded-lg">
            <h2 className="font-medium text-text-primary mb-2">
              {question?.text}
            </h2>
            <p className="text-ahorro-600 font-medium">
              {selectedOption?.label}
            </p>
          </div>
          
          {/* Impacto estimado */}
          {decision.impact ? (
            <div className="mb-6">
              <h2 className="font-medium text-text-primary mb-3">Impacto estimado:</h2>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">Mensual:</span>
                  <span className={`font-medium ${decision.impact.monthly_delta >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {decision.impact.monthly_delta >= 0 ? '+' : ''}{formatCurrency(decision.impact.monthly_delta)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">Anual:</span>
                  <span className={`font-medium ${decision.impact.yearly_delta >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {decision.impact.yearly_delta >= 0 ? '+' : ''}{formatCurrency(decision.impact.yearly_delta)}
                  </span>
                </div>
                
                {decision.impact.label && (
                  <p className="text-sm text-ahorro-600 mt-2">
                    {decision.impact.label}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-text-secondary">
                Aún no tenemos estimación para esta decisión.
              </p>
              <p className="text-text-secondary mt-2">
                Tu progreso sigue contando.
              </p>
            </div>
          )}
          
          {/* Progreso del objetivo */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-medium text-text-primary">Progreso en {goal.title}</h2>
              <span className="text-ahorro-600 font-medium">{Math.round(progressPercentage)}%</span>
            </div>
            
            <Progress 
              value={progressPercentage} 
              className="mb-2" 
              size="md" 
              color="blue" 
            />
            
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">{formatCurrency(goal.current_amount)}</span>
              <span className="text-text-secondary">{formatCurrency(goal.target_amount)}</span>
            </div>
          </div>
          
          {/* Disclaimer */}
          <p className="text-xs text-text-secondary text-center mb-6">
            Estimación educativa. No es asesoramiento financiero.
          </p>
          
          {/* Botones de acción */}
          <div className="space-y-3">
            <Button 
              variant="primary" 
              fullWidth 
              onClick={handleExtraSaving}
            >
              Registrar acción extra
            </Button>
            
            <Button 
              variant="outline" 
              fullWidth 
              onClick={handleViewHistory}
            >
              Ver historial
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
