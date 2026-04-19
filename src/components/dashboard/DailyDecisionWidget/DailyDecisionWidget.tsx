"use client";

import React, { useState, useEffect } from 'react';
import { analytics } from '@/services/analytics';
import { getTodayQuestion } from '@/services/dashboardStore';
import type { DailyDecisionWidgetProps, ExtraSaving } from './DailyDecisionWidget.types';
import styles from './DailyDecisionWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';
import { CloseIcon, PlusIcon, TargetIcon, ChevronRightIcon, AlertIcon, StarIcon, BoltIcon, TrendingUpIcon } from '@/components/ui/AppIcons';

// ── Modal de ahorro extra ────────────────────────────────────────────────────
function ExtraSavingModal({
  allGoals,
  primaryGoal,
  onSave,
  onClose,
}: {
  allGoals: { id: string; title: string }[];
  primaryGoal: { id: string } | null;
  onSave: (s: ExtraSaving) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [goalId, setGoalId] = useState(primaryGoal?.id ?? allGoals[0]?.id ?? '');
  const [error, setError] = useState('');

  function handleSave() {
    setError('');
    if (!name.trim()) { setError('Escribe un nombre para el ahorro.'); return; }
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) { setError('Introduce una cantidad válida.'); return; }
    if (!goalId) { setError('Selecciona un objetivo.'); return; }
    onSave({ name: name.trim(), amount: amt, goalId });
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Añadir ahorro extra</h3>
          <button className={styles.modalClose} onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </div>

        {error && <p className={styles.modalError}>{error}</p>}

        <div className={styles.modalField}>
          <label className={styles.modalLabel}>Nombre del ahorro</label>
          <input
            className={styles.modalInput}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Ahorro extra café"
            autoFocus
          />
        </div>

        <div className={styles.modalField}>
          <label className={styles.modalLabel}>Cantidad (€)</label>
          <input
            className={styles.modalInput}
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </div>

        {allGoals.length > 0 && (
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Asignar a objetivo</label>
            <select
              className={styles.modalSelect}
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
            >
              {allGoals.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.modalFooter}>
          <button className={styles.btnCancel} onClick={onClose}>Cancelar</button>
          <button className={styles.btnSave} onClick={handleSave}>Guardar ahorro</button>
        </div>
      </div>
    </div>
  );
}

function CoffeeIcon() {
  return <BoltIcon size={16} />;
}

function WidgetHeader({ completed, collapsed, onToggle, isHeader }: { completed: boolean; collapsed: boolean; onToggle: () => void; isHeader?: boolean }) {
  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        <div className={`${styles.iconBadge} ${isHeader ? styles.iconBadgeHeader : ''}`}><CoffeeIcon /></div>
        <span className={`${styles.headerLabel} ${isHeader ? styles.headerLabelOnGrad : ''}`}>DECISIÓN DIARIA</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {completed ? (
          <div className={styles.badgeCompleted}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Completado
          </div>
        ) : (
          <div className={styles.badgePending}>
            <span className={styles.badgeDot} /> Pendiente
          </div>
        )}
        <CollapseChevron collapsed={collapsed} onToggle={onToggle} />
      </div>
    </div>
  );
}

export function DailyDecisionWidget({
  daily,
  primaryGoal,
  allGoals,
  onSubmitDecision,
  onGoToImpact,
  onCreateGoal,
  onResetDecision,
  onAddExtraSaving,
  onGoToHistory,
  variant = 'default',
}: DailyDecisionWidgetProps): React.ReactElement {
  const isHeader = variant === 'header';
  const activeGoals = allGoals.filter((g) => !g.archived);
  const todayQuestion = getTodayQuestion();
  const { collapsed, toggle } = useWidgetCollapse('daily_decision', false);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string>(
    primaryGoal?.id ?? activeGoals[0]?.id ?? '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  useEffect(() => {
    analytics.dailyCtaCardViewed(daily.status);
    // Cuando el status vuelve a 'pending' (tras reset), limpiar estado interno
    if (daily.status === 'pending') {
      setSelectedAnswer(null);
      setConfirmed(false);
      setSubmitting(false);
      setUseCustomAmount(false);
      setCustomAmount('');
    }
  }, [daily.status]);

  useEffect(() => {
    const preferred = primaryGoal?.id ?? activeGoals[0]?.id ?? '';
    setSelectedGoalId(preferred);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryGoal?.id, activeGoals.length]);

  // Importe parseado del input
  const parsedAmount = customAmount ? Number(customAmount) : 0;
  const hasAmount = parsedAmount > 0;

  // Confirmar: siempre se puede (0 = no ahorré, >0 = ahorré X)
  const canConfirm =
    !!selectedGoalId &&
    activeGoals.length > 0 &&
    !submitting &&
    !confirmed;

  // ── Estado: completada hoy ───────────────────────────────────────────────
  if (daily.status === 'completed') {
    return (
      <>
        <div className={`${styles.wrapper} ${isHeader ? styles.wrapperHeader : ''}`}>
          {!isHeader && <div className={styles.blurBlue} />}
          {!isHeader && <div className={styles.blurPurple} />}
          <div className={`${styles.card} ${isHeader ? styles.cardHeader : ''}`}>
            <WidgetHeader completed collapsed={collapsed} onToggle={toggle} isHeader={isHeader} />
            {!collapsed && (
              <>
                <h2 className={styles.title}>¡Decisión tomada hoy!</h2>
                <p className={styles.subtitle}>Ya registraste tu ahorro de hoy. Tu objetivo avanza.</p>
                <div className={styles.completedActions}>
                  {onGoToHistory && (
                    <button
                      className={styles.btnOutline}
                      onClick={() => { analytics.dailyCtaClicked('completed', 'history'); onGoToHistory(); }}
                    >
                      Ver progreso →
                    </button>
                  )}
                  <button className={styles.btnExtraSaving} onClick={() => setShowExtraModal(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Añadir ahorro extra
                  </button>
                  {onResetDecision && (
                    <button className={styles.btnReset} onClick={() => setShowResetConfirm(true)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 4 1 10 7 10"/>
                        <path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
                      </svg>
                      Reiniciar decisión
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Modal confirmación reset ── */}
        {showResetConfirm && (
          <div className={styles.overlay} onClick={() => setShowResetConfirm(false)}>
            <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>¿Reiniciar decisión?</h3>
                <button className={styles.modalClose} onClick={() => setShowResetConfirm(false)}>
                  <CloseIcon size={16} />
                </button>
              </div>
              <p className={styles.modalText}>Se eliminará el ahorro registrado hoy y se revertirá el progreso del objetivo. Esta acción no se puede deshacer.</p>
              <div className={styles.modalFooter}>
                <button className={styles.btnCancel} onClick={() => setShowResetConfirm(false)}>Cancelar</button>
                <button className={styles.btnDanger} onClick={() => { onResetDecision!(); setShowResetConfirm(false); }}>Sí, reiniciar</button>
              </div>
            </div>
          </div>
        )}
        {showExtraModal && (
          <ExtraSavingModal
            allGoals={activeGoals}
            primaryGoal={primaryGoal}
            onSave={(s) => { onAddExtraSaving?.(s); setShowExtraModal(false); }}
            onClose={() => setShowExtraModal(false)}
          />
        )}
      </>
    );
  }

  // ── Handler único de confirmación ────────────────────────────────────────
  function handleConfirm() {
    if (!canConfirm) return;
    const goalId = selectedGoalId || (activeGoals[0]?.id ?? '');
    const answerKey = hasAmount ? 'saved' : 'zero';
    const finalAmount = hasAmount ? parsedAmount : undefined;
    setSubmitting(true);
    setSelectedAnswer(answerKey);
    analytics.dailyAnswerSubmitted(
      daily.date,
      todayQuestion.questionId,
      answerKey,
      goalId,
      primaryGoal?.id === goalId,
    );
    onSubmitDecision(todayQuestion.questionId, answerKey, goalId, finalAmount);
    setConfirmed(true);
    setTimeout(() => setSubmitting(false), 1800);
  }

  // ── Mensaje motivacional ─────────────────────────────────────────────────
  const motivationalMsg = hasAmount && !confirmed
    ? '¡Excelente! Cada euro que registras construye tu hábito de ahorro.'
    : null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={`${styles.wrapper} ${isHeader ? styles.wrapperHeader : ''}`}>
      {!isHeader && <div className={styles.blurBlue} />}
      {!isHeader && <div className={styles.blurPurple} />}
      <div className={`${styles.card} ${isHeader ? styles.cardHeader : ''}`}>

        <WidgetHeader completed={confirmed} collapsed={collapsed} onToggle={toggle} isHeader={isHeader} />

        {!collapsed && <h2 className={styles.title}>{todayQuestion.text}</h2>}
        {collapsed && (
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.65)', margin: '4px 0 0', lineHeight: 1.4, cursor: 'pointer' }} onClick={toggle}>{todayQuestion.text}</p>
        )}

        {/* ── Importe de ahorro ── */}
        {!collapsed && <div className={styles.answers}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
              ¿Cuánto te has ahorrado?
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={customAmount}
                onChange={(e) => { setCustomAmount(e.target.value); if (!selectedAnswer) setSelectedAnswer('saved'); }}
                placeholder="0"
                disabled={submitting || confirmed}
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  background: 'rgba(15,23,42,0.6)',
                  border: `1.5px solid ${Number(customAmount) > 0 ? 'rgba(74,222,128,0.4)' : 'rgba(51,65,85,0.5)'}`,
                  borderRadius: 12,
                  color: Number(customAmount) > 0 ? '#4ade80' : '#f1f5f9',
                  fontSize: 22,
                  fontWeight: 800,
                  textAlign: 'right',
                  outline: 'none',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.2s',
                }}
              />
              <span style={{ fontSize: 18, fontWeight: 700, color: 'rgba(148,163,184,0.4)' }}>€</span>
            </div>
            <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.45)', marginTop: 6, marginBottom: 0 }}>
              💡 Típico: {todayQuestion.suggestedAmount} € · Si no ahorraste nada, deja 0
            </p>
          </div>
        </div>}

        {/* ── Selector de objetivo ── */}
        {!collapsed && (
          <div className={styles.goalSection}>
            {activeGoals.length === 0 ? (
              <div className={styles.noGoalsBox}>
                <AlertIcon size={15} className={styles.noGoalsIcon} />
                <div>
                  <p className={styles.noGoalsText}>No tienes objetivos creados.</p>
                  <button className={styles.noGoalsBtn} onClick={onCreateGoal}>
                    Crear objetivo →
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.goalList}>
                {activeGoals.map((g) => {
                  const isSelected = selectedGoalId === g.id;
                  const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
                  return (
                    <button
                      key={g.id}
                      onClick={() => !submitting && !confirmed && setSelectedGoalId(g.id)}
                      disabled={submitting || confirmed}
                      className={`${styles.goalBtn} ${isSelected ? styles.goalBtnSelected : ''} ${submitting ? styles.goalBtnDisabled : ''}`}
                    >
                      <div className={styles.goalBtnTop}>
                        <div className={`${styles.radio} ${isSelected ? styles.radioSelected : ''}`}>
                          {isSelected && <div className={styles.radioDot} />}
                        </div>
                        <div className={styles.goalBtnName}>
                          <TargetIcon size={12} style={{ color: '#60a5fa', flexShrink: 0 }} />
                          <span className={styles.goalBtnTitle}>{g.title}</span>
                        </div>
                        <ChevronRightIcon size={14}
                          style={{ color: isSelected ? '#60a5fa' : 'rgba(148,163,184,0.4)', flexShrink: 0 }}/>
                      </div>
                      <div className={styles.goalProgress}>
                        <div className={styles.goalAmounts}>
                          <span>{g.currentAmount.toLocaleString('es-ES')}€</span>
                          <span>{g.targetAmount.toLocaleString('es-ES')}€</span>
                        </div>
                        <div className={styles.goalTrack}>
                          <div className={styles.goalFill} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Mensaje motivacional ── */}
        {!collapsed && motivationalMsg && (
          <div className={styles.motivBox}>
            <StarIcon size={15} className={styles.motivIcon} />
            <span className={styles.motivText}>{motivationalMsg}</span>
          </div>
        )}

        {/* ── Botón confirmar ── */}
        {!collapsed && <button
          className={`${styles.btnPrimary} ${!canConfirm ? styles.btnDisabled : ''}`}
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          {confirmed ? (
            <span className={styles.confirmedContent}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Decisión Confirmada
            </span>
          ) : Number(customAmount) > 0 ? `Registrar ahorro de ${Number(customAmount).toLocaleString('es-ES')}€` : 'Hoy no he ahorrado (0 €)'}
        </button>}

      </div>
    </div>
  );
}

export default DailyDecisionWidget;
