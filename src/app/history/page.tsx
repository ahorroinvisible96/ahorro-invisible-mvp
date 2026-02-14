"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';
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

interface HistoryItem {
  type: 'daily_decision' | 'extra_saving';
  date: string;
  goal_id: string;
  summary: string;
  payload: any;
}

export default function HistoryPage() {
  const router = useRouter();
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [goals, setGoals] = useState<Record<string, Goal>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Establecer el nombre de la pantalla para analytics
    analytics.setScreen('history');
    
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
    
    // Registrar evento de visualización del historial
    analytics.historyViewed('sidebar');
  }, [router]);
  
  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Cargar objetivos para referencia
      const storedGoals = localStorage.getItem("goals");
      if (storedGoals) {
        const parsedGoals = JSON.parse(storedGoals);
        const goalsMap: Record<string, Goal> = {};
        parsedGoals.forEach((goal: Goal) => {
          goalsMap[goal.id] = goal;
        });
        setGoals(goalsMap);
      }
      
      // Cargar decisiones diarias
      const storedDecisions = localStorage.getItem("dailyDecisions");
      const decisions = storedDecisions ? JSON.parse(storedDecisions) : [];
      
      // Cargar acciones extra
      const storedExtraSavings = localStorage.getItem("extraSavings");
      const extraSavings = storedExtraSavings ? JSON.parse(storedExtraSavings) : [];
      
      // Convertir a formato de historial
      const historyItems: HistoryItem[] = [
        ...decisions.map((decision: any) => {
          const question = QUESTION_BANK.find(q => q.question_id === decision.question_id);
          const option = question?.options.find(o => o.answer_key === decision.answer_key);
          
          return {
            type: 'daily_decision',
            date: decision.date,
            goal_id: decision.goal_id,
            summary: `Decisión diaria: ${option?.label || decision.answer_key}`,
            payload: {
              decision_id: decision.id,
              question_id: decision.question_id,
              answer_key: decision.answer_key,
              impact: decision.impact
            }
          };
        }),
        ...extraSavings.map((saving: any) => ({
          type: 'extra_saving',
          date: saving.date,
          goal_id: saving.goal_id,
          summary: `Acción extra: ${saving.note || 'Ahorro adicional'}`,
          payload: {
            extra_saving_id: saving.id,
            amount: saving.amount,
            note: saving.note
          }
        }))
      ];
      
      // Ordenar por fecha (más reciente primero)
      historyItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setHistoryItems(historyItems);
      
    } catch (error) {
      console.error("Error al cargar historial:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleItemClick = (item: HistoryItem) => {
    if (item.type === 'daily_decision') {
      analytics.historyItemOpened('daily_decision', item.payload.decision_id);
      router.push(`/impact/${item.payload.decision_id}`);
    }
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
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
  
  return (
    <div className="p-6 bg-background">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Historial</h1>
        <p className="text-text-secondary">Todas tus decisiones y acciones extra.</p>
      </div>
      
      {historyItems.length > 0 ? (
        <div className="space-y-4">
          {historyItems.map((item, index) => (
            <div 
              key={index} 
              className="overflow-hidden cursor-pointer hover:shadow-card-hover transition-shadow"
              onClick={() => handleItemClick(item)}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <div className={`rounded-full p-2 mr-3 ${
                      item.type === 'daily_decision' && item.payload.impact?.monthly_delta >= 0 || item.type === 'extra_saving'
                        ? 'bg-green-100' 
                        : 'bg-red-100'
                    }`}>
                      {item.type === 'daily_decision' && item.payload.impact?.monthly_delta >= 0 || item.type === 'extra_saving' ? (
                        <ArrowUpIcon className="h-5 w-5 text-green-600" />
                      ) : (
                        <ArrowDownIcon className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-text-primary">{item.summary}</p>
                        <span className="text-xs text-text-secondary">{formatDate(item.date)}</span>
                      </div>
                      
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-text-secondary">
                          {goals[item.goal_id]?.title || 'Objetivo no encontrado'}
                        </p>
                        
                        {item.type === 'daily_decision' && item.payload.impact && (
                          <span className={`text-sm font-medium ${
                            item.payload.impact.monthly_delta >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {item.payload.impact.monthly_delta >= 0 ? '+' : ''}
                            {formatCurrency(item.payload.impact.monthly_delta)}/mes
                          </span>
                        )}
                        
                        {item.type === 'extra_saving' && (
                          <span className="text-sm font-medium text-green-600">
                            +{formatCurrency(item.payload.amount)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <Card className="p-6 text-center">
          <p className="text-text-secondary mb-4">Aún no hay decisiones registradas.</p>
          <Button 
            variant="primary" 
            onClick={() => router.push('/daily')}
          >
            Responder ahora
          </Button>
        </Card>
      )}
    </div>
  );
}
