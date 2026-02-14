"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';

export default function HomePage() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [userName, setUserName] = useState('');
  const [savingsProgress, setSavingsProgress] = useState(0);
  const [recentDecisions, setRecentDecisions] = useState<any[]>([]);
  
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-blue-600 text-white p-6">
        <h1 className="text-xl font-semibold">Hola, {userName}</h1>
        <p className="text-sm opacity-90">Resumen de tu ahorro invisible</p>
      </div>
      
      {/* Tarjeta principal */}
      <div className="px-4 -mt-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-700">Tu progreso</h2>
            <span className="text-sm text-gray-500">Meta: {formatCurrency(userData.savingGoal)}</span>
          </div>
          
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-medium">{formatCurrency(userData.currentSaving)}</span>
            <span>{savingsProgress.toFixed(0)}%</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${Math.min(savingsProgress, 100)}%` }}
            ></div>
          </div>
          
          <button
            onClick={handleAddSaving}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Añadir ahorro de 5€
          </button>
        </div>
      </div>
      
      {/* Actividad reciente */}
      <div className="px-4 mt-6">
        <h2 className="text-lg font-medium text-gray-700 mb-3">Actividad reciente</h2>
        
        {recentDecisions.length > 0 ? (
          <div className="bg-white rounded-xl shadow-lg divide-y">
            {recentDecisions.map((decision) => (
              <div key={decision.id} className="p-4 flex items-center">
                <div className={`rounded-full p-2 mr-3 ${
                  decision.type === 'saving' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {decision.type === 'saving' ? (
                    <ArrowUpIcon className="h-5 w-5 text-green-600" />
                  ) : (
                    <ArrowDownIcon className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">{decision.description}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(decision.date).toLocaleDateString()}
                  </p>
                </div>
                <span className={`font-medium ${
                  decision.type === 'saving' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {decision.type === 'saving' ? '+' : '-'}{formatCurrency(decision.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <p className="text-gray-500">No hay actividad reciente</p>
          </div>
        )}
      </div>
      
      {/* Consejos de ahorro */}
      <div className="px-4 mt-6">
        <h2 className="text-lg font-medium text-gray-700 mb-3">Consejos de ahorro</h2>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="font-medium text-gray-800 mb-2">Ahorra en tus compras diarias</h3>
          <p className="text-gray-600 text-sm">
            Compara precios antes de comprar y aprovecha las ofertas para ahorrar más sin esfuerzo.
          </p>
        </div>
      </div>
    </div>
  );
}
