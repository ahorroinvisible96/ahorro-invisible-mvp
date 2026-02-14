"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

// Componente para el Dashboard según las especificaciones del SYNC PACK
export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [goals, setGoals] = useState<any[]>([]);
  const [primaryGoal, setPrimaryGoal] = useState<any>(null);
  const [dailyDecisions, setDailyDecisions] = useState<any[]>([]);
  const [hasAnsweredToday, setHasAnsweredToday] = useState(false);
  const [incomeRange, setIncomeRange] = useState<string | null>(null);
  const [activeTimeframe, setActiveTimeframe] = useState("30D");
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
    
    // Cargar datos del usuario
    try {
      // Nombre de usuario
      const storedUserName = localStorage.getItem("userName");
      if (storedUserName) {
        setUserName(storedUserName);
      }
      
      // Objetivos
      const storedGoals = JSON.parse(localStorage.getItem("goals") || "[]");
      setGoals(storedGoals.filter((goal: any) => !goal.archived));
      
      // Objetivo principal
      const primary = storedGoals.find((goal: any) => goal.is_primary && !goal.archived);
      setPrimaryGoal(primary || (storedGoals.length > 0 ? storedGoals[0] : null));
      
      // Decisiones diarias
      const storedDecisions = JSON.parse(localStorage.getItem("dailyDecisions") || "[]");
      setDailyDecisions(storedDecisions);
      
      // Verificar si ya respondió hoy
      const today = new Date().toISOString().split('T')[0];
      const answeredToday = storedDecisions.some((decision: any) => 
        decision.date.split('T')[0] === today
      );
      setHasAnsweredToday(answeredToday);
      
      // Rango de ingresos (del onboarding)
      const onboardingAnswers = JSON.parse(localStorage.getItem("onboardingAnswers") || "{}");
      if (onboardingAnswers["onboarding_2"]) {
        setIncomeRange(onboardingAnswers["onboarding_2"]);
      }
      
      setIsLoading(false);
      
      // Evento de analytics: dashboard_viewed
      console.log("Analytics: dashboard_viewed");
    } catch (err) {
      console.error("Error al cargar datos:", err);
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
  
  // Función para calcular el porcentaje de progreso
  const calculateProgress = (current: number, target: number) => {
    if (!target || target === 0) return 0;
    const progress = (current / target) * 100;
    return Math.min(progress, 100);
  };
  
  // Función para archivar un objetivo
  const handleArchiveGoal = (goalId: string) => {
    try {
      // Obtener objetivos actuales
      const currentGoals = JSON.parse(localStorage.getItem("goals") || "[]");
      
      // Encontrar y marcar como archivado
      const updatedGoals = currentGoals.map((goal: any) => {
        if (goal.id === goalId) {
          return { ...goal, archived: true, updated_at: new Date().toISOString() };
        }
        return goal;
      });
      
      // Si el objetivo archivado era el principal, asignar uno nuevo
      const archivedGoal = currentGoals.find((goal: any) => goal.id === goalId);
      if (archivedGoal && archivedGoal.is_primary) {
        // Buscar el objetivo activo más reciente
        const activeGoals = updatedGoals.filter((goal: any) => !goal.archived);
        if (activeGoals.length > 0) {
          // Ordenar por fecha de actualización (más reciente primero)
          activeGoals.sort((a: any, b: any) => 
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
          
          // Marcar el primero como principal
          updatedGoals.forEach((goal: any) => {
            goal.is_primary = goal.id === activeGoals[0].id;
          });
        }
      }
      
      // Guardar cambios
      localStorage.setItem("goals", JSON.stringify(updatedGoals));
      
      // Actualizar estado
      setGoals(updatedGoals.filter((goal: any) => !goal.archived));
      const newPrimary = updatedGoals.find((goal: any) => goal.is_primary && !goal.archived);
      setPrimaryGoal(newPrimary || (updatedGoals.length > 0 ? updatedGoals[0] : null));
      
      // Evento de analytics: goal_archived
      console.log(`Analytics: goal_archived (goal_id: ${goalId})`);
    } catch (err) {
      console.error("Error al archivar objetivo:", err);
    }
  };
  
  // Datos simulados para el gráfico de evolución
  const generateChartData = () => {
    const data = [];
    const now = new Date();
    
    // Generar datos según el timeframe seleccionado
    let days = 30;
    if (activeTimeframe === "7D") days = 7;
    if (activeTimeframe === "90D") days = 90;
    if (activeTimeframe === "180D") days = 180;
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - (days - i - 1));
      
      data.push({
        date: date.toISOString().split('T')[0],
        value: Math.floor(Math.random() * 50) + 10
      });
    }
    
    return data;
  };
  
  const chartData = generateChartData();
  
  // Función para manejar el cambio de timeframe
  const handleTimeframeChange = (timeframe: string) => {
    setActiveTimeframe(timeframe);
    
    // Evento de analytics: savings_evolution_range_changed
    console.log(`Analytics: savings_evolution_range_changed (range: ${timeframe})`);
  };
  
  // Función para navegar a la pregunta del día
  const handleDailyQuestion = () => {
    if (hasAnsweredToday) {
      // Si ya respondió, ir a la pantalla de impacto
      router.push("/impact/latest");
      
      // Evento de analytics: dashboard_motivation_cta_clicked
      console.log("Analytics: dashboard_motivation_cta_clicked (status: completed)");
    } else {
      // Si no ha respondido, ir a la pregunta del día
      router.push("/daily");
      
      // Evento de analytics: dashboard_motivation_cta_clicked
      console.log("Analytics: dashboard_motivation_cta_clicked (status: pending)");
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ahorro-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-text-primary">Hola, {userName}</h1>
              <p className="text-text-secondary mt-1">Tus ahorros crecen mientras brilla el día. ✨</p>
            </div>
            <div className="flex items-center">
              <div className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                <span>SISTEMA ACTIVO</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Objetivo Principal */}
            {primaryGoal ? (
              <Card className="overflow-hidden">
                <CardHeader className="bg-ahorro-50 py-4 px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-ahorro-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                      </svg>
                      <span className="text-xs uppercase tracking-wider text-ahorro-600 font-medium">OBJETIVO PRINCIPAL</span>
                    </div>
                    {primaryGoal.months && (
                      <div className="bg-ahorro-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                        {primaryGoal.months} MESES
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <h2 className="text-2xl font-semibold text-text-primary mb-4">{primaryGoal.title}</h2>
                  
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-2xl font-bold">
                      {formatCurrency(primaryGoal.current_amount)}
                      <span className="text-text-secondary text-sm font-normal ml-1">/ {formatCurrency(primaryGoal.target_amount)}</span>
                    </div>
                    <div className="text-ahorro-600 text-xl font-bold">
                      {calculateProgress(primaryGoal.current_amount, primaryGoal.target_amount).toFixed(0)}%
                    </div>
                  </div>
                  
                  <Progress 
                    value={calculateProgress(primaryGoal.current_amount, primaryGoal.target_amount)} 
                    className="mb-4" 
                    size="md" 
                    color="blue" 
                  />
                  
                  <p className="text-text-secondary text-sm">
                    Te faltan <span className="font-semibold">{formatCurrency(primaryGoal.target_amount - primaryGoal.current_amount)}</span> para completar tu meta. ¡Sigue así!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-ahorro-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <h3 className="text-xl font-medium text-text-primary mb-2">No tienes objetivos</h3>
                  <p className="text-text-secondary mb-4">Crea tu primer objetivo para comenzar a ahorrar</p>
                  <Button 
                    variant="primary" 
                    onClick={() => router.push("/goals/new")}
                  >
                    Crear objetivo
                  </Button>
                </CardContent>
              </Card>
            )}
            
            {/* Widget Ingresos mensuales (condicional) */}
            {incomeRange && (
              <Card className="overflow-hidden">
                <CardHeader className="py-4 px-6">
                  <CardTitle className="text-lg font-medium">Ingresos mensuales</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="text-xl font-semibold">
                    {incomeRange === "income_1" && "Menos de 1.000€"}
                    {incomeRange === "income_2" && "Entre 1.000€ y 2.000€"}
                    {incomeRange === "income_3" && "Entre 2.000€ y 3.000€"}
                    {incomeRange === "income_4" && "Más de 3.000€"}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Evolución del Ahorro */}
            <Card className="overflow-hidden">
              <CardHeader className="py-4 px-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium">Evolución del Ahorro</CardTitle>
                  <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                    {['7D', '30D', '90D', '180D'].map((timeframe) => (
                      <button
                        key={timeframe}
                        className={`text-xs px-3 py-1 rounded-lg ${activeTimeframe === timeframe ? 'bg-ahorro-600 text-white' : 'text-text-secondary'}`}
                        onClick={() => handleTimeframeChange(timeframe)}
                      >
                        {timeframe}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {chartData.length > 0 ? (
                  <div className="h-48 flex items-end justify-between">
                    {chartData.map((item, index) => (
                      <div key={index} className="flex flex-col items-center">
                        <div 
                          className="w-6 bg-ahorro-500 rounded-t-sm" 
                          style={{ height: `${item.value * 2}px` }}
                        ></div>
                        {index % Math.ceil(chartData.length / 7) === 0 && (
                          <span className="text-xs text-text-secondary mt-2">{item.date.split('-')[2]}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center">
                    <p className="text-text-secondary">No hay datos suficientes para mostrar la evolución</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-6">
            {/* Tarjeta CTA "Tu decisión de hoy" */}
            <Card className={`overflow-hidden ${hasAnsweredToday ? 'bg-green-50 border-green-100' : 'bg-ahorro-50 border-ahorro-100'}`}>
              <CardContent className="p-6">
                <h3 className="text-lg font-medium mb-2">
                  {hasAnsweredToday ? 'Decisión de hoy completada' : 'Tu decisión de hoy'}
                </h3>
                <p className="text-text-secondary mb-4">
                  {hasAnsweredToday 
                    ? '¡Genial! Has completado tu decisión financiera de hoy.' 
                    : 'Responde a la pregunta diaria para avanzar en tus objetivos.'}
                </p>
                <Button 
                  variant={hasAnsweredToday ? "outline" : "primary"}
                  onClick={handleDailyQuestion}
                  fullWidth
                >
                  {hasAnsweredToday ? 'Ver impacto' : 'Responder ahora'}
                </Button>
              </CardContent>
            </Card>
            
            {/* Mis Objetivos */}
            <Card className="overflow-hidden">
              <CardHeader className="py-4 px-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium">Mis Objetivos</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => router.push("/goals/new")}
                  >
                    + Nuevo
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {goals.length > 0 ? (
                  <div className="space-y-4">
                    {goals.map((goal) => (
                      <div key={goal.id} className="border rounded-xl overflow-hidden">
                        <div className="bg-ahorro-50 py-3 px-4">
                          <div className="flex items-center">
                            <div className="bg-white p-1 rounded mr-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-ahorro-600" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-sm font-medium">{goal.title}</h3>
                              {goal.months && (
                                <p className="text-xs text-text-secondary">{goal.months} MESES</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="p-4">
                          <Progress 
                            value={calculateProgress(goal.current_amount, goal.target_amount)} 
                            className="mb-2" 
                            size="sm" 
                            color="blue" 
                          />
                          <div className="flex items-center justify-between text-sm">
                            <span>{formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}</span>
                            <span className="text-ahorro-600">{calculateProgress(goal.current_amount, goal.target_amount).toFixed(0)}%</span>
                          </div>
                          <div className="mt-3 text-right">
                            <button 
                              className="text-xs text-accent-red hover:underline"
                              onClick={() => handleArchiveGoal(goal.id)}
                            >
                              Archivar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-text-secondary mb-4">No tienes objetivos activos</p>
                    <Button 
                      variant="primary" 
                      onClick={() => router.push("/goals/new")}
                    >
                      Crear objetivo
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Tarjeta motivacional */}
            <Card className="bg-ahorro-600 text-white overflow-hidden">
              <CardContent className="p-6">
                <h3 className="text-2xl font-bold mb-2">Tu Ahorro es Imparable.</h3>
                <p className="text-white/80 mb-6">Intensidad:</p>
                <div className="mb-1 font-medium">MEDIUM</div>
                <p className="text-sm text-white/80 mb-6">¡Vas por buen camino!</p>
                
                <Button 
                  variant="outline" 
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                  onClick={handleDailyQuestion}
                >
                  {hasAnsweredToday ? 'VER IMPACTO' : 'RESPONDER AHORA'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
