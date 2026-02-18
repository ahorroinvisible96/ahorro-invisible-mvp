"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { analytics } from '@/services/analytics';

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [incomeRange, setIncomeRange] = useState('');
  const [savingsGoal, setSavingsGoal] = useState('10');
  const [savingsFrequency, setSavingsFrequency] = useState('weekly');
  
  useEffect(() => {
    // Establecer el nombre de la pantalla para analytics
    analytics.setScreen('settings');
    
    // Verificar autenticación
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated !== "true") {
      router.replace("/signup");
      return;
    }
    
    // Cargar datos
    loadSettings();
  }, [router]);
  
  const loadSettings = () => {
    try {
      setIsLoading(true);
      
      // Cargar rango de ingresos
      const storedIncomeRange = localStorage.getItem("onboarding_income_range");
      if (storedIncomeRange) {
        setIncomeRange(storedIncomeRange);
      }
      
      // Cargar objetivo de ahorro (simulado)
      const storedSavingsGoal = localStorage.getItem("savings_goal");
      if (storedSavingsGoal) {
        setSavingsGoal(storedSavingsGoal);
      }
      
      // Cargar frecuencia de ahorro (simulado)
      const storedSavingsFrequency = localStorage.getItem("savings_frequency");
      if (storedSavingsFrequency) {
        setSavingsFrequency(storedSavingsFrequency);
      }
      
      // Registrar evento de visualización
      analytics.settingsViewed();
      
    } catch (error) {
      console.error("Error al cargar configuración:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSaveSettings = () => {
    try {
      // Guardar objetivo de ahorro
      localStorage.setItem("savings_goal", savingsGoal);
      
      // Guardar frecuencia de ahorro
      localStorage.setItem("savings_frequency", savingsFrequency);
      
      // Registrar evento
      analytics.settingsUpdated();
      
      // Mostrar mensaje de éxito (simulado)
      alert("Configuración guardada correctamente");
      
    } catch (error) {
      console.error("Error al guardar configuración:", error);
    }
  };
  
  const handleResetOnboarding = () => {
    try {
      // Eliminar datos de onboarding
      localStorage.removeItem("hasCompletedOnboarding");
      localStorage.removeItem("onboarding_income_range");
      
      // Registrar evento
      analytics.onboardingReset();
      
      // Redirigir a onboarding
      router.replace("/onboarding");
      
    } catch (error) {
      console.error("Error al reiniciar onboarding:", error);
    }
  };
  
  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout
      title="Configuración"
      subtitle="Personaliza tu experiencia de ahorro"
    >
      <div className="space-y-8">
        <Card variant="default" size="md">
          <Card.Header title="Configuración de Ahorro" />
          <Card.Content>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rango de Ingresos
                </label>
                <select
                  value={incomeRange}
                  onChange={(e) => setIncomeRange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="0-1000">Menos de 1.000€</option>
                  <option value="1000-2000">1.000€ - 2.000€</option>
                  <option value="2000-3500">2.000€ - 3.500€</option>
                  <option value="3500-5000">3.500€ - 5.000€</option>
                  <option value="5000+">Más de 5.000€</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Objetivo de Ahorro (%)
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={savingsGoal}
                  onChange={(e) => setSavingsGoal(e.target.value)}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-gray-500">5%</span>
                  <span className="text-sm font-medium text-primary-500">{savingsGoal}%</span>
                  <span className="text-xs text-gray-500">50%</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frecuencia de Ahorro
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="daily"
                      checked={savingsFrequency === 'daily'}
                      onChange={() => setSavingsFrequency('daily')}
                      className="h-4 w-4 text-primary-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Diario</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="weekly"
                      checked={savingsFrequency === 'weekly'}
                      onChange={() => setSavingsFrequency('weekly')}
                      className="h-4 w-4 text-primary-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Semanal</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="monthly"
                      checked={savingsFrequency === 'monthly'}
                      onChange={() => setSavingsFrequency('monthly')}
                      className="h-4 w-4 text-primary-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Mensual</span>
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSaveSettings}
                >
                  Guardar Configuración
                </Button>
              </div>
            </div>
          </Card.Content>
        </Card>
        
        <Card variant="default" size="md">
          <Card.Header title="Notificaciones" />
          <Card.Content>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Recordatorios diarios</h3>
                  <p className="text-xs text-gray-500">Recibe un recordatorio para tomar tu decisión diaria</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Resumen semanal</h3>
                  <p className="text-xs text-gray-500">Recibe un resumen de tu progreso cada semana</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                </label>
              </div>
            </div>
          </Card.Content>
        </Card>
        
        <Card variant="default" size="md">
          <Card.Header title="Datos y Privacidad" />
          <Card.Content>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Datos de la aplicación</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Puedes reiniciar tu proceso de onboarding si deseas cambiar tus preferencias iniciales.
                </p>
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleResetOnboarding}
                >
                  Reiniciar Onboarding
                </Button>
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-red-600 mb-2">
                  Eliminar todos los datos
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Esta acción eliminará permanentemente todos tus datos de la aplicación.
                </p>
                <Button
                  variant="outline"
                  size="md"
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  Eliminar Todos los Datos
                </Button>
              </div>
            </div>
          </Card.Content>
        </Card>
      </div>
    </AppLayout>
  );
}
