"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { analytics } from "@/services/analytics";

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

export default function ExtraSavingPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Establecer el nombre de la pantalla para analytics
    analytics.setScreen('extra_saving');
    
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
    
    // Registrar evento de inicio de acción extra
    analytics.extraSavingStarted('impact');
  }, [router]);
  
  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Cargar objetivos
      const storedGoals = localStorage.getItem("goals");
      if (!storedGoals || JSON.parse(storedGoals).filter((g: Goal) => !g.archived).length === 0) {
        // Redirigir a crear objetivo si no hay objetivos activos
        console.log("EVENT: system_redirect", { destination: "create_goal" });
        router.replace("/goals/new");
        return;
      }
      
      const parsedGoals = JSON.parse(storedGoals);
      const activeGoals = parsedGoals.filter((goal: Goal) => !goal.archived);
      setGoals(activeGoals);
      
      // Seleccionar objetivo principal por defecto
      const primaryGoal = activeGoals.find((goal: Goal) => goal.is_primary);
      if (primaryGoal) {
        setSelectedGoalId(primaryGoal.id);
      } else if (activeGoals.length > 0) {
        setSelectedGoalId(activeGoals[0].id);
      }
      
    } catch (error) {
      console.error("Error al cargar datos:", error);
      setError("No se pudieron cargar los objetivos. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Validaciones
    if (!selectedGoalId) {
      setError("Selecciona un objetivo");
      return;
    }
    
    if (!amount || amount <= 0) {
      setError("Ingresa una cantidad válida");
      return;
    }
    
    try {
      // Generar ID único para la acción extra
      const extraSavingId = `extra_${Date.now()}`;
      const today = new Date().toISOString().split('T')[0];
      
      // Crear objeto de acción extra
      const newExtraSaving = {
        id: extraSavingId,
        date: today,
        goal_id: selectedGoalId,
        amount,
        note: note.trim() || null,
        created_at: new Date().toISOString()
      };
      
      // Guardar en localStorage
      const storedExtraSavings = localStorage.getItem("extraSavings");
      const extraSavings = storedExtraSavings ? JSON.parse(storedExtraSavings) : [];
      extraSavings.unshift(newExtraSaving);
      localStorage.setItem("extraSavings", JSON.stringify(extraSavings));
      
      // Actualizar el objetivo
      const storedGoals = localStorage.getItem("goals");
      if (storedGoals) {
        const goals = JSON.parse(storedGoals);
        const updatedGoals = goals.map((goal: Goal) => {
          if (goal.id === selectedGoalId) {
            return {
              ...goal,
              current_amount: goal.current_amount + amount,
              updated_at: new Date().toISOString()
            };
          }
          return goal;
        });
        
        localStorage.setItem("goals", JSON.stringify(updatedGoals));
      }
      
      // Registrar evento de acción extra enviada
      analytics.extraSavingSubmitted(
        today,
        selectedGoalId,
        amount,
        note.length
      );
      
      // Redirigir al dashboard
      router.push("/dashboard");
      
    } catch (error) {
      console.error("Error al guardar acción extra:", error);
      setError("No se pudo guardar. Intenta de nuevo.");
      
      // Registrar evento de error
      analytics.extraSavingError(
        new Date().toISOString().split('T')[0],
        selectedGoalId || '',
        "LOCAL_STORAGE_ERROR",
        String(error)
      );
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ahorro-500"></div>
      </div>
    );
  }
  
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-text-primary mb-2">Acción extra</h1>
          <p className="text-text-secondary">Registra un ahorro adicional para impulsar tu objetivo.</p>
        </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Cantidad
              </label>
              <div className="flex items-center">
                <span className="text-text-secondary text-lg mr-2">€</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount || ""}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:border-ahorro-500"
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Objetivo
              </label>
              <select
                value={selectedGoalId || ""}
                onChange={(e) => setSelectedGoalId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:border-ahorro-500"
              >
                <option value="" disabled>Selecciona un objetivo</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title} {goal.is_primary ? "(Principal)" : ""}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Nota (opcional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:border-ahorro-500"
                placeholder="Ej: No pedí café fuera"
                rows={3}
              />
            </div>
            
            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={!selectedGoalId || !amount || amount <= 0}
            >
              Guardar
            </Button>
          </form>
      </div>
    </main>
  );
}
