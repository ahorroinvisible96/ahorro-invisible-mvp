"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { analytics } from '@/services/analytics';
import { storeGetGoalProgressPoints } from '@/services/dashboardStore';
import type { GoalProgressPoint } from '@/services/dashboardStore';
import type { Goal } from '@/types/Dashboard';
import type { SavingsEvolutionWidgetProps } from './SavingsEvolutionWidget.types';
import styles from './SavingsEvolutionWidget.module.css';
import { TargetIcon, ShieldIcon, ChevronRightIcon } from '@/components/ui/AppIcons';

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Paleta limpia Reference Dark (coherente con imagen 2) ─────────────────────
const DONUT_COLORS = [
  '#5a63f6', // indigo
  '#0ea5e9', // sky
  '#10c482', // emerald
  '#9b51f6', // violet
  '#f59e0b', // amber
  '#ec4899', // pink
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── DONUT CHART + LISTA AIREADA DE OBJETIVOS (V3 Final) ───────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function GoalDonutChart({ goals }: { goals: Goal[] }) {
  const activeGoals = goals.filter((g) => !g.archived);
  const totalSaved = activeGoals.reduce((sum, g) => sum + g.currentAmount, 0);
  const hasData = totalSaved > 0;
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const CX = 84;
  const CY = 84;
  const R = 64;
  const STROKE = 14;
  const CI = 2 * Math.PI * R;

  const goalsWithSavings = activeGoals.filter((g) => g.currentAmount > 0);
  const segCount = goalsWithSavings.length;

  // Asignación geométrica sin solapes:
  // Con strokeLinecap="round", cada arco sobresale STROKE/2 por ambos extremos.
  // Reservamos un slot mínimo (STROKE + VISUAL_GAP + MIN_DASH) mediante water-filling
  // proporcional para que incluso objetivos pequeños (<1%) se vean nítidos y separados.
  const VISUAL_GAP = segCount > 6 ? 3 : 5;
  const useRoundCaps = segCount === 1 || segCount * (STROKE + VISUAL_GAP + 1) <= CI;
  const capAllowance = useRoundCaps ? STROKE : 0;
  const inset = segCount > 1 ? (capAllowance + VISUAL_GAP) / 2 : 0;
  const minSlot = segCount > 1 ? Math.min(capAllowance + VISUAL_GAP + 1, CI / segCount) : CI;

  const slots = new Array<number>(segCount).fill(0);
  if (segCount === 1) {
    slots[0] = CI;
  } else if (segCount > 1) {
    const locked = new Array<boolean>(segCount).fill(false);
    let changed = true;
    while (changed) {
      changed = false;
      let lockedSum = 0;
      let unlockedAmount = 0;
      for (let i = 0; i < segCount; i++) {
        if (locked[i]) lockedSum += minSlot;
        else unlockedAmount += goalsWithSavings[i].currentAmount;
      }
      const remCI = Math.max(0, CI - lockedSum);
      for (let i = 0; i < segCount; i++) {
        if (locked[i]) {
          slots[i] = minSlot;
        } else {
          const share = unlockedAmount > 0
            ? (goalsWithSavings[i].currentAmount / unlockedAmount) * remCI
            : remCI / Math.max(1, segCount - locked.filter(Boolean).length);
          if (share < minSlot) {
            locked[i] = true;
            slots[i] = minSlot;
            changed = true;
          } else {
            slots[i] = share;
          }
        }
      }
    }
  }

  let cursorLen = 0;
  const segments = goalsWithSavings.map((g, i) => {
    const pct = g.currentAmount / totalSaved;
    const slotLen = slots[i];
    const dashStart = cursorLen + inset;
    const dashLen = segCount > 1 ? Math.max(0.5, slotLen - 2 * inset) : CI;
    const startRot = -90 + (dashStart / CI) * 360;
    cursorLen += slotLen;
    return {
      goal: g,
      pct,
      slotLen,
      dashLen,
      startRot,
      visualStartLen: dashStart - capAllowance / 2,
      visualEndLen: dashStart + dashLen + capAllowance / 2,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
      originalIdx: activeGoals.indexOf(g),
    };
  });

  const handleSegmentClick = useCallback((idx: number) => {
    setSelectedIdx((prev) => (prev === idx ? null : idx));
  }, []);

  const selectedSeg =
    selectedIdx !== null
      ? segments.find((s) => s.originalIdx === selectedIdx) ?? null
      : null;

  const selectedPctLabel = selectedSeg
    ? (selectedSeg.pct > 0 && selectedSeg.pct < 0.005 ? '< 1%' : `${Math.round(selectedSeg.pct * 100)}%`)
    : '';

  return (
    <div className={styles.donutSection}>
      {/* Rueda donut limpia */}
      <div className={styles.donutContainer}>
        <svg viewBox="0 0 168 168" width="146" height="146" className={styles.donutSvg} aria-label="Distribución de ahorro por objetivo">
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            className={styles.donutTrack}
            strokeWidth={STROKE}
          />

          {segments.map((seg) => {
            const isSelected = selectedIdx === seg.originalIdx;
            return (
              <circle
                key={seg.goal.id}
                data-donut-goal={seg.goal.id}
                data-visual-start={seg.visualStartLen.toFixed(2)}
                data-visual-end={seg.visualEndLen.toFixed(2)}
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth={isSelected ? STROKE + 3 : STROKE}
                strokeDasharray={`${seg.dashLen} ${CI}`}
                strokeLinecap={useRoundCaps ? 'round' : 'butt'}
                transform={`rotate(${seg.startRot} ${CX} ${CY})`}
                style={{
                  cursor: 'pointer',
                  transition: 'opacity 200ms ease, stroke-width 200ms ease',
                  opacity: selectedIdx !== null && !isSelected ? 0.32 : 1,
                }}
                onClick={() => handleSegmentClick(seg.originalIdx)}
              />
            );
          })}

          {hasData ? (
            <>
              <text
                x={CX}
                y={CY - 5}
                textAnchor="middle"
                fontSize="11"
                fontWeight="500"
                className={styles.donutCenterLabel}
              >
                {selectedSeg
                  ? selectedPctLabel
                  : `${goalsWithSavings.length} ${goalsWithSavings.length === 1 ? 'objetivo' : 'objetivos'}`}
              </text>
              <text
                x={CX}
                y={CY + 16}
                textAnchor="middle"
                fontSize="20"
                fontWeight="700"
                className={styles.donutCenterValue}
              >
                {formatCurrency(selectedSeg ? selectedSeg.goal.currentAmount : totalSaved)}
              </text>
            </>
          ) : (
            <>
              <text x={CX} y={CY - 2} textAnchor="middle" fontSize="11" className={styles.donutCenterLabel}>
                Sin ahorros
              </text>
              <text x={CX} y={CY + 17} textAnchor="middle" fontSize="18" fontWeight="700" className={styles.donutCenterValue}>
                0 €
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Lista aireada estilo Patrimonio total */}
      {goalsWithSavings.length > 0 && (
        <div className={styles.goalRows}>
          {goalsWithSavings.map((g, i) => {
            const color = DONUT_COLORS[i % DONUT_COLORS.length];
            const origIdx = activeGoals.indexOf(g);
            const isSelected = selectedIdx === origIdx;
            const isDimmed = selectedIdx !== null && !isSelected;
            return (
              <button
                key={g.id}
                type="button"
                className={`${styles.goalRow} ${isSelected ? styles.goalRowActive : ''} ${isDimmed ? styles.goalRowDimmed : ''}`}
                onClick={() => handleSegmentClick(origIdx)}
              >
                <div className={styles.goalRowLeft}>
                  <span className={styles.goalRowIcon} style={{ background: color }}>
                    {i === 0 ? <ShieldIcon size={17} /> : <TargetIcon size={17} />}
                  </span>
                  <span className={styles.goalRowTitle}>{g.title}</span>
                </div>
                <span className={styles.goalRowAmount}>{formatCurrency(g.currentAmount)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── GOAL LINE CHART — minimalista estilo Gastado este mes ─────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function GoalLineChart({ points, goal }: { points: GoalProgressPoint[]; goal: Goal }) {
  const W = 320;
  const H = 136;
  const PAD = { top: 20, right: 8, bottom: 26, left: 8 };
  const CW = W - PAD.left - PAD.right;
  const CH = H - PAD.top - PAD.bottom;

  const horizonDays = Math.max(1, goal.horizonMonths * 30);
  const maxVal = goal.targetAmount || 1;
  const safeId = goal.id.replace(/[^a-zA-Z0-9]/g, '_');

  const xScale = (day: number) => PAD.left + (Math.min(day, horizonDays) / horizonDays) * CW;
  const yScale = (val: number) => PAD.top + CH - (Math.min(val, maxVal) / maxVal) * CH;
  const yBottom = yScale(0);

  const hasActualProgress = goal.currentAmount > 0 && points.length > 0;
  let actualPts: { x: number; y: number }[] = [];
  if (hasActualProgress) {
    const startPt = { x: xScale(0), y: yScale(0) };
    const dataPts = points.map((p) => ({ x: xScale(p.day), y: yScale(p.actual) }));
    actualPts = points[0]?.day > 0 ? [startPt, ...dataPts] : dataPts;
  }

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
  const areaPath =
    actualPts.length > 1
      ? `${smoothLine} L ${actualPts[actualPts.length - 1].x.toFixed(1)} ${yBottom.toFixed(1)} L ${actualPts[0].x.toFixed(1)} ${yBottom.toFixed(1)} Z`
      : '';

  const step =
    goal.horizonMonths <= 3 ? 1 : goal.horizonMonths <= 6 ? 2 : goal.horizonMonths <= 12 ? 3 : 6;
  const xLabels: { month: number; x: number }[] = [];
  for (let m = 0; m <= goal.horizonMonths; m += step) {
    xLabels.push({ month: m, x: xScale(m * 30) });
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className={styles.goalChart}>
      <defs>
        <linearGradient id={`ga_${safeId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(16, 196, 130, 0.34)" />
          <stop offset="100%" stopColor="rgba(16, 196, 130, 0.00)" />
        </linearGradient>
      </defs>

      {/* Meta arriba a la derecha */}
      <text x={W - PAD.right} y="14" textAnchor="end" fontSize="10.5" className={styles.axisLabel}>
        {formatCurrencyShort(maxVal)}
      </text>

      {/* Eje base */}
      <line x1={PAD.left} y1={yBottom} x2={W - PAD.right} y2={yBottom} className={styles.axisBase} />

      {/* Ritmo ideal */}
      <line
        x1={xScale(0)}
        y1={yScale(0)}
        x2={xScale(horizonDays)}
        y2={yScale(maxVal)}
        stroke="rgba(155, 160, 180, 0.34)"
        strokeWidth="1.5"
        strokeDasharray="4 5"
      />

      {/* Progreso real */}
      {hasActualProgress && areaPath && <path d={areaPath} fill={`url(#ga_${safeId})`} />}
      {hasActualProgress && actualPts.length > 1 && (
        <path
          d={smoothLine}
          fill="none"
          stroke="#10c482"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {hasActualProgress && actualPts.length > 0 && (
        <circle
          cx={actualPts[actualPts.length - 1].x}
          cy={actualPts[actualPts.length - 1].y}
          r="4"
          fill="#10c482"
        />
      )}

      {/* Eje X */}
      {xLabels.map((l, i) => (
        <text
          key={l.month}
          x={l.x}
          y={H - 4}
          textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
          fontSize="10.5"
          className={styles.axisLabel}
        >
          {l.month === 0 ? 'Inicio' : `${l.month}m`}
        </text>
      ))}

      {!hasActualProgress && (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="11" className={styles.axisLabel}>
          Tu progreso aparecerá con el primer ahorro
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
  onGoToDailyQuestion,
  goals,
}: SavingsEvolutionWidgetProps & { onGoToDailyQuestion?: () => void }): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'general' | 'goals'>('general');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(goals?.[0]?.id ?? null);
  const [goalDropdownOpen, setGoalDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
  const allTimeSaved = activeGoalList.reduce((sum, g) => sum + g.currentAmount, 0);

  const selectedGoal: Goal | null = activeGoalList.find((g) => g.id === selectedGoalId) ?? activeGoalList[0] ?? null;
  const goalPoints: GoalProgressPoint[] =
    activeTab === 'goals' && selectedGoal?.id ? storeGetGoalProgressPoints(selectedGoal.id) : [];

  const selectedPct =
    selectedGoal && selectedGoal.targetAmount > 0
      ? Math.min(100, Math.round((selectedGoal.currentAmount / selectedGoal.targetAmount) * 100))
      : 0;

  return (
    <section className={styles.wrapper} data-widget-cat="progress" aria-label="Evolución del ahorro">
      {/* Cabecera limpia: Total ahorrado + switch General / Progreso */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.eyebrow}>Total ahorrado</span>
          {evolution?.mode === 'demo' && <span className={styles.demoBadge}>Demo</span>}
        </div>

        {activeGoalList.length > 0 && (
          <div className={styles.miniSwitch} role="tablist" aria-label="Vista de evolución">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'general'}
              className={`${styles.miniTab} ${activeTab === 'general' ? styles.miniTabActive : ''}`}
              onClick={() => setActiveTab('general')}
            >
              General
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'goals'}
              className={`${styles.miniTab} ${activeTab === 'goals' ? styles.miniTabActive : ''}`}
              onClick={() => setActiveTab('goals')}
            >
              Progreso
            </button>
          </div>
        )}
      </div>

      {/* Cifra protagonista */}
      <div className={styles.totalAmount}>{formatCurrency(allTimeSaved)}</div>

      {/* Tab General: Rueda donut + lista aireada de objetivos */}
      {activeTab === 'general' && <GoalDonutChart goals={activeGoalList} />}

      {/* Tab Progreso: Curva minimalista por objetivo */}
      {activeTab === 'goals' && (
        <div className={styles.progressTab}>
          {activeGoalList.length > 1 && (
            <div className={styles.goalDropdownWrap} ref={dropdownRef}>
              <button
                type="button"
                className={styles.goalDropdownTrigger}
                onClick={() => setGoalDropdownOpen((o) => !o)}
              >
                <span className={styles.goalDropdownLabel}>{selectedGoal?.title ?? 'Selecciona un objetivo'}</span>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: goalDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 160ms ease',
                    flexShrink: 0,
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
                      type="button"
                      className={`${styles.goalDropdownItem} ${selectedGoal?.id === g.id ? styles.goalDropdownItemActive : ''}`}
                      onClick={() => {
                        setSelectedGoalId(g.id);
                        setGoalDropdownOpen(false);
                      }}
                    >
                      {g.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedGoal ? (
            <>
              <div className={styles.goalSummaryRow}>
                <span className={styles.goalSummaryTitle}>{selectedGoal.title}</span>
                <span className={styles.goalSummaryMeta}>
                  {formatCurrency(selectedGoal.currentAmount)} · {selectedPct}%
                </span>
              </div>
              <GoalLineChart points={goalPoints} goal={selectedGoal} />
            </>
          ) : (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>Crea tu primer objetivo para ver la evolución.</p>
              {onGoToDailyQuestion && (
                <button type="button" className={styles.emptyBtn} onClick={onGoToDailyQuestion}>
                  <span>Empezar</span>
                  <ChevronRightIcon size={15} />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default SavingsEvolutionWidget;
