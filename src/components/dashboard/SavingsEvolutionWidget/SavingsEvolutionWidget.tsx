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
import { TrendingUpIcon, BarChartIcon, ChevronRightIcon } from '@/components/ui/AppIcons';

// ── Helpers ──────────────────────────────────────────────────────────────────
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

function getRangeDays(range: string): number {
  switch (range) {
    case '7d':  return 7;
    case '30d': return 30;
    case '90d': return 90;
    default:    return 30;
  }
}

/** Formatea una fecha local en YYYY-MM-DD sin problemas de timezone */
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const RANGES = ['7d', '30d', '90d'] as const;

// ── General Line Chart (acumulado día a día) ──────────────────────────────────
function GeneralLineChart({
  points,
  rangeDays,
}: {
  points: { date: string; value: number }[];
  rangeDays: number;
}) {
  const W = 320, H = 160;
  const PAD = { top: 16, right: 12, bottom: 28, left: 52 };
  const CW = W - PAD.left - PAD.right;
  const CH = H - PAD.top - PAD.bottom;

  // ── Mapa de ahorro por fecha (día local) ─────────────────────────────────
  const byDate: Record<string, number> = {};
  for (const pt of points) {
    const dk = pt.date.substring(0, 10);
    byDate[dk] = (byDate[dk] ?? 0) + pt.value;
  }

  // ── Construir línea de tiempo acumulativa ─────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const timeline: { day: number; cumulative: number; label: string }[] = [];
  let running = 0;
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dk = localDateKey(d);
    running += byDate[dk] ?? 0;
    timeline.push({
      day: rangeDays - 1 - i,
      cumulative: running,
      label: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
    });
  }

  const maxVal = Math.max(...timeline.map((t) => t.cumulative), 1);
  const hasProgress = timeline.some((t) => t.cumulative > 0);

  const xScale = (day: number) => PAD.left + (day / Math.max(rangeDays - 1, 1)) * CW;
  const yScale = (val: number) => PAD.top + CH - (val / maxVal) * CH;
  const yBottom = yScale(0);

  const svgPts = timeline.map((t) => ({
    x: xScale(t.day),
    y: yScale(t.cumulative),
    cumulative: t.cumulative,
    label: t.label,
  }));

  const polylineStr = svgPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const areaPath =
    svgPts.length > 1
      ? [
          `M ${svgPts[0].x.toFixed(1)} ${svgPts[0].y.toFixed(1)}`,
          ...svgPts.slice(1).map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
          `L ${svgPts[svgPts.length - 1].x.toFixed(1)} ${yBottom.toFixed(1)}`,
          `L ${svgPts[0].x.toFixed(1)} ${yBottom.toFixed(1)}`,
          'Z',
        ].join(' ')
      : '';

  // Etiquetas eje X: cada 1 día (7d), 7 días (30d), 14 días (90d)
  const labelStep = rangeDays <= 7 ? 1 : rangeDays <= 30 ? 7 : 14;
  const xLabelDays = timeline.filter((_, i) => i % labelStep === 0 || i === timeline.length - 1);

  const yRatios = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="genLineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="genAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgba(96,165,250,0.16)" />
          <stop offset="100%" stopColor="rgba(168,85,247,0.00)" />
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
      {xLabelDays.map((t, idx) => (
        <text key={idx}
          x={xScale(t.day)} y={H - 6}
          textAnchor="middle" fontSize="9" fill="rgba(148,163,184,0.65)" fontFamily="inherit"
        >
          {t.label}
        </text>
      ))}

      {/* Eje X */}
      <line x1={PAD.left} y1={yBottom} x2={W - PAD.right} y2={yBottom} stroke="rgba(51,65,85,0.40)" />

      {/* Área de relleno */}
      {hasProgress && areaPath && <path d={areaPath} fill="url(#genAreaGrad)" />}

      {/* Línea acumulativa */}
      {hasProgress && svgPts.length > 1 && (
        <polyline
          points={polylineStr}
          fill="none"
          stroke="url(#genLineGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Punto actual */}
      {hasProgress && svgPts.length > 0 && (
        <circle
          cx={svgPts[svgPts.length - 1].x}
          cy={svgPts[svgPts.length - 1].y}
          r="4"
          fill="#a855f7"
          stroke="rgba(168,85,247,0.30)"
          strokeWidth="6"
        />
      )}

      {/* Estado vacío dentro del SVG si no hay datos */}
      {!hasProgress && (
        <text
          x={W / 2} y={H / 2 + 4}
          textAnchor="middle"
          fontSize="11"
          fill="rgba(148,163,184,0.35)"
          fontFamily="inherit"
        >
          Tu curva aparecerá aquí cuando empieces a ahorrar
        </text>
      )}
    </svg>
  );
}

