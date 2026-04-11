"use client";

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { useHistorySummary } from '@/hooks/useHistorySummary';
import type { HistoryDecisionItem } from '@/hooks/useHistorySummary';
import { HistoryFiltersWidget } from '@/components/history/HistoryFiltersWidget/HistoryFiltersWidget';
import { HistorySummaryWidget } from '@/components/history/HistorySummaryWidget/HistorySummaryWidget';
import { HistoryDecisionsListWidget } from '@/components/history/HistoryDecisionsListWidget/HistoryDecisionsListWidget';
import { HistoryEmptyStateWidget } from '@/components/history/HistoryEmptyStateWidget/HistoryEmptyStateWidget';
import styles from './History.module.css';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';
import { BarChartIcon, DownloadIcon } from '@/components/ui/AppIcons';

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

  const [open, setOpen] = useState({ filtros: false, resumen: false, lista: false });
  const toggle = (k: keyof typeof open) => setOpen(p => ({ ...p, [k]: !p[k] }));

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
              <BarChartIcon size={20} />
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
              <DownloadIcon size={14} />
              CSV
            </button>
          )}
        </div>
      </div>

      {/* ── Widgets ── */}
      <div className={styles.widgetsStack}>

        {/* Widget filtros */}
        <div>
          <div onClick={() => toggle('filtros')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 14, cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(241,245,249,0.9)' }}>🔍 Filtros</span>
            <CollapseChevron collapsed={!open.filtros} onToggle={() => toggle('filtros')} />
          </div>
          {open.filtros && <HistoryFiltersWidget filters={filters} goals={goals} categories={categories} onChange={setFilters} />}
        </div>

        {/* Widget resumen — solo si hay resultados */}
        {filtered.length > 0 && (
          <div>
            <div onClick={() => toggle('resumen')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 14, cursor: 'pointer', userSelect: 'none' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(241,245,249,0.9)' }}>📊 Resumen</span>
              <CollapseChevron collapsed={!open.resumen} onToggle={() => toggle('resumen')} />
            </div>
            {open.resumen && <HistorySummaryWidget count={filtered.length} totalSaved={totalSaved} />}
          </div>
        )}

        {/* Widget lista o estado vacío */}
        <div>
          <div onClick={() => toggle('lista')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 14, cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(241,245,249,0.9)' }}>📅 Decisiones ({filtered.length})</span>
            <CollapseChevron collapsed={!open.lista} onToggle={() => toggle('lista')} />
          </div>
          {open.lista && (
            filtered.length > 0 ? (
              <HistoryDecisionsListWidget decisions={filtered} onOpenDecision={() => {}} onDeleteDecision={deleteDecision} onEditDecision={editDecision} />
            ) : (
              <HistoryEmptyStateWidget hasFilters={hasActiveFilters} onGoToDashboard={() => router.push('/dashboard')} />
            )
          )}
        </div>

      </div>
    </div>
  );
}
