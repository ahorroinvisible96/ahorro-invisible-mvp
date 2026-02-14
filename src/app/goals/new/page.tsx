"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function CreateGoalPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFromOnboarding, setIsFromOnboarding] = useState(false);

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
    
    // Determinar si viene del onboarding
    const referrer = document.referrer;
    if (referrer.includes("onboarding")) {
      setIsFromOnboarding(true);
    }
    
    // Evento de analytics: goal_create_started
    console.log("Analytics: goal_create_started");
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Validación
    if (!title.trim()) {
      setError("El título del objetivo es obligatorio");
      return;
    }
    
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      setError("La cantidad debe ser un número mayor que cero");
      return;
    }
    
    const monthsValue = months ? parseInt(months) : 0;
    if (months && (isNaN(monthsValue) || monthsValue <= 0)) {
      setError("Los meses deben ser un número entero positivo");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Generar ID único para el objetivo
      const goalId = `goal_${Date.now()}`;
      
      // Verificar si hay objetivos existentes
      const existingGoals = JSON.parse(localStorage.getItem("goals") || "[]");
      const isPrimary = existingGoals.length === 0;
      
      // Crear nuevo objetivo
      const newGoal = {
        id: goalId,
        title,
        target_amount: amountValue,
        current_amount: 0,
        months: monthsValue || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_primary: isPrimary,
        archived: false
      };
      
      // Guardar en localStorage
      existingGoals.push(newGoal);
      localStorage.setItem("goals", JSON.stringify(existingGoals));
      
      // Evento de analytics: goal_created
      console.log(`Analytics: goal_created (goal_id: ${goalId})`);
      
      // Redirigir al dashboard
      router.push("/dashboard");
    } catch (err) {
      console.error("Error al crear objetivo:", err);
      setError("No se pudo crear el objetivo. Intenta de nuevo.");
      setIsLoading(false);
      
      // Evento de analytics: goal_create_error
      console.log("Analytics: goal_create_error");
    }
  };
  
  const handleBack = () => {
    if (isFromOnboarding) {
      router.push("/onboarding/3");
    } else {
      router.push("/dashboard");
    }
  };

  // Obtener objetivos existentes para mostrar el título correcto
  const [existingGoals, setExistingGoals] = useState<any[]>([]);
  
  useEffect(() => {
    try {
      const goals = JSON.parse(localStorage.getItem("goals") || "[]");
      setExistingGoals(goals);
    } catch (err) {
      console.error("Error al cargar objetivos:", err);
    }
  }, []);

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
        
        <h1 className="text-2xl font-semibold text-text-primary mb-2">
          {existingGoals.length === 0 ? "Crea tu primer objetivo" : "Nuevo objetivo"}
        </h1>
        <p className="text-text-secondary mb-6">Define una meta clara para tu ahorro</p>
        
        {error && <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>}
        
        <Card className="mb-6">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Título del objetivo*
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:border-ahorro-500"
                  placeholder="Ej: Viaje a Japón, Fondo de emergencia..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Cantidad objetivo (€)*
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:border-ahorro-500"
                  placeholder="Ej: 1000"
                  min="1"
                  step="any"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Plazo en meses (opcional)
                </label>
                <input
                  type="number"
                  value={months}
                  onChange={(e) => setMonths(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:border-ahorro-500"
                  placeholder="Ej: 12"
                  min="1"
                />
                <p className="text-xs text-text-secondary mt-1">
                  Deja en blanco si no tienes un plazo definido
                </p>
              </div>
              
              <div className="flex justify-between pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleBack}
                  disabled={isLoading}
                >
                  Atrás
                </Button>
                
                <Button 
                  type="submit" 
                  variant="primary"
                  disabled={isLoading}
                >
                  {isLoading ? "Creando..." : "Crear objetivo"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        
        <div className="text-center text-sm text-text-secondary">
          <p>Podrás editar o archivar este objetivo más adelante</p>
        </div>
      </div>
    </div>
  );
}