// ── Goal Line Chart (progreso vs. ritmo ideal) ────────────────────────────────
function GoalLineChart({ points, goal }: { points: GoalProgressPoint[]; goal: Goal }) {
  const W = 320, H = 180;
  const PAD = { top: 16, right: 12, bottom: 28, left: 52 };
  const CW = W - PAD.left - PAD.right;
  const CH = H - PAD.top - PAD.bottom;

  const horizonDays = goal.horizonMonths * 30;
  const maxVal      = goal.targetAmount || 1;
  const safeId      = goal.id.replace(/[^a-zA-Z0-9]/g, '_');
  const greenGradId = `green_${safeId}`;
  const greenAreaId = `greenArea_${safeId}`;

  const xScale = (day: number) => PAD.left + (day / horizonDays) * CW;
  const yScale = (val: number) => PAD.top + CH - (val / maxVal) * CH;

  // Solo mostrar el progreso real cuando el usuario ha ahorrado algo
  const hasActualProgress = goal.currentAmount > 0 && points.length > 0;

  const actualPts = points.map((p) => ({ x: xScale(p.day), y: yScale(p.actual) }));
  const polylineStr = actualPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const yBottom = yScale(0);
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
        {/* Degradado verde para la línea de progreso */}
        <linearGradient id={greenGradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        {/* Área bajo la línea de progreso */}
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

      {/* Línea de ritmo ideal (siempre visible como referencia) */}
      <line
        x1={xScale(0)} y1={yScale(0)}
        x2={xScale(horizonDays)} y2={yScale(maxVal)}
        stroke="rgba(168,85,247,0.45)"
        strokeWidth="1.5"
        strokeDasharray="6 4"
      />

      {/* ── Tu progreso real (solo cuando hay ahorros registrados) ── */}
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
          r="4"
          fill="#22c55e"
          stroke="rgba(34,197,94,0.30)"
          strokeWidth="6"
        />
      )}

      {/* Mensaje si no hay progreso aún */}
      {!hasActualProgress && (
        <text
          x={W / 2} y={H / 2 + 4}
          textAnchor="middle" fontSize="10"
          fill="rgba(148,163,184,0.35)" fontFamily="inherit"
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
  const [selectedRange, setSelectedRange] = useState<'7d' | '30d' | '90d'>(
    evolution?.range ?? '30d'
  );
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

  const handleRangeChange = (range: '7d' | '30d' | '90d') => {
    setSelectedRange(range);
    analytics.savingsEvolutionRangeChanged(range, evolution?.mode ?? 'live');
    onChangeRange?.(range);
  };

  // Acumulado total del rango seleccionado
  const totalAmount = evolution?.points.reduce((acc, p) => acc + p.value, 0) ?? 0;
  const hasData     = (evolution?.points?.length ?? 0) > 0;

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
            <div className={styles.iconWrap}><TrendingUpIcon size={24} /></div>
            <span className={styles.title}>Evolución del ahorro</span>
          </div>
          <div className={styles.headerRight}>
            {evolution?.mode === 'demo' && (
              <div className={styles.demoBadge}>DEMO</div>
            )}
            {/* Selector de rango: solo en pestaña general */}
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
            {/* Tab bar (solo si hay objetivos activos) */}
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

            {/* ── Tab: Ahorro general — línea acumulativa ── */}
            {activeTab === 'general' && (
              hasData ? (
                <div className={styles.lineChartWrap}>
                  <GeneralLineChart
                    points={evolution!.points}
                    rangeDays={getRangeDays(selectedRange)}
                  />
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIconWrap}><BarChartIcon size={32} /></div>
                  <p className={styles.emptyText}>Aún no hay datos para este período.</p>
                  {onGoToDailyQuestion && (
                    <button className={styles.emptyBtn} onClick={onGoToDailyQuestion}>
                      <span>Responder ahora</span>
                      <span className={styles.emptyBtnArrow}><ChevronRightIcon size={16} /></span>
                    </button>
                  )}
                </div>
              )
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
                      style={{ transform: goalDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 180ms ease', flexShrink: 0 }}
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

                    {/* Gráfica de progreso vs. ideal */}
                    <div className={styles.lineChartWrap}>
                      <GoalLineChart points={goalPoints} goal={selectedGoal} />
                    </div>

                    {/* Leyenda */}
                    <div className={styles.chartLegend}>
                      {/* Ritmo ideal */}
                      <div className={styles.legendItem}>
                        <svg width="24" height="10" viewBox="0 0 24 10">
                          <line x1="0" y1="5" x2="24" y2="5"
                            stroke="rgba(168,85,247,0.55)" strokeWidth="1.5" strokeDasharray="5 3" />
                        </svg>
                        <span className={styles.legendLabel}>Ritmo ideal</span>
                      </div>
                      {/* Tu progreso (verde) */}
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
              </>
            )}
          </>
        )}

      </div>
    </div>
  );
}

export default SavingsEvolutionWidget;
