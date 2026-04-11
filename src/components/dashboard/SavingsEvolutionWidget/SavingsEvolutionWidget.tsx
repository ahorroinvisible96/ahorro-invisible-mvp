"use client";

import React, { useState, useEffect } from 'react';
import { analytics } from '@/services/analytics';
import { storeGetGoalProgressPoints } from '@/services/dashboardStore';
import type { GoalProgressPoint } from '@/services/dashboardStore';
import type { Goal } from '@/types/Dashboard';
import type { SavingsEvolutionWidgetProps } from './SavingsEvolutionWidget.types';
import styles from './SavingsEvolutionWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';

// ── Iconos SVG inline ────────────────────────────────────────────────────────
function TrendingUpIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  );
}

function BarChart3Icon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyShort(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    return `${k % 1 === 0 ? k : k.toFixed(1)}k€`;
  }
  return `${Math.round(value)}€`;
}

function getRangeDays(range: string): number {
  switch (range) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    default: return 30;
  }
}

// ── Constantes ───────────────────────────────────────────────────────────────
const RANGES = ['7d', '30d', '90d'] as const;

// ── Goal Line Chart ───────────────────────────────────────────────────────────
function GoalLineChart({ points, goal }: { points: GoalProgressPoint[]; goal: Goal }) {
  const W = 320;
  const H = 180;
  const PAD = { top: 16, right: 12, bottom: 28, left: 52 };
  const CW = W - PAD.left - PAD.right;
  const CH = H - PAD.top - PAD.bottom;
  const horizonDays = goal.horizonMonths * 30;
  const maxVal = goal.targetAmount || 1;

  const safeId = goal.id.replace(/[^a-zA-Z0-9]/g, '_');
  const gradId = `act_${safeId}`;
  const areaGradId = `area_${safeId}`;

  const xScale = (day: number) => PAD.left + (day / horizonDays) * CW;
  const yScale = (val: number) => PAD.top + CH - (val / maxVal) * CH;

  const actualPts = points.map((p) => ({ x: xScale(p.day), y: yScale(p.actual) }));
  const actualPolyline = actualPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const areaPath =
    actualPts.length > 1
      ? [
          `M ${actualPts[0].x.toFixed(1)} ${actualPts[0].y.toFixed(1)}`,
          ...actualPts.slice(1).map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
          `L ${actualPts[actualPts.length - 1].x.toFixed(1)} ${yScale(0).toFixed(1)}`,
          `L ${actualPts[0].x.toFixed(1)} ${yScale(0).toFixed(1)}`,
          'Z',
        ].join(' ')
      : '';

  const yRatios = [0, 0.25, 0.5, 0.75, 1.0];

  const xLabels: { month: number; x: number }[] = [];
  const step =
    goal.horizonMonths <= 3 ? 1
    : goal.horizonMonths <= 6 ? 2
    : goal.horizonMonths <= 12 ? 3
    : 6;
  for (let m = 0; m <= goal.horizonMonths; m += step) {
    xLabels.push({ month: m, x: xScale(m * 30) });
  }

  const yBottom = yScale(0);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
        <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(168,85,247,0.20)" />
          <stop offset="100%" stopColor="rgba(168,85,247,0.00)" />
        </linearGradient>
      </defs>

      {/* Horizontal grid lines */}
      {yRatios.slice(1).map((r, i) => (
        <line
          key={i}
          x1={PAD.left} y1={yScale(maxVal * r)}
          x2={W - PAD.right} y2={yScale(maxVal * r)}
          stroke="rgba(51,65,85,0.30)"
          strokeDasharray="4 3"
        />
      ))}

      {/* Y-axis labels */}
      {yRatios.map((r, i) => (
        <text
          key={i}
          x={PAD.left - 6}
          y={yScale(maxVal * r) + 4}
          textAnchor="end"
          fontSize="9"
          fill="rgba(148,163,184,0.65)"
          fontFamily="inherit"
        >
          {formatCurrencyShort(maxVal * r)}
        </text>
      ))}

      {/* X-axis labels */}
      {xLabels.map((l, i) => (
        <text
          key={i}
          x={l.x} y={H - 6}
          textAnchor="middle"
          fontSize="9"
          fill="rgba(148,163,184,0.65)"
          fontFamily="inherit"
        >
          {l.month === 0 ? 'Inicio' : `${l.month}m`}
        </text>
      ))}

      {/* X-axis line */}
      <line
        x1={PAD.left} y1={yBottom}
        x2={W - PAD.right} y2={yBottom}
        stroke="rgba(51,65,85,0.40)"
      />

      {/* Ideal line (dashed diagonal) */}
      <line
        x1={xScale(0)} y1={yScale(0)}
        x2={xScale(horizonDays)} y2={yScale(maxVal)}
        stroke="rgba(168,85,247,0.45)"
        strokeWidth="1.5"
        strokeDasharray="6 4"
      />

      {/* Area fill under actual progress */}
      {areaPath && <path d={areaPath} fill={`url(#${areaGradId})`} />}

      {/* Actual progress polyline */}
      {actualPts.length > 1 && (
        <polyline
          points={actualPolyline}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Dot at current progress */}
      {actualPts.length > 0 && (
        <circle
          cx={actualPts[actualPts.length - 1].x}
          cy={actualPts[actualPts.length - 1].y}
          r="4"
          fill="#a855f7"
          stroke="rgba(168,85,247,0.30)"
          strokeWidth="6"
        />
      )}
    </svg>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export function SavingsEvolutionWidget({
  evolution,
  onChangeRange,
  onGoToDailyQuestion,
  goals,
}: SavingsEvolutionWidgetProps & { onGoToDailyQuestion?: () => void }): React.ReactElement {
  const [selectedRange, setSelectedRange] = useState<'7d' | '30d' | '90d'>(
    evolution?.range ?? '30d'
  );
  const [activeTab, setActiveTab] = useState<'general' | 'goals'>('general');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(
    goals?.[0]?.id ?? null
  );
  const { collapsed, toggle } = useWidgetCollapse('savings_evolution', true);

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

  const handleRangeChange = (range: '7d' | '30d' | '90d') => {
    setSelectedRange(range);
    analytics.savingsEvolutionRangeChanged(range, evolution?.mode ?? 'live');
    onChangeRange?.(range);
  };

  const totalAmount = evolution?.points.reduce((acc, p) => acc + p.value, 0) ?? 0;
  const maxValue = evolution?.points.length
    ? Math.max(...evolution.points.map((p) => p.value))
    : 0;
  const hasData = (evolution?.points?.length ?? 0) > 0;

  const activeGoalList = (goals ?? []).filter((g) => !g.archived);
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
            <div className={styles.iconWrap}><TrendingUpIcon /></div>
            <span className={styles.title}>Evolución del ahorro</span>
          </div>
          <div className={styles.headerRight}>
            {evolution?.mode === 'demo' && (
              <div className={styles.demoBadge}>DEMO</div>
            )}
            {!collapsed && activeTab === 'general' && (
              <div className={styles.rangeSelector}>
                {RANGES.map((r) => (
                  <button
                    key={r}
                    className={`${styles.rangeBtn} ${selectedRange === r ? styles.rangeBtnActive : ''}`}
                    onClick={() => handleRangeChange(r)}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
            <CollapseChevron collapsed={collapsed} onToggle={toggle} />
          </div>
        </div>

        {/* ── Total acumulado (siempre visible en modo live) ── */}
        {evolution?.mode !== 'demo' && (
          <div
            className={styles.totalSection}
            style={{ cursor: collapsed ? 'pointer' : 'default' }}
            onClick={collapsed ? toggle : undefined}
          >
            <div className={styles.totalAmount}>{formatCurrency(totalAmount)}</div>
            <div className={styles.totalLabel}>Acumulado en {getRangeDays(selectedRange)}d</div>
          </div>
        )}
        {evolution?.mode === 'demo' && !collapsed && (
          <div className={styles.totalSection}>
            <div style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', lineHeight: 1.5 }}>
              Aquí verás tu curva de ahorro cuando completes tu primera decisión diaria. 📈
            </div>
          </div>
        )}

        {/* ── Contenido expandido ── */}
        {!collapsed && (
          <>
            {/* Tab bar (solo si hay objetivos) */}
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

            {/* ── Tab: Ahorro general ── */}
            {activeTab === 'general' && (
              hasData ? (
                <div className={styles.chartContainer}>
                  <div className={styles.barsRow}>
                    {evolution!.points.map((point, index) => {
                      const heightPct = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
                      const dateLabel = new Date(point.date).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                      });
                      return (
                        <div key={index} className={styles.barWrapper}>
                          <div className={styles.tooltip}>
                            <div className={styles.tooltipInner}>
                              <div className={styles.tooltipDate}>{dateLabel}</div>
                              <div className={styles.tooltipValue}>{formatCurrency(point.value)}</div>
                            </div>
                            <div className={styles.tooltipArrow} />
                          </div>
                          <div className={styles.bar} style={{ height: `${heightPct}%` }}>
                            <div className={styles.barBase} />
                            <div className={styles.barShine} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className={styles.axisLine} />
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIconWrap}><BarChart3Icon /></div>
                  <p className={styles.emptyText}>Aún no hay datos para este período.</p>
                  {onGoToDailyQuestion && (
                    <button className={styles.emptyBtn} onClick={onGoToDailyQuestion}>
                      <span>Responder ahora</span>
                      <span className={styles.emptyBtnArrow}><ArrowRightIcon /></span>
                    </button>
                  )}
                </div>
              )
            )}

            {/* ── Tab: Mis objetivos ── */}
            {activeTab === 'goals' && (
              <>
                {/* Selector de objetivo */}
                <div className={styles.goalSelector}>
                  {activeGoalList.map((goal) => (
                    <button
                      key={goal.id}
                      className={`${styles.goalPill} ${selectedGoalId === goal.id ? styles.goalPillActive : ''}`}
                      onClick={() => setSelectedGoalId(goal.id)}
                    >
                      {goal.title}
                    </button>
                  ))}
                </div>

                {selectedGoal && (
                  <>
                    {/* Resumen del objetivo */}
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

                    {/* Gráfica de líneas */}
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
                            <linearGradient id="lgd" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#a855f7" />
                              <stop offset="100%" stopColor="#22c55e" />
                            </linearGradient>
                          </defs>
                          <line x1="0" y1="5" x2="24" y2="5"
                            stroke="url(#lgd)" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                        <span className={styles.legendLabel}>Tu progreso</span>
                      </div>
                    </div>
                  </>
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
