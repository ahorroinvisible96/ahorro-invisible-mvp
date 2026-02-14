"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Banco de preguntas diarias (en un entorno real, esto vendría de una API)
const dailyQuestions = [
  {
    id: "daily_1",
    question: "¿Hoy pedirás comida a domicilio o cocinarás en casa?",
    options: [
      { key: "delivery", label: "Pediré comida a domicilio", impact: { monthly_delta: -60, yearly_delta: -720, label: "Ahorrarías hasta 720€ al año cocinando en casa" } },
      { key: "cook", label: "Cocinaré en casa", impact: { monthly_delta: 60, yearly_delta: 720, label: "Estás ahorrando hasta 720€ al año cocinando en casa" } }
    ]
  },
  {
    id: "daily_2",
    question: "¿Tomarás el café fuera o lo prepararás en casa?",
    options: [
      { key: "outside", label: "Lo tomaré fuera", impact: { monthly_delta: -45, yearly_delta: -540, label: "Ahorrarías hasta 540€ al año preparando café en casa" } },
      { key: "home", label: "Lo prepararé en casa", impact: { monthly_delta: 45, yearly_delta: 540, label: "Estás ahorrando hasta 540€ al año preparando café en casa" } }
    ]
  },
  {
    id: "daily_3",
    question: "¿Usarás transporte público o taxi/coche hoy?",
    options: [
      { key: "taxi", label: "Taxi/coche", impact: { monthly_delta: -100, yearly_delta: -1200, label: "Ahorrarías hasta 1200€ al año usando transporte público" } },
      { key: "public", label: "Transporte público", impact: { monthly_delta: 100, yearly_delta: 1200, label: "Estás ahorrando hasta 1200€ al año usando transporte público" } }
    ]
  },
  {
    id: "daily_4",
    question: "¿Comprarás algo por impulso hoy o esperarás 24h?",
    options: [
      { key: "impulse", label: "Compraré por impulso", impact: { monthly_delta: -50, yearly_delta: -600, label: "Ahorrarías hasta 600€ al año evitando compras impulsivas" } },
      { key: "wait", label: "Esperaré 24h", impact: { monthly_delta: 50, yearly_delta: 600, label: "Estás ahorrando hasta 600€ al año evitando compras impulsivas" } }
    ]
  },
  {
    id: "daily_5",
    question: "¿Renovarás automáticamente una suscripción o la cancelarás?",
    options: [
      { key: "renew", label: "La renovaré", impact: { monthly_delta: -15, yearly_delta: -180, label: "Ahorrarías hasta 180€ al año revisando tus suscripciones" } },
      { key: "cancel", label: "La cancelaré", impact: { monthly_delta: 15, yearly_delta: 180, label: "Estás ahorrando hasta 180€ al año cancelando suscripciones" } }
    ]
  }
];

