"use client";

import React, { useState, useEffect } from 'react';
import { analytics } from '@/services/analytics';
import { getTodayQuestion, DAILY_DECISION_RULES } from '@/services/dashboardStore';
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

  // Delta real desde DAILY_DECISION_RULES — nunca hardcodeado
  const selectedRule = selectedAnswer
    ? DAILY_DECISION_RULES.find(
        (r) => r.questionId === todayQuestion.questionId && r.answerKey === selectedAnswer,
      ) ?? null
    : null;

  if (selectedAnswer && !selectedRule) {
    console.error(`[DailyDecisionWidget] Sin regla para ${todayQuestion.questionId}/${selectedAnswer}`);
  }

  const savingsDelta = selectedRule?.immediateDelta ?? 0;
  const isSavingAnswer = savingsDelta > 0;

  // Confirmar solo si: respuesta + (si hay ahorro → objetivo) + no enviado
  const canConfirm =
    !!selectedAnswer &&
    (!isSavingAnswer || (isSavingAnswer && !!selectedGoalId && activeGoals.length > 0)) &&
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
    const goalId = isSavingAnswer ? selectedGoalId : (activeGoals[0]?.id ?? '');
    const finalAmount = useCustomAmount && customAmount ? Number(customAmount) : undefined;
    setSubmitting(true);
    analytics.dailyAnswerSubmitted(
      daily.date,
      todayQuestion.questionId,
      selectedAnswer!,
      goalId,
      primaryGoal?.id === goalId,
    );
    onSubmitDecision(todayQuestion.questionId, selectedAnswer!, goalId, finalAmount);
    setConfirmed(true);
    setTimeout(() => setSubmitting(false), 1800);
  }

  // ── Mensaje motivacional ─────────────────────────────────────────────────
  const motivationalMsg = selectedAnswer && !confirmed
    ? isSavingAnswer
      ? '¡Excelente! Estás construyendo buenos hábitos financieros y sumando a tu objetivo.'
      : 'No te preocupes, lo importante es ser consciente de tus decisiones financieras.'
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

        {/* ── Opciones: precio SIEMPRE visible si delta > 0 ── */}
        {!collapsed && <div className={styles.answers}>
          {todayQuestion.answers.map((a) => {
            const rule = DAILY_DECISION_RULES.find(
              (r) => r.questionId === todayQuestion.questionId && r.answerKey === a.key,
            );
            const delta = rule?.immediateDelta ?? 0;
            const isSelected = selectedAnswer === a.key;
            return (
              <button
                key={a.key}
                onClick={() => !submitting && !confirmed && setSelectedAnswer(a.key)}
                disabled={submitting || confirmed}
                className={`${styles.answerBtn} ${
                  isSelected && delta > 0
                    ? styles.answerBtnSaving
                    : isSelected
                    ? styles.answerBtnSelected
                    : ''
                }`}
              >
                <div className={styles.answerLeft}>
                  <div className={`${styles.radio} ${isSelected ? styles.radioSelected : ''}`}>
                    {isSelected && <div className={styles.radioDot} />}
                  </div>
                  <span className={styles.answerLabel}>{a.label}</span>
                </div>
                {/* Precio siempre visible si la opción tiene ahorro */}
                {delta > 0 && (
                  <div className={`${styles.savingsBadge} ${isSelected ? styles.savingsBadgeActive : styles.savingsBadgeDim}`}>
                    <TrendingUpIcon size={12} />
                    +{delta}€
                  </div>
                )}
              </button>
            );
          })}
        </div>}

        {/* ── Selector de objetivo inline: solo si la respuesta tiene ahorro ── */}
        {!collapsed && isSavingAnswer && (
          <div className={styles.goalSection}>
            <div className={styles.goalSectionLabelRow}>
              <p className={styles.goalSectionLabel}>
                Destinar{' '}
                {useCustomAmount && customAmount
                  ? <span className={styles.deltaHighlight}>+{customAmount}€</span>
                  : <span className={styles.deltaHighlight}>+{savingsDelta}€</span>
                }{' '}a:
              </p>
              <button
                className={styles.customAmountToggle}
                onClick={() => { setUseCustomAmount(!useCustomAmount); setCustomAmount(''); }}
                disabled={submitting || confirmed}
              >
                {useCustomAmount ? 'Usar precio sugerido' : 'Cambiar importe'}
              </button>
            </div>

            {useCustomAmount && (
              <div className={styles.customAmountRow}>
                <input
                  className={styles.customAmountInput}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={`${savingsDelta}`}
                  disabled={submitting || confirmed}
                />
                <span className={styles.customAmountUnit}>€</span>
              </div>
            )}


            {activeGoals.length === 0 ? (
              /* Sin objetivos: CTA inline dentro del mismo widget */
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
              /* Lista real de objetivos activos */
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
          ) : 'Confirmar decisión'}
        </button>}

      </div>
    </div>
  );
}

export default DailyDecisionWidget;
