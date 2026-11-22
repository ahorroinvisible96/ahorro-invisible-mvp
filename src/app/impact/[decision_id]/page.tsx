"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { analytics } from "@/services/analytics";
import { QUESTIONS_BANK } from "@/services/dailyQuestionsBank";
import type { DailyDecision, Goal } from "@/types/Dashboard";
import { CheckIcon, BoltIcon, TargetIcon } from "@/components/ui/AppIcons";
import styles from "./Impact.module.css";

type StoreShape = { decisions: DailyDecision[]; goals: Goal[] };

function formatEUR(n: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
}

function formatDate(d: string): string {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d));
}

export default function ImpactPage() {
  const router = useRouter();
  const routeParams = useParams();
  const decisionId = typeof routeParams?.decision_id === 'string'
    ? routeParams.decision_id
    : Array.isArray(routeParams?.decision_id)
      ? routeParams.decision_id[0]
      : '';
  const [decision, setDecision] = useState<DailyDecision | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [sameDecisionCount, setSameDecisionCount] = useState(0);
  const [totalSavedAllTime, setTotalSavedAllTime] = useState(0);
  const [shared, setShared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    try {
      const isAuthenticated = localStorage.getItem("isAuthenticated");
      if (isAuthenticated !== "true") { router.replace("/login"); return; }

      const raw = localStorage.getItem("ahorro_invisible_dashboard_v1");
      if (!raw) { setError(true); setLoading(false); return; }

      const store = JSON.parse(raw) as StoreShape;
      const found = store.decisions.find((d) => d.id === decisionId) ?? null;
      if (!found) { setError(true); setLoading(false); return; }

      const foundGoal = store.goals.find((g) => g.id === found.goalId) ?? null;

      const count = store.decisions.filter(
        (d) => d.questionId === found.questionId && d.answerKey === found.answerKey
      ).length;
      setSameDecisionCount(count);

      const total = store.decisions.reduce((s, d) => s + (d.deltaAmount ?? 0), 0);
      setTotalSavedAllTime(total);

      setDecision(found);
      setGoal(foundGoal);
      setLoading(false);

      analytics.impactViewed(
        found.date, found.questionId, found.answerKey,
        found.monthlyProjection > 0 || found.yearlyProjection > 0,
      );
    } catch {
      setError(true);
      setLoading(false);
    }
  }, [decisionId, router]);

  useEffect(() => {
    analytics.setScreen("impact");
    load();
  }, [load]);

  const q = decision ? QUESTIONS_BANK.find((item) => item.id === decision.questionId) : null;
  const goalPct = goal ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;

  const NEGATIVE_TIPS: Record<string, string> = {
    coffee: 'Mañana tienes otra oportunidad. El hábito se construye con la tendencia, no con cada día.',
    delivery: 'Cocinar en casa suma poco a poco. La próxima vez que lo evites, habrás compensado hoy.',
    transport: 'El transporte tiene días inevitables. Lo que cuenta es la tendencia semanal.',
    impulse: 'Haberlo registrado ya es un acto de consciencia. La próxima vez el freno llegará antes.',
    subscription: 'Las suscripciones se optimizan una vez y ahorran para siempre. Anótatela para revisarla.',
  };

  const isNegativeDecision = (decision?.deltaAmount ?? -1) === 0 && (decision?.monthlyProjection ?? -1) === 0;
  const negativeTip = isNegativeDecision && decision
    ? (NEGATIVE_TIPS[decision.questionId] ?? 'Registrar tu decisión, sea cual sea, es el hábito más poderoso.')
    : null;

  if (loading) {
    return <div className={styles.centerState}>Cargando impacto...</div>;
  }

  if (error || !decision) {
    return (
      <div className={styles.centerState}>
        <p style={{ margin: 0, fontSize: 14 }}>No se encontró esta decisión.</p>
        <button type="button" onClick={() => router.push('/dashboard')} className={styles.btnWhite} style={{ width: 'auto', padding: '0 24px' }}>
          Volver al dashboard
        </button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={`${styles.sky} ${isNegativeDecision ? styles.skyNeutral : ''}`}>
        <div className={styles.inner}>
          <div className={styles.topBar}>
            <button type="button" onClick={() => router.push('/dashboard')} className={styles.glassBtn} aria-label="Volver al dashboard">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className={styles.dateLabel}>{formatDate(decision.date)}</span>
            <div style={{ width: 38 }} />
          </div>

          <div className={styles.heroCenter}>
            <div className={`${styles.heroMedallion} ${isNegativeDecision ? styles.heroMedallionNeutral : ''}`}>
              <CheckIcon size={24} />
            </div>
            <div className={styles.heroAmount}>
              {decision.deltaAmount > 0 ? `+${formatEUR(decision.deltaAmount)}` : '0 €'}
            </div>
            <h1 className={styles.heroTitle}>
              {isNegativeDecision ? 'Decisión registrada' : 'Impacto registrado hoy'}
            </h1>
            <p className={styles.heroSub}>
              {isNegativeDecision ? 'La constancia importa más que cada día individual.' : 'Esto es lo que suma tu constancia.'}
            </p>
            {totalSavedAllTime > 0 && (
              <div className={styles.heroPill}>Total acumulado · {formatEUR(totalSavedAllTime)}</div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.body}>
        <section className={styles.card}>
          <div className={styles.rows}>
            <div className={styles.row}>
              <div className={`${styles.medallion} ${styles.mViolet}`}>
                <BoltIcon size={18} />
              </div>
              <div className={styles.rowMid}>
                <p className={styles.rowTitle}>{q?.text ?? decision.questionId}</p>
                <p className={styles.rowSub}>
                  {sameDecisionCount > 1
                    ? `${sameDecisionCount}ª vez tomando esta decisión`
                    : decision.deltaAmount > 0 ? `Ahorré ${formatEUR(decision.deltaAmount)}` : 'Registrado hoy'}
                </p>
              </div>
            </div>

            {isNegativeDecision && negativeTip && (
              <div className={styles.row}>
                <div className={`${styles.medallion} ${styles.mAmber}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18h6" /><path d="M10 22h4" />
                    <path d="M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2z" />
                  </svg>
                </div>
                <div className={styles.rowMid}>
                  <p className={styles.rowTitle}>Para la próxima</p>
                  <p className={styles.rowSub}>{negativeTip}</p>
                </div>
              </div>
            )}

            {goal && (
              <div className={styles.row}>
                <div className={`${styles.medallion} ${styles.mCobalt}`}>
                  <TargetIcon size={18} />
                </div>
                <div className={styles.rowMid}>
                  <div className={styles.rowTitleRow}>
                    <span className={styles.rowTitle}>{goal.title}</span>
                    <span className={styles.rowPct}>{goalPct}%</span>
                  </div>
                  <p className={styles.rowSub}>
                    {formatEUR(goal.currentAmount)} de {formatEUR(goal.targetAmount)}
                  </p>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${goalPct}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className={styles.ctas}>
          <button
            type="button"
            onClick={async () => {
              const shareText = `Con Ahorro Invisible acabo de registrar una decisión consciente. ¡Construyendo hábitos de ahorro!`;
              if (navigator.share) {
                await navigator.share({ title: 'Mi decisión en Ahorro Invisible', text: shareText, url: 'https://ahorro-invisible.vercel.app' }).catch(() => null);
              } else {
                await navigator.clipboard.writeText(shareText).catch(() => null);
                setShared(true);
                setTimeout(() => setShared(false), 2500);
              }
            }}
            className={styles.btnWhite}
          >
            {shared ? 'Copiado al portapapeles' : 'Compartir mi logro'}
          </button>
          <button
            type="button"
            onClick={() => { analytics.impactCtaExtraSavingsClicked(); router.push('/extra-saving'); }}
            className={styles.btnGhost}
          >
            Registrar acción extra
          </button>
          <button
            type="button"
            onClick={() => { analytics.impactCtaHistoryClicked(); router.push('/history'); }}
            className={styles.btnLink}
          >
            Ver historial completo
          </button>
        </div>
      </div>
    </div>
  );
}