export default function DailyQuestionPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<any[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [dailyQuestion, setDailyQuestion] = useState<any>(null);
  const [hasAnsweredToday, setHasAnsweredToday] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Verificar autenticación
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated !== "true") {
      router.replace("/signup");
      return;
    }
    
    // Verificar onboarding
    const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding");
    if (hasCompletedOnboarding !== "true") {
      router.replace("/onboarding/1");
      return;
    }
    
    // Cargar datos
    try {
      // Objetivos
      const storedGoals = JSON.parse(localStorage.getItem("goals") || "[]");
      const activeGoals = storedGoals.filter((goal: any) => !goal.archived);
      setGoals(activeGoals);
      
      // Si no hay objetivos, redirigir a crear objetivo
      if (activeGoals.length === 0) {
        router.replace("/goals/new");
        return;
      }
      
      // Seleccionar objetivo principal por defecto
      const primaryGoal = activeGoals.find((goal: any) => goal.is_primary);
      setSelectedGoal(primaryGoal ? primaryGoal.id : activeGoals[0].id);
      
      // Verificar si ya respondió hoy
      const today = new Date().toISOString().split('T')[0];
      const dailyDecisions = JSON.parse(localStorage.getItem("dailyDecisions") || "[]");
      const answeredToday = dailyDecisions.some((decision: any) => 
        decision.date.split('T')[0] === today
      );
      setHasAnsweredToday(answeredToday);
      
      // Si ya respondió hoy, mostrar la última decisión
      if (answeredToday) {
        const todayDecision = dailyDecisions.find((decision: any) => 
          decision.date.split('T')[0] === today
        );
        
        if (todayDecision) {
          const question = dailyQuestions.find(q => q.id === todayDecision.question_id);
          setDailyQuestion(question);
          setSelectedOption(todayDecision.answer_key);
          setSelectedGoal(todayDecision.goal_id);
        }
      } else {
        // Seleccionar una pregunta aleatoria
        const randomIndex = Math.floor(Math.random() * dailyQuestions.length);
        setDailyQuestion(dailyQuestions[randomIndex]);
        
        // Evento de analytics: daily_question_viewed
        console.log(`Analytics: daily_question_viewed (question_id: ${dailyQuestions[randomIndex]?.id})`);
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error("Error al cargar datos:", err);
      setIsLoading(false);
    }
  }, [router]);

  const handleSubmit = () => {
    if (!selectedOption || !selectedGoal || !dailyQuestion) return;
    
    setIsSubmitting(true);
    
    try {
      // Evento de analytics: daily_answer_selected
      console.log(`Analytics: daily_answer_selected (answer_key: ${selectedOption})`);
      
      // Obtener el impacto de la opción seleccionada
      const selectedOptionData = dailyQuestion.options.find((opt: any) => opt.key === selectedOption);
      const impact = selectedOptionData?.impact;
      
      // Crear nueva decisión diaria
      const newDecision = {
        id: `decision_${Date.now()}`,
        date: new Date().toISOString(),
        question_id: dailyQuestion.id,
        question_text: dailyQuestion.question,
        answer_key: selectedOption,
        answer_text: selectedOptionData?.label,
        goal_id: selectedGoal,
        impact: impact
      };
      
      // Guardar en localStorage
      const dailyDecisions = JSON.parse(localStorage.getItem("dailyDecisions") || "[]");
      dailyDecisions.unshift(newDecision);
      localStorage.setItem("dailyDecisions", JSON.stringify(dailyDecisions));
      
      // Actualizar el objetivo con el impacto
      if (impact && impact.monthly_delta > 0) {
        const goals = JSON.parse(localStorage.getItem("goals") || "[]");
        const updatedGoals = goals.map((goal: any) => {
          if (goal.id === selectedGoal) {
            return {
              ...goal,
              current_amount: goal.current_amount + (impact.monthly_delta / 30), // Impacto diario aproximado
              updated_at: new Date().toISOString()
            };
          }
          return goal;
        });
        localStorage.setItem("goals", JSON.stringify(updatedGoals));
      }
      
      // Evento de analytics: daily_answer_submitted
      console.log("Analytics: daily_answer_submitted");
      
      // Evento de analytics: daily_completed
      console.log(`Analytics: daily_completed (question_id: ${dailyQuestion.id}, answer_key: ${selectedOption}, goal_id: ${selectedGoal})`);
      
      // Redirigir a la página de impacto
      router.push(`/impact/${newDecision.id}`);
    } catch (err) {
      console.error("Error al guardar decisión:", err);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ahorro-600"></div>
      </div>
    );
  }
  
  if (hasAnsweredToday) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="mb-6">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-text-primary mb-4">¡Ya has respondido hoy!</h2>
              <p className="text-text-secondary mb-6">
                Ya has tomado tu decisión financiera consciente del día. Vuelve mañana para una nueva pregunta.
              </p>
              <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-6">
                <h3 className="font-medium text-text-primary mb-2">Tu respuesta:</h3>
                <p className="text-text-secondary mb-2">{dailyQuestion?.question}</p>
                <p className="font-medium">
                  {dailyQuestion?.options.find((opt: any) => opt.key === selectedOption)?.label}
                </p>
              </div>
              <Button 
                variant="primary" 
                onClick={() => router.push(`/impact/latest`)}
                fullWidth
              >
                Ver impacto
              </Button>
            </CardContent>
          </Card>
          <div className="flex justify-center">
            <Button 
              variant="outline" 
              onClick={() => router.push("/dashboard")}
            >
              Volver al Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
        
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Tu decisión de hoy</h1>
        <p className="text-text-secondary mb-6">Responde a la pregunta y asígnala a un objetivo</p>
        
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-text-primary mb-6">{dailyQuestion?.question}</h2>
            
            <div className="space-y-3 mb-6">
              {dailyQuestion?.options.map((option: any) => (
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
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-text-primary mb-2">
                Asignar a objetivo
              </label>
              <select
                value={selectedGoal || ""}
                onChange={(e) => setSelectedGoal(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:border-ahorro-500"
              >
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title} ({goal.is_primary ? "Principal" : "Secundario"})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="text-xs text-text-secondary mb-6">
              <p>Estimación educativa, no asesoramiento financiero.</p>
            </div>
            
            <Button 
              variant="primary" 
              onClick={handleSubmit}
              disabled={!selectedOption || !selectedGoal || isSubmitting}
              fullWidth
            >
              {isSubmitting ? "Guardando..." : "Guardar decisión"}
            </Button>
          </CardContent>
        </Card>
        
        <div className="flex justify-center">
          <Button 
            variant="outline" 
            onClick={() => router.push("/dashboard")}
          >
            Volver al Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
