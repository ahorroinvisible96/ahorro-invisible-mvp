"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { analytics } from "@/services/analytics";

// Banco de preguntas diarias (simulado, en producción vendría del backend)
const QUESTION_BANK = [
  {
    question_id: "dly_delivery_vs_cook",
    text: "Hoy, ¿qué eliges?",
    options: [
      { answer_key: "delivery", label: "Pido delivery" },
      { answer_key: "cook", label: "Cocino en casa" }
    ],
    impact: {
      delivery: { monthly_delta: -60, yearly_delta: -720 },
      cook: { monthly_delta: 60, yearly_delta: 720, label: "Pequeñas decisiones, gran diferencia" }
    }
  },
  {
    question_id: "dly_coffee_out_vs_home",
    text: "¿Café fuera o en casa?",
    options: [
      { answer_key: "out", label: "Lo compro fuera" },
      { answer_key: "home", label: "Lo preparo en casa" }
    ],
    impact: {
      out: { monthly_delta: -30, yearly_delta: -360 },
      home: { monthly_delta: 30, yearly_delta: 360, label: "Un paso hoy cuenta" }
    }
  },
  {
    question_id: "dly_impulse_vs_wait",
    text: "¿Comprar por impulso o esperar?",
    options: [
      { answer_key: "impulse", label: "Compro ahora" },
      { answer_key: "wait", label: "Espero 24h" }
    ],
    impact: {
      impulse: { monthly_delta: -45, yearly_delta: -540 },
      wait: { monthly_delta: 45, yearly_delta: 540, label: "Constancia > intensidad" }
    }
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

export default function DailyQuestionPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [primaryGoal, setPrimaryGoal] = useState<Goal | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [dailyQuestion, setDailyQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [decisionId, setDecisionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  useEffect(() => {
    // Establecer el nombre de la pantalla para analytics
    analytics.setScreen('daily_question');
    
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
  }, [router]);
  
  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Cargar objetivos
      const storedGoals = localStorage.getItem("goals");
      if (!storedGoals || JSON.parse(storedGoals).filter((g: Goal) => !g.archived).length === 0) {
        // Redirigir a crear objetivo si no hay objetivos activos
        analytics.setScreen('create_goal');
        router.replace("/goals/new");
        return;
      }
      
      const parsedGoals = JSON.parse(storedGoals);
      const activeGoals = parsedGoals.filter((goal: Goal) => !goal.archived);
      setGoals(activeGoals);
      
      // Encontrar objetivo principal
      const primary = activeGoals.find((goal: Goal) => goal.is_primary);
      if (primary) {
        setPrimaryGoal(primary);
        setSelectedGoalId(primary.id);
      } else if (activeGoals.length > 0) {
        setPrimaryGoal(activeGoals[0]);
        setSelectedGoalId(activeGoals[0].id);
      }
      
      // Verificar si ya completó la decisión del día
      const today = new Date().toISOString().split('T')[0];
      const storedDecisions = localStorage.getItem("dailyDecisions");
      
      if (storedDecisions) {
        const decisions = JSON.parse(storedDecisions);
        const todayDecision = decisions.find((d: any) => d.date.startsWith(today));
        
        if (todayDecision) {
          setIsCompleted(true);
          setDecisionId(todayDecision.id);
        }
      }
      
      // Obtener pregunta del día (simulado, en producción sería una llamada a la API)
      // Seleccionar una pregunta aleatoria del banco para simular rotación
      const randomIndex = Math.floor(Math.random() * QUESTION_BANK.length);
      setDailyQuestion(QUESTION_BANK[randomIndex]);
      
      // Registrar evento de visualización de pregunta diaria
      analytics.dailyQuestionViewed(
        today,
        QUESTION_BANK[randomIndex].question_id,
        isCompleted ? "completed" : "pending"
      );
      
    } catch (error) {
      console.error("Error al cargar datos:", error);
      setError("No se pudo cargar la pregunta del día. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSelectAnswer = (answerKey: string) => {
    setSelectedAnswer(answerKey);
    
    if (dailyQuestion) {
      const today = new Date().toISOString().split('T')[0];
      analytics.dailyAnswerSelected(today, dailyQuestion.question_id, answerKey);
    }
  };
  
  const handleSubmit = () => {
    if (!selectedAnswer || !selectedGoalId || !dailyQuestion) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const newDecisionId = `decision_${Date.now()}`;
      const isPrimaryGoal = primaryGoal?.id === selectedGoalId;
      
      // Registrar evento de respuesta enviada
      analytics.dailyAnswerSubmitted(
        today, 
        dailyQuestion.question_id, 
        selectedAnswer, 
        selectedGoalId,
        isPrimaryGoal
      );
      
      // Crear nueva decisión
      const newDecision = {
        id: newDecisionId,
        date: today,
        question_id: dailyQuestion.question_id,
        answer_key: selectedAnswer,
        goal_id: selectedGoalId,
        impact: dailyQuestion.impact[selectedAnswer],
        created_at: new Date().toISOString()
      };
      
      // Guardar en localStorage
      const storedDecisions = localStorage.getItem("dailyDecisions");
      const decisions = storedDecisions ? JSON.parse(storedDecisions) : [];
      decisions.unshift(newDecision);
      localStorage.setItem("dailyDecisions", JSON.stringify(decisions));
      
      // Actualizar estado
      setIsCompleted(true);
      setDecisionId(newDecisionId);
      
      // Registrar evento de decisión completada (NSM)
      analytics.dailyCompleted(
        today,
        newDecisionId,
        dailyQuestion.question_id,
        selectedAnswer,
        selectedGoalId,
        true,
        dailyQuestion.impact[selectedAnswer].monthly_delta,
        dailyQuestion.impact[selectedAnswer].yearly_delta,
        isPrimaryGoal
      );
      
      // Redirigir a la página de impacto
      router.push(`/impact/${newDecisionId}`);
      
    } catch (error) {
      console.error("Error al guardar decisión:", error);
      setError("No se pudo guardar. Intenta de nuevo.");
      
      // Registrar evento de error
      analytics.dailySubmitError(
        new Date().toISOString().split('T')[0],
        dailyQuestion.question_id,
        selectedAnswer,
        "LOCAL_STORAGE_ERROR",
        String(error)
      );
    }
  };
  
  const handleViewImpact = () => {
    if (decisionId) {
      router.push(`/impact/${decisionId}`);
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ahorro-500"></div>
      </div>
    );
  }
  
  if (isCompleted) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="p-6">
            <h1 className="text-xl font-semibold text-text-primary mb-2">
              Ya completaste la decisión de hoy
            </h1>
            <p className="text-text-secondary mb-6">
              Vuelve mañana para una nueva decisión o revisa el impacto de tu elección de hoy.
            </p>
            <Button 
              variant="primary" 
              fullWidth 
              onClick={handleViewImpact}
            >
              Ver impacto
            </Button>
          </Card>
        </div>
      </main>
    );
  }
  
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-text-primary mb-2">Decisión del día</h1>
          <p className="text-text-secondary">Una pequeña decisión diaria puede generar un gran impacto en tus finanzas.</p>
        </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          {dailyQuestion && (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-medium text-text-primary mb-4">
                  {dailyQuestion.text}
                </h2>
                
                <div className="space-y-3">
                  {dailyQuestion.options.map((option: any) => (
                    <button
                      key={option.answer_key}
                      onClick={() => handleSelectAnswer(option.answer_key)}
                      className={`w-full py-3 px-4 rounded-lg border text-left ${
                        selectedAnswer === option.answer_key
                          ? "border-ahorro-600 bg-ahorro-50 text-ahorro-700"
                          : "border-gray-200 text-text-primary hover:bg-gray-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Asignar a objetivo
                </label>
                <select
                  value={selectedGoalId || ""}
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:border-ahorro-500"
                >
                  {goals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title} {goal.is_primary ? "(Principal)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              
              <Button
                variant="primary"
                fullWidth
                disabled={!selectedAnswer || !selectedGoalId}
                onClick={handleSubmit}
              >
                Guardar decisión
              </Button>
              
              <p className="text-xs text-text-secondary text-center mt-4">
                Estimación educativa. No es asesoramiento financiero.
              </p>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
