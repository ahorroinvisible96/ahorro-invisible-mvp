"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { storeCreateGoal, storeListActiveGoals, computeInitialGoalSuggestion, buildSummary, checkGoalRealism } from "@/services/dashboardStore";
import { analytics } from "@/services/analytics";
import { pushLocalDataToSupabase, syncGoalToSupabase } from "@/services/syncService";

type UIState = 'form' | 'recommendation' | 'restructuring';

type RealismData = {
  isUnrealistic: boolean;
  estimatedMonths: number;
  requiredMonthly: number;
  recommendedMonthly: number;
  suggestedAmount: number;
  suggestedHorizonMonths: number;
};

function CreateGoalInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const goalSource = (searchParams.get('source') === 'onboarding' ? 'onboarding' : 'dashboard') as 'onboarding' | 'dashboard';
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [horizonMonths, setHorizonMonths] = useState("12");
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<{ monthly: number; target: number; horizonMonths: number } | null>(null);
  const [uiState, setUiState] = useState<UIState>('form');
  const [realismData, setRealismData] = useState<RealismData | null>(null);
  const [summaryRef, setSummaryRef] = useState<{ incomeRange: ReturnType<typeof buildSummary>['incomeRange']; savingsPercent: number } | null>(null);

  useEffect(() => {
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated !== "true") { router.replace("/login"); return; }
    const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding");
    if (hasCompletedOnboarding !== "true") { router.replace("/onboarding"); return; }
    try {
      const s = buildSummary('30d');
      setSummaryRef({ incomeRange: s.incomeRange, savingsPercent: s.savingsPercent });
      const sug = computeInitialGoalSuggestion(s.incomeRange, s.savingsProfile);
      if (sug) {
        setSuggestion(sug);
        if (!targetAmount) setTargetAmount(String(sug.target));
        if (!horizonMonths || horizonMonths === '12') setHorizonMonths(String(sug.horizonMonths));
      }
    } catch { /* fallthrough */ }
    analytics.goalCreateStarted("goals_new_page");
  }, [router]);

  const fmtEUR = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

  const doSave = async (opts: {
    amount: number; months: number;
    finalGoalAmount?: number; isUnrealistic?: boolean; subGoalIndex?: number;
  }) => {
    try {
      const isFirst = storeListActiveGoals().length === 0;
      const summary = storeCreateGoal({
        title: title.trim(),
        targetAmount: opts.amount,
        currentAmount: 0,
        horizonMonths: opts.months,
        source: goalSource,
        finalGoalAmount: opts.finalGoalAmount,
        isUnrealistic: opts.isUnrealistic ?? false,
        subGoalIndex: opts.subGoalIndex ?? 0,
      });
      const newGoal = summary.goals.filter(g => !g.archived).slice(-1)[0];
      analytics.goalCreated(newGoal?.id ?? `goal_${Date.now()}`, isFirst, opts.amount, opts.months);
      if (isFirst) analytics.firstGoalCreated(newGoal?.id ?? `goal_${Date.now()}`, opts.amount, opts.months);
      if (newGoal) await syncGoalToSupabase(newGoal);
      router.push("/dashboard");
      const userId = localStorage.getItem('supabaseUserId');
      if (userId) pushLocalDataToSupabase(userId).catch(() => null);
    } catch (err) {
      setError("No se pudo guardar. Intenta de nuevo.");
      analytics.goalCreateError("save_failed", String(err));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Ponle un nombre a tu objetivo."); return; }
    const amount = Number(targetAmount);
    if (!targetAmount || isNaN(amount) || amount <= 0) { setError("Escribe una cantidad válida."); return; }
    const months = Number(horizonMonths);
    if (!horizonMonths || isNaN(months) || months < 1) { setError("El horizonte debe ser al menos 1 mes."); return; }
    // Reality check
    if (summaryRef) {
      const r = checkGoalRealism(amount, months, summaryRef.incomeRange, summaryRef.savingsPercent);
      if (r.isUnrealistic) { setRealismData(r); setUiState('recommendation'); return; }
    }
    await doSave({ amount, months });
  };

  // ── Recommendation modal (overlay sobre el form) ─────────────────────────
  if (uiState === 'recommendation' && realismData) {
    const userAmount = Number(targetAmount);
    return (
      <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: 'var(--font-geist-sans,Arial,sans-serif)' }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div style={{ borderRadius: 20, background: 'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)', border: '1px solid rgba(251,191,36,0.3)', boxShadow: '0 25px 50px rgba(2,6,23,0.7)', padding: '28px 24px' }}>
            <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>⚡</div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px', textAlign: 'center', lineHeight: 1.3 }}>Este objetivo puede tardar más de lo esperado</h2>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.8)', margin: '0 0 20px', textAlign: 'center', lineHeight: 1.6 }}>
              Los usuarios que empiezan con metas más pequeñas tienen <strong style={{ color: '#fbbf24' }}>3 veces más probabilidades</strong> de tener éxito.
            </p>
            {/* Stats box */}
            <div style={{ background: 'rgba(15,23,42,0.6)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)' }}>Tu objetivo</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{fmtEUR(userAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)' }}>Tiempo estimado</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>~{realismData.estimatedMonths} meses</span>
              </div>
              <div style={{ borderTop: '1px solid rgba(51,65,85,0.4)', paddingTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'rgba(74,222,128,0.8)', fontWeight: 600 }}>💡 Objetivo recomendado</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#4ade80' }}>{fmtEUR(realismData.suggestedAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)' }}>Alcanzable en</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>{realismData.suggestedHorizonMonths} meses</span>
                </div>
              </div>
            </div>
            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => doSave({ amount: realismData.suggestedAmount, months: realismData.suggestedHorizonMonths })}
                style={{ padding: '13px', border: 'none', borderRadius: 12, background: 'linear-gradient(90deg,#16a34a,#15803d)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
              >
                Empezar con {fmtEUR(realismData.suggestedAmount)} ✓
              </button>
              <button
                onClick={() => setUiState('restructuring')}
                style={{ padding: '13px', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 12, background: 'transparent', color: 'rgba(203,213,225,0.7)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Continuar con {fmtEUR(userAmount)} de todas formas
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── Restructuring screen ──────────────────────────────────────────────────
  if (uiState === 'restructuring' && realismData) {
    const userAmount = Number(targetAmount);
    return (
      <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: 'var(--font-geist-sans,Arial,sans-serif)' }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div style={{ borderRadius: 20, background: 'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)', border: '1px solid rgba(99,102,241,0.35)', boxShadow: '0 25px 50px rgba(2,6,23,0.7)', padding: '28px 24px' }}>
            <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>🗺️</div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px', textAlign: 'center', lineHeight: 1.3 }}>Perfecto. Lo dividimos en pasos.</h2>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.8)', margin: '0 0 20px', textAlign: 'center', lineHeight: 1.6 }}>
              Tu objetivo final es <strong style={{ color: '#a78bfa' }}>{fmtEUR(userAmount)}</strong>. Empezamos con el primer paso que puedes conseguir pronto.
            </p>
            {/* Plan visual */}
            <div style={{ background: 'rgba(15,23,42,0.6)', borderRadius: 12, padding: '16px', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>1</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Primer paso — {fmtEUR(realismData.suggestedAmount)}</p>
                  <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)', margin: '2px 0 0' }}>Activo ahora · {realismData.suggestedHorizonMonths} meses</p>
                </div>
                <span style={{ fontSize: 18 }}>🎯</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.45 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(51,65,85,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'rgba(148,163,184,0.6)', flexShrink: 0 }}>…</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(148,163,184,0.5)', margin: 0 }}>Próximos pasos · auto-generados</p>
                  <p style={{ fontSize: 12, color: 'rgba(100,116,139,0.5)', margin: '2px 0 0' }}>Hasta {fmtEUR(userAmount)}</p>
                </div>
                <span style={{ fontSize: 18, opacity: 0.3 }}>🏆</span>
              </div>
            </div>
            <button
              onClick={() => doSave({ amount: realismData.suggestedAmount, months: realismData.suggestedHorizonMonths, finalGoalAmount: userAmount, isUnrealistic: true, subGoalIndex: 0 })}
              style={{ width: '100%', padding: '13px', border: 'none', borderRadius: 12, background: 'linear-gradient(90deg,#6366f1,#a855f7)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            >
              Empezar paso 1 → {fmtEUR(realismData.suggestedAmount)}
            </button>
          </div>
        </div>
      </main>
    );
  }

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

          {/* Sugerencia adaptativa */}
          {suggestion && goalSource === 'onboarding' && (
            <div style={{ marginBottom: 20, padding: '12px 14px', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(196,181,253,0.9)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>💡 Sugerido para tu perfil</p>
              <p style={{ fontSize: 13, color: 'rgba(196,181,253,0.75)', margin: 0 }}>
                Con tus ingresos puedes ahorrar ~<strong style={{ color: '#c4b5fd' }}>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(suggestion.monthly)}/mes</strong>. Meta inicial: <strong style={{ color: '#c4b5fd' }}>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(suggestion.target)}</strong> en {suggestion.horizonMonths} {suggestion.horizonMonths === 1 ? 'mes' : 'meses'}. Puedes ajustarlo.
              </p>
            </div>
          )}

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

export default function CreateGoalPage() {
  return (
    <Suspense fallback={null}>
      <CreateGoalInner />
    </Suspense>
  );
}
