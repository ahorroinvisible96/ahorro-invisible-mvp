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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(51,65,85,0.55)',
    borderRadius: 10,
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: 500,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-geist-sans, Arial, sans-serif)',
    transition: 'border-color 180ms ease',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(148,163,184,0.6)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 6,
  };

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: 'var(--font-geist-sans, Arial, sans-serif)',
    }}>
      {/* Glow decorativo */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 400,
        background: 'radial-gradient(ellipse, rgba(37,99,235,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 480, position: 'relative' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #a855f7, #2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 18,
            boxShadow: '0 4px 14px rgba(168,85,247,0.4)',
          }}>A</div>
          <div>
            <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16 }}>Ahorro </span>
            <span style={{ color: '#a855f7', fontWeight: 700, fontSize: 16 }}>Invisible</span>
          </div>
        </div>

        {/* Card principal */}
        <div style={{
          position: 'relative',
          borderRadius: 20,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid rgba(51,65,85,0.6)',
          boxShadow: '0 25px 50px rgba(2,6,23,0.7)',
          overflow: 'hidden',
          padding: '28px 24px',
        }}>
          {/* Glow interior */}
          <div style={{
            position: 'absolute', top: -40, right: -40,
            width: 200, height: 200,
            background: 'radial-gradient(ellipse, rgba(37,99,235,0.1) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #2563eb, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
              boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
            }}>🎯</div>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: 'rgba(148,163,184,0.7)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>ÚLTIMO PASO · TU OBJETIVO</span>
          </div>

          <h1 style={{
            fontSize: 20, fontWeight: 800,
            color: '#f1f5f9', margin: '0 0 6px',
            lineHeight: 1.25,
          }}>Define tu primer objetivo</h1>
          <p style={{
            fontSize: 13, color: 'rgba(148,163,184,0.75)',
            margin: '0 0 28px', lineHeight: 1.5,
          }}>
            Será tu referencia diaria. Puedes editarlo en cualquier momento.
          </p>

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: 20,
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10,
              fontSize: 13, color: '#fca5a5',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div>
              <label style={labelStyle}>Nombre del objetivo</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Viaje, emergencia, formación..."
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(51,65,85,0.55)'; }}
              />
            </div>

            <div>
              <label style={labelStyle}>Meta (€)</label>
              <input
                type="number"
                min="1"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="5000"
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(51,65,85,0.55)'; }}
              />
            </div>

            <div>
              <label style={labelStyle}>Horizonte (meses)</label>
              <input
                type="number"
                min="1"
                value={horizonMonths}
                onChange={(e) => setHorizonMonths(e.target.value)}
                placeholder="12"
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(51,65,85,0.55)'; }}
              />
            </div>

            {/* Info hint */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 14px',
              background: 'rgba(37,99,235,0.08)',
              border: '1px solid rgba(37,99,235,0.2)',
              borderRadius: 10,
            }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>💡</span>
              <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.75)', margin: 0, lineHeight: 1.5 }}>
                Con cada decisión diaria irás acumulando pequeños ahorros hacia este objetivo.
              </p>
            </div>

            <button
              type="submit"
              style={{
                width: '100%', padding: '13px 0', marginTop: 4,
                background: 'linear-gradient(90deg, #a855f7, #2563eb)',
                border: 'none', borderRadius: 10,
                color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 4px 14px rgba(168,85,247,0.35)',
                transition: 'all 200ms ease',
              }}
            >
              Ir al Dashboard →
            </button>

          </form>
        </div>

        <p style={{
          textAlign: 'center', marginTop: 20,
          fontSize: 13, color: 'rgba(148,163,184,0.4)',
        }}>
          Ya casi estás. Solo queda este paso ✨
        </p>

      </div>
    </main>
  );
}
