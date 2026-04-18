"use client";

import React, { useState, useEffect, useRef } from 'react';
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

// ── Paleta de colores para el donut ───────────────────────────────────────────
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

// ── Donut chart — distribución por objetivos ──────────────────────────────────
function GoalDonutChart({ goals }: { goals: Goal[] }) {
  const activeGoals = goals.filter((g) => !g.archived);
  const totalSaved  = activeGoals.reduce((sum, g) => sum + g.currentAmount, 0);
  const hasData     = totalSaved > 0;

  const CX = 100, CY = 100, R = 68;
  const STROKE = 22;
  const CI  = 2 * Math.PI * R; // circunferencia ≈ 427.26
  const GAP = 5;               // px de hueco entre segmentos

  // Solo los objetivos con ahorro > 0 aparecen como segmentos
  const goalsWithSavings = activeGoals.filter((g) => g.currentAmount > 0);

  let rotOffset = -90; // empezamos desde arriba
  const segments = goalsWithSavings.map((g, i) => {
    const pct     = g.currentAmount / totalSaved;
    const dashLen = Math.max(0, pct * CI - (goalsWithSavings.length > 1 ? GAP : 0));
    const startRot = rotOffset;
    rotOffset += pct * 360;
    return { goal: g, pct, dashLen, startRot, color: DONUT_COLORS[i % DONUT_COLORS.length] };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>

      {/* ── SVG Donut ── */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 200, margin: '0 auto' }}>
        <svg
          viewBox="0 0 200 200"
          width="100%"
          style={{ display: 'block', filter: 'drop-shadow(0 0 20px rgba(168,85,247,0.12))' }}
        >
          {/* Anillo de fondo */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke="rgba(51,65,85,0.22)"
            strokeWidth={STROKE}
          />

          {/* Segmentos por objetivo */}
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth={STROKE}
              strokeDasharray={`${seg.dashLen} ${CI}`}
              strokeLinecap="butt"
              transform={`rotate(${seg.startRot} ${CX} ${CY})`}
              style={{ filter: `drop-shadow(0 0 5px ${seg.color}55)` }}
            />
          ))}

          {/* ── Centro: total ahorrado ── */}
          {hasData ? (
            <>
              <text
                x={CX} y={CY - 10}
                textAnchor="middle"
                fontSize="8.5"
                fill="rgba(148,163,184,0.5)"
                fontFamily="inherit"
                letterSpacing="0.1em"
              >
                TOTAL AHORRADO
              </text>
              <text
                x={CX} y={CY + 9}
                textAnchor="middle"
                fontSize="19"
                fontWeight="800"
                fill="#f1f5f9"
                fontFamily="inherit"
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
                fill="rgba(148,163,184,0.3)"
                fontFamily="inherit"
              >
                Sin ahorros aún
              </text>
              <text
                x={CX} y={CY + 12}
                textAnchor="middle"
                fontSize="13"
                fill="rgba(148,163,184,0.2)"
                fontFamily="inherit"
                fontWeight="600"
              >
                0 €
              </text>
            </>
          )}
        </svg>
      </div>

      {/* ── Leyenda: un objetivo por línea ── */}
      {activeGoals.length === 0 ? (
        <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.4)', textAlign: 'center', margin: 0 }}>
          Crea un objetivo para ver la distribución
        </p>
      ) : (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activeGoals.map((g, i) => {
            const color = DONUT_COLORS[i % DONUT_COLORS.length];
            const pct   = hasData ? Math.round((g.currentAmount / totalSaved) * 100) : 0;
            return (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: color, flexShrink: 0,
                  boxShadow: `0 0 6px ${color}66`,
                  opacity: g.currentAmount > 0 ? 1 : 0.3,
                }} />
                <span style={{
                  flex: 1, fontSize: 12, color: g.currentAmount > 0 ? '#cbd5e1' : 'rgba(148,163,184,0.45)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {g.title}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: g.currentAmount > 0 ? color : 'rgba(100,116,139,0.5)',
                }}>
                  {formatCurrencyShort(g.currentAmount)}
                </span>
                {hasData && (
                  <span style={{
                    fontSize: 10, color: 'rgba(148,163,184,0.4)',
                    minWidth: 30, textAlign: 'right',
                  }}>
                    {pct}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Goal Line Chart (progreso vs. ritmo ideal) ────────────────────────────────
function GoalLineChart({ points, goal }: { points: GoalProgressPoint[]; goal: Goal }) {
  const W = 320, H = 180;
  const PAD = { top: 16, right: 12, bottom: 28, left: 52 };
  const CW  = W - PAD.left - PAD.right;
  const CH  = H - PAD.top  - PAD.bottom;

  const horizonDays = goal.horizonMonths * 30;
  const maxVal      = goal.targetAmount || 1;
  const safeId      = goal.id.replace(/[^a-zA-Z0-9]/g, '_');
  const greenGradId = `green_${safeId}`;
  const greenAreaId = `greenArea_${safeId}`;

  const xScale = (day: number) => PAD.left + (day / horizonDays) * CW;
  const yScale = (val: number) => PAD.top  + CH - (val / maxVal)  * CH;

  const hasActualProgress = goal.currentAmount > 0 && points.length > 0;

  const actualPts   = points.map((p) => ({ x: xScale(p.day), y: yScale(p.actual) }));
  const polylineStr = actualPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const yBottom     = yScale(0);

  const areaPath =
    actualPts.length > 1
      ? [
          `M ${actualPts[0].x.toFixed(1)} ${actualPts[0].y.toFixed(1)}`,
          ...actualPts.slice(1).map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
          `L ${actualPts[actualPts.length - 1].x.toFixed(1)} ${yBottom.toFixed(1)}`,
          `L ${actualPts[0].x.toFixed(1)} ${yBottom.toFixed(1)}`,
          'Z',
        ].join(' ')
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
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={greenGradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <linearGradient id={greenAreaId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgba(52,211,153,0.18)" />
          <stop offset="100%" stopColor="rgba(52,211,153,0.00)" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yRatios.slice(1).map((r, i) => (
        <line key={i}
          x1={PAD.left} y1={yScale(maxVal * r)}
          x2={W - PAD.right} y2={yScale(maxVal * r)}
          stroke="rgba(51,65,85,0.30)" strokeDasharray="4 3"
        />
      ))}
      {/* Y labels */}
      {yRatios.map((r, i) => (
        <text key={i}
          x={PAD.left - 6} y={yScale(maxVal * r) + 4}
          textAnchor="end" fontSize="9" fill="rgba(148,163,184,0.65)" fontFamily="inherit"
        >
          {formatCurrencyShort(maxVal * r)}
        </text>
      ))}
      {/* X labels */}
      {xLabels.map((l, i) => (
        <text key={i}
          x={l.x} y={H - 6}
          textAnchor="middle" fontSize="9" fill="rgba(148,163,184,0.65)" fontFamily="inherit"
        >
          {l.month === 0 ? 'Inicio' : `${l.month}m`}
        </text>
      ))}
      {/* Eje X */}
      <line x1={PAD.left} y1={yBottom} x2={W - PAD.right} y2={yBottom} stroke="rgba(51,65,85,0.40)" />

      {/* Ritmo ideal — siempre visible */}
      <line
        x1={xScale(0)} y1={yScale(0)}
        x2={xScale(horizonDays)} y2={yScale(maxVal)}
        stroke="rgba(168,85,247,0.45)"
        strokeWidth="1.5"
        strokeDasharray="6 4"
      />

      {/* Tu progreso — solo cuando hay ahorros */}
      {hasActualProgress && areaPath && (
        <path d={areaPath} fill={`url(#${greenAreaId})`} />
      )}
      {hasActualProgress && actualPts.length > 1 && (
        <polyline
          points={polylineStr}
          fill="none"
          stroke={`url(#${greenGradId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {hasActualProgress && actualPts.length > 0 && (
        <circle
          cx={actualPts[actualPts.length - 1].x}
          cy={actualPts[actualPts.length - 1].y}
          r="4" fill="#22c55e" stroke="rgba(34,197,94,0.30)" strokeWidth="6"
        />
      )}
      {!hasActualProgress && (
        <text
          x={W / 2} y={H / 2 + 4}
          textAnchor="middle" fontSize="10"
          fill="rgba(148,163,184,0.30)" fontFamily="inherit"
        >
          Tu línea verde aparecerá con el primer ahorro
        </text>
      )}
    </svg>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
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

  const selectedGoal: Goal | null  = activeGoalList.find((g) => g.id === selectedGoalId) ?? null;
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

        {/* ── Total acumulado (siempre visible) ── */}
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

            {/* ── Tab: Ahorro general — rosco por objetivos ── */}
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

                    {/* Gráfica */}
                    <div className={styles.lineChartWrap}>
                      <GoalLineChart points={goalPoints} goal={selectedGoal} />
                    </div>

                    {/* Leyenda */}
                    <div className={styles.chartLegend}>
                      <div className={styles.legendItem}>
                        <svg width="24" height="10" viewBox="0 0 24 10">
                          <line x1="0" y1="5" x2="24" y2="5"
                            stroke="rgba(168,85,247,0.55)" strokeWidth="1.5" strokeDasharray="5 3" />
                        </svg>
                        <span className={styles.legendLabel}>Ritmo ideal</span>
                      </div>
                      <div className={styles.legendItem}>
                        <svg width="24" height="10" viewBox="0 0 24 10">
                          <defs>
                            <linearGradient id="lgd_green" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%"   stopColor="#10b981" />
                              <stop offset="100%" stopColor="#34d399" />
                            </linearGradient>
                          </defs>
                          <line x1="0" y1="5" x2="24" y2="5"
                            stroke="url(#lgd_green)" strokeWidth="2.5" strokeLinecap="round" />
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
