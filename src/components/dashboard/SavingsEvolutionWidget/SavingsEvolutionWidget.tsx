"use client";

import React, { useState, useEffect } from 'react';
import { analytics } from '@/services/analytics';
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

// ── Componente principal ─────────────────────────────────────────────────────
export function SavingsEvolutionWidget({
  evolution,
  onChangeRange,
  onGoToDailyQuestion,
}: SavingsEvolutionWidgetProps & { onGoToDailyQuestion?: () => void }): React.ReactElement {
  const [selectedRange, setSelectedRange] = useState<'7d' | '30d' | '90d'>(
    evolution?.range ?? '30d'
  );

  useEffect(() => {
    if (evolution?.range) {
      analytics.savingsEvolutionRangeChanged(evolution.range, evolution.mode);
    }
  }, [evolution?.range, evolution?.mode]);

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
  const { collapsed, toggle } = useWidgetCollapse('savings_evolution', true);

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
            {!collapsed && (
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

        {/* ── Total acumulado ── */}
        <div className={styles.totalSection} style={{ cursor: collapsed ? 'pointer' : 'default' }} onClick={collapsed ? toggle : undefined}>
          <div className={styles.totalAmount}>{formatCurrency(totalAmount)}</div>
          <div className={styles.totalLabel}>Acumulado en {getRangeDays(selectedRange)}d</div>
        </div>

        {/* ── Gráfico o estado vacío ── */}
        {!collapsed && (
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

      </div>
    </div>
  );
}

export default SavingsEvolutionWidget;
