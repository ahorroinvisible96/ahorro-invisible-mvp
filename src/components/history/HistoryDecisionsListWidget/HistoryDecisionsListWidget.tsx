"use client";

import React, { useState } from 'react';
import type { HistoryDecisionItem } from '@/hooks/useHistorySummary';
import type { HistoryDecisionsListWidgetProps } from './HistoryDecisionsListWidget.types';
import styles from './HistoryDecisionsListWidget.module.css';
import { CloseIcon, EditIcon, TrashIcon, BoltIcon, PlusIcon } from '@/components/ui/AppIcons';
import { ModalPortal } from '@/components/ui/ModalPortal/ModalPortal';

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

const ACCENT_MEDALLIONS = [styles.mViolet, styles.mCobalt, styles.mAmber];

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
    <ModalPortal>
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.grabber} />
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>¿Eliminar este ahorro?</h3>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Cerrar">
            <CloseIcon size={14} />
          </button>
        </div>
        <p className={styles.modalText}>
          Se eliminará <strong>{decision.questionText}</strong> y se revertirán{' '}
          <strong style={{ color: '#12C48B' }}>{formatEUR(decision.deltaAmount)}</strong> del objetivo asociado.
        </p>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnCancel} onClick={onClose}>Cancelar</button>
          <button type="button" className={styles.btnDanger} onClick={onConfirm}>Eliminar</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

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
    <ModalPortal>
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.grabber} />
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Editar ahorro</h3>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Cerrar">
            <CloseIcon size={14} />
          </button>
        </div>

        <p className={styles.modalText}>
          Modifica la cantidad ahorrada para <strong>{decision.questionText}</strong>.
        </p>

        {error && (
          <p style={{ fontSize: 12.5, color: '#ff6961', marginBottom: 12, padding: '9px 12px', background: 'rgba(255,69,58,0.12)', borderRadius: 12 }}>
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
          <button type="button" className={styles.btnCancel} onClick={onClose}>Cancelar</button>
          <button type="button" className={styles.btnSave} onClick={handleSave}>Guardar</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

export function HistoryDecisionsListWidget({
  decisions,
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
        {decisions.map((d, idx) => {
          const isExtra = d.questionId === 'extra_saving';
          const isZero = d.deltaAmount === 0;
          const medallionCls = isZero
            ? styles.mSlate
            : isExtra
            ? styles.mEmerald
            : ACCENT_MEDALLIONS[idx % ACCENT_MEDALLIONS.length];
          return (
            <div key={d.id} className={styles.row}>
              <div className={`${styles.medallion} ${medallionCls}`}>
                {isExtra ? <PlusIcon size={17} /> : <BoltIcon size={16} />}
              </div>

              <div className={styles.rowMain}>
                <span className={styles.rowQuestion}>{d.questionText}</span>
                <span className={styles.rowMeta}>
                  {formatDate(d.date)}{d.goalTitle ? ` · ${d.goalTitle}` : ''}
                </span>
              </div>

              <div className={styles.rowRight}>
                <span className={`${styles.rowAmount} ${isZero ? styles.rowAmountZero : ''}`}>
                  {d.deltaAmount > 0 ? '+' : ''}{formatEUR(d.deltaAmount)}
                </span>

                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.rowBtn}
                    title="Editar"
                    aria-label="Editar ahorro"
                    onClick={(e) => { e.stopPropagation(); setEditingId(d.id); }}
                  >
                    <EditIcon size={13} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.rowBtn} ${styles.rowBtnDanger}`}
                    title="Eliminar"
                    aria-label="Eliminar ahorro"
                    onClick={(e) => { e.stopPropagation(); setDeletingId(d.id); }}
                  >
                    <TrashIcon size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {deletingDecision && (
        <DeleteModal
          decision={deletingDecision}
          onConfirm={() => { onDeleteDecision(deletingDecision.id); setDeletingId(null); }}
          onClose={() => setDeletingId(null)}
        />
      )}

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
