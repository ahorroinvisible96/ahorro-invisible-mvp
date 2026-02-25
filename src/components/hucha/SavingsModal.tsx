"use client";

import React, { useState } from 'react';
import { Wallet, Coins, TrendingUp, Plus, X, AlertCircle } from 'lucide-react';
import type { Goal } from '@/types/Dashboard';

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

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(2,6,23,0.82)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 300,
    padding: 16,
  };

  const boxStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    border: '1px solid rgba(51,65,85,0.6)',
    borderRadius: 28,
    padding: 0,
    width: '100%',
    maxWidth: 460,
    boxShadow: '0 30px 60px -12px rgba(2,6,23,0.95)',
    overflow: 'hidden',
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={boxStyle} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '24px 24px 20px',
          borderBottom: '1px solid rgba(51,65,85,0.4)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(16,185,129,0.20), rgba(6,182,212,0.20))',
              border: '1px solid rgba(52,211,153,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Wallet size={22} color="#34d399" strokeWidth={1.8} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', margin: 0, lineHeight: 1.2 }}>
                Asignar Hucha
              </h2>
              <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.65)', margin: '3px 0 0' }}>
                Transfiere tu ahorro a un objetivo activo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'rgba(30,41,59,0.6)',
              border: '1px solid rgba(51,65,85,0.5)',
              color: 'rgba(148,163,184,0.7)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Saldo disponible */}
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(20,184,166,0.10), rgba(6,182,212,0.08))',
            border: '1px solid rgba(52,211,153,0.25)',
            borderRadius: 16,
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Blur decorativo */}
            <div style={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(52,211,153,0.12)',
              filter: 'blur(20px)',
              pointerEvents: 'none',
            }} />
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(52,211,153,0.20), rgba(34,211,238,0.20))',
              border: '1px solid rgba(52,211,153,0.30)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Coins size={20} color="#34d399" strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(52,211,153,0.70)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>
                Saldo disponible
              </p>
              <p style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9', margin: 0, fontFamily: 'ui-monospace, monospace', letterSpacing: '-0.02em' }}>
                {formatEUR(balance)}
              </p>
            </div>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(52,211,153,0.15)',
              border: '1px solid rgba(52,211,153,0.30)',
              color: '#34d399',
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
              flexShrink: 0,
            }}>
              Listo
            </span>
          </div>
        </div>

        {/* Contenido según caso */}
        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {!hasGoals ? (
            /* CASO A — Sin objetivos activos */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                background: 'rgba(30,41,59,0.5)',
                border: '1px solid rgba(51,65,85,0.4)',
                borderRadius: 16,
                padding: '24px 20px',
                textAlign: 'center',
              }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: 'rgba(168,85,247,0.12)',
                  border: '1px solid rgba(168,85,247,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                }}>
                  <Plus size={24} color="#c084fc" strokeWidth={2} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', margin: '0 0 6px' }}>
                  Sin objetivos activos
                </p>
                <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.65)', margin: 0, lineHeight: 1.5 }}>
                  Crea un objetivo para poder asignar este saldo y empezar a ahorrar.
                </p>
              </div>
              <button
                onClick={() => { onClose(); onCreateGoal(); }}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  borderRadius: 14,
                  border: 'none',
                  background: 'linear-gradient(90deg, #a855f7, #2563eb)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(168,85,247,0.35)',
                }}
              >
                <Plus size={16} strokeWidth={2.5} />
                Crear nuevo objetivo
              </button>
            </div>
          ) : (
            /* CASO B — Con objetivos activos */
            <>
              {/* Selector de objetivo */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,0.70)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
                  Asignar a objetivo
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={goalId}
                    onChange={e => { setGoalId(e.target.value); setErr(''); }}
                    style={{
                      width: '100%',
                      background: 'rgba(15,23,42,0.8)',
                      border: '1px solid rgba(51,65,85,0.6)',
                      borderRadius: 14,
                      padding: '12px 44px 12px 14px',
                      fontSize: 14,
                      color: '#f1f5f9',
                      outline: 'none',
                      boxSizing: 'border-box',
                      appearance: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {activeGoals.map(g => (
                      <option key={g.id} value={g.id} style={{ background: '#1e293b' }}>
                        {g.title} ({formatEUR(g.currentAmount)} ahorrados)
                      </option>
                    ))}
                  </select>
                  {/* Flecha personalizada */}
                  <div style={{
                    position: 'absolute',
                    right: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    <TrendingUp size={16} color="rgba(148,163,184,0.5)" strokeWidth={2} />
                  </div>
                </div>
              </div>

              {/* Toggle Total / Parcial */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,0.70)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
                  Importe a transferir
                </label>
                <div style={{ display: 'flex', gap: 10, marginBottom: mode === 'partial' ? 12 : 0 }}>
                  {/* Tarjeta Total */}
                  <button
                    onClick={() => { setMode('total'); setErr(''); }}
                    style={{
                      flex: 1,
                      padding: '12px 10px',
                      borderRadius: 14,
                      border: `2px solid ${mode === 'total' ? 'rgba(52,211,153,0.45)' : 'rgba(51,65,85,0.4)'}`,
                      background: mode === 'total' ? 'rgba(16,185,129,0.10)' : 'rgba(15,23,42,0.5)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <p style={{ fontSize: 11, fontWeight: 700, color: mode === 'total' ? '#34d399' : 'rgba(100,116,139,0.8)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 3px' }}>
                      Todo
                    </p>
                    <p style={{ fontSize: 15, fontWeight: 800, color: mode === 'total' ? '#f1f5f9' : 'rgba(148,163,184,0.6)', margin: 0, fontFamily: 'ui-monospace, monospace' }}>
                      {formatEUR(balance)}
                    </p>
                  </button>

                  {/* Tarjeta Parcial */}
                  <button
                    onClick={() => { setMode('partial'); setErr(''); }}
                    style={{
                      flex: 1,
                      padding: '12px 10px',
                      borderRadius: 14,
                      border: `2px solid ${mode === 'partial' ? 'rgba(168,85,247,0.45)' : 'rgba(51,65,85,0.4)'}`,
                      background: mode === 'partial' ? 'rgba(168,85,247,0.10)' : 'rgba(15,23,42,0.5)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <p style={{ fontSize: 11, fontWeight: 700, color: mode === 'partial' ? '#c084fc' : 'rgba(100,116,139,0.8)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 3px' }}>
                      Parcial
                    </p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: mode === 'partial' ? 'rgba(192,132,252,0.8)' : 'rgba(100,116,139,0.6)', margin: 0 }}>
                      Elige importe
                    </p>
                  </button>
                </div>

                {/* Input parcial */}
                {mode === 'partial' && (
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      min="0.01"
                      max={balance}
                      step="0.01"
                      value={partial}
                      onChange={e => { setPartial(e.target.value); setErr(''); }}
                      placeholder={`Máx. ${balance} €`}
                      autoFocus
                      style={{
                        width: '100%',
                        background: 'rgba(15,23,42,0.8)',
                        border: '1px solid rgba(51,65,85,0.6)',
                        borderRadius: 14,
                        padding: '12px 44px 12px 14px',
                        fontSize: 15,
                        color: '#f1f5f9',
                        outline: 'none',
                        boxSizing: 'border-box',
                        fontFamily: 'ui-monospace, monospace',
                      }}
                    />
                    <span style={{
                      position: 'absolute',
                      right: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'rgba(148,163,184,0.5)',
                      pointerEvents: 'none',
                    }}>
                      €
                    </span>
                  </div>
                )}
              </div>

              {/* Error */}
              {err && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 12,
                  padding: '10px 14px',
                }}>
                  <AlertCircle size={15} color="#f87171" strokeWidth={2} style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>{err}</p>
                </div>
              )}

              {/* Botones */}
              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button
                  onClick={onClose}
                  style={{
                    flex: 1,
                    padding: '13px 0',
                    borderRadius: 14,
                    border: '1px solid rgba(51,65,85,0.5)',
                    background: 'rgba(30,41,59,0.5)',
                    color: 'rgba(203,213,225,0.8)',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  style={{
                    flex: 2,
                    padding: '13px 0',
                    borderRadius: 14,
                    border: 'none',
                    background: 'linear-gradient(90deg, #10b981, #0891b2)',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(16,185,129,0.30)',
                  }}
                >
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
