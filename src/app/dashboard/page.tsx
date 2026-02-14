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
            <h1 className="text-2xl font-semibold text-text-primary mb-2">Hola, {userName}</h1>
            <p className="text-text-secondary">Tus ahorros crecen mientras brilla el día. ✨</p>
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
            <div className="bg-ahorro-600 text-white text-xs font-medium px-3 py-1 rounded-full">
              12 MESES
            </div>
          </div>
          
          <div className="flex flex-col">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Viaje a Japón</h2>
            
            <div className="flex items-center justify-between mb-2">
              <div className="text-xl font-bold">
                1500€
                <span className="text-text-secondary text-sm font-normal ml-1">/ 5000€</span>
              </div>
              <div className="text-ahorro-600 text-lg font-bold">
                30%
              </div>
            </div>
            
            <Progress 
              value={30} 
              className="mb-4" 
              size="md" 
              color="blue" 
            />
            
            <p className="text-text-secondary text-sm">
              Te faltan <span className="font-semibold">3500€</span> para completar tu meta. ¡Sigue así!
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
      
      {/* Ingresos mensuales */}
      <div className="mb-8">
        <div className="text-xs uppercase tracking-wider text-text-secondary font-medium mb-2">INGRESOS MENSUALES</div>
        <div className="text-xl font-semibold text-text-primary">
          2.000 - 3.500 €
        </div>
      </div>
      
      {/* Mis Objetivos */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Mis Objetivos</h2>
          <Button variant="primary" size="sm" onClick={handleCreateGoal} className="bg-accent-blue text-white rounded-full">
            + Nuevo Objetivo
          </Button>
        </div>
        
        <div className="border border-ahorro-500 rounded-xl overflow-hidden">
          <div className="bg-white p-4">
            <div className="flex items-center mb-2">
              <div className="bg-white p-1 rounded mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-ahorro-600" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium">Viaje a Japón</h3>
                <p className="text-xs text-text-secondary">12 MESES</p>
              </div>
              <div className="ml-auto">
                <span className="bg-ahorro-500 text-white text-xs px-2 py-1 rounded-md">PRINCIPAL</span>
              </div>
            </div>
            
            <Progress 
              value={30} 
              className="mb-2" 
              size="sm" 
              color="blue" 
            />
            <div className="flex items-center justify-between text-sm">
              <span>1500€ / 5000€</span>
              <span className="text-ahorro-600">30%</span>
            </div>
            <div className="mt-3 text-right">
              <button 
                className="text-xs text-accent-red hover:underline"
              >
                Archivar
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Evolución del ahorro */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Evolución del Ahorro</h2>
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {['7D', '30D', '90D'].map((range) => (
              <button
                key={range}
                className={`text-xs px-3 py-1 rounded-lg ${range === '30D' ? 'bg-ahorro-600 text-white' : 'text-text-secondary'}`}
                onClick={() => handleSavingsRangeChange(range.toLowerCase())}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        
        <div className="p-6 bg-white rounded-xl">
          <div className="flex items-center justify-center h-48">
            <div className="w-full">
              <div className="flex justify-end items-end h-40 space-x-2">
                {[20, 30, 25, 35, 40, 45, 50, 55, 60, 65, 70].map((height, index) => (
                  <div 
                    key={index} 
                    className="bg-ahorro-500 rounded-t-md w-8" 
                    style={{ height: `${height}%` }}
                  ></div>
                ))}
              </div>
            </div>
          </div>
          <div className="text-xs text-text-secondary text-center mt-2">
            <span className="bg-gray-100 px-2 py-1 rounded">Modo demo</span>
          </div>
        </div>
      </div>
      
      {/* Tarjeta motivacional */}
      <div>
        <div className="bg-ahorro-500 text-white overflow-hidden rounded-xl p-6">
          <h3 className="text-xl font-bold mb-2">Tu Ahorro es imparable.</h3>
          <p className="text-white/80 mb-2">Intensidad:</p>
          <p className="text-white font-medium mb-4">MEDIUM - ¡Vas por buen camino!</p>
          
          <button 
            className="bg-white/20 border border-white/30 text-white hover:bg-white/30 px-4 py-2 rounded-lg"
          >
            AJUSTAR REGLAS
          </button>
        </div>
      </div>
    </div>
  );
}
