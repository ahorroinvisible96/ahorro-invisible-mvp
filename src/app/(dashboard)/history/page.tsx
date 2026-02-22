"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { useHistorySummary } from '@/hooks/useHistorySummary';
import { HistoryFiltersWidget } from '@/components/history/HistoryFiltersWidget/HistoryFiltersWidget';
import { HistorySummaryWidget } from '@/components/history/HistorySummaryWidget/HistorySummaryWidget';
import { HistoryDecisionsListWidget } from '@/components/history/HistoryDecisionsListWidget/HistoryDecisionsListWidget';
import { HistoryEmptyStateWidget } from '@/components/history/HistoryEmptyStateWidget/HistoryEmptyStateWidget';
import styles from './History.module.css';

export default function HistoryPage() {
  const router = useRouter();
  const {
    goals,
    categories,
    filters,
    setFilters,
    filtered,
    totalSaved,
    loading,
    deleteDecision,
    editDecision,
  } = useHistorySummary();

  useEffect(() => {
    analytics.setScreen('history');
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (isAuthenticated !== 'true') { router.replace('/signup'); return; }
    analytics.historyViewed('sidebar');
  }, [router]);

  const hasActiveFilters =
    filters.range !== 'all' ||
    filters.goalId !== 'all' ||
    filters.category !== 'all';

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Cargando historial...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderGlow} />
        <div className={styles.pageHeaderInner}>
          <div className={styles.pageIconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div className={styles.pageTitles}>
            <h1 className={styles.pageTitle}>Historial</h1>
            <p className={styles.pageSubtitle}>Todas tus decisiones de ahorro</p>
          </div>
        </div>
      </div>

      {/* ── Widgets ── */}
      <div className={styles.widgetsStack}>

        {/* Widget filtros */}
        <HistoryFiltersWidget
          filters={filters}
          goals={goals}
          categories={categories}
          onChange={setFilters}
        />

        {/* Widget resumen — solo si hay resultados */}
        {filtered.length > 0 && (
          <HistorySummaryWidget
            count={filtered.length}
            totalSaved={totalSaved}
          />
        )}

        {/* Widget lista o estado vacío */}
        {filtered.length > 0 ? (
          <HistoryDecisionsListWidget
            decisions={filtered}
            onOpenDecision={(id) => router.push(`/impact/${id}`)}
            onDeleteDecision={deleteDecision}
            onEditDecision={editDecision}
          />
        ) : (
          <HistoryEmptyStateWidget
            hasFilters={hasActiveFilters}
            onGoToDashboard={() => router.push('/dashboard')}
          />
        )}

      </div>
    </div>
  );
}
