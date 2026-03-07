"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { analytics } from "@/services/analytics";
import { storeAddExtraSaving, storeListActiveGoals } from "@/services/dashboardStore";
import type { Goal } from "@/types/Dashboard";

export default function ExtraSavingPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    analytics.setScreen('extra_saving');

    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated !== "true") {
      router.replace("/signup");
      return;
    }

    const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding");
    if (hasCompletedOnboarding !== "true") {
      router.replace("/onboarding");
      return;
    }

    const active = storeListActiveGoals();
    if (active.length === 0) {
      router.replace("/goals");
      return;
    }

    setGoals(active);
    const primary = active.find((g) => g.isPrimary) ?? active[0];
    setSelectedGoalId(primary.id);
    setIsLoading(false);

    analytics.extraSavingStarted('impact');
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedGoalId) {
      setError("Selecciona un objetivo");
      return;
    }

    if (!amount || amount <= 0) {
      setError("Ingresa una cantidad válida");
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];

      storeAddExtraSaving(note.trim() || 'Ahorro extra', amount, selectedGoalId);

      analytics.extraSavingSubmitted(today, selectedGoalId, amount, note.length);

      router.push("/dashboard");
    } catch (err) {
      const today = new Date().toISOString().split('T')[0];
      setError("No se pudo guardar. Intenta de nuevo.");
      analytics.extraSavingError(today, selectedGoalId || '', "STORE_ERROR", String(err));
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
                    {goal.title} {goal.isPrimary ? "(Principal)" : ""}
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
