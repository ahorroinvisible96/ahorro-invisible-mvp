"use client";

import React, { useState } from 'react';
import type { HistoryDecisionItem } from '@/hooks/useHistorySummary';
import type { HistoryDecisionsListWidgetProps } from './HistoryDecisionsListWidget.types';
import styles from './HistoryDecisionsListWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateString));
}

function formatEUR(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ── Modal eliminar ───────────────────────────────────────────────────────────
function DeleteModal({
  decision,
  onConfirm,
  onClose,
}: {
  decision: HistoryDecisionItem;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>¿Eliminar este ahorro?</h3>
          <button className={styles.modalClose} onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <p className={styles.modalText}>
          Se eliminará <strong style={{ color: '#f1f5f9' }}>{decision.questionText}</strong> del{' '}
          <strong style={{ color: '#f1f5f9' }}>{formatDate(decision.date)}</strong> y se revertirán{' '}
          <strong style={{ color: '#4ade80' }}>{formatEUR(decision.deltaAmount)}</strong> del objetivo asociado.
        </p>
        <div className={styles.modalFooter}>
          <button className={styles.btnCancel} onClick={onClose}>Cancelar</button>
          <button className={styles.btnDanger} onClick={onConfirm}>Sí, eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal editar ─────────────────────────────────────────────────────────────
function EditModal({
  decision,
  onConfirm,
  onClose,
}: {
  decision: HistoryDecisionItem;
  onConfirm: (newAmount: number) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(decision.deltaAmount));
  const [error, setError] = useState('');

  function handleSave() {
    setError('');
    const val = Number(amount);
    if (!amount || isNaN(val) || val < 0) {
      setError('Introduce una cantidad válida (0 o mayor).');
      return;
    }
    onConfirm(val);
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Editar ahorro</h3>
          <button className={styles.modalClose} onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <p className={styles.modalText}>
          Modifica la cantidad ahorrada para{' '}
          <strong style={{ color: '#f1f5f9' }}>{decision.questionText}</strong>{' '}
          del <strong style={{ color: '#f1f5f9' }}>{formatDate(decision.date)}</strong>.
        </p>

        {error && (
          <p style={{ fontSize: 12, color: '#f87171', marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>
            {error}
          </p>
        )}

        <div className={styles.modalField}>
          <label className={styles.modalLabel}>Cantidad ahorrada (€)</label>
          <input
            className={styles.modalInput}
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnCancel} onClick={onClose}>Cancelar</button>
          <button className={styles.btnSave} onClick={handleSave}>Guardar cambio</button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export function HistoryDecisionsListWidget({
  decisions,
  onOpenDecision,
  onDeleteDecision,
  onEditDecision,
}: HistoryDecisionsListWidgetProps): React.ReactElement {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { collapsed, toggle } = useWidgetCollapse('history_decisions_list', false);

  const deletingDecision = decisions.find((d) => d.id === deletingId) ?? null;
  const editingDecision = decisions.find((d) => d.id === editingId) ?? null;

  return (
    <>
      {/* Header colapsable */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'rgba(15,23,42,0.6)',
        border: '1px solid rgba(51,65,85,0.4)',
        borderRadius: collapsed ? 16 : '16px 16px 0 0',
        marginBottom: collapsed ? 0 : 0,
        cursor: 'pointer',
      }} onClick={toggle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
            color: '#818cf8', flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(241,245,249,0.9)', letterSpacing: '0.03em' }}>
            DECISIONES REGISTRADAS
          </span>
          <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)', fontWeight: 500 }}>
            {decisions.length} en total
          </span>
        </div>
        <CollapseChevron collapsed={collapsed} onToggle={toggle} />
      </div>

      {!collapsed && <div className={styles.list}>
        {decisions.map((d) => (
          <div
            key={d.id}
            className={styles.card}
            onClick={() => onOpenDecision(d.id)}
          >
            <div className={styles.cardBg} />
            <div className={`${styles.cardBorder} ${d.isExtra ? styles.cardBorderExtra : ''}`} />

            <div className={styles.cardContent}>
              <div className={styles.mainRow}>
                {/* Columna izquierda */}
                <div className={styles.leftCol}>
                  <div className={styles.badgeRow}>
                    <span className={styles.badgeDate}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      {formatDate(d.date)}
                    </span>
                    {d.goalTitle && (
                      <span className={styles.badgeGoal}>{d.goalTitle}</span>
                    )}
                    {d.isExtra && (
                      <span className={styles.badgeExtra}>✦ Extra</span>
                    )}
                  </div>
                  <p className={styles.questionText}>{d.questionText}</p>
                  <p className={styles.answerText}>{d.answerLabel}</p>
                </div>

                {/* Columna derecha */}
                <div className={styles.rightCol}>
                  <span className={`${styles.amount} ${d.deltaAmount === 0 ? styles.amountZero : ''}`}>
                    {d.deltaAmount > 0 ? '+' : ''}{formatEUR(d.deltaAmount)}
                  </span>
                  {d.monthlyProjection > 0 && (
                    <span className={styles.monthlyHint}>{formatEUR(d.monthlyProjection)}/mes</span>
                  )}

                  {/* Botones editar / eliminar */}
                  <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
                    <button
                      className={styles.btnEdit}
                      title="Editar cantidad"
                      onClick={(e) => { e.stopPropagation(); setEditingId(d.id); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      className={styles.btnDelete}
                      title="Eliminar ahorro"
                      onClick={(e) => { e.stopPropagation(); setDeletingId(d.id); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6"/><path d="M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>}

      {/* Modal eliminar */}
      {deletingDecision && (
        <DeleteModal
          decision={deletingDecision}
          onConfirm={() => { onDeleteDecision(deletingDecision.id); setDeletingId(null); }}
          onClose={() => setDeletingId(null)}
        />
      )}

      {/* Modal editar */}
      {editingDecision && (
        <EditModal
          decision={editingDecision}
          onConfirm={(newAmount) => { onEditDecision(editingDecision.id, newAmount); setEditingId(null); }}
          onClose={() => setEditingId(null)}
        />
      )}
    </>
  );
}

export default HistoryDecisionsListWidget;
