"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { useHistorySummary } from '@/hooks/useHistorySummary';
import { HistoryDecisionsListWidget } from '@/components/history/HistoryDecisionsListWidget/HistoryDecisionsListWidget';
import { HistoryEmptyStateWidget } from '@/components/history/HistoryEmptyStateWidget/HistoryEmptyStateWidget';
import styles from './History.module.css';
import { WidgetSkeleton } from '@/components/ui/Skeleton/Skeleton';

function formatEUR(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

const RANGE_OPTIONS = [
  { label: '7 días', value: '7d' },
  { label: '30 días', value: '30d' },
  { label: '90 días', value: '90d' },
] as const;

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

  const totalDecisions = filtered.length;
  const totalAmount = totalSaved;
  const avgPerDecision = totalDecisions > 0 ? totalAmount / totalDecisions : 0;
  const daysWithSavings = new Set(filtered.filter(d => d.deltaAmount > 0).map(d => d.date)).size;
  const activeRangeLabel = RANGE_OPTIONS.find(o => o.value === filters.range)?.label ?? '30 días';

  return (
    <div className={styles.page}>
      <div className={styles.headerZone}>
        <div className={styles.zoneInner}>
          <div className={styles.headerContent}>
            <div className={styles.topBar}>
              <h1 className={styles.headerTitle}>Historial</h1>
            </div>

            <div className={styles.heroCenter}>
              <span className={styles.heroKicker}>
                Ahorrado · {filters.range === 'all' ? 'en total' : `últimos ${activeRangeLabel}`}
              </span>
              <div className={styles.heroAmount}>
                {totalAmount > 0 ? '+' : ''}{formatEUR(totalAmount)}
              </div>
              <div className={styles.heroPill}>
                {totalDecisions} {totalDecisions === 1 ? 'decisión' : 'decisiones'} · media {formatEUR(avgPerDecision)}
                {daysWithSavings > 0 ? ` · ${daysWithSavings}d activos` : ''}
              </div>
            </div>

            <div className={styles.headerFilters}>
              <div className={styles.dropdownWrap}>
                <button
                  type="button"
                  className={styles.dropdownTrigger}
                  onClick={() => { setRangeOpen(!rangeOpen); setGoalOpen(false); }}
                >
                  <span className={styles.dropdownValue}>{activeRangeLabel}</span>
                  <svg className={`${styles.dropdownChevron} ${rangeOpen ? styles.dropdownChevronOpen : ''}`} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
                {rangeOpen && (
                  <div className={styles.dropdownMenu}>
                    {RANGE_OPTIONS.map((opt) => (
                      <button
                        type="button"
                        key={opt.value}
                        className={`${styles.dropdownItem} ${filters.range === opt.value ? styles.dropdownItemActive : ''}`}
                        onClick={() => { setFilters({ range: opt.value }); setRangeOpen(false); }}
                      >
                        {opt.label}
                        {filters.range === opt.value && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {goals.length > 0 && (
                <div className={styles.dropdownWrap}>
                  <button
                    type="button"
                    className={styles.dropdownTrigger}
                    onClick={() => { setGoalOpen(!goalOpen); setRangeOpen(false); }}
                  >
                    <span className={styles.dropdownValue}>
                      {filters.goalId === 'all'
                        ? 'Todos los objetivos'
                        : (goals.find(g => g.id === filters.goalId)?.title ?? 'Todos')}
                    </span>
                    <svg className={`${styles.dropdownChevron} ${goalOpen ? styles.dropdownChevronOpen : ''}`} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                  {goalOpen && (
                    <div className={styles.dropdownMenu}>
                      <button
                        type="button"
                        className={`${styles.dropdownItem} ${filters.goalId === 'all' ? styles.dropdownItemActive : ''}`}
                        onClick={() => { setFilters({ goalId: 'all' }); setGoalOpen(false); }}
                      >
                        Todos los objetivos
                        {filters.goalId === 'all' && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        )}
                      </button>
                      {goals.map((g) => (
                        <button
                          type="button"
                          key={g.id}
                          className={`${styles.dropdownItem} ${filters.goalId === g.id ? styles.dropdownItemActive : ''}`}
                          onClick={() => { setFilters({ goalId: g.id }); setGoalOpen(false); }}
                        >
                          {g.title}
                          {filters.goalId === g.id && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.contentZone}>
        <div className={styles.zoneInner}>
          {filtered.length > 0 ? (
            <section className={styles.listCard}>
              <div className={styles.listCardHead}>
                <h2 className={styles.listCardTitle}>Movimientos</h2>
                <span className={styles.listCardCount}>
                  {totalDecisions} {totalDecisions === 1 ? 'registro' : 'registros'}
                </span>
              </div>
              <HistoryDecisionsListWidget
                decisions={filtered}
                onOpenDecision={() => {}}
                onDeleteDecision={deleteDecision}
                onEditDecision={editDecision}
              />
            </section>
          ) : (
            <HistoryEmptyStateWidget
              hasFilters={hasActiveFilters}
              onGoToDashboard={() => router.push('/dashboard')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
