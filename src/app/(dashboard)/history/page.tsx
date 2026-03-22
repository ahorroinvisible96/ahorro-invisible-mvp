"use client";

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { useHistorySummary } from '@/hooks/useHistorySummary';
import type { HistoryDecisionItem } from '@/hooks/useHistorySummary';
import { HistoryFiltersWidget } from '@/components/history/HistoryFiltersWidget/HistoryFiltersWidget';
import { HistorySummaryWidget } from '@/components/history/HistorySummaryWidget/HistorySummaryWidget';
import { HistoryDecisionsListWidget } from '@/components/history/HistoryDecisionsListWidget/HistoryDecisionsListWidget';
import { HistoryEmptyStateWidget } from '@/components/history/HistoryEmptyStateWidget/HistoryEmptyStateWidget';
import styles from './History.module.css';

function exportCSV(decisions: HistoryDecisionItem[]): void {
  const header = ['Fecha', 'Categoría', 'Pregunta', 'Respuesta', 'Ahorro (€)', 'Objetivo', 'Proyección mensual (€)', 'Proyección anual (€)'];
  const rows = decisions.map((d) => [
    d.date,
    d.category,
    `"${d.questionText.replace(/"/g, '""')}"`,
    `"${d.answerLabel.replace(/"/g, '""')}"`,
    d.deltaAmount.toFixed(2),
    `"${(d.goalTitle ?? '').replace(/"/g, '""')}"`,
    d.monthlyProjection.toFixed(2),
    d.yearlyProjection.toFixed(2),
  ]);
  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ahorro-invisible-historial-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

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
    if (isAuthenticated !== 'true') { router.replace('/login'); return; }
    analytics.historyViewed('sidebar');
  }, [router]);

  const handleExport = useCallback(() => {
    exportCSV(filtered);
  }, [filtered]);

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
        <div className={styles.pageHeaderInner} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
          {filtered.length > 0 && (
            <button
              onClick={handleExport}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 10,
                background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.35)',
                color: '#60a5fa', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
              }}
              title="Exportar a CSV"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              CSV
            </button>
          )}
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
