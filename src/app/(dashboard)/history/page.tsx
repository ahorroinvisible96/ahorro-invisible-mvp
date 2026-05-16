"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { useHistorySummary } from '@/hooks/useHistorySummary';
import { HistoryDecisionsListWidget } from '@/components/history/HistoryDecisionsListWidget/HistoryDecisionsListWidget';
import { HistoryEmptyStateWidget } from '@/components/history/HistoryEmptyStateWidget/HistoryEmptyStateWidget';
import styles from './History.module.css';
import { BarChartIcon } from '@/components/ui/AppIcons';
import { WidgetSkeleton } from '@/components/ui/Skeleton/Skeleton';

function formatEUR(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ── Opciones de periodo ───────────────────────────────────────────────────────
const RANGE_OPTIONS = [
  { label: '7 días', value: '7d' },
  { label: '30 días', value: '30d' },
  { label: '90 días', value: '90d' },
] as const;

// ── Página ────────────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const router = useRouter();
  const {
    goals,
    filters,
    setFilters,
    filtered,
    totalSaved,
    loading,
    deleteDecision,
    editDecision,
  } = useHistorySummary();

  const [rangeOpen, setRangeOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);

  useEffect(() => {
    analytics.setScreen('history');
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (isAuthenticated !== 'true') { router.replace('/login'); return; }
    analytics.historyViewed('sidebar');
  }, [router]);

  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    if (!rangeOpen && !goalOpen) return;
    const handleClick = () => { setRangeOpen(false); setGoalOpen(false); };
    const t = setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => { clearTimeout(t); document.removeEventListener('click', handleClick); };
  }, [rangeOpen, goalOpen]);

  const hasActiveFilters =
    filters.range !== 'all' ||
    filters.goalId !== 'all' ||
    filters.category !== 'all';

  if (loading) {
    return (
      <div className={styles.page}>
        <div style={{ padding: '40px 16px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480, margin: '0 auto', width: '100%' }}>
          <WidgetSkeleton />
          <WidgetSkeleton />
        </div>
      </div>
    );
  }

  // Métricas para el header
  const totalDecisions = filtered.length;
  const totalAmount    = totalSaved;
  const avgPerDecision = totalDecisions > 0 ? totalAmount / totalDecisions : 0;

  // Calcular mejores días
  const daysWithSavings = new Set(filtered.filter(d => d.deltaAmount > 0).map(d => d.date)).size;

  return (
    <div className={styles.page}>

      {/* ══════════════════════════════════════════════════════════════════════
          ZONA 1 — HEADER PRINCIPAL (degradado navy-índigo, igual que Objetivos)
          ══════════════════════════════════════════════════════════════════════ */}
      <div className={styles.headerZone}>
        <div className={styles.zoneInner}>
          <div className={styles.headerContent}>

            {/* Fila superior: icono + título */}
            <div className={styles.headerTop}>
              <div className={styles.headerLeft}>
                <div className={styles.headerIconWrap}>
                  <BarChartIcon size={22} />
                </div>
                <div className={styles.headerTitles}>
                  <span className={styles.headerSub}>Tu actividad</span>
                  <h1 className={styles.headerTitle}>Historial</h1>
                </div>
              </div>
            </div>

            {/* ── Filtros integrados: Periodo + Objetivo ── */}
            <div className={styles.headerFilters}>
              {/* Dropdown Periodo */}
              <div className={styles.dropdownWrap}>
                <button
                  className={styles.dropdownTrigger}
                  onClick={() => { setRangeOpen(!rangeOpen); setGoalOpen(false); }}
                >
                  <span className={styles.dropdownLabel}>Periodo</span>
                  <span className={styles.dropdownValue}>
                    {RANGE_OPTIONS.find(o => o.value === filters.range)?.label ?? '30 días'}
                  </span>
                  <svg className={`${styles.dropdownChevron} ${rangeOpen ? styles.dropdownChevronOpen : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {rangeOpen && (
                  <div className={styles.dropdownMenu}>
                    {RANGE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        className={`${styles.dropdownItem} ${filters.range === opt.value ? styles.dropdownItemActive : ''}`}
                        onClick={() => { setFilters({ range: opt.value }); setRangeOpen(false); }}
                      >
                        {opt.label}
                        {filters.range === opt.value && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dropdown Objetivo */}
              {goals.length > 0 && (
                <div className={styles.dropdownWrap}>
                  <button
                    className={styles.dropdownTrigger}
                    onClick={() => { setGoalOpen(!goalOpen); setRangeOpen(false); }}
                  >
                    <span className={styles.dropdownLabel}>Objetivo</span>
                    <span className={styles.dropdownValue}>
                      {filters.goalId === 'all'
                        ? 'Todos'
                        : (goals.find(g => g.id === filters.goalId)?.title ?? 'Todos')}
                    </span>
                    <svg className={`${styles.dropdownChevron} ${goalOpen ? styles.dropdownChevronOpen : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {goalOpen && (
                    <div className={styles.dropdownMenu}>
                      <button
                        className={`${styles.dropdownItem} ${filters.goalId === 'all' ? styles.dropdownItemActive : ''}`}
                        onClick={() => { setFilters({ goalId: 'all' }); setGoalOpen(false); }}
                      >
                        Todos los objetivos
                        {filters.goalId === 'all' && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </button>
                      {goals.map((g) => (
                        <button
                          key={g.id}
                          className={`${styles.dropdownItem} ${filters.goalId === g.id ? styles.dropdownItemActive : ''}`}
                          onClick={() => { setFilters({ goalId: g.id }); setGoalOpen(false); }}
                        >
                          {g.title}
                          {filters.goalId === g.id && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Divisor */}
            <div className={styles.headerDivider} />

            {/* Métricas clave: 3 tarjetas (igual que Objetivos) */}
            <div className={styles.metricsRow}>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Decisiones</span>
                <span className={styles.metricValue}>{totalDecisions}</span>
                <span className={styles.metricSub}>
                  {filters.range === 'all' ? 'en total' : `últimos ${filters.range}`}
                </span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Ahorro</span>
                <span className={styles.metricValueAccent}>
                  {totalAmount > 0 ? '+' : ''}{formatEUR(totalAmount)}
                </span>
                <span className={styles.metricSub}>
                  acumulado
                </span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Media</span>
                <span className={styles.metricValue}>
                  {formatEUR(avgPerDecision)}
                </span>
                <span className={styles.metricSub}>
                  {daysWithSavings > 0 ? `${daysWithSavings} días activos` : 'por decisión'}
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ZONA 2 — CONTENIDO (fondo oscuro, lista de decisiones)
          ══════════════════════════════════════════════════════════════════════ */}
      <div className={styles.contentZone}>
        <div className={styles.zoneInner}>
          <div className={styles.contentCol}>

            {/* ─── Bloque: Lista de decisiones ─── */}
            <div className={styles.sectionGroup}>
              <p className={styles.sectionLabel}>
                DECISIONES
                {totalDecisions > 0 && (
                  <span style={{ color: 'rgba(255,255,255,0.18)', fontWeight: 400, marginLeft: 6 }}>
                    ({totalDecisions})
                  </span>
                )}
              </p>

              {filtered.length > 0 ? (
                <div className={styles.listCard}>
                  <HistoryDecisionsListWidget
                    decisions={filtered}
                    onOpenDecision={() => {}}
                    onDeleteDecision={deleteDecision}
                    onEditDecision={editDecision}
                  />
                </div>
              ) : (
                <div className={styles.listCard}>
                  <HistoryEmptyStateWidget
                    hasFilters={hasActiveFilters}
                    onGoToDashboard={() => router.push('/dashboard')}
                  />
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}
