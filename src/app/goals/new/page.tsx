"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { storeCreateGoal } from "@/services/dashboardStore";
import { analytics } from "@/services/analytics";

export default function CreateGoalPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [horizonMonths, setHorizonMonths] = useState("12");
  const [error, setError] = useState("");

  const GOAL_TYPE_LABELS: Record<string, string> = {
    travel:    'Viaje',
    emergency: 'Fondo de emergencia',
    purchase:  'Compra importante',
    freedom:   'Libertad financiera',
  };

  useEffect(() => {
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated !== "true") { router.replace("/signup"); return; }
    const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding");
    if (hasCompletedOnboarding !== "true") { router.replace("/onboarding"); return; }
    // Prelllenar el nombre con el tipo de objetivo elegido en el onboarding
    try {
      const onbRaw = localStorage.getItem("onboardingData");
      if (onbRaw) {
        const onb = JSON.parse(onbRaw);
        if (onb.goalType && GOAL_TYPE_LABELS[onb.goalType]) {
          setTitle(GOAL_TYPE_LABELS[onb.goalType]);
        }
      }
    } catch { /* fallthrough */ }
    analytics.goalCreateStarted("goals_new_page");
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Ponle un nombre a tu objetivo."); return; }
    const amount = Number(targetAmount);
    if (!targetAmount || isNaN(amount) || amount <= 0) { setError("Escribe una cantidad válida."); return; }
    const months = Number(horizonMonths);
    if (!horizonMonths || isNaN(months) || months < 1) { setError("El horizonte debe ser al menos 1 mes."); return; }

    try {
      storeCreateGoal({ title: title.trim(), targetAmount: amount, currentAmount: 0, horizonMonths: months });
      analytics.goalCreated(`goal_${Date.now()}`, true, amount, months);
      router.push("/dashboard");
    } catch (err) {
      setError("No se pudo guardar. Intenta de nuevo.");
      analytics.goalCreateError("save_failed", String(err));
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ marginBottom: 32, fontWeight: 700, fontSize: 20, color: "#111827" }}>
          Ahorro <span style={{ color: "#2563eb" }}>Invisible</span>
        </div>
        <div style={{ background: "#fff", borderRadius: 16, padding: "32px 28px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Crea tu objetivo</h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>Será tu punto de referencia diario.</p>

          {error && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#ef4444" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 6 }}>Nombre del objetivo</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Viaje, emergencia, formación..."
                style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 6 }}>Meta (€)</label>
              <input
                type="number"
                min="1"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="5000"
                style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 6 }}>Horizonte (meses)</label>
              <input
                type="number"
                min="1"
                value={horizonMonths}
                onChange={(e) => setHorizonMonths(e.target.value)}
                placeholder="12"
                style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <button
              type="submit"
              style={{ width: "100%", padding: "12px 0", background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" }}
            >
              Guardar objetivo
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
