"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import styles from "./analytics.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────
interface KPIs {
  totalUsers: number;
  totalSaved: number;
  totalDecisions: number;
  avgStreak: number;
  activeGoals: number;
  completedGoals: number;
}

interface Retention {
  dau: number;
  wau: number;
  mau: number;
  total_users: number;
  dau_pct: number;
  wau_pct: number;
}

interface DailySaving {
  date: string;
  amount: number;
  cumulative: number;
}

interface QuestionStat {
  question_id: string;
  answer_key: string;
  answer_count: number;
  unique_users: number;
  avg_delta: number;
  total_delta: number;
  pct_in_question: number;
}

interface RecentDecision {
  id: string;
  date: string;
  question_id: string;
  answer_key: string;
  delta_amount: number;
  monthly_projection: number;
  yearly_projection: number;
}

interface GoalProgress {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  percent: number;
  is_primary: boolean;
}

interface AnalyticsData {
  kpis: KPIs;
  retention: Retention | null;
  dailySavings: DailySaving[];
  feelingDist: Record<string, number>;
  questionStats: QuestionStat[];
  recentDecisions: RecentDecision[];
  goalProgress: GoalProgress[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatEUR(n: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
}

const FEELING_MAP: Record<string, { emoji: string; label: string }> = {
  tranquilo: { emoji: "😌", label: "Tranquilo" },
  estresado: { emoji: "😰", label: "Estresado" },
  motivado: { emoji: "💪", label: "Motivado" },
  indiferente: { emoji: "😐", label: "Indiferente" },
  preocupado: { emoji: "😟", label: "Preocupado" },
  optimista: { emoji: "🌟", label: "Optimista" },
  "Sin respuesta": { emoji: "❓", label: "Sin respuesta" },
};

const QUESTION_LABELS: Record<string, string> = {
  coffee: "☕ Café",
  delivery: "🛵 Delivery",
  impulse: "🛍️ Compra impulsiva",
  impulse_online: "📦 Compra online",
  ocio_bar: "🍺 Ocio / Bar",
  transport: "🚗 Transporte",
  transport_alt: "🚌 Alt. Transporte",
  transport_share: "🤝 Compartir viaje",
  subscription: "📱 Suscripciones",
  tech_apps: "💻 Apps/Tech",
  hogar_energy: "💡 Energía hogar",
  hogar_water: "💧 Agua",
  hogar_meal_plan: "🍽️ Planif. comidas",
  hogar_heating: "🌡️ Calefacción",
  salud_lunch: "🥗 Almuerzo sano",
  salud_exercise: "🏃 Ejercicio",
  salud_generic: "❤️ Salud general",
  ocio_streaming: "📺 Streaming",
  ocio_library: "📚 Biblioteca",
  tech_gadget: "📱 Gadgets",
  extra_saving: "💰 Ahorro extra",
};

const BAR_COLORS = [
  "linear-gradient(90deg, #a855f7, #7c3aed)",
  "linear-gradient(90deg, #3b82f6, #2563eb)",
  "linear-gradient(90deg, #22c55e, #16a34a)",
  "linear-gradient(90deg, #f59e0b, #d97706)",
  "linear-gradient(90deg, #ef4444, #dc2626)",
  "linear-gradient(90deg, #ec4899, #db2777)",
  "linear-gradient(90deg, #06b6d4, #0891b2)",
];

// ── Chart drawing ─────────────────────────────────────────────────────────────
function drawSavingsChart(
  canvas: HTMLCanvasElement,
  data: DailySaving[],
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || data.length === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const padL = 52;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  ctx.clearRect(0, 0, W, H);

  const maxVal = Math.max(...data.map((d) => d.cumulative), 1);

  // Grid lines
  const gridLines = 4;
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  ctx.font = "10px Inter, system-ui, sans-serif";
  ctx.fillStyle = "rgba(148,163,184,0.4)";
  ctx.textAlign = "right";
  for (let i = 0; i <= gridLines; i++) {
    const y = padT + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    const val = maxVal - (maxVal / gridLines) * i;
    ctx.fillText(`${Math.round(val)}€`, padL - 8, y + 3);
  }

  // X-axis labels
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(148,163,184,0.35)";
  const step = Math.max(1, Math.floor(data.length / 6));
  for (let i = 0; i < data.length; i += step) {
    const x = padL + (i / (data.length - 1)) * chartW;
    ctx.fillText(formatDate(data[i].date), x, H - 8);
  }

  // Cumulative area + line
  const gradient = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  gradient.addColorStop(0, "rgba(168,85,247,0.25)");
  gradient.addColorStop(1, "rgba(168,85,247,0.01)");

  // Area
  ctx.beginPath();
  ctx.moveTo(padL, padT + chartH);
  for (let i = 0; i < data.length; i++) {
    const x = padL + (i / (data.length - 1)) * chartW;
    const y = padT + chartH - (data[i].cumulative / maxVal) * chartH;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(padL + chartW, padT + chartH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Line
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = padL + (i / (data.length - 1)) * chartW;
    const y = padT + chartH - (data[i].cumulative / maxVal) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "#a855f7";
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.stroke();

  // Daily bars (subtle)
  const barW = Math.max(2, (chartW / data.length) * 0.5);
  const dailyMax = Math.max(...data.map((d) => d.amount), 1);
  for (let i = 0; i < data.length; i++) {
    if (data[i].amount <= 0) continue;
    const x = padL + (i / (data.length - 1)) * chartW - barW / 2;
    const barH = (data[i].amount / dailyMax) * (chartH * 0.3);
    const y = padT + chartH - barH;
    ctx.fillStyle = "rgba(37,99,235,0.35)";
    ctx.fillRect(x, y, barW, barH);
  }

  // End dot
  if (data.length > 0) {
    const last = data[data.length - 1];
    const x = padL + chartW;
    const y = padT + chartH - (last.cumulative / maxVal) * chartH;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#a855f7";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(168,85,247,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// ── Page Component ────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const chartRef = useRef<HTMLCanvasElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setLastUpdate(
        new Date().toLocaleString("es-ES", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Draw chart when data loads
  useEffect(() => {
    if (!data || !chartRef.current) return;
    drawSavingsChart(chartRef.current, data.dailySavings);

    const handleResize = () => {
      if (chartRef.current && data) {
        drawSavingsChart(chartRef.current, data.dailySavings);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [data]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}>
          <div className={styles.spinner} />
          <span className={styles.loadingText}>Cargando analytics…</span>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className={styles.page}>
        <div className={styles.errorWrap}>
          <span className={styles.errorIcon}>⚠️</span>
          <p className={styles.errorText}>{error ?? "No se pudieron cargar los datos"}</p>
          <button className={styles.retryBtn} onClick={fetchData}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ── Group question stats by question_id ─────────────────────────────────────
  const groupedQuestions: Record<string, QuestionStat[]> = {};
  for (const qs of data.questionStats) {
    if (!groupedQuestions[qs.question_id]) groupedQuestions[qs.question_id] = [];
    groupedQuestions[qs.question_id].push(qs);
  }
  // Sort by total count per question
  const sortedQuestions = Object.entries(groupedQuestions).sort(
    (a, b) =>
      b[1].reduce((s, q) => s + q.answer_count, 0) -
      a[1].reduce((s, q) => s + q.answer_count, 0),
  );

  // Feeling distribution sorted
  const feelingSorted = Object.entries(data.feelingDist).sort((a, b) => b[1] - a[1]);
  const maxFeeling = feelingSorted.length > 0 ? feelingSorted[0][1] : 1;

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerIcon}>📊</div>
          <h1 className={styles.headerTitle}>Analytics Dashboard</h1>
        </div>
        <p className={styles.headerSub}>
          Panel de métricas de Ahorro Invisible — datos en tiempo real desde Supabase
        </p>
        <div className={styles.headerActions}>
          <span className={styles.lastUpdated}>
            Última actualización: {lastUpdate}
          </span>
          <button className={styles.refreshBtn} onClick={fetchData}>
            🔄 Actualizar
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {/* ── KPI Cards ── */}
        <div className={styles.kpiRow}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <div
                className={styles.kpiIcon}
                style={{
                  background: "rgba(168,85,247,0.15)",
                  border: "1px solid rgba(168,85,247,0.3)",
                }}
              >
                👥
              </div>
              <span className={styles.kpiLabel}>Usuarios</span>
            </div>
            <div className={styles.kpiValue} style={{ color: "#c4b5fd" }}>
              {data.kpis.totalUsers}
            </div>
            <span className={styles.kpiSub}>
              {data.kpis.activeGoals} objetivos activos
            </span>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <div
                className={styles.kpiIcon}
                style={{
                  background: "rgba(34,197,94,0.15)",
                  border: "1px solid rgba(34,197,94,0.3)",
                }}
              >
                💰
              </div>
              <span className={styles.kpiLabel}>Ahorro Total</span>
            </div>
            <div className={styles.kpiValue} style={{ color: "#4ade80" }}>
              {formatEUR(data.kpis.totalSaved)}
            </div>
            <span className={styles.kpiSub}>
              {data.kpis.completedGoals} objetivos completados
            </span>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <div
                className={styles.kpiIcon}
                style={{
                  background: "rgba(37,99,235,0.15)",
                  border: "1px solid rgba(37,99,235,0.3)",
                }}
              >
                ⚡
              </div>
              <span className={styles.kpiLabel}>Decisiones</span>
            </div>
            <div className={styles.kpiValue} style={{ color: "#60a5fa" }}>
              {data.kpis.totalDecisions}
            </div>
            <span className={styles.kpiSub}>decisiones diarias tomadas</span>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <div
                className={styles.kpiIcon}
                style={{
                  background: "rgba(245,158,11,0.15)",
                  border: "1px solid rgba(245,158,11,0.3)",
                }}
              >
                🔥
              </div>
              <span className={styles.kpiLabel}>Racha Media</span>
            </div>
            <div className={styles.kpiValue} style={{ color: "#fbbf24" }}>
              {data.kpis.avgStreak}
            </div>
            <span className={styles.kpiSub}>días consecutivos promedio</span>
          </div>
        </div>

        {/* ── Savings Chart + Retention ── */}
        <div className={styles.twoCol}>
          <div className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionTitleIcon}>📈</span>
              Ahorro acumulado (últimos 30 días)
            </h2>
            <div className={styles.chartWrap}>
              <canvas ref={chartRef} className={styles.chartCanvas} />
            </div>
          </div>

          <div className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionTitleIcon}>📡</span>
              Retención de usuarios
            </h2>
            {data.retention ? (
              <>
                <div className={styles.retentionRow}>
                  <div className={styles.retentionCard}>
                    <div className={styles.retentionLabel}>DAU (hoy)</div>
                    <div
                      className={styles.retentionValue}
                      style={{ color: "#4ade80" }}
                    >
                      {data.retention.dau}
                    </div>
                    <div className={styles.retentionPct}>
                      {data.retention.dau_pct ?? 0}% del total
                    </div>
                  </div>
                  <div className={styles.retentionCard}>
                    <div className={styles.retentionLabel}>WAU (7 días)</div>
                    <div
                      className={styles.retentionValue}
                      style={{ color: "#60a5fa" }}
                    >
                      {data.retention.wau}
                    </div>
                    <div className={styles.retentionPct}>
                      {data.retention.wau_pct ?? 0}% del total
                    </div>
                  </div>
                  <div className={styles.retentionCard}>
                    <div className={styles.retentionLabel}>MAU (30 días)</div>
                    <div
                      className={styles.retentionValue}
                      style={{ color: "#c4b5fd" }}
                    >
                      {data.retention.mau}
                    </div>
                    <div className={styles.retentionPct}>
                      de {data.retention.total_users} totales
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>
                No hay datos de retención todavía
              </div>
            )}
          </div>
        </div>

        {/* ── Goal Progress + Feeling Distribution ── */}
        <div className={styles.twoCol}>
          <div className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionTitleIcon}>🎯</span>
              Progreso de objetivos activos
            </h2>
            {data.goalProgress.length > 0 ? (
              data.goalProgress.map((g) => (
                <div key={g.id} className={styles.goalItem}>
                  <div className={styles.goalTop}>
                    <span className={styles.goalTitle}>
                      {g.is_primary && "⭐ "}
                      {g.title}
                    </span>
                    <span
                      className={styles.goalPct}
                      style={{
                        color:
                          g.percent >= 100
                            ? "#4ade80"
                            : g.percent >= 50
                              ? "#fbbf24"
                              : "#c4b5fd",
                      }}
                    >
                      {g.percent}%
                    </span>
                  </div>
                  <div className={styles.goalTrack}>
                    <div
                      className={styles.goalFill}
                      style={{
                        width: `${Math.min(100, g.percent)}%`,
                        background:
                          g.percent >= 100
                            ? "linear-gradient(90deg, #22c55e, #4ade80)"
                            : undefined,
                      }}
                    />
                  </div>
                  <div className={styles.goalAmounts}>
                    <span>{formatEUR(g.current_amount)}</span>
                    <span>{formatEUR(g.target_amount)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>
                No hay objetivos activos
              </div>
            )}
          </div>

          <div className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionTitleIcon}>💜</span>
              Relación con el dinero
            </h2>
            {feelingSorted.length > 0 ? (
              feelingSorted.map(([feeling, count]) => {
                const meta = FEELING_MAP[feeling] ?? {
                  emoji: "🔹",
                  label: feeling,
                };
                return (
                  <div key={feeling} className={styles.feelingItem}>
                    <span className={styles.feelingEmoji}>{meta.emoji}</span>
                    <div className={styles.feelingInfo}>
                      <div className={styles.feelingName}>{meta.label}</div>
                      <div className={styles.feelingBar}>
                        <div
                          className={styles.feelingFill}
                          style={{
                            width: `${(count / maxFeeling) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className={styles.feelingCount}>{count}</span>
                  </div>
                );
              })
            ) : (
              <div className={styles.emptyState}>Sin datos de perfil</div>
            )}
          </div>
        </div>

        {/* ── Question Stats ── */}
        <div className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionTitleIcon}>📋</span>
            Distribución de respuestas por pregunta
          </h2>
          {sortedQuestions.length > 0 ? (
            <div className={styles.twoCol}>
              {sortedQuestions.slice(0, 10).map(([qId, answers], qi) => {
                const totalQ = answers.reduce((s, a) => s + a.answer_count, 0);
                return (
                  <div key={qId}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#e2e8f0",
                        marginBottom: 10,
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{QUESTION_LABELS[qId] ?? qId}</span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "rgba(148,163,184,0.4)",
                          fontWeight: 400,
                        }}
                      >
                        {totalQ} respuestas
                      </span>
                    </div>
                    {answers.map((a, ai) => (
                      <div key={a.answer_key} className={styles.barGroup}>
                        <div className={styles.barLabel}>
                          <span>{a.answer_key}</span>
                          <span className={styles.barLabelCount}>
                            {a.answer_count} ({a.pct_in_question}%)
                          </span>
                        </div>
                        <div className={styles.barTrack}>
                          <div
                            className={styles.barFill}
                            style={{
                              width: `${a.pct_in_question}%`,
                              background:
                                BAR_COLORS[(qi + ai) % BAR_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              No hay datos de preguntas todavía
            </div>
          )}
        </div>

        {/* ── Recent Decisions Table ── */}
        <div className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionTitleIcon}>🕐</span>
            Últimas decisiones
          </h2>
          {data.recentDecisions.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Pregunta</th>
                    <th>Respuesta</th>
                    <th>Ahorro</th>
                    <th>Proy. Mensual</th>
                    <th>Proy. Anual</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentDecisions.map((d) => (
                    <tr key={d.id}>
                      <td>{formatDate(d.date)}</td>
                      <td>
                        <span className={styles.badge}>
                          {QUESTION_LABELS[d.question_id] ?? d.question_id}
                        </span>
                      </td>
                      <td>{d.answer_key}</td>
                      <td
                        className={
                          d.delta_amount > 0
                            ? styles.amountPositive
                            : d.delta_amount < 0
                              ? styles.amountNegative
                              : styles.amountZero
                        }
                      >
                        {d.delta_amount > 0 ? "+" : ""}
                        {formatEUR(d.delta_amount)}
                      </td>
                      <td style={{ color: "rgba(148,163,184,0.6)" }}>
                        {formatEUR(d.monthly_projection)}
                      </td>
                      <td style={{ color: "rgba(148,163,184,0.6)" }}>
                        {formatEUR(d.yearly_projection)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              No hay decisiones registradas
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
