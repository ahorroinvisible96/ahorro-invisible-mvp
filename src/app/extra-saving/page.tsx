"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ExtraSavingPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<any[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      // Objetivos
      const storedGoals = JSON.parse(localStorage.getItem("goals") || "[]");
      const activeGoals = storedGoals.filter((goal: any) => !goal.archived);
      setGoals(activeGoals);
      
      // Si no hay objetivos, redirigir a crear objetivo
      if (activeGoals.length === 0) {
        router.replace("/goals/new");
        return;
      }
      
      // Seleccionar objetivo principal por defecto
      const primaryGoal = activeGoals.find((goal: any) => goal.is_primary);
      setSelectedGoal(primaryGoal ? primaryGoal.id : activeGoals[0].id);
      
      setIsLoading(false);
      
      // Evento de analytics: extra_saving_started
      console.log("Analytics: extra_saving_started");
    } catch (err) {
      console.error("Error al cargar datos:", err);
      setIsLoading(false);
    }
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Validación
    if (!selectedGoal) {
      setError("Debes seleccionar un objetivo");
      return;
    }
    
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      setError("La cantidad debe ser un número mayor que cero");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Crear nueva acción extra de ahorro
      const extraSaving = {
        id: `extra_${Date.now()}`,
        date: new Date().toISOString(),
        amount: amountValue,
        goal_id: selectedGoal,
        note: note.trim() || "Ahorro extra",
        type: "extra_saving"
      };
      
      // Guardar en localStorage
      const extraSavings = JSON.parse(localStorage.getItem("extraSavings") || "[]");
      extraSavings.unshift(extraSaving);
      localStorage.setItem("extraSavings", JSON.stringify(extraSavings));
      
      // Actualizar el objetivo con la cantidad
      const goals = JSON.parse(localStorage.getItem("goals") || "[]");
      const updatedGoals = goals.map((goal: any) => {
        if (goal.id === selectedGoal) {
          return {
            ...goal,
            current_amount: goal.current_amount + amountValue,
            updated_at: new Date().toISOString()
          };
        }
        return goal;
      });
      localStorage.setItem("goals", JSON.stringify(updatedGoals));
      
      // Evento de analytics: extra_saving_submitted
      console.log("Analytics: extra_saving_submitted");
      
      // Redirigir al dashboard
      router.push("/dashboard");
    } catch (err) {
      console.error("Error al guardar ahorro extra:", err);
      setError("No se pudo guardar el ahorro extra. Intenta de nuevo.");
      setIsSubmitting(false);
      
      // Evento de analytics: extra_saving_error
      console.log("Analytics: extra_saving_error");
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
        
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Acción extra de ahorro</h1>
        <p className="text-text-secondary mb-6">Registra un ahorro adicional para avanzar más rápido</p>
        
        {error && <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>}
        
        <Card className="mb-6">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Cantidad (€)*
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:border-ahorro-500"
                  placeholder="Ej: 50"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Objetivo*
                </label>
                <select
                  value={selectedGoal || ""}
                  onChange={(e) => setSelectedGoal(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:border-ahorro-500"
                  required
                >
                  {goals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title} ({goal.is_primary ? "Principal" : "Secundario"})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Nota (opcional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:border-ahorro-500"
                  placeholder="Ej: Ahorro de la semana"
                />
              </div>
              
              <div className="flex justify-between pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                
                <Button 
                  type="submit" 
                  variant="primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Guardando..." : "Guardar ahorro"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
