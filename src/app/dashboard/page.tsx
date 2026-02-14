"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { analytics } from '@/services/analytics';

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

interface DailyStatus {
  date: string;
  status: 'pending' | 'completed';
  decision_id: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [primaryGoal, setPrimaryGoal] = useState<Goal | null>(null);
  const [dailyStatus, setDailyStatus] = useState<DailyStatus>({
    date: new Date().toISOString().split('T')[0],
    status: 'pending',
    decision_id: null
  });
  const [incomeRange, setIncomeRange] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Rangos de tiempo para la evolución del ahorro
  const [savingsRange, setSavingsRange] = useState('30d');
  
  useEffect(() => {
    // Establecer el nombre de la pantalla para analytics
    analytics.setScreen('dashboard');
    
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
  
  const loadData = () => {
    try {
      setIsLoading(true);
      
      // Cargar nombre de usuario
      const storedName = localStorage.getItem("userName");
      if (storedName) {
        setUserName(storedName);
      }
      
      // Cargar objetivos
      const storedGoals = localStorage.getItem("goals");
      if (storedGoals) {
        const parsedGoals = JSON.parse(storedGoals);
        
        // Filtrar objetivos no archivados
        const activeGoals = parsedGoals.filter((goal: Goal) => !goal.archived);
        setGoals(activeGoals);
        
        // Encontrar objetivo principal
        const primary = activeGoals.find((goal: Goal) => goal.is_primary);
        if (primary) {
          setPrimaryGoal(primary);
          analytics.goalPrimaryWidgetViewed();
        } else if (activeGoals.length > 0) {
          // Si no hay primary pero hay objetivos, establecer el primero como primary
          const updatedGoals = activeGoals.map((goal: Goal, index: number) => ({
            ...goal,
            is_primary: index === 0
          }));
          setPrimaryGoal(updatedGoals[0]);
          localStorage.setItem("goals", JSON.stringify([
            ...updatedGoals,
            ...parsedGoals.filter((goal: Goal) => goal.archived)
          ]));
        }
      }
      
      // Cargar rango de ingresos del onboarding
      const storedIncomeRange = localStorage.getItem("onboarding_income_range");
      if (storedIncomeRange) {
        setIncomeRange(storedIncomeRange);
        analytics.incomeRangeViewed();
      }
      
      // Verificar estado de la decisión diaria
      const today = new Date().toISOString().split('T')[0];
      const storedDecisions = localStorage.getItem("dailyDecisions");
      
      if (storedDecisions) {
        const decisions = JSON.parse(storedDecisions);
        const todayDecision = decisions.find((d: any) => d.date.startsWith(today));
        
        if (todayDecision) {
          setDailyStatus({
            date: today,
            status: 'completed',
            decision_id: todayDecision.id
          });
        }
      }
      
      // Registrar eventos de visualización de widgets
      analytics.dailyCtaCardViewed(dailyStatus.status);
      analytics.goalsWidgetViewed();
      analytics.dashboardViewed(
        dailyStatus.status, 
        goals.length, 
        !!primaryGoal, 
        !!incomeRange
      );
      
    } catch (error) {
      console.error("Error al cargar datos:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDailyAction = () => {
    if (dailyStatus.status === 'pending') {
      analytics.dailyCtaClicked('pending', 'daily_question');
      router.push('/daily');
    } else {
      analytics.dailyCtaClicked('completed', 'impact');
      router.push(`/impact/${dailyStatus.decision_id}`);
    }
  };
  
  const handleMotivationAction = () => {
    if (dailyStatus.status === 'pending') {
      analytics.motivationCtaClicked('pending', 'daily_question');
      router.push('/daily');
    } else {
      analytics.motivationCtaClicked('completed', 'impact');
      router.push(`/impact/${dailyStatus.decision_id}`);
    }
  };
  
  const handleCreateGoal = () => {
    analytics.goalCreateStarted('dashboard');
    router.push('/goals/new');
  };
  
  const handleArchiveGoal = (goalId: string, isPrimary: boolean) => {
    try {
      const storedGoals = localStorage.getItem("goals");
      if (!storedGoals) return;
      
      const parsedGoals = JSON.parse(storedGoals);
      
      // Marcar el objetivo como archivado
      const updatedGoals = parsedGoals.map((goal: Goal) => {
        if (goal.id === goalId) {
          return { ...goal, archived: true, is_primary: false };
        }
        return goal;
      });
      
      // Si era el objetivo principal, promover otro objetivo como principal
      if (isPrimary) {
        const activeGoals = updatedGoals.filter((goal: Goal) => !goal.archived);
        if (activeGoals.length > 0) {
          // Promover el objetivo activo más reciente
          const sortedActiveGoals = [...activeGoals].sort((a, b) => 
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
          
          updatedGoals.forEach((goal: Goal) => {
            if (goal.id === sortedActiveGoals[0].id) {
              goal.is_primary = true;
            }
          });
        }
      }
      
      // Guardar cambios
      localStorage.setItem("goals", JSON.stringify(updatedGoals));
      
      // Actualizar estado
      loadData();
      
      // Registrar evento de objetivo archivado
      analytics.goalArchived(goalId, isPrimary);
    } catch (error) {
      console.error("Error al archivar objetivo:", error);
    }
  };
  
  const handleSavingsRangeChange = (range: string) => {
    setSavingsRange(range);
    analytics.savingsEvolutionRangeChanged(range, 'demo');
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
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-text-primary">Hola, {userName}</h1>
            <p className="text-text-secondary">Tu ahorro invisible en acción</p>
          </div>
          <div className="flex items-center">
            <div className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
              <span>SISTEMA ACTIVO</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Objetivo Principal */}
      {primaryGoal ? (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-ahorro-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
              </svg>
              <span className="text-xs uppercase tracking-wider text-ahorro-600 font-medium">OBJETIVO PRINCIPAL</span>
            </div>
            {primaryGoal.time_horizon_months && (
              <div className="bg-ahorro-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                {primaryGoal.time_horizon_months} MESES
              </div>
            )}
          </div>
          
          <div className="flex flex-col">
            <h2 className="text-xl font-semibold text-text-primary mb-4">{primaryGoal.title}</h2>
            
            <div className="flex items-center justify-between mb-2">
              <div className="text-xl font-bold">
                {formatCurrency(primaryGoal.current_amount)}
                <span className="text-text-secondary text-sm font-normal ml-1">/ {formatCurrency(primaryGoal.target_amount)}</span>
              </div>
              <div className="text-ahorro-600 text-lg font-bold">
                {Math.round((primaryGoal.current_amount / primaryGoal.target_amount) * 100)}%
              </div>
            </div>
            
            <Progress 
              value={(primaryGoal.current_amount / primaryGoal.target_amount) * 100} 
              className="mb-4" 
              size="md" 
              color="blue" 
            />
            
            <p className="text-text-secondary text-sm">
              Te faltan <span className="font-semibold">{formatCurrency(primaryGoal.target_amount - primaryGoal.current_amount)}</span> para completar tu meta. ¡Sigue así!
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <Card className="p-6 text-center">
            <p className="text-text-secondary mb-4">No tienes ningún objetivo configurado.</p>
            <Button variant="primary" onClick={handleCreateGoal}>
              Crear objetivo
            </Button>
          </Card>
        </div>
      )}
      
      {/* Ingresos mensuales (si existe) */}
      {incomeRange && (
        <div className="mb-8">
          <Card className="p-4">
            <CardTitle className="text-sm font-medium mb-2">Ingresos mensuales</CardTitle>
            <div className="text-text-primary">
              {incomeRange === "below_1000" && "Menos de 1.000€"}
              {incomeRange === "1000_2000" && "Entre 1.000€ y 2.000€"}
              {incomeRange === "2000_3500" && "Entre 2.000€ y 3.500€"}
              {incomeRange === "above_3500" && "Más de 3.500€"}
            </div>
          </Card>
        </div>
      )}
      
      {/* Mis Objetivos */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Mis objetivos</h2>
          <Button variant="primary" size="sm" onClick={handleCreateGoal}>
            + Nuevo objetivo
          </Button>
        </div>
        
        {goals.length > 0 ? (
          <div className="space-y-4">
            {goals.map(goal => (
              <Card key={goal.id} bordered={goal.is_primary} className="overflow-hidden">
                <CardHeader className="bg-ahorro-50 py-3 px-4">
                  <div className="flex items-center">
                    <div className="bg-white p-1 rounded mr-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-ahorro-600" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">{goal.title}</h3>
                      {goal.time_horizon_months && (
                        <p className="text-xs text-text-secondary">{goal.time_horizon_months} MESES</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <Progress 
                    value={(goal.current_amount / goal.target_amount) * 100} 
                    className="mb-2" 
                    size="sm" 
                    color="blue" 
                  />
                  <div className="flex items-center justify-between text-sm">
                    <span>{formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}</span>
                    <span className="text-ahorro-600">{Math.round((goal.current_amount / goal.target_amount) * 100)}%</span>
                  </div>
                  <div className="mt-3 text-right">
                    <button 
                      className="text-xs text-accent-red hover:underline"
                      onClick={() => handleArchiveGoal(goal.id, goal.is_primary)}
                    >
                      Archivar
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-text-secondary mb-4">No tienes objetivos activos</p>
            <Button variant="primary" onClick={handleCreateGoal}>
              Nuevo objetivo
            </Button>
          </Card>
        )}
      </div>
      
      {/* Tarjeta CTA "Tu decisión de hoy" */}
      <div className="mb-8">
        <Card className={`p-6 ${dailyStatus.status === 'pending' ? 'border-2 border-ahorro-500' : ''}`}>
          <CardHeader>
            <CardTitle>Decisión del día</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyStatus.status === 'pending' ? (
              <>
                <p className="mb-4">Una pequeña decisión diaria puede generar un gran impacto en tus finanzas.</p>
                <Button 
                  variant="primary" 
                  fullWidth 
                  onClick={handleDailyAction}
                >
                  Responder ahora
                </Button>
              </>
            ) : (
              <>
                <p className="mb-4">¡Ya has tomado tu decisión del día! Revisa el impacto en tu objetivo.</p>
                <Button 
                  variant="outline" 
                  fullWidth 
                  onClick={handleDailyAction}
                >
                  Ver impacto
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Evolución del ahorro */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Evolución del ahorro</h2>
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {['7D', '30D', '90D'].map((range) => (
              <button
                key={range}
                className={`text-xs px-3 py-1 rounded-lg ${savingsRange === range.toLowerCase() ? 'bg-ahorro-600 text-white' : 'text-text-secondary'}`}
                onClick={() => handleSavingsRangeChange(range.toLowerCase())}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        
        <Card className="p-6">
          <div className="flex items-center justify-center h-48 text-text-secondary">
            <div className="text-center">
              <p>Aún no hay datos.</p>
              <Button 
                variant="primary" 
                size="sm" 
                className="mt-4"
                onClick={handleDailyAction}
              >
                {dailyStatus.status === 'pending' ? 'Responder ahora' : 'Ver impacto'}
              </Button>
            </div>
          </div>
          <div className="text-xs text-text-secondary text-center mt-2">
            <span className="bg-gray-100 px-2 py-1 rounded">Modo demo</span>
          </div>
        </Card>
      </div>
      
      {/* Tarjeta motivacional */}
      <div>
        <Card className="bg-ahorro-600 text-white overflow-hidden">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold mb-2">Cada decisión cuenta</h3>
            <p className="text-white/80 mb-6">Pequeñas decisiones, grandes resultados</p>
            
            <Button 
              variant="outline" 
              className="bg-white/20 border-white/30 text-white hover:bg-white/30"
              onClick={handleMotivationAction}
            >
              {dailyStatus.status === 'pending' ? 'Responder ahora' : 'Ver impacto'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
