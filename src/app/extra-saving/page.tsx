"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { analytics } from "@/services/analytics";
import { storeAddExtraSaving, storeListActiveGoals } from "@/services/dashboardStore";
import { localDateStr } from "@/lib/dates";
import { pushLocalDataToSupabase, syncDecisionToSupabase, syncGoalToSupabase } from "@/services/syncService";
import type { Goal } from "@/types/Dashboard";
import { TargetIcon } from "@/components/ui/AppIcons";
import styles from "./ExtraSaving.module.css";

function formatEUR(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
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

  const handleSubmit = async (e: React.FormEvent) => {
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
      analytics.extraSavingSubmitted(localDateStr(), amount, 'extra_saving_page');

      storeAddExtraSaving(note.trim() || 'Ahorro extra', amount, selectedGoalId, '30d', { surface: 'extra_saving_page' });

      try {
        const raw = localStorage.getItem('ahorro_invisible_dashboard_v1');
        if (raw) {
          const store = JSON.parse(raw);
          const newExtra = [...(store.decisions ?? [])].reverse()
            .find((d: Record<string, unknown>) => d.questionId === 'extra_saving');
          const updatedGoal = store.goals?.find((g: Record<string, unknown>) => g.id === selectedGoalId);
          await Promise.all([
            newExtra ? syncDecisionToSupabase(newExtra) : Promise.resolve(),
            updatedGoal ? syncGoalToSupabase(updatedGoal) : Promise.resolve(),
          ]);
        }
      } catch { /* no bloquear navegación */ }

      router.push("/dashboard");
      const userId = localStorage.getItem('supabaseUserId');
      if (userId) pushLocalDataToSupabase(userId).catch(() => null);
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
      analytics.extraSavingError("store_error");
    }
  };

  if (isLoading) {
    return <div className={styles.centerLoad}>Cargando...</div>;
  }

  const selectedGoal = goals.find((g) => g.id === selectedGoalId) ?? goals[0];
  const projectedTotal = selectedGoal ? selectedGoal.currentAmount + (amount > 0 ? amount : 0) : 0;
  const projectedPct = selectedGoal ? Math.min(100, Math.round((projectedTotal / selectedGoal.targetAmount) * 100)) : 0;

  return (
    <main className={styles.page}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className={styles.sky}>
          <div className={styles.inner}>
            <div className={styles.topBar}>
              <button type="button" onClick={() => router.back()} className={styles.glassBtn} aria-label="Volver">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <h1 className={styles.topTitle}>Acción extra</h1>
              <div style={{ width: 38 }} />
            </div>

            <div className={styles.heroCenter}>
              <span className={styles.heroKicker}>¿Cuánto quieres sumar hoy?</span>
              <div className={styles.amountInputWrap}>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={amount || ""}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className={styles.amountInput}
                  placeholder="0"
                  aria-label="Cantidad en euros"
                  autoFocus
                />
                <span className={styles.amountUnit}>€</span>
              </div>

              <select
                aria-label="Objetivo destino"
                value={selectedGoalId || ""}
                onChange={(e) => setSelectedGoalId(e.target.value)}
                className={styles.goalPillSelect}
              >
                <option value="" disabled>Selecciona un objetivo</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    Destino: {goal.title}{goal.isPrimary ? ' (Principal)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={styles.formBody}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && <div className={styles.errorBox}>{error}</div>}

            <div className={styles.card}>
              <div>
                <label htmlFor="extra-note" className={styles.label}>Nota (opcional)</label>
                <textarea
                  id="extra-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={styles.textarea}
                  placeholder="Ej: No pedí café fuera o reembolso recibido"
                  rows={3}
                />
              </div>

              {selectedGoal && (
                <div className={styles.previewRow}>
                  <div className={styles.medallion}><TargetIcon size={17} /></div>
                  <div>
                    <div className={styles.previewTitle}>{selectedGoal.title}</div>
                    <div className={styles.previewSub}>
                      {amount > 0
                        ? `Pasará a ${formatEUR(projectedTotal)} (${projectedPct}%)`
                        : `Actual: ${formatEUR(selectedGoal.currentAmount)} de ${formatEUR(selectedGoal.targetAmount)}`}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={!selectedGoalId || !amount || amount <= 0}
            className={styles.btnWhite}
          >
            {amount > 0 ? `Guardar ${formatEUR(amount)}` : 'Guardar ahorro extra'}
          </button>
        </div>
      </form>
    </main>
  );
}
