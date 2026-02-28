"use client";

import React from 'react';
import type { HistoryFiltersWidgetProps } from './HistoryFiltersWidget.types';
import styles from './HistoryFiltersWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';

const RANGE_OPTIONS = [
  { label: 'Todo', value: 'all' },
  { label: '7 días', value: '7d' },
  { label: '30 días', value: '30d' },
  { label: '90 días', value: '90d' },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  consumo: 'Consumo',
  food: 'Alimentación',
  transport: 'Transporte',
  subscription: 'Suscripciones',
  extra: 'Ahorro extra',
  otro: 'Otro',
};

export function HistoryFiltersWidget({
  filters,
  goals,
  categories,
  onChange,
}: HistoryFiltersWidgetProps): React.ReactElement {
  const { collapsed, toggle } = useWidgetCollapse('history_filters', false);
  return (
    <div className={styles.wrapper}>
      <div className={styles.bgGradient} />
      <div className={styles.glowPurple} />
      <div className={styles.borderLayer} />

      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
              <line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
          </div>
          <span className={styles.headerLabel} style={{ flex: 1 }}>Filtros</span>
          <CollapseChevron collapsed={collapsed} onToggle={toggle} />
        </div>

        {!collapsed && (
          <>
            {/* Periodo */}
            <div className={styles.filterRow}>
              <span className={styles.filterLabel}>Periodo</span>
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.chip} ${filters.range === opt.value ? styles.chipActive : ''}`}
                  onClick={() => onChange({ range: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Objetivo (solo si hay más de 1) */}
            {goals.length > 1 && (
              <div className={styles.filterRow}>
                <span className={styles.filterLabel}>Objetivo</span>
                <button
                  className={`${styles.chip} ${filters.goalId === 'all' ? styles.chipActive : ''}`}
                  onClick={() => onChange({ goalId: 'all' })}
                >Todos</button>
                {goals.map((g) => (
                  <button
                    key={g.id}
                    className={`${styles.chip} ${filters.goalId === g.id ? styles.chipActive : ''}`}
                    onClick={() => onChange({ goalId: g.id })}
                  >{g.title}</button>
                ))}
              </div>
            )}

            {/* Categoría (solo si hay más de 1) */}
            {categories.length > 1 && (
              <div className={styles.filterRow}>
                <span className={styles.filterLabel}>Categoría</span>
                <button
                  className={`${styles.chip} ${filters.category === 'all' ? styles.chipActive : ''}`}
                  onClick={() => onChange({ category: 'all' })}
                >Todas</button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className={`${styles.chip} ${filters.category === cat ? styles.chipActive : ''}`}
                    onClick={() => onChange({ category: cat })}
                  >{CATEGORY_LABELS[cat] ?? cat}</button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default HistoryFiltersWidget;
