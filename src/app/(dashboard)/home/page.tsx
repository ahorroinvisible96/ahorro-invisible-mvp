"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { Progress } from '@/components/ui/Progress/Progress';

export default function HomePage() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [userName, setUserName] = useState('');
  const [savingsProgress, setSavingsProgress] = useState(0);
  const [recentDecisions, setRecentDecisions] = useState<any[]>([]);
  const [activeTimeframe, setActiveTimeframe] = useState('1M');
  const [goalName, setGoalName] = useState('Viaje a Japón');
  
  useEffect(() => {
    // Verificar autenticación
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated !== "true") {
      router.replace("/login");
      return;
    }
    
    // Verificar onboarding
    const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding");
    if (hasCompletedOnboarding !== "true") {
      router.replace("/onboarding");
      return;
    }
    
    // Cargar datos del usuario
    try {
      const storedUserData = localStorage.getItem("userData");
      const storedUserName = localStorage.getItem("userName");
      const storedDecisions = localStorage.getItem("dailyDecisions");
      
      if (storedUserData) {
        const parsedUserData = JSON.parse(storedUserData);
        setUserData(parsedUserData);
        setSavingsProgress(
          (parsedUserData.currentSaving / parsedUserData.savingGoal) * 100
        );
      }
      
      if (storedUserName) {
        setUserName(storedUserName);
      }
      
      if (storedDecisions) {
        const parsedDecisions = JSON.parse(storedDecisions);
        setRecentDecisions(parsedDecisions.slice(0, 3));
      }
    } catch (err) {
      console.error("Error al cargar datos:", err);
    }
  }, [router]);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };
  
  const handleAddSaving = () => {
    try {
      const amount = 5; // Monto fijo para simplificar
      
      // Actualizar datos del usuario
      if (userData) {
        const updatedUserData = {
          ...userData,
          currentSaving: userData.currentSaving + amount,
          lastUpdated: new Date().toISOString()
        };
        
        // Guardar decisión
        const newDecision = {
          id: Date.now(),
          type: 'saving',
          amount,
          date: new Date().toISOString(),
          description: 'Ahorro manual'
        };
        
        const storedDecisions = localStorage.getItem("dailyDecisions");
        const decisions = storedDecisions ? JSON.parse(storedDecisions) : [];
        decisions.unshift(newDecision);
        
        // Actualizar localStorage
        localStorage.setItem("userData", JSON.stringify(updatedUserData));
        localStorage.setItem("dailyDecisions", JSON.stringify(decisions));
        
        // Actualizar estado
        setUserData(updatedUserData);
        setSavingsProgress(
          (updatedUserData.currentSaving / updatedUserData.savingGoal) * 100
        );
        setRecentDecisions(decisions.slice(0, 3));
      }
    } catch (err) {
      console.error("Error al añadir ahorro:", err);
    }
  };
  
  if (!userData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ahorro-500"></div>
      </div>
    );
  }
  
  // Datos para el gráfico de barras (simulados)
  const barChartData = [
    { month: 'Ene', value: 20 },
    { month: 'Feb', value: 35 },
    { month: 'Mar', value: 25 },
    { month: 'Abr', value: 40 },
    { month: 'May', value: 30 },
    { month: 'Jun', value: 45 },
    { month: 'Jul', value: 55 },
    { month: 'Ago', value: 50 },
    { month: 'Sep', value: 60 },
    { month: 'Oct', value: 70 },
    { month: 'Nov', value: 65 },
    { month: 'Dic', value: 75 },
  ];
  
  return (
    <div className="p-6 bg-background">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-text-primary">Hola, {userName}</h1>
            <p className="text-text-secondary mt-1">Tus ahorros crecen mientras brilla el día. ✨</p>
          </div>
          <div className="flex items-center">
            <div className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full flex items-center mr-3">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
              <span>SISTEMA ACTIVO</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Objetivo Principal */}
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
          <h2 className="text-2xl font-semibold text-text-primary mb-4">{goalName}</h2>
          
          <div className="flex items-center justify-between mb-2">
            <div className="text-2xl font-bold">
              {formatCurrency(userData.currentSaving)}
              <span className="text-text-secondary text-sm font-normal ml-1">/ {formatCurrency(userData.savingGoal)}</span>
            </div>
            <div className="text-ahorro-600 text-xl font-bold">
              {savingsProgress.toFixed(0)}%
            </div>
          </div>
          
          <Progress 
            value={savingsProgress} 
            className="mb-4" 
            size="md" 
            color="blue" 
          />
          
          <p className="text-text-secondary text-sm">
            Te faltan <span className="font-semibold">{formatCurrency(userData.savingGoal - userData.currentSaving)}</span> para completar tu meta. ¡Sigue así!
          </p>
        </div>
      </div>
      
      {/* Mis Objetivos */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-text-primary">Mis Objetivos</h2>
          <Button variant="primary" size="sm">
            + Nuevo Objetivo
          </Button>
        </div>
        
        <Card variant="default" size="md" className="overflow-hidden">
          <Card.Content className="bg-ahorro-50 py-3 px-4">
            <div className="flex items-center">
              <div className="bg-white p-1 rounded mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-ahorro-600" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium">{goalName}</h3>
                <p className="text-xs text-text-secondary">12 MESES</p>
              </div>
            </div>
          </Card.Content>
          <Card.Content className="p-4">
            <Progress 
              value={savingsProgress} 
              className="mb-2" 
              size="sm" 
              color="blue" 
            />
            <div className="flex items-center justify-between text-sm">
              <span>{formatCurrency(userData.currentSaving)} / {formatCurrency(userData.savingGoal)}</span>
              <span className="text-ahorro-600">{savingsProgress.toFixed(0)}%</span>
            </div>
            <div className="mt-3 text-right">
              <button className="text-xs text-accent-red hover:underline">Archivar</button>
            </div>
          </Card.Content>
        </Card>
      </div>
      
      {/* Evolución del Ahorro */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-text-primary">Evolución del Ahorro</h2>
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {['1D', '1S', '1M', '3M', '6M', '1A'].map((timeframe) => (
              <button
                key={timeframe}
                className={`text-xs px-3 py-1 rounded-lg ${activeTimeframe === timeframe ? 'bg-ahorro-600 text-white' : 'text-text-secondary'}`}
                onClick={() => setActiveTimeframe(timeframe)}
              >
                {timeframe}
              </button>
            ))}
          </div>
        </div>
        
        <Card variant="default" size="md" className="p-4">
          <div className="h-48 flex items-end justify-between">
            {barChartData.map((bar, index) => (
              <div key={index} className="flex flex-col items-center">
                <div 
                  className="w-6 bg-ahorro-500 rounded-t-sm" 
                  style={{ height: `${bar.value * 2}px` }}
                ></div>
                <span className="text-xs text-text-secondary mt-2">{bar.month}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      
      {/* Tarjeta de Ahorro */}
      <div>
        <Card variant="default" size="md" className="bg-ahorro-600 text-white overflow-hidden">
          <Card.Content className="p-6">
            <h3 className="text-2xl font-bold mb-2">Tu Ahorro es Imparable.</h3>
            <p className="text-white/80 mb-6">Intensidad:</p>
            <div className="mb-1 font-medium">MEDIUM</div>
            <p className="text-sm text-white/80 mb-6">¡Vas por buen camino!</p>
            
            <Button variant="outline" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
              AJUSTAR REGLAS
            </Button>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
