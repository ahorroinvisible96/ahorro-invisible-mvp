"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [goals, setGoals] = useState<{[key: string]: any}>({});
  const [isLoading, setIsLoading] = useState(true);

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
      // Obtener decisiones diarias
      const dailyDecisions = JSON.parse(localStorage.getItem("dailyDecisions") || "[]");
      
      // Obtener ahorros extra
      const extraSavings = JSON.parse(localStorage.getItem("extraSavings") || "[]");
      
      // Combinar y ordenar por fecha (más reciente primero)
      const combinedHistory = [...dailyDecisions, ...extraSavings].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      setHistory(combinedHistory);
      
      // Obtener objetivos para mostrar nombres
      const storedGoals = JSON.parse(localStorage.getItem("goals") || "[]");
      const goalsMap: {[key: string]: any} = {};
      storedGoals.forEach((goal: any) => {
        goalsMap[goal.id] = goal;
      });
      setGoals(goalsMap);
      
      setIsLoading(false);
      
      // Evento de analytics: history_viewed
      console.log("Analytics: history_viewed");
    } catch (err) {
      console.error("Error al cargar historial:", err);
      setIsLoading(false);
    }
  }, [router]);

  // Función para formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };
  
  // Función para formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ahorro-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Historial</h1>
            <p className="text-text-secondary">Registro de tus decisiones y acciones</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => router.push("/dashboard")}
          >
            Volver
          </Button>
        </div>
        
        {history.length > 0 ? (
          <div className="space-y-4">
            {history.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      {item.type === "extra_saving" ? (
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium">{item.note || "Ahorro extra"}</p>
                            <p className="text-sm text-text-secondary">
                              {formatDate(item.date)} • {goals[item.goal_id]?.title || "Objetivo"}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-ahorro-100 flex items-center justify-center mr-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-ahorro-600" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium">{item.answer_text}</p>
                            <p className="text-sm text-text-secondary">
                              {formatDate(item.date)} • {goals[item.goal_id]?.title || "Objetivo"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      {item.type === "extra_saving" ? (
                        <span className="text-green-600 font-medium">
                          +{formatCurrency(item.amount)}
                        </span>
                      ) : item.impact?.monthly_delta > 0 ? (
                        <span className="text-green-600 font-medium">
                          +{formatCurrency(item.impact.monthly_delta / 30)}
                        </span>
                      ) : item.impact?.monthly_delta < 0 ? (
                        <span className="text-red-600 font-medium">
                          {formatCurrency(item.impact.monthly_delta / 30)}
                        </span>
                      ) : (
                        <span className="text-text-secondary">--</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-ahorro-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <h3 className="text-xl font-medium text-text-primary mb-2">No hay historial</h3>
              <p className="text-text-secondary mb-4">Aún no hay decisiones registradas</p>
              <Button 
                variant="primary" 
                onClick={() => router.push("/daily")}
              >
                Responder ahora
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
