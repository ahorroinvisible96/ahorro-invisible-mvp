"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { storeCreateGoal, storeListActiveGoals, computeInitialGoalSuggestion, buildSummary, checkGoalRealism } from "@/services/dashboardStore";
import { analytics } from "@/services/analytics";
import { pushLocalDataToSupabase, syncGoalToSupabase } from "@/services/syncService";
import { BoltIcon, TargetIcon, TrendingUpIcon, TrophyIcon } from "@/components/ui/AppIcons";
import s from "./NewGoal.module.css";

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
      analytics.goalCreateSubmitted(isFirst, opts.amount, opts.months, goalSource === 'onboarding' ? 'onboarding' : 'goals_page');
      if (newGoal) await syncGoalToSupabase(newGoal);
      router.push("/dashboard");
      const userId = localStorage.getItem('supabaseUserId');
      if (userId) pushLocalDataToSupabase(userId).catch(() => null);
    } catch (err) {
      setError("No se pudo guardar. Intenta de nuevo.");
      analytics.goalCreateError("save_failed");
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

  // ── Recommendation screen ────────────────────────────────────────────────
  if (uiState === 'recommendation' && realismData) {
    const userAmount = Number(targetAmount);
    return (
      <main className={s.page}>
        <div className={s.sky} />
        <div className={s.container}>
          <div className={s.card}>
            <div className={`${s.medallionLarge} ${s.medallionAmber}`}>
              <BoltIcon size={26} />
            </div>
            <h2 className={`${s.title} ${s.titleCenter}`}>Este objetivo puede tardar más de lo esperado</h2>
            <p className={`${s.sub} ${s.subCenter}`}>
              Los usuarios que empiezan con metas más pequeñas tienen{' '}
              <strong className={s.highlightAmber}>3 veces más probabilidades</strong> de tener éxito.
            </p>

            <div className={s.statsCard}>
              <div className={s.statRow}>
                <span className={s.statLabel}>Tu objetivo</span>
                <span className={s.statVal}>{fmtEUR(userAmount)}</span>
              </div>
              <div className={s.statRow}>
                <span className={s.statLabel}>Tiempo estimado</span>
                <span className={`${s.statVal} ${s.statValWarn}`}>~{realismData.estimatedMonths} meses</span>
              </div>
              <div className={s.statsDivider} />
              <div className={s.statRow}>
                <span className={s.statLabelEmerald}>Objetivo recomendado</span>
                <span className={`${s.statVal} ${s.statValEmerald}`}>{fmtEUR(realismData.suggestedAmount)}</span>
              </div>
              <div className={s.statRow}>
                <span className={s.statLabel}>Alcanzable en</span>
                <span className={`${s.statVal} ${s.statValEmerald}`}>{realismData.suggestedHorizonMonths} meses</span>
              </div>
            </div>

            <div className={s.btnStack}>
              <button
                type="button"
                onClick={() => doSave({ amount: realismData.suggestedAmount, months: realismData.suggestedHorizonMonths })}
                className={s.primaryBtn}
              >
                Empezar con {fmtEUR(realismData.suggestedAmount)}
              </button>
              <button
                type="button"
                onClick={() => setUiState('restructuring')}
                className={s.secondaryBtn}
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
      <main className={s.page}>
        <div className={s.sky} />
        <div className={s.container}>
          <div className={s.card}>
            <div className={`${s.medallionLarge} ${s.medallionIndigo}`}>
              <TrendingUpIcon size={26} />
            </div>
            <h2 className={`${s.title} ${s.titleCenter}`}>Perfecto. Lo dividimos en pasos.</h2>
            <p className={`${s.sub} ${s.subCenter}`}>
              Tu objetivo final es <strong className={s.highlightViolet}>{fmtEUR(userAmount)}</strong>. Empezamos con el primer paso que puedes conseguir pronto.
            </p>

            <div className={s.statsCard}>
              <div className={s.planRow}>
                <div className={s.planStepBadge}>1</div>
                <div className={s.planStepBody}>
                  <p className={s.planStepTitle}>Primer paso — {fmtEUR(realismData.suggestedAmount)}</p>
                  <p className={s.planStepSub}>Activo ahora · {realismData.suggestedHorizonMonths} meses</p>
                </div>
                <TargetIcon size={18} />
              </div>
              <div className={`${s.planRow} ${s.planRowMuted}`}>
                <div className={`${s.planStepBadge} ${s.planStepBadgeMuted}`}>…</div>
                <div className={s.planStepBody}>
                  <p className={s.planStepTitle}>Próximos pasos · auto-generados</p>
                  <p className={s.planStepSub}>Hasta {fmtEUR(userAmount)}</p>
                </div>
                <TrophyIcon size={18} />
              </div>
            </div>

            <button
              type="button"
              onClick={() => doSave({ amount: realismData.suggestedAmount, months: realismData.suggestedHorizonMonths, finalGoalAmount: userAmount, isUnrealistic: true, subGoalIndex: 0 })}
              className={s.primaryBtn}
            >
              Empezar paso 1 → {fmtEUR(realismData.suggestedAmount)}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Form screen ───────────────────────────────────────────────────────────
  return (
    <main className={s.page}>
      <div className={s.sky} />

      <div className={s.container}>
        <div className={s.brandRow}>
          <div className={s.brandMark}>A</div>
          <div>
            <span className={s.brandName}>Ahorro </span>
            <span className={s.brandAccent}>Invisible</span>
          </div>
        </div>

        <div className={s.card}>
          <div className={s.stepHeader}>
            <div className={s.medallion}>
              <TargetIcon size={16} />
            </div>
            <span className={s.stepLabel}>Último paso · Tu objetivo</span>
          </div>

          <h1 className={s.title}>Define tu primer objetivo</h1>
          <p className={s.sub}>
            Será tu referencia diaria. Puedes editarlo en cualquier momento.
          </p>

          {suggestion && goalSource === 'onboarding' && (
            <div className={s.suggestionBox}>
              <p className={s.suggestionTitle}>Sugerido para tu perfil</p>
              <p className={s.suggestionText}>
                Con tus ingresos puedes ahorrar ~<strong className={s.highlightViolet}>{fmtEUR(suggestion.monthly)}/mes</strong>. Meta inicial: <strong className={s.highlightViolet}>{fmtEUR(suggestion.target)}</strong> en {suggestion.horizonMonths} {suggestion.horizonMonths === 1 ? 'mes' : 'meses'}. Puedes ajustarlo.
              </p>
            </div>
          )}

          {error && <div className={s.errorBox}>{error}</div>}

          <form onSubmit={handleSubmit} className={s.form}>
            <div>
              <label className={s.label} htmlFor="new-goal-title">Nombre del objetivo</label>
              <input
                id="new-goal-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Viaje, emergencia, formación..."
                className={s.input}
              />
            </div>

            <div>
              <label className={s.label} htmlFor="new-goal-amount">Meta (€)</label>
              <input
                id="new-goal-amount"
                type="number"
                min="1"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="5000"
                className={s.input}
              />
            </div>

            <div>
              <label className={s.label} htmlFor="new-goal-months">Horizonte (meses)</label>
              <input
                id="new-goal-months"
                type="number"
                min="1"
                value={horizonMonths}
                onChange={(e) => setHorizonMonths(e.target.value)}
                placeholder="12"
                className={s.input}
              />
            </div>

            <div className={s.hintBox}>
              <span className={s.hintIcon}><TrendingUpIcon size={13} /></span>
              <p className={s.hintText}>
                Con cada decisión diaria irás acumulando pequeños ahorros hacia este objetivo.
              </p>
            </div>

            <button type="submit" className={s.primaryBtn}>
              Ir al Dashboard →
            </button>
          </form>
        </div>

        <p className={s.footerNote}>
          Ya casi estás. Solo queda este paso
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
