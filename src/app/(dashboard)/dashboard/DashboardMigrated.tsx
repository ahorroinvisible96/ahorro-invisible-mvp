"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background-main)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }
  
  return (
    <div className="p-6" style={{ backgroundColor: 'var(--color-background-main)' }}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="mb-6">
            <h1 className="text-[32px] font-semibold mb-2 text-gray-800">Hola, {userName}</h1>
            <p className="text-gray-500">Tus ahorros crecen mientras brilla el día. ✨</p>
          </div>
          <div className="flex items-center">
            <Badge 
              variant="success" 
              size="md" 
              shape="pill" 
              withDot 
              pulse 
              uppercase 
              bold
            >
              SISTEMA ACTIVO
            </Badge>
          </div>
        </div>
      </div>
      
      {/* Objetivo Principal */}
      {primaryGoal ? (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
              </svg>
              <Badge variant="primary" size="sm" uppercase>OBJETIVO PRINCIPAL</Badge>
            </div>
            <Badge variant="solid" size="md">12 MESES</Badge>
          </div>
          
          <Card variant="highlight" size="md">
            <Card.Content>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Viaje a Japón</h2>
              
              <div className="flex items-center justify-between mb-2">
                <div className="text-2xl font-bold">
                  1500€
                  <span className="text-gray-500 text-sm font-normal ml-1">/ 5000€</span>
                </div>
                <div className="text-xl font-bold text-primary-500">
                  30%
                </div>
              </div>
              
              <Progress 
                value={30} 
                variant="gradient" 
                size="md"
              />
              
              <p className="text-gray-500 text-sm mt-4">
                Te faltan <span className="font-semibold">3500€</span> para completar tu meta. ¡Sigue así!
              </p>
            </Card.Content>
          </Card>
        </div>
      ) : (
        <div className="mb-8">
          <Card size="md">
            <Card.Content className="text-center">
              <p className="text-gray-600 mb-4">No tienes ningún objetivo configurado.</p>
              <Button variant="primary" size="md" onClick={handleCreateGoal}>
                Crear objetivo
              </Button>
            </Card.Content>
          </Card>
        </div>
      )}
      
      {/* Ingresos mensuales */}
      <div className="mb-8">
        <Badge variant="default" size="sm" uppercase>INGRESOS MENSUALES</Badge>
        <div className="text-xl font-semibold text-gray-800 mt-2">
          2.000 - 3.500 €
        </div>
      </div>
      
      {/* Mis Objetivos */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Mis Objetivos</h2>
          <Button 
            variant="primary" 
            size="md" 
            onClick={handleCreateGoal}
          >
            + Nuevo Objetivo
          </Button>
        </div>
        
        <Card variant="primary" size="md" interactive>
          <Card.Content>
            <div className="flex items-center mb-3">
              <div className="bg-blue-50 p-2 rounded-lg mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-800">Viaje a Japón</h3>
                <p className="text-xs text-gray-500">12 MESES</p>
              </div>
              <div className="ml-auto">
                <Badge variant="solid" size="sm">PRINCIPAL</Badge>
              </div>
            </div>
            
            <Progress 
              value={30} 
              variant="primary" 
              size="sm"
            />
            
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-600">1500€ / 5000€</span>
              <span className="font-medium text-primary-500">30%</span>
            </div>
            
            <div className="mt-3 text-right">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleArchiveGoal(primaryGoal?.id || '', true)}
                className="text-red-500"
              >
                Archivar
              </Button>
            </div>
          </Card.Content>
        </Card>
      </div>
      
      {/* Evolución + Tarjeta motivacional en grid */}
      <div className="mb-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Evolución del ahorro */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Evolución del Ahorro</h2>
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              {['7D', '30D', '90D'].map((range) => (
                <button
                  key={range}
                  className={`text-xs px-3 py-1 rounded-lg ${range === '30D' ? 'text-white' : 'text-gray-600'}`}
                  style={range === '30D' ? { backgroundColor: 'var(--color-primary-500)' } : {}}
                  onClick={() => handleSavingsRangeChange(range.toLowerCase())}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <Card variant="default" size="md" rounded2xl>
            <Card.Content>
              <div className="flex items-center justify-center h-48">
                <div className="w-full">
                  <div className="flex justify-center items-end h-40 space-x-2">
                    {[20, 30, 25, 35, 40, 45, 50, 55, 60, 65, 70].map((height, index) => (
                      <div
                        key={index}
                        className="rounded-t-md w-6"
                        style={{ 
                          height: `${height}%`, 
                          background: 'var(--gradient-bar)'
                        }}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-500 text-center mt-2">
                <Badge variant="default" size="sm">Modo demo</Badge>
              </div>
            </Card.Content>
          </Card>
        </div>

        {/* Tarjeta motivacional */}
        <div className="lg:col-span-4">
          <Card variant="gradient" size="md" rounded2xl shadowBlue>
            <Card.Content>
              <h3 className="text-2xl font-bold mb-2 leading-tight">Tu Ahorro es<br/>imparable.</h3>
              <p className="text-white/80 mb-1">Intensidad:</p>
              <p className="text-white font-medium mb-6 leading-snug">MEDIUM - ¡Vas por<br/>buen camino!</p>

              <Button
                variant="outline"
                size="md"
                className="bg-white/20 border border-white/30 text-white hover:bg-white/30 uppercase tracking-wide"
                onClick={handleMotivationAction}
              >
                Ajustar<br/>Reglas
              </Button>
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
