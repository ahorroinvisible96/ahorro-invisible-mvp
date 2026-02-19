"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button/Button";
import { Card } from "@/components/ui/Card/Card";
import { FormInput } from "@/components/ui/FormInput";

export default function CreateGoalPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState<number>(1000);
  const [timeHorizonMonths, setTimeHorizonMonths] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState("");
  
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
      router.replace("/onboarding");
      return;
    }
    
    // Cargar nombre de usuario
    const storedName = localStorage.getItem("userName");
    if (storedName) {
      setUserName(storedName);
    }
    
    // Registrar evento de inicio de creación de objetivo
    console.log("EVENT: goal_create_started", { source: "onboarding" });
  }, [router]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Validaciones
    if (!title.trim()) {
      setError("Ponle un nombre a tu objetivo.");
      return;
    }
    
    if (!targetAmount || targetAmount <= 0) {
      setError("Escribe una cantidad válida.");
      return;
    }
    
    try {
      // Generar ID único para el objetivo
      const goalId = `goal_${Date.now()}`;
      
      // Crear objeto de objetivo
      const newGoal = {
        id: goalId,
        title,
        target_amount: targetAmount,
        current_amount: 0,
        time_horizon_months: timeHorizonMonths,
        is_primary: true, // El primer objetivo siempre es primary
        archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Guardar en localStorage
      const storedGoals = localStorage.getItem("goals");
      const goals = storedGoals ? JSON.parse(storedGoals) : [];
      
      // Si ya hay objetivos, quitar el primary de los demás
      const updatedGoals = goals.map((goal: any) => ({
        ...goal,
        is_primary: false
      }));
      
      // Añadir el nuevo objetivo
      updatedGoals.push(newGoal);
      localStorage.setItem("goals", JSON.stringify(updatedGoals));
      
      // Registrar evento de objetivo creado
      console.log("EVENT: goal_created", { 
        goal_id: goalId,
        is_primary_goal: true,
        goal_target_amount: targetAmount,
        goal_time_horizon_months: timeHorizonMonths
      });
      
      // Redirigir al dashboard
      router.push("/dashboard");
    } catch (err) {
      console.error("Error al crear objetivo:", err);
      setError("No se pudo guardar. Intenta de nuevo.");
      
      // Registrar evento de error
      console.log("EVENT: goal_create_error", { error: String(err) });
    }
  };
  
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-0">
      <div className="w-full">
        <div className="flex items-center gap-2 mb-8 px-4">
          <div className="w-8 h-8 rounded-md bg-black flex items-center justify-center text-white font-bold">
            A
          </div>
          <div className="font-semibold">
            <div>Ahorro</div>
            <div className="text-lg text-indigo-400">Invisible</div>
          </div>
        </div>
        
        <Card variant="default" size="md" className="rounded-none md:rounded-xl">
          <Card.Content>
            <h1 className="text-2xl font-semibold text-text-primary mb-2">
              Crea tu primer objetivo
            </h1>
            <p className="text-text-secondary mb-6">
              Será tu punto de referencia diario.
            </p>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <FormInput
                label="Nombre del objetivo"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Viaje, emergencia, formación..."
              />
              
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Cantidad objetivo
                </label>
                <div className="flex items-center">
                  <span className="text-text-secondary text-lg mr-2">€</span>
                  <input
                    type="number"
                    min="1"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(parseInt(e.target.value) || 0)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              
              <FormInput
                label="Horizonte (meses) (opcional)"
                type="number"
                min="1"
                value={timeHorizonMonths || ""}
                onChange={(e) => {
                  const value = e.target.value ? parseInt(e.target.value) : null;
                  setTimeHorizonMonths(value);
                }}
                placeholder="12"
              />
              
              <Button
                type="submit"
                variant="primary"
                size="lg"
              >
                Guardar objetivo
              </Button>
            </form>
          </Card.Content>
        </Card>
      </div>
    </main>
  );
}
