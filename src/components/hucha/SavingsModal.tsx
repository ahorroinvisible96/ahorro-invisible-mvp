"use client";

import React, { useState } from 'react';
import { Wallet, Coins, TrendingUp, Plus, X, AlertCircle } from 'lucide-react';
import type { Goal } from '@/types/Dashboard';
import s from './SavingsModal.module.css';

interface SavingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  activeGoals: Goal[];
  onAssign: (goalId: string, amount: number) => void;
  onCreateGoal: () => void;
}

function formatEUR(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export function SavingsModal({
  isOpen,
  onClose,
  balance,
  activeGoals,
  onAssign,
  onCreateGoal,
}: SavingsModalProps) {
  const [goalId, setGoalId] = useState(activeGoals[0]?.id ?? '');
  const [mode, setMode] = useState<'total' | 'partial'>('total');
  const [partial, setPartial] = useState('');
  const [err, setErr] = useState('');

  if (!isOpen) return null;

  const hasGoals = activeGoals.length > 0;

  function handleSubmit() {
    setErr('');
    if (!goalId) { setErr('Selecciona un objetivo.'); return; }
    const amount = mode === 'total' ? balance : Number(partial);
    if (!amount || amount <= 0) { setErr('El importe debe ser mayor que 0.'); return; }
    if (amount > balance) { setErr(`El importe no puede superar ${formatEUR(balance)}.`); return; }
    onAssign(goalId, amount);
  }

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.box} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={s.header}>
          <div className={s.headerLeft}>
            <div className={s.headerIcon}>
              <Wallet size={22} color="#34d399" strokeWidth={1.8} />
            </div>
            <div>
              <h2 className={s.headerTitle}>Asignar Hucha</h2>
              <p className={s.headerSub}>Transfiere tu ahorro a un objetivo activo</p>
            </div>
          </div>
          <button onClick={onClose} className={s.closeBtn} aria-label="Cerrar">
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Saldo disponible */}
        <div className={s.balanceSection}>
          <div className={s.balanceCard}>
            <div className={s.balanceGlow} />
            <div className={s.balanceIcon}>
              <Coins size={20} color="#34d399" strokeWidth={1.8} />
            </div>
            <div className={s.balanceContent}>
              <p className={s.balanceLabel}>Saldo disponible</p>
              <p className={s.balanceAmount}>{formatEUR(balance)}</p>
            </div>
            <span className={s.balanceBadge}>Listo</span>
          </div>
        </div>

        {/* Contenido según caso */}
        <div className={s.contentSection}>

          {!hasGoals ? (
            /* CASO A — Sin objetivos activos */
            <div className={s.emptyState}>
              <div className={s.emptyCard}>
                <div className={s.emptyIcon}>
                  <Plus size={24} color="#c084fc" strokeWidth={2} />
                </div>
                <p className={s.emptyTitle}>Sin objetivos activos</p>
                <p className={s.emptyText}>
                  Crea un objetivo para poder asignar este saldo y empezar a ahorrar.
                </p>
              </div>
              <button onClick={() => { onClose(); onCreateGoal(); }} className={s.createBtn}>
                <Plus size={16} strokeWidth={2.5} />
                Crear nuevo objetivo
              </button>
            </div>
          ) : (
            /* CASO B — Con objetivos activos */
            <>
              {/* Selector de objetivo */}
              <div>
                <label className={s.fieldLabel}>Asignar a objetivo</label>
                <div className={s.selectWrap}>
                  <select
                    value={goalId}
                    onChange={e => { setGoalId(e.target.value); setErr(''); }}
                    className={s.select}
                  >
                    {activeGoals.map(g => (
                      <option key={g.id} value={g.id} className={s.selectOption}>
                        {g.title} ({formatEUR(g.currentAmount)} ahorrados)
                      </option>
                    ))}
                  </select>
                  <div className={s.selectChevron}>
                    <TrendingUp size={16} color="rgba(148,163,184,0.5)" strokeWidth={2} />
                  </div>
                </div>
              </div>

              {/* Toggle Total / Parcial */}
              <div>
                <label className={s.fieldLabel}>Importe a transferir</label>
                <div className={s.toggleRow}>
                  <button
                    onClick={() => { setMode('total'); setErr(''); }}
                    className={`${s.toggleCard} ${mode === 'total' ? s.toggleCardActiveTotal : ''}`}
                  >
                    <p className={`${s.toggleLabel} ${mode === 'total' ? s.toggleLabelActive : s.toggleLabelInactive}`}>
                      Todo
                    </p>
                    <p className={`${s.toggleValue} ${mode === 'total' ? s.toggleValueActive : s.toggleValueInactive}`}>
                      {formatEUR(balance)}
                    </p>
                  </button>

                  <button
                    onClick={() => { setMode('partial'); setErr(''); }}
                    className={`${s.toggleCard} ${mode === 'partial' ? s.toggleCardActivePartial : ''}`}
                  >
                    <p className={`${s.toggleLabel} ${mode === 'partial' ? s.toggleLabelActivePartial : s.toggleLabelInactive}`}>
                      Parcial
                    </p>
                    <p className={`${s.toggleSubtext} ${mode === 'partial' ? s.toggleSubtextActive : s.toggleSubtextInactive}`}>
                      Elige importe
                    </p>
                  </button>
                </div>

                {/* Input parcial */}
                {mode === 'partial' && (
                  <div className={s.partialInputWrap}>
                    <input
                      type="number"
                      min="0.01"
                      max={balance}
                      step="0.01"
                      value={partial}
                      onChange={e => { setPartial(e.target.value); setErr(''); }}
                      placeholder={`Máx. ${balance} €`}
                      autoFocus
                      className={s.partialInput}
                    />
                    <span className={s.partialSuffix}>€</span>
                  </div>
                )}
              </div>

              {/* Error */}
              {err && (
                <div className={s.errorRow}>
                  <AlertCircle size={15} color="#f87171" strokeWidth={2} style={{ flexShrink: 0 }} />
                  <p className={s.errorText}>{err}</p>
                </div>
              )}

              {/* Botones */}
              <div className={s.footerBtns}>
                <button onClick={onClose} className={s.cancelBtn}>
                  Cancelar
                </button>
                <button onClick={handleSubmit} className={s.assignBtn}>
                  <Coins size={16} strokeWidth={2.5} />
                  Asignar ahorro
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
