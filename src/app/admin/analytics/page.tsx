"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import styles from "./analytics.module.css";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════
interface KPIs {
  totalUsers: number;
  totalSaved: number;
  totalDecisions: number;
  avgStreak: number;
  activeGoals: number;
  completedGoals: number;
}
interface Retention { dau: number; wau: number; mau: number; total_users: number; dau_pct: number; wau_pct: number; }
interface DailySaving { date: string; amount: number; cumulative: number; }
interface QuestionStat { question_id: string; answer_key: string; answer_count: number; unique_users: number; avg_delta: number; total_delta: number; pct_in_question: number; }
interface RecentDecision { id: string; date: string; question_id: string; answer_key: string; delta_amount: number; monthly_projection: number; yearly_projection: number; }
interface GoalProgress { id: string; title: string; target_amount: number; current_amount: number; percent: number; is_primary: boolean; }
interface AnalyticsData {
  kpis: KPIs;
  retention: Retention | null;
  dailySavings: DailySaving[];
  feelingDist: Record<string, number>;
  questionStats: QuestionStat[];
  recentDecisions: RecentDecision[];
  goalProgress: GoalProgress[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function fmtEUR(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}
function fmtDateFull(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
}

const FEELING_MAP: Record<string, { emoji: string; label: string; color: string }> = {
  tranquilo:      { emoji: "😌", label: "Tranquilo",      color: "#22c55e" },
  estresado:      { emoji: "😰", label: "Estresado",      color: "#ef4444" },
  motivado:       { emoji: "💪", label: "Motivado",       color: "#f59e0b" },
  indiferente:    { emoji: "😐", label: "Indiferente",    color: "#64748b" },
  preocupado:     { emoji: "😟", label: "Preocupado",     color: "#f97316" },
  optimista:      { emoji: "🌟", label: "Optimista",      color: "#a855f7" },
  planning:       { emoji: "📋", label: "Planning",       color: "#3b82f6" },
  avoidant:       { emoji: "🙈", label: "Avoidant",       color: "#ec4899" },
  anxious:        { emoji: "😰", label: "Anxious",        color: "#ef4444" },
  "Sin respuesta":{ emoji: "❓", label: "Sin respuesta",  color: "#475569" },
};

const Q_LABELS: Record<string, string> = {
  coffee: "☕ Café", delivery: "🛵 Delivery", impulse: "🛍️ Compra impulsiva",
  impulse_online: "📦 Compra online", ocio_bar: "🍺 Ocio / Bar",
  transport: "🚗 Transporte", transport_alt: "🚌 Alt. Transporte",
  transport_share: "🤝 Compartir viaje", subscription: "📱 Suscripciones",
  tech_apps: "💻 Apps/Tech", hogar_energy: "💡 Energía", hogar_water: "💧 Agua",
  hogar_meal_plan: "🍽️ Planif. comidas", hogar_heating: "🌡️ Calefacción",
  salud_lunch: "🥗 Almuerzo", salud_exercise: "🏃 Ejercicio",
  salud_generic: "❤️ Salud", ocio_streaming: "📺 Streaming",
  ocio_library: "📚 Biblioteca", tech_gadget: "📱 Gadgets", extra_saving: "💰 Ahorro extra",
};

const GRAD = [
  "#a855f7", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#8b5cf6",
];

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED COUNTER HOOK
// ═══════════════════════════════════════════════════════════════════════════════
function useAnimatedValue(target: number, duration = 1200, decimals = 0) {
  const [value, setValue] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(Number((from + (target - from) * ease).toFixed(decimals)));
      if (t < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, decimals]);
  return value;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPARKLINE DRAWER
// ═══════════════════════════════════════════════════════════════════════════════
function drawSparkline(canvas: HTMLCanvasElement, data: number[], color: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx || data.length < 2) return;
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  canvas.width = r.width * dpr;
  canvas.height = r.height * dpr;
  ctx.scale(dpr, dpr);
  const W = r.width, H = r.height;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  ctx.clearRect(0, 0, W, H);
  // gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, color + "30");
  grad.addColorStop(1, color + "05");
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((data[i] - min) / range) * H * 0.85 - H * 0.05;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  // line
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((data[i] - min) / range) * H * 0.85 - H * 0.05;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.stroke();
  // end dot
  const lastY = H - ((data[data.length - 1] - min) / range) * H * 0.85 - H * 0.05;
  ctx.beginPath();
  ctx.arc(W, lastY, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CHART DRAWER (with tooltip support)
// ═══════════════════════════════════════════════════════════════════════════════
function drawMainChart(
  canvas: HTMLCanvasElement,
  data: DailySaving[],
  hoverIdx: number | null,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || data.length === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  canvas.width = r.width * dpr;
  canvas.height = r.height * dpr;
  ctx.scale(dpr, dpr);
  const W = r.width, H = r.height;
  const pL = 56, pR = 20, pT = 20, pB = 32;
  const cW = W - pL - pR, cH = H - pT - pB;
  ctx.clearRect(0, 0, W, H);
  const maxVal = Math.max(...data.map(d => d.cumulative), 1);

  // grid
  const lines = 5;
  ctx.font = "10px Inter, system-ui, sans-serif";
  for (let i = 0; i <= lines; i++) {
    const y = pT + (cH / lines) * i;
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(W - pR, y); ctx.stroke();
    ctx.fillStyle = "rgba(148,163,184,0.35)";
    ctx.textAlign = "right";
    const val = maxVal - (maxVal / lines) * i;
    ctx.fillText(`${Math.round(val)}€`, pL - 10, y + 3);
  }

  // x labels
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(148,163,184,0.3)";
  const step = Math.max(1, Math.floor(data.length / 6));
  for (let i = 0; i < data.length; i += step) {
    const x = pL + (i / (data.length - 1)) * cW;
    ctx.fillText(fmtDate(data[i].date), x, H - 6);
  }

  // bars (daily amounts)
  const barW = Math.max(3, (cW / data.length) * 0.55);
  const dailyMax = Math.max(...data.map(d => d.amount), 1);
  for (let i = 0; i < data.length; i++) {
    if (data[i].amount <= 0) continue;
    const x = pL + (i / (data.length - 1)) * cW - barW / 2;
    const barH = (data[i].amount / dailyMax) * (cH * 0.3);
    const y = pT + cH - barH;
    ctx.fillStyle = hoverIdx === i ? "rgba(37,99,235,0.55)" : "rgba(37,99,235,0.25)";
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 2);
    ctx.fill();
  }

  // area fill
  const grad = ctx.createLinearGradient(0, pT, 0, pT + cH);
  grad.addColorStop(0, "rgba(168,85,247,0.22)");
  grad.addColorStop(1, "rgba(168,85,247,0.01)");
  ctx.beginPath();
  ctx.moveTo(pL, pT + cH);
  for (let i = 0; i < data.length; i++) {
    const x = pL + (i / (data.length - 1)) * cW;
    const y = pT + cH - (data[i].cumulative / maxVal) * cH;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(pL + cW, pT + cH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // line
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = pL + (i / (data.length - 1)) * cW;
    const y = pT + cH - (data[i].cumulative / maxVal) * cH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "#a855f7";
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  // dots at each point
  for (let i = 0; i < data.length; i++) {
    const x = pL + (i / (data.length - 1)) * cW;
    const y = pT + cH - (data[i].cumulative / maxVal) * cH;
    if (hoverIdx === i) {
      // hover dot
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(168,85,247,0.2)"; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#a855f7"; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = "#fff"; ctx.fill();
      // vertical guide
      ctx.strokeStyle = "rgba(168,85,247,0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(x, pT); ctx.lineTo(x, pT + cH); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // end dot
  if (hoverIdx === null && data.length > 0) {
    const last = data[data.length - 1];
    const x = pL + cW;
    const y = pT + cH - (last.cumulative / maxVal) * cH;
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#a855f7"; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(168,85,247,0.25)"; ctx.lineWidth = 2; ctx.stroke();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DONUT CHART
// ═══════════════════════════════════════════════════════════════════════════════
function drawDonut(canvas: HTMLCanvasElement, segments: { label: string; value: number; color: string }[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  canvas.width = r.width * dpr;
  canvas.height = r.height * dpr;
  ctx.scale(dpr, dpr);
  const W = r.width, H = r.height;
  const cx = W / 2, cy = H / 2;
  const outerR = Math.min(W, H) / 2 - 4;
  const innerR = outerR * 0.62;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return;

  let startAngle = -Math.PI / 2;
  const gap = 0.03;

  for (const seg of segments) {
    const sliceAngle = (seg.value / total) * (Math.PI * 2 - gap * segments.length);
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, startAngle + gap / 2, startAngle + sliceAngle - gap / 2);
    ctx.arc(cx, cy, innerR, startAngle + sliceAngle - gap / 2, startAngle + gap / 2, true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    startAngle += sliceAngle + gap;
  }

  // center text
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 22px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(total), cx, cy - 6);
  ctx.fillStyle = "rgba(148,163,184,0.5)";
  ctx.font = "10px Inter, system-ui, sans-serif";
  ctx.fillText("usuarios", cx, cy + 12);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSV EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
function exportCSV(decisions: RecentDecision[]) {
  const header = "Fecha,Pregunta,Respuesta,Ahorro,Proy.Mensual,Proy.Anual\n";
  const rows = decisions.map(d =>
    `${d.date},${d.question_id},${d.answer_key},${d.delta_amount},${d.monthly_projection},${d.yearly_projection}`
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analytics_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
type TabKey = "overview" | "decisions" | "goals";
type SortCol = "date" | "question_id" | "answer_key" | "delta_amount" | "monthly_projection" | "yearly_projection";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const chartRef = useRef<HTMLCanvasElement>(null);
  const donutRef = useRef<HTMLCanvasElement>(null);
  const sparkRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  // Animated KPI values
  const animUsers = useAnimatedValue(data?.kpis.totalUsers ?? 0);
  const animSaved = useAnimatedValue(data?.kpis.totalSaved ?? 0, 1400);
  const animDecisions = useAnimatedValue(data?.kpis.totalDecisions ?? 0);
  const animStreak = useAnimatedValue(data?.kpis.avgStreak ?? 0, 1000, 1);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setLastUpdate(new Date().toLocaleString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (err) { setError(String(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Draw charts ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!data) return;

    // Main chart
    if (chartRef.current) drawMainChart(chartRef.current, data.dailySavings, hoverIdx);

    // Donut
    if (donutRef.current) {
      const segments = Object.entries(data.feelingDist)
        .sort((a, b) => b[1] - a[1])
        .map(([key, val]) => ({
          label: FEELING_MAP[key]?.label ?? key,
          value: val,
          color: FEELING_MAP[key]?.color ?? "#64748b",
        }));
      drawDonut(donutRef.current, segments);
    }

    // Sparklines
    const sparkData = [
      data.dailySavings.map(d => d.cumulative),
      data.dailySavings.map(d => d.amount),
      data.dailySavings.map((_, i) => Math.min(i + 1, data.kpis.totalDecisions)),
      data.dailySavings.map((_, i) => Math.max(0, data.kpis.avgStreak - Math.random() * 0.5)),
    ];
    const sparkColors = ["#4ade80", "#60a5fa", "#c4b5fd", "#fbbf24"];
    sparkRefs.current.forEach((c, i) => {
      if (c && sparkData[i]?.length > 1) drawSparkline(c, sparkData[i], sparkColors[i]);
    });

    const handleResize = () => {
      if (chartRef.current) drawMainChart(chartRef.current, data.dailySavings, hoverIdx);
      if (donutRef.current) {
        const segs = Object.entries(data.feelingDist).sort((a, b) => b[1] - a[1])
          .map(([k, v]) => ({ label: FEELING_MAP[k]?.label ?? k, value: v, color: FEELING_MAP[k]?.color ?? "#64748b" }));
        drawDonut(donutRef.current, segs);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [data, hoverIdx]);

  // ── Chart hover logic ─────────────────────────────────────────────────────
  const handleChartMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!data || !chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pL = 56, pR = 20;
    const cW = rect.width - pL - pR;
    const ratio = (x - pL) / cW;
    const idx = Math.round(ratio * (data.dailySavings.length - 1));
    if (idx >= 0 && idx < data.dailySavings.length) setHoverIdx(idx);
    else setHoverIdx(null);
  }, [data]);

  const handleChartLeave = useCallback(() => setHoverIdx(null), []);

  // ── Tooltip position ──────────────────────────────────────────────────────
  const tooltipStyle = useMemo(() => {
    if (hoverIdx === null || !data || !chartRef.current) return { display: "none" as const };
    const rect = chartRef.current.getBoundingClientRect();
    const pL = 56, pR = 20;
    const cW = rect.width - pL - pR;
    const x = pL + (hoverIdx / (data.dailySavings.length - 1)) * cW;
    const flipLeft = x > rect.width * 0.7;
    return { left: flipLeft ? x - 160 : x + 16, top: 20 };
  }, [hoverIdx, data]);

  // ── Sorted decisions ──────────────────────────────────────────────────────
  const sortedDecisions = useMemo(() => {
    if (!data) return [];
    const sorted = [...data.recentDecisions];
    sorted.sort((a, b) => {
      const aVal = a[sortCol];
      const bVal = b[sortCol];
      if (typeof aVal === "number" && typeof bVal === "number") return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      return sortDir === "asc" ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
    return sorted;
  }, [data, sortCol, sortDir]);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  // ── Question stats grouped ────────────────────────────────────────────────
  const groupedQ = useMemo(() => {
    if (!data) return [];
    const map: Record<string, QuestionStat[]> = {};
    for (const q of data.questionStats) {
      if (!map[q.question_id]) map[q.question_id] = [];
      map[q.question_id].push(q);
    }
    return Object.entries(map)
      .sort((a, b) => b[1].reduce((s, x) => s + x.answer_count, 0) - a[1].reduce((s, x) => s + x.answer_count, 0));
  }, [data]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (loading) return (
    <div className={styles.page}>
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
        <span className={styles.loadingText}>Cargando analytics…</span>
        <span className={styles.loadingSubText}>Conectando con Supabase</span>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className={styles.page}>
      <div className={styles.errorWrap}>
        <span className={styles.errorIcon}>⚠️</span>
        <p className={styles.errorText}>{error ?? "No se pudieron cargar los datos"}</p>
        <button className={styles.retryBtn} onClick={fetchData}>Reintentar</button>
      </div>
    </div>
  );

  const feelingSorted = Object.entries(data.feelingDist).sort((a, b) => b[1] - a[1]);

  return (
    <div className={styles.page}>
      {/* ═══ TOP BAR ═══ */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <div className={styles.topBarIcon}>📊</div>
          <div>
            <h1 className={styles.topBarTitle}>Analytics Dashboard</h1>
            <span className={styles.topBarSub}>Ahorro Invisible · {lastUpdate}</span>
          </div>
        </div>
        <div className={styles.topBarRight}>
          <div className={styles.liveDot} />
          <span className={styles.liveText}>LIVE</span>
          <button className={styles.actionBtn} onClick={() => exportCSV(data.recentDecisions)}>📥 Exportar CSV</button>
          <button className={styles.actionBtn} onClick={fetchData}>🔄 Actualizar</button>
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <div className={styles.tabBar}>
        {([["overview", "📈 Resumen"], ["decisions", "⚡ Decisiones"], ["goals", "🎯 Objetivos"]] as [TabKey, string][]).map(([key, label]) => (
          <button key={key} className={`${styles.tab} ${activeTab === key ? styles.tabActive : ""}`} onClick={() => setActiveTab(key)}>
            {label}
          </button>
        ))}
      </div>

      <div className={styles.content}>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: OVERVIEW
            ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <>
            {/* KPI CARDS */}
            <div className={styles.kpiRow}>
              {[
                { label: "USUARIOS", value: animUsers, display: String(animUsers), icon: "👥", color: "#c4b5fd", bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.25)", sub: `${data.kpis.activeGoals} objetivos activos`, idx: 0 },
                { label: "AHORRO TOTAL", value: animSaved, display: fmtEUR(animSaved), icon: "💰", color: "#4ade80", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.25)", sub: `${data.kpis.completedGoals} objetivos completados`, idx: 1 },
                { label: "DECISIONES", value: animDecisions, display: String(animDecisions), icon: "⚡", color: "#60a5fa", bg: "rgba(37,99,235,0.12)", border: "rgba(37,99,235,0.25)", sub: "decisiones diarias tomadas", idx: 2 },
                { label: "RACHA MEDIA", value: animStreak, display: String(animStreak), icon: "🔥", color: "#fbbf24", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)", sub: "días consecutivos promedio", idx: 3 },
              ].map((kpi) => (
                <div key={kpi.label} className={styles.kpiCard} style={{ animationDelay: `${kpi.idx * 0.08}s` }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${kpi.color}66, ${kpi.color}22)` }} />
                  <div className={styles.kpiTop}>
                    <div className={styles.kpiHeader}>
                      <div className={styles.kpiIcon} style={{ background: kpi.bg, border: `1px solid ${kpi.border}` }}>{kpi.icon}</div>
                      <span className={styles.kpiLabel}>{kpi.label}</span>
                    </div>
                  </div>
                  <div className={styles.kpiValue} style={{ color: kpi.color }}>{kpi.display}</div>
                  <div className={styles.kpiBottom}>
                    <span className={styles.kpiSub}>{kpi.sub}</span>
                    <div className={styles.sparkWrap}>
                      <canvas ref={el => { sparkRefs.current[kpi.idx] = el; }} className={styles.sparkCanvas} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* SAVINGS CHART + RETENTION */}
            <div className={styles.twoCol}>
              <div className={styles.sectionCard} style={{ animationDelay: "0.25s" }}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>
                    <span className={styles.sectionTitleIcon}>📈</span>
                    Ahorro acumulado
                  </h2>
                  <span style={{ fontSize: 12, color: "rgba(148,163,184,0.4)" }}>Últimos 30 días</span>
                </div>
                <div className={styles.chartWrap}>
                  <canvas
                    ref={chartRef}
                    className={styles.chartCanvas}
                    onMouseMove={handleChartMove}
                    onMouseLeave={handleChartLeave}
                  />
                  {/* Tooltip */}
                  {hoverIdx !== null && data.dailySavings[hoverIdx] && (
                    <div className={styles.tooltip} style={tooltipStyle}>
                      <div className={styles.tooltipDate}>{fmtDateFull(data.dailySavings[hoverIdx].date)}</div>
                      <div className={styles.tooltipRow}>
                        <span className={styles.tooltipLabel}>Día:</span>
                        <span className={styles.tooltipValue} style={{ color: "#60a5fa" }}>
                          {data.dailySavings[hoverIdx].amount > 0 ? "+" : ""}{fmtEUR(data.dailySavings[hoverIdx].amount)}
                        </span>
                      </div>
                      <div className={styles.tooltipRow}>
                        <span className={styles.tooltipLabel}>Acumulado:</span>
                        <span className={styles.tooltipValue} style={{ color: "#a855f7" }}>
                          {fmtEUR(data.dailySavings[hoverIdx].cumulative)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.sectionCard} style={{ animationDelay: "0.3s" }}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>
                    <span className={styles.sectionTitleIcon}>📡</span>
                    Retención
                  </h2>
                </div>
                {data.retention ? (
                  <div className={styles.retentionGrid}>
                    {[
                      { label: "DAU", value: data.retention.dau, pct: data.retention.dau_pct, color: "#4ade80" },
                      { label: "WAU", value: data.retention.wau, pct: data.retention.wau_pct, color: "#60a5fa" },
                      { label: "MAU", value: data.retention.mau, pct: null, color: "#c4b5fd" },
                      { label: "TOTAL", value: data.retention.total_users, pct: null, color: "#94a3b8" },
                    ].map(r => (
                      <div key={r.label} className={styles.retentionCard}>
                        <div className={styles.retentionLabel}>{r.label}</div>
                        <div className={styles.retentionValue} style={{ color: r.color }}>{r.value}</div>
                        <div className={styles.retentionPct}>{r.pct != null ? `${r.pct}% del total` : "registrados"}</div>
                      </div>
                    ))}
                  </div>
                ) : <div className={styles.emptyState}>Sin datos de retención</div>}
              </div>
            </div>

            {/* DONUT + QUESTION STATS */}
            <div className={styles.twoCol}>
              <div className={styles.sectionCard} style={{ animationDelay: "0.35s" }}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>
                    <span className={styles.sectionTitleIcon}>💜</span>
                    Relación con el dinero
                  </h2>
                </div>
                <div className={styles.donutWrap}>
                  <canvas ref={donutRef} className={styles.donutCanvas} />
                  <div className={styles.donutLegend}>
                    {feelingSorted.map(([key, count], i) => {
                      const meta = FEELING_MAP[key] ?? { emoji: "🔹", label: key, color: "#64748b" };
                      return (
                        <div key={key} className={styles.legendItem}>
                          <div className={styles.legendDot} style={{ background: meta.color }} />
                          <span className={styles.legendLabel}>{meta.emoji} {meta.label}</span>
                          <span className={styles.legendValue}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className={styles.sectionCard} style={{ animationDelay: "0.4s" }}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>
                    <span className={styles.sectionTitleIcon}>📋</span>
                    Top preguntas
                  </h2>
                </div>
                {groupedQ.slice(0, 6).map(([qId, answers], qi) => {
                  const total = answers.reduce((s, a) => s + a.answer_count, 0);
                  return (
                    <div key={qId} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                        <span>{Q_LABELS[qId] ?? qId}</span>
                        <span style={{ fontSize: 11, color: "rgba(148,163,184,0.35)", fontWeight: 400 }}>{total}</span>
                      </div>
                      {answers.slice(0, 3).map((a, ai) => (
                        <div key={a.answer_key} className={styles.barGroup}>
                          <div className={styles.barLabel}>
                            <span>{a.answer_key}</span>
                            <span className={styles.barLabelCount}>{a.pct_in_question}%</span>
                          </div>
                          <div className={styles.barTrack}>
                            <div className={styles.barFill} style={{ width: `${a.pct_in_question}%`, background: GRAD[(qi + ai) % GRAD.length] }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: DECISIONS
            ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "decisions" && (
          <div className={styles.sectionCard} style={{ animationDelay: "0.1s" }}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionTitleIcon}>⚡</span>
                Todas las decisiones
              </h2>
              <button className={styles.actionBtn} onClick={() => exportCSV(data.recentDecisions)}>📥 Exportar CSV</button>
            </div>
            <div className={styles.tableWrap} style={{ maxHeight: 600, overflowY: "auto" }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {([
                      ["date", "Fecha"],
                      ["question_id", "Pregunta"],
                      ["answer_key", "Respuesta"],
                      ["delta_amount", "Ahorro"],
                      ["monthly_projection", "Proy. Mensual"],
                      ["yearly_projection", "Proy. Anual"],
                    ] as [SortCol, string][]).map(([col, label]) => (
                      <th key={col} onClick={() => toggleSort(col)}>
                        {label}
                        <span className={`${styles.sortArrow} ${sortCol === col ? styles.sortArrowActive : ""}`}>
                          {sortCol === col ? (sortDir === "asc" ? " ▲" : " ▼") : " ▽"}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedDecisions.map(d => (
                    <tr key={d.id}>
                      <td>{fmtDate(d.date)}</td>
                      <td><span className={styles.badge}>{Q_LABELS[d.question_id] ?? d.question_id}</span></td>
                      <td>{d.answer_key}</td>
                      <td className={d.delta_amount > 0 ? styles.amountPositive : d.delta_amount < 0 ? styles.amountNegative : styles.amountZero}>
                        {d.delta_amount > 0 ? "+" : ""}{fmtEUR(d.delta_amount)}
                      </td>
                      <td style={{ color: "rgba(148,163,184,0.55)" }}>{fmtEUR(d.monthly_projection)}</td>
                      <td style={{ color: "rgba(148,163,184,0.55)" }}>{fmtEUR(d.yearly_projection)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.tableFooter}>
              <span>{sortedDecisions.length} decisiones</span>
              <span>Haz clic en una columna para ordenar</span>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: GOALS
            ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "goals" && (
          <div className={styles.twoCol}>
            <div className={styles.sectionCard} style={{ animationDelay: "0.1s" }}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionTitleIcon}>🎯</span>
                  Objetivos activos ({data.goalProgress.length})
                </h2>
              </div>
              {data.goalProgress.length > 0 ? data.goalProgress.map(g => (
                <div key={g.id} className={styles.goalItem}>
                  <div className={styles.goalTop}>
                    <span className={styles.goalTitle}>
                      {g.title}
                      {g.is_primary && <span className={styles.goalPrimary}>PRINCIPAL</span>}
                    </span>
                    <span className={styles.goalPct} style={{
                      color: g.percent >= 100 ? "#4ade80" : g.percent >= 50 ? "#fbbf24" : "#c4b5fd"
                    }}>{g.percent}%</span>
                  </div>
                  <div className={styles.goalTrack}>
                    <div className={styles.goalFill} style={{
                      width: `${Math.min(100, g.percent)}%`,
                      background: g.percent >= 100 ? "linear-gradient(90deg, #22c55e, #4ade80)" : undefined,
                    }} />
                  </div>
                  <div className={styles.goalAmounts}>
                    <span>{fmtEUR(g.current_amount)}</span>
                    <span>{fmtEUR(g.target_amount)}</span>
                  </div>
                </div>
              )) : <div className={styles.emptyState}>No hay objetivos activos</div>}
            </div>

            <div className={styles.sectionCard} style={{ animationDelay: "0.15s" }}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionTitleIcon}>📊</span>
                  Estadísticas
                </h2>
              </div>
              <div className={styles.retentionGrid} style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className={styles.retentionCard}>
                  <div className={styles.retentionLabel}>Activos</div>
                  <div className={styles.retentionValue} style={{ color: "#c4b5fd" }}>{data.kpis.activeGoals}</div>
                </div>
                <div className={styles.retentionCard}>
                  <div className={styles.retentionLabel}>Completados</div>
                  <div className={styles.retentionValue} style={{ color: "#4ade80" }}>{data.kpis.completedGoals}</div>
                </div>
              </div>
              <div style={{ marginTop: 20 }}>
                <h3 className={styles.sectionTitle} style={{ fontSize: 13, marginBottom: 14 }}>
                  <span className={styles.sectionTitleIcon}>📋</span>
                  Distribución de respuestas
                </h3>
                {groupedQ.slice(0, 4).map(([qId, answers], qi) => (
                  <div key={qId} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(203,213,225,0.7)", marginBottom: 6 }}>{Q_LABELS[qId] ?? qId}</div>
                    {answers.slice(0, 2).map((a, ai) => (
                      <div key={a.answer_key} className={styles.barGroup}>
                        <div className={styles.barLabel}>
                          <span>{a.answer_key}</span>
                          <span className={styles.barLabelCount}>{a.answer_count}</span>
                        </div>
                        <div className={styles.barTrack}>
                          <div className={styles.barFill} style={{ width: `${a.pct_in_question}%`, background: GRAD[(qi + ai) % GRAD.length] }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
