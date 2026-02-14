"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function ImpactPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [decision, setDecision] = useState<any>(null);
  const [goal, setGoal] = useState<any>(null);
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
      let targetDecision;
      
      // Si el ID es "latest", buscar la decisión más reciente
      if (params.id === "latest") {
        const dailyDecisions = JSON.parse(localStorage.getItem("dailyDecisions") || "[]");
        if (dailyDecisions.length > 0) {
          targetDecision = dailyDecisions[0]; // La más reciente está al inicio
        } else {
          // No hay decisiones, redirigir al dashboard
          router.replace("/dashboard");
          return;
        }
      } else {
        // Buscar la decisión por ID
        const dailyDecisions = JSON.parse(localStorage.getItem("dailyDecisions") || "[]");
        targetDecision = dailyDecisions.find((d: any) => d.id === params.id);
        
        // Si no se encuentra, redirigir al dashboard
        if (!targetDecision) {
          router.replace("/dashboard");
          return;
        }
      }
      
      setDecision(targetDecision);
      
      // Buscar el objetivo asociado
      const goals = JSON.parse(localStorage.getItem("goals") || "[]");
      const targetGoal = goals.find((g: any) => g.id === targetDecision.goal_id);
      setGoal(targetGoal);
      
      setIsLoading(false);
      
      // Evento de analytics: impact_viewed
      console.log("Analytics: impact_viewed");
    } catch (err) {
      console.error("Error al cargar datos:", err);
      setIsLoading(false);
    }
  }, [router, params.id]);

  // Función para formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };
  
  // Función para calcular el porcentaje de progreso
  const calculateProgress = (current: number, target: number) => {
    if (!target || target === 0) return 0;
    const progress = (current / target) * 100;
    return Math.min(progress, 100);
  };
  
  // Función para manejar la acción extra de ahorro
  const handleExtraSaving = () => {
    // Evento de analytics: impact_cta_extra_savings_clicked
    console.log("Analytics: impact_cta_extra_savings_clicked");
    
    router.push("/extra-saving");
  };
  
  // Función para ver el historial
  const handleViewHistory = () => {
    // Evento de analytics: impact_cta_history_clicked
    console.log("Analytics: impact_cta_history_clicked");
    
    router.push("/history");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ahorro-600"></div>
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
        
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Impacto de tu decisión</h1>
        <p className="text-text-secondary mb-6">Así afecta tu decisión a tus objetivos</p>
        
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="bg-ahorro-50 rounded-xl p-4 mb-6">
              <h3 className="font-medium text-text-primary mb-2">Tu decisión:</h3>
              <p className="text-text-secondary mb-2">{decision?.question_text}</p>
              <p className="font-medium">{decision?.answer_text}</p>
            </div>
            
            <div className="mb-6">
              <h3 className="font-medium text-text-primary mb-2">Objetivo asignado:</h3>
              <p className="text-ahorro-600 font-medium">{goal?.title}</p>
            </div>
            
            {decision?.impact ? (
              <div className="mb-6">
                <h3 className="font-medium text-text-primary mb-2">Impacto estimado:</h3>
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  {decision.impact.monthly_delta > 0 ? (
                    <>
                      <p className="text-green-600 font-medium mb-1">
                        +{formatCurrency(decision.impact.monthly_delta)} / mes
                      </p>
                      <p className="text-green-600 font-medium mb-3">
                        +{formatCurrency(decision.impact.yearly_delta)} / año
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-red-600 font-medium mb-1">
                        {formatCurrency(decision.impact.monthly_delta)} / mes
                      </p>
                      <p className="text-red-600 font-medium mb-3">
                        {formatCurrency(decision.impact.yearly_delta)} / año
                      </p>
                    </>
                  )}
                  <p className="text-text-secondary text-sm">{decision.impact.label}</p>
                </div>
              </div>
            ) : (
              <div className="mb-6">
                <h3 className="font-medium text-text-primary mb-2">Impacto estimado:</h3>
                <p className="text-text-secondary">Aún estamos calculándolo.</p>
              </div>
            )}
            
            <div className="mb-6">
              <h3 className="font-medium text-text-primary mb-2">Progreso actualizado:</h3>
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{formatCurrency(goal?.current_amount)}</span>
                  <span className="text-sm text-text-secondary">{formatCurrency(goal?.target_amount)}</span>
                </div>
                <Progress 
                  value={calculateProgress(goal?.current_amount, goal?.target_amount)} 
                  size="md" 
                  color="blue" 
                />
              </div>
              <p className="text-text-secondary text-sm">
                Te faltan <span className="font-semibold">{formatCurrency(goal?.target_amount - goal?.current_amount)}</span> para completar tu meta.
              </p>
            </div>
            
            <div className="text-xs text-text-secondary mb-6">
              <p>Estimación educativa, no asesoramiento financiero.</p>
            </div>
            
            <div className="space-y-3">
              <Button 
                variant="primary" 
                onClick={handleExtraSaving}
                fullWidth
              >
                Registrar acción extra de ahorro
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleViewHistory}
                fullWidth
              >
                Ver historial
              </Button>
            </div>
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
