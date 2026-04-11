"use client";

import React, { useState } from 'react';
import type { HistoryDecisionItem } from '@/hooks/useHistorySummary';
import type { HistoryDecisionsListWidgetProps } from './HistoryDecisionsListWidget.types';
import styles from './HistoryDecisionsListWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';
import { CloseIcon, EditIcon, TrashIcon, CalendarIcon, BarChartIcon } from '@/components/ui/AppIcons';

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
            <CloseIcon size={14} />
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
            <CloseIcon size={14} />
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
            <BarChartIcon size={14} />
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
                      <CalendarIcon size={10} />
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
                      <EditIcon size={13} />
                    </button>
                    <button
                      className={styles.btnDelete}
                      title="Eliminar ahorro"
                      onClick={(e) => { e.stopPropagation(); setDeletingId(d.id); }}
                    >
                      <TrashIcon size={13} />
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
