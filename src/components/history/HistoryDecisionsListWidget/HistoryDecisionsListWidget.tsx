"use client";

import React, { useState } from 'react';
import type { HistoryDecisionItem } from '@/hooks/useHistorySummary';
import type { HistoryDecisionsListWidgetProps } from './HistoryDecisionsListWidget.types';
import styles from './HistoryDecisionsListWidget.module.css';
import { CloseIcon, EditIcon, TrashIcon } from '@/components/ui/AppIcons';

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
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
          Se eliminará <strong style={{ color: '#f1f5f9' }}>{decision.questionText}</strong> y se revertirán{' '}
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
          <strong style={{ color: '#f1f5f9' }}>{decision.questionText}</strong>.
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

// ── Componente principal — Lista simple ──────────────────────────────────────
export function HistoryDecisionsListWidget({
  decisions,
  onOpenDecision,
  onDeleteDecision,
  onEditDecision,
}: HistoryDecisionsListWidgetProps): React.ReactElement {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const deletingDecision = decisions.find((d) => d.id === deletingId) ?? null;
  const editingDecision = decisions.find((d) => d.id === editingId) ?? null;

  return (
    <>
      <div className={styles.simpleList}>
        {decisions.map((d, i) => (
          <div
            key={d.id}
            className={`${styles.row} ${i < decisions.length - 1 ? styles.rowBorder : ''}`}
          >
            {/* Fecha */}
            <span className={styles.rowDate}>{formatDate(d.date)}</span>

            {/* Texto de la pregunta (truncado) */}
            <span className={styles.rowQuestion}>{d.questionText}</span>

            {/* Importe */}
            <span className={`${styles.rowAmount} ${d.deltaAmount === 0 ? styles.rowAmountZero : ''}`}>
              {d.deltaAmount > 0 ? '+' : ''}{formatEUR(d.deltaAmount)}
            </span>

            {/* Acciones mini */}
            <div className={styles.rowActions}>
              <button
                className={styles.rowBtn}
                title="Editar"
                onClick={(e) => { e.stopPropagation(); setEditingId(d.id); }}
              >
                <EditIcon size={12} />
              </button>
              <button
                className={`${styles.rowBtn} ${styles.rowBtnDanger}`}
                title="Eliminar"
                onClick={(e) => { e.stopPropagation(); setDeletingId(d.id); }}
              >
                <TrashIcon size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

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
