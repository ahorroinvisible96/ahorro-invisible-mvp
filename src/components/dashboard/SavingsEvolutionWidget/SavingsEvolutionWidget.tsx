"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { analytics } from '@/services/analytics';
import { storeGetGoalProgressPoints } from '@/services/dashboardStore';
import type { GoalProgressPoint } from '@/services/dashboardStore';
import type { Goal } from '@/types/Dashboard';
import type { SavingsEvolutionWidgetProps } from './SavingsEvolutionWidget.types';
import styles from './SavingsEvolutionWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';
import { TrendingUpIcon, ChevronRightIcon } from '@/components/ui/AppIcons';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyShort(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    return `${k % 1 === 0 ? k : k.toFixed(1)}k€`;
  }
  return `${Math.round(value)}€`;
}

// ── Paleta de colores premium para el donut ─────────────────────────────────
const DONUT_COLORS = [
  '#a855f7', // purple
  '#3b82f6', // blue
  '#ec4899', // pink
  '#10b981', // emerald
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#f97316', // orange
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── DONUT CHART — Distribución interactiva por objetivos ──────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function GoalDonutChart({ goals }: { goals: Goal[] }) {
  const activeGoals = goals.filter((g) => !g.archived);
  const totalSaved  = activeGoals.reduce((sum, g) => sum + g.currentAmount, 0);
  const hasData     = totalSaved > 0;
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const CX = 110, CY = 110, R = 76;
  const STROKE = 26;
  const CI = 2 * Math.PI * R;
  const GAP = 6;

  const goalsWithSavings = activeGoals.filter((g) => g.currentAmount > 0);

  let rotOffset = -90;
  const segments = goalsWithSavings.map((g, i) => {
    const pct     = g.currentAmount / totalSaved;
    const dashLen = Math.max(0, pct * CI - (goalsWithSavings.length > 1 ? GAP : 0));
    const startRot = rotOffset;
    const midAngle = rotOffset + (pct * 360) / 2;
    rotOffset += pct * 360;
    return {
      goal: g,
      pct,
      dashLen,
      startRot,
      midAngle,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
      originalIdx: activeGoals.indexOf(g),
    };
  });

  const handleSegmentClick = useCallback((idx: number) => {
    setSelectedIdx((prev) => (prev === idx ? null : idx));
  }, []);

  // Datos del segmento seleccionado
  const selectedSeg = selectedIdx !== null
    ? segments.find((s) => s.originalIdx === selectedIdx) ?? null
    : null;

  return (
    <div className={styles.donutSection}>

      {/* ── SVG Donut ── */}
      <div className={styles.donutContainer}>
        <svg
          viewBox="0 0 220 220"
          width="100%"
          className={styles.donutSvg}
        >
          <defs>
            {/* Glow filter para segmentos seleccionados */}
            {segments.map((seg, i) => (
              <filter key={i} id={`glow_${i}`} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feFlood floodColor={seg.color} floodOpacity="0.5" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="shadow" />
                <feMerge>
                  <feMergeNode in="shadow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
          </defs>

          {/* Anillo de fondo */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke="rgba(51,65,85,0.18)"
            strokeWidth={STROKE}
          />

          {/* Partículas decorativas de fondo */}
          <circle cx="30"  cy="40"  r="1.5" fill="rgba(168,85,247,0.12)" />
          <circle cx="190" cy="55"  r="1"   fill="rgba(59,130,246,0.10)" />
          <circle cx="45"  cy="185" r="1.2" fill="rgba(236,72,153,0.10)" />
          <circle cx="180" cy="175" r="1.8" fill="rgba(168,85,247,0.08)" />

          {/* Segmentos por objetivo */}
          {segments.map((seg, i) => {
            const isSelected = selectedIdx === seg.originalIdx;
            // Offset hacia afuera cuando seleccionado
            const rad = (seg.midAngle * Math.PI) / 180;
            const offsetX = isSelected ? Math.cos(rad) * 7 : 0;
            const offsetY = isSelected ? Math.sin(rad) * 7 : 0;

            return (
              <circle
                key={i}
                cx={CX + offsetX}
                cy={CY + offsetY}
                r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth={isSelected ? STROKE + 6 : STROKE}
                strokeDasharray={`${seg.dashLen} ${CI}`}
                strokeLinecap="butt"
                transform={`rotate(${seg.startRot} ${CX + offsetX} ${CY + offsetY})`}
                filter={isSelected ? `url(#glow_${i})` : undefined}
                style={{
                  cursor: 'pointer',
                  transition: 'all 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                  opacity: selectedIdx !== null && !isSelected ? 0.35 : 1,
                }}
                onClick={() => handleSegmentClick(seg.originalIdx)}
              />
            );
          })}

          {/* ── Centro: total ahorrado ── */}
          {hasData ? (
            <>
              <text
                x={CX} y={CY - 14}
                textAnchor="middle"
                fontSize="8"
                fill="rgba(148,163,184,0.4)"
                fontFamily="inherit"
                letterSpacing="0.14em"
                fontWeight="600"
              >
                TOTAL AHORRADO
              </text>
              <text
                x={CX} y={CY + 12}
                textAnchor="middle"
                fontSize="24"
                fontWeight="800"
                fill="#f1f5f9"
                fontFamily="inherit"
                letterSpacing="-0.02em"
              >
                {formatCurrencyShort(totalSaved)}
              </text>
            </>
          ) : (
            <>
              <text
                x={CX} y={CY - 4}
                textAnchor="middle"
                fontSize="10"
                fill="rgba(148,163,184,0.25)"
                fontFamily="inherit"
              >
                Sin ahorros aún
              </text>
              <text
                x={CX} y={CY + 14}
                textAnchor="middle"
                fontSize="16"
                fill="rgba(148,163,184,0.15)"
                fontFamily="inherit"
                fontWeight="700"
              >
                0 €
              </text>
            </>
          )}
        </svg>
      </div>

      {/* ── Info contextual: solo aparece al seleccionar ── */}
      {selectedSeg && (
        <div className={styles.donutDetail}>
          <div className={styles.donutDetailDot} style={{ background: selectedSeg.color, boxShadow: `0 0 12px ${selectedSeg.color}88` }} />
          <div className={styles.donutDetailInfo}>
            <span className={styles.donutDetailTitle}>{selectedSeg.goal.title}</span>
            <div className={styles.donutDetailRow}>
              <span className={styles.donutDetailAmount} style={{ color: selectedSeg.color }}>
                {formatCurrency(selectedSeg.goal.currentAmount)}
              </span>
              <span className={styles.donutDetailPct}>
                {Math.round(selectedSeg.pct * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Leyenda: solo objetivos con ahorro > 0 ── */}
      {goalsWithSavings.length > 0 && (
        <div className={styles.donutLegend}>
          {goalsWithSavings.map((g, i) => {
            const color = DONUT_COLORS[i % DONUT_COLORS.length];
            const origIdx = activeGoals.indexOf(g);
            const isSelected = selectedIdx === origIdx;
            return (
              <button
                key={g.id}
                className={`${styles.donutLegendItem} ${isSelected ? styles.donutLegendItemActive : ''}`}
                onClick={() => handleSegmentClick(origIdx)}
              >
                <div
                  className={styles.donutLegendDot}
                  style={{
                    background: color,
                    boxShadow: isSelected ? `0 0 8px ${color}66` : 'none',
                  }}
                />
                <span className={styles.donutLegendLabel}>{g.title}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── GOAL LINE CHART — progreso vs. ritmo ideal (premium) ──────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function GoalLineChart({ points, goal }: { points: GoalProgressPoint[]; goal: Goal }) {
  const W = 340, H = 200;
  const PAD = { top: 20, right: 16, bottom: 32, left: 52 };
  const CW = W - PAD.left - PAD.right;
  const CH = H - PAD.top  - PAD.bottom;

  const horizonDays = goal.horizonMonths * 30;
  const maxVal      = goal.targetAmount || 1;
  const safeId      = goal.id.replace(/[^a-zA-Z0-9]/g, '_');

  const xScale = (day: number) => PAD.left + (day / horizonDays) * CW;
  const yScale = (val: number) => PAD.top  + CH - (val / maxVal) * CH;
  const yBottom = yScale(0);

  // ===== Construir puntos de progreso =====
  // IMPORTANTE: si solo hay un punto, lo anclarmos desde (0,0) para dibujar
  // una línea ascendente real desde el primer registro
  const hasActualProgress = goal.currentAmount > 0 && points.length > 0;

  let actualPts: { x: number; y: number }[] = [];
  if (hasActualProgress) {
    // Siempre empezamos desde el día 0, valor 0 para dibujar una línea correcta
    const startPt = { x: xScale(0), y: yScale(0) };
    const dataPts = points.map((p) => ({ x: xScale(p.day), y: yScale(p.actual) }));
    // Si el primer punto de datos no es día 0, añadir el origen
    if (points[0]?.day > 0) {
      actualPts = [startPt, ...dataPts];
    } else {
      actualPts = dataPts;
    }
  }

  const polylineStr = actualPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Smooth path para la línea de progreso (aspecto premium con curvas)
  function buildSmoothPath(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx = (prev.x + curr.x) / 2;
      d += ` C ${cpx.toFixed(1)} ${prev.y.toFixed(1)}, ${cpx.toFixed(1)} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
    }
    return d;
  }

  const smoothLine = buildSmoothPath(actualPts);

  // Área bajo la curva (smooth) 
  const areaPath =
    actualPts.length > 1
      ? smoothLine +
        ` L ${actualPts[actualPts.length - 1].x.toFixed(1)} ${yBottom.toFixed(1)}` +
        ` L ${actualPts[0].x.toFixed(1)} ${yBottom.toFixed(1)} Z`
      : '';

  const yRatios = [0, 0.25, 0.5, 0.75, 1.0];
  const step =
    goal.horizonMonths <= 3 ? 1 :
    goal.horizonMonths <= 6 ? 2 :
    goal.horizonMonths <= 12 ? 3 : 6;
  const xLabels: { month: number; x: number }[] = [];
  for (let m = 0; m <= goal.horizonMonths; m += step) {
    xLabels.push({ month: m, x: xScale(m * 30) });
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      className={styles.goalChart}
    >
      <defs>
        {/* Degradado para la línea de progreso (verde premium) */}
        <linearGradient id={`gl_${safeId}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#059669" />
          <stop offset="40%"  stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>

        {/* Área bajo la curva: degradado vertical elegante */}
        <linearGradient id={`ga_${safeId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgba(16,185,129,0.22)" />
          <stop offset="50%"  stopColor="rgba(52,211,153,0.08)" />
          <stop offset="100%" stopColor="rgba(52,211,153,0.00)" />
        </linearGradient>

        {/* Glow para la línea de progreso */}
        <filter id={`lineGlow_${safeId}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feFlood floodColor="#10b981" floodOpacity="0.35" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Glow para el punto de progreso actual */}
        <radialGradient id={`dotGlow_${safeId}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(34,197,94,0.6)" />
          <stop offset="100%" stopColor="rgba(34,197,94,0)" />
        </radialGradient>

        {/* Glow para ritmo ideal */}
        <linearGradient id={`idealGrad_${safeId}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="rgba(168,85,247,0.50)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0.35)" />
        </linearGradient>
      </defs>

      {/* Grid horizontal — líneas sutiles */}
      {yRatios.slice(1).map((r, i) => (
        <line key={i}
          x1={PAD.left} y1={yScale(maxVal * r)}
          x2={W - PAD.right} y2={yScale(maxVal * r)}
          stroke="rgba(51,65,85,0.22)"
          strokeDasharray="3 4"
        />
      ))}

      {/* Y labels */}
      {yRatios.map((r, i) => (
        <text key={i}
          x={PAD.left - 8} y={yScale(maxVal * r) + 4}
          textAnchor="end" fontSize="9" fill="rgba(148,163,184,0.50)" fontFamily="inherit"
          fontWeight="500"
        >
          {formatCurrencyShort(maxVal * r)}
        </text>
      ))}

      {/* X labels */}
      {xLabels.map((l, i) => (
        <text key={i}
          x={l.x} y={H - 8}
          textAnchor="middle" fontSize="9" fill="rgba(148,163,184,0.50)" fontFamily="inherit"
          fontWeight="500"
        >
          {l.month === 0 ? 'Inicio' : `${l.month}m`}
        </text>
      ))}

      {/* Eje X base */}
      <line
        x1={PAD.left} y1={yBottom}
        x2={W - PAD.right} y2={yBottom}
        stroke="rgba(51,65,85,0.30)"
      />

      {/* ── Ritmo ideal — línea discontinua morada ── */}
      <line
        x1={xScale(0)} y1={yScale(0)}
        x2={xScale(horizonDays)} y2={yScale(maxVal)}
        stroke={`url(#idealGrad_${safeId})`}
        strokeWidth="2"
        strokeDasharray="8 5"
        strokeLinecap="round"
      />

      {/* Punto meta al final del ritmo ideal */}
      <circle
        cx={xScale(horizonDays)} cy={yScale(maxVal)}
        r="3" fill="none"
        stroke="rgba(168,85,247,0.35)" strokeWidth="1.5"
        strokeDasharray="3 2"
      />

      {/* ── Tu progreso — línea continua verde premium ── */}
      {hasActualProgress && areaPath && (
        <path d={areaPath} fill={`url(#ga_${safeId})`} />
      )}
      {hasActualProgress && actualPts.length > 1 && (
        <path
          d={smoothLine}
          fill="none"
          stroke={`url(#gl_${safeId})`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#lineGlow_${safeId})`}
        />
      )}

      {/* Punto de progreso actual con resplandor */}
      {hasActualProgress && actualPts.length > 0 && (
        <>
          {/* Halo exterior */}
          <circle
            cx={actualPts[actualPts.length - 1].x}
            cy={actualPts[actualPts.length - 1].y}
            r="14"
            fill={`url(#dotGlow_${safeId})`}
          />
          {/* Glow ring */}
          <circle
            cx={actualPts[actualPts.length - 1].x}
            cy={actualPts[actualPts.length - 1].y}
            r="7"
            fill="none"
            stroke="rgba(34,197,94,0.20)"
            strokeWidth="2"
            className={styles.pulsingDot}
          />
          {/* Punto sólido */}
          <circle
            cx={actualPts[actualPts.length - 1].x}
            cy={actualPts[actualPts.length - 1].y}
            r="4.5"
            fill="#22c55e"
            stroke="#0d9b4a"
            strokeWidth="1"
          />
        </>
      )}

      {/* Mensaje sin progreso */}
      {!hasActualProgress && (
        <text
          x={W / 2} y={H / 2 + 4}
          textAnchor="middle" fontSize="10"
          fill="rgba(148,163,184,0.25)" fontFamily="inherit"
          fontWeight="500"
        >
          Tu línea verde aparecerá con el primer ahorro
        </text>
      )}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
export function SavingsEvolutionWidget({
  evolution,
  onChangeRange,
  onGoToDailyQuestion,
  goals,
}: SavingsEvolutionWidgetProps & { onGoToDailyQuestion?: () => void }): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'general' | 'goals'>('general');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(
    goals?.[0]?.id ?? null
  );
  const [goalDropdownOpen, setGoalDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { collapsed, toggle } = useWidgetCollapse('savings_evolution', true);

  useEffect(() => {
    if (!goalDropdownOpen) return;
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setGoalDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [goalDropdownOpen]);

  useEffect(() => {
    if (evolution?.range) {
      analytics.savingsEvolutionRangeChanged(evolution.range, evolution.mode);
    }
  }, [evolution?.range, evolution?.mode]);

  useEffect(() => {
    if (goals?.length && !selectedGoalId) {
      setSelectedGoalId(goals[0].id);
    }
  }, [goals, selectedGoalId]);

  const activeGoalList = (goals ?? []).filter((g) => !g.archived);
  const allTimeSaved   = activeGoalList.reduce((sum, g) => sum + g.currentAmount, 0);

  const selectedGoal: Goal | null = activeGoalList.find((g) => g.id === selectedGoalId) ?? null;
  const goalPoints: GoalProgressPoint[] =
    activeTab === 'goals' && selectedGoalId
      ? storeGetGoalProgressPoints(selectedGoalId)
      : [];

  return (
    <div className={styles.wrapper}>
      <div className={styles.bgGradient} />
      <div className={styles.glowOverlay}>
        <div className={styles.glowPurple} />
        <div className={styles.glowBlue} />
      </div>
      <div className={styles.borderLayer} />
      <div className={styles.content}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconWrap}><TrendingUpIcon size={24} /></div>
            <span className={styles.title}>Evolución del ahorro</span>
          </div>
          <div className={styles.headerRight}>
            {evolution?.mode === 'demo' && (
              <div className={styles.demoBadge}>DEMO</div>
            )}
            <CollapseChevron collapsed={collapsed} onToggle={toggle} />
          </div>
        </div>

        {/* ── Total acumulado — versión premium ── */}
        <div
          className={styles.totalSection}
          style={{ cursor: collapsed ? 'pointer' : 'default' }}
          onClick={collapsed ? toggle : undefined}
        >
          <div className={styles.totalAmount}>{formatCurrency(allTimeSaved)}</div>
          <div className={styles.totalLabel}>Total ahorrado en todos los objetivos</div>
        </div>

        {/* ── Contenido expandido ── */}
        {!collapsed && (
          <>
            {/* Tab bar */}
            {activeGoalList.length > 0 && (
              <div className={styles.tabBar}>
                <button
                  className={`${styles.tabBtn} ${activeTab === 'general' ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab('general')}
                >
                  Ahorro general
                </button>
                <button
                  className={`${styles.tabBtn} ${activeTab === 'goals' ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab('goals')}
                >
                  Mis objetivos
                </button>
              </div>
            )}

            {/* ── Tab: Ahorro general — donut interactivo ── */}
            {activeTab === 'general' && (
              <GoalDonutChart goals={activeGoalList} />
            )}

            {/* ── Tab: Mis objetivos ── */}
            {activeTab === 'goals' && (
              <>
                {/* Selector de objetivo */}
                <div className={styles.goalDropdownWrap} ref={dropdownRef}>
                  <button
                    className={styles.goalDropdownTrigger}
                    onClick={() => setGoalDropdownOpen((o) => !o)}
                  >
                    <span className={styles.goalDropdownLabel}>
                      {selectedGoal?.title ?? 'Selecciona un objetivo'}
                    </span>
                    <svg
                      width="14" height="14" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round"
                      style={{
                        transform: goalDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 180ms ease', flexShrink: 0,
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {goalDropdownOpen && (
                    <div className={styles.goalDropdownList}>
                      {activeGoalList.map((g) => (
                        <button
                          key={g.id}
                          className={`${styles.goalDropdownItem} ${selectedGoalId === g.id ? styles.goalDropdownItemActive : ''}`}
                          onClick={() => { setSelectedGoalId(g.id); setGoalDropdownOpen(false); }}
                        >
                          {g.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedGoal && (
                  <>
                    {/* Resumen */}
                    <div className={styles.goalSummary}>
                      <div className={styles.goalAmounts}>
                        <span className={styles.goalActual}>{formatCurrency(selectedGoal.currentAmount)}</span>
                        <span className={styles.goalSep}> / </span>
                        <span className={styles.goalTarget}>{formatCurrency(selectedGoal.targetAmount)}</span>
                      </div>
                      <span className={styles.goalHorizon}>
                        {selectedGoal.horizonMonths} meses para completarlo
                      </span>
                    </div>

                    {/* Gráfica premium */}
                    <div className={styles.lineChartWrap}>
                      <GoalLineChart points={goalPoints} goal={selectedGoal} />
                    </div>

                    {/* Leyenda mejorada */}
                    <div className={styles.chartLegend}>
                      <div className={styles.legendItem}>
                        <svg width="28" height="12" viewBox="0 0 28 12">
                          <line x1="0" y1="6" x2="28" y2="6"
                            stroke="rgba(168,85,247,0.50)" strokeWidth="2" strokeDasharray="6 3"
                            strokeLinecap="round" />
                        </svg>
                        <span className={styles.legendLabel}>Ritmo ideal</span>
                      </div>
                      <div className={styles.legendItem}>
                        <svg width="28" height="12" viewBox="0 0 28 12">
                          <defs>
                            <linearGradient id="lgd_green_v2" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%"   stopColor="#059669" />
                              <stop offset="100%" stopColor="#34d399" />
                            </linearGradient>
                          </defs>
                          <line x1="0" y1="6" x2="28" y2="6"
                            stroke="url(#lgd_green_v2)" strokeWidth="3" strokeLinecap="round" />
                          <circle cx="24" cy="6" r="2.5" fill="#22c55e" />
                        </svg>
                        <span className={styles.legendLabel}>Tu progreso</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Empty state sin objetivos */}
                {activeGoalList.length === 0 && (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyText}>Crea tu primer objetivo para ver la evolución.</p>
                    {onGoToDailyQuestion && (
                      <button className={styles.emptyBtn} onClick={onGoToDailyQuestion}>
                        <span>Empezar</span>
                        <span className={styles.emptyBtnArrow}><ChevronRightIcon size={16} /></span>
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

      </div>
    </div>
  );
}

export default SavingsEvolutionWidget;
