"use client";

import React, { useState, useEffect } from 'react';
import { analytics } from '@/services/analytics';
import { getTodayQuestion, getAlternativeQuestion } from '@/services/dashboardStore';
import type { DailyDecisionWidgetProps, ExtraSaving } from './DailyDecisionWidget.types';
import styles from './DailyDecisionWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { AlertIcon, BoltIcon } from '@/components/ui/AppIcons';
import { useToast } from '@/components/ui/Toast/Toast';
import { FillBlankInput } from '@/components/daily/FillBlankInput/FillBlankInput';

/* ---- Iconos inline ---- */
function CheckSvg({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
function CloseSvg() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function ChevronSvg({ up }: { up?: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {up ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
    </svg>
  );
}

/* ---- Modal de ahorro extra (overlay custom position:fixed) ---- */
function ExtraSavingModal({
  isOpen,
  allGoals,
  primaryGoal,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  allGoals: { id: string; title: string }[];
  primaryGoal: { id: string } | null;
  onSave: (s: ExtraSaving) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [goalId, setGoalId] = useState(primaryGoal?.id ?? allGoals[0]?.id ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(''); setAmount(''); setError('');
      setGoalId(primaryGoal?.id ?? allGoals[0]?.id ?? '');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, primaryGoal?.id, allGoals]);

  function handleSave() {
    setError('');
    if (!name.trim()) { setError('Escribe un nombre para el ahorro.'); return; }
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) { setError('Introduce una cantidad valida.'); return; }
    if (!goalId) { setError('Selecciona un objetivo.'); return; }
    onSave({ name: name.trim(), amount: amt, goalId });
  }

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>⚡ Añadir Ahorro Extra</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Cerrar">
            <CloseSvg />
          </button>
        </div>
        {error && <p className={styles.modalError}>{error}</p>}
        <div className={styles.modalField}>
          <label className={styles.modalLabel}>Nombre del ahorro</label>
          <input className={styles.modalInput} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Ahorro extra cafe" autoFocus />
        </div>
        <div className={styles.modalField}>
          <label className={styles.modalLabel}>Cantidad</label>
          <div className={styles.modalAmountRow}>
            <input className={`${styles.modalInput} ${styles.modalAmountInput}`} type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            <span className={styles.modalAmountUnit}>EUR (€)</span>
          </div>
        </div>
        {allGoals.length > 0 && (
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Objetivo Destino</label>
            <div className={styles.modalSelectWrap}>
              <select className={styles.modalSelect} value={goalId} onChange={e => setGoalId(e.target.value)}>
                {allGoals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
              <span className={styles.modalSelectChevron}><ChevronSvg /></span>
            </div>
          </div>
        )}
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnCancel} onClick={onClose}>Cancelar</button>
          <button type="button" className={styles.btnSave} onClick={handleSave}>Añadir Ahorro</button>
        </div>
      </div>
    </div>
  );
}

/* ---- Header del widget ---- */
function WidgetHeader({
  completed,
  collapsed,
  onToggle,
}: {
  completed: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`${styles.header} ${collapsed ? styles.headerCollapsed : ''}`}>
      <div className={styles.headerLeft}>
        <div className={`${styles.iconBadge} ${completed ? styles.iconBadgeCompleted : ''}`}>
          <BoltIcon size={14} />
        </div>
        <div className={styles.headerTextGroup}>
          <span className={styles.headerLabel}>DECISION DIARIA</span>
          <span className={styles.headerSubtitle}>Ahorro Consciente</span>
        </div>
      </div>
      <div className={styles.headerRight}>
        {completed ? (
          <span className={styles.badgeCompleted}>Completado</span>
        ) : (
          <span className={styles.badgePending}>Pendiente</span>
        )}
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir' : 'Colapsar'}
        >
          <ChevronSvg up={!collapsed} />
        </button>
      </div>
    </div>
  );
}

/* ======== WIDGET PRINCIPAL ======== */
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
  const activeGoals = allGoals.filter(g => !g.archived);
  const [currentQuestion, setCurrentQuestion] = useState(() => getTodayQuestion());
  const todayQuestion = currentQuestion;
  const { collapsed, toggle } = useWidgetCollapse('daily_decision', false);
  const { addToast } = useToast();

  const sortedGoals = [
    ...activeGoals.filter(g => g.id === primaryGoal?.id),
    ...activeGoals.filter(g => g.id !== primaryGoal?.id),
  ];

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
  const [signalValue, setSignalValue] = useState<string | null>(null);
  const [customText, setCustomText] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    analytics.dailyCtaCardViewed(daily.status);
    if (daily.status === 'pending') {
      setSelectedAnswer(null);
      setConfirmed(false);
      setSubmitting(false);
      setUseCustomAmount(false);
      setCustomAmount('');
      setIsDropdownOpen(false);
    }
  }, [daily.status]);

  useEffect(() => {
    const preferred = primaryGoal?.id ?? activeGoals[0]?.id ?? '';
    setSelectedGoalId(preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryGoal?.id, activeGoals.length]);

  const parsedAmount = customAmount ? Number(customAmount) : 0;
  const hasAmount = parsedAmount > 0;

  const canConfirm =
    !!selectedGoalId &&
    activeGoals.length > 0 &&
    !submitting &&
    !confirmed;

  /* ---- Estado: completado ---- */
  if (daily.status === 'completed') {
    return (
      <>
        <div className={`${styles.wrapper} ${isHeader ? styles.wrapperHeader : ''} ${collapsed ? styles.wrapperCollapsed : ''}`}>
          <WidgetHeader completed collapsed={collapsed} onToggle={toggle} />

          {collapsed ? (
            <button type="button" className={styles.collapsedRow2} onClick={toggle} aria-label="Expandir widget">
              <span className={styles.collapsedText}>
                <span className={`${styles.collapsedDot} ${styles.collapsedDotGreen}`} />
                Decision de hoy completada
              </span>
              <span className={styles.collapsedChevron}><ChevronSvg /></span>
            </button>
          ) : (
            <div className={styles.card}>
              {/* Tarjeta de celebracion */}
              <div className={styles.celebrationCard}>
                <div className={styles.celebrationIconWrap}>
                  <CheckSvg size={22} />
                </div>
                <h2 className={styles.celebrationTitle}>¡Decision tomada hoy!</h2>
                <p className={styles.celebrationSubtitle}>Ya registraste tu ahorro de hoy. Tu objetivo avanza.</p>
                {onGoToHistory && (
                  <button
                    type="button"
                    className={styles.celebrationLink}
                    onClick={() => { analytics.dailyCtaClicked('completed', 'history'); onGoToHistory(); }}
                  >
                    Ver progreso completo →
                  </button>
                )}
              </div>
              {/* Acciones */}
              {!showResetConfirm ? (
                <div className={styles.completedActions}>
                  <button type="button" className={styles.btnExtraSaving} onClick={() => setShowExtraModal(true)}>
                    ⚡ Añadir ahorro extra
                  </button>
                  {onResetDecision && (
                    <button type="button" className={styles.btnReset} onClick={() => setShowResetConfirm(true)}>
                      ↺ Reiniciar decision
                    </button>
                  )}
                </div>
              ) : (
                /* Confirmacion destructiva inline */
                <div className={styles.resetConfirmBox}>
                  <div className={styles.resetConfirmHeader}>
                    <span>⚠️</span>
                    <p className={styles.resetConfirmTitle}>¿Quieres reiniciar la decision de hoy?</p>
                  </div>
                  <p className={styles.resetConfirmText}>Esta accion revertira el ahorro registrado y podras rellenar el widget de nuevo.</p>
                  <div className={styles.resetConfirmActions}>
                    <button
                      type="button"
                      className={styles.btnDanger}
                      onClick={() => { onResetDecision!(); setShowResetConfirm(false); addToast('Decision reiniciada', 'info'); }}
                    >
                      Si, reiniciar
                    </button>
                    <button type="button" className={styles.btnCancelSmall} onClick={() => setShowResetConfirm(false)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <ExtraSavingModal
          isOpen={showExtraModal}
          allGoals={activeGoals}
          primaryGoal={primaryGoal}
          onSave={s => { onAddExtraSaving?.(s); setShowExtraModal(false); addToast(`+${s.amount}€ ahorro extra`, 'success'); }}
          onClose={() => setShowExtraModal(false)}
        />
      </>
    );
  }

  /* ---- Handler de confirmacion ---- */
  function handleConfirm() {
    if (!canConfirm) return;
    const goalId = selectedGoalId || (activeGoals[0]?.id ?? '');
    const signalKey = signalValue === '__custom__'
      ? `custom:${customText}`
      : signalValue ?? '';
    const answerKey = signalKey
      ? (hasAmount ? `saved|${signalKey}` : `zero|${signalKey}`)
      : (hasAmount ? 'saved' : 'zero');
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
    addToast(hasAmount ? `+${parsedAmount}€ registrado ✓` : 'Decision registrada', 'success');
    setTimeout(() => setSubmitting(false), 1800);
  }

  /* ---- Render pending ---- */
  return (
    <>
      <div className={`${styles.wrapper} ${isHeader ? styles.wrapperHeader : ''} ${hasAmount && !confirmed ? styles.wrapperActive : ''} ${collapsed ? styles.wrapperCollapsed : ''}`}>
        <WidgetHeader completed={confirmed} collapsed={collapsed} onToggle={toggle} />

        {/* Estado colapsado */}
        {collapsed && (
          <button type="button" className={styles.collapsedRow2} onClick={toggle} aria-label="Expandir widget">
            <span className={styles.collapsedText}>
              <span className={styles.collapsedDot} />
              He gastado menos en... ¿cuanto has ahorrado?
            </span>
            <span className={styles.collapsedChevron}><ChevronSvg /></span>
          </button>
        )}

        {!collapsed && (
          <div className={styles.card}>

            {/* Bloque de pregunta */}
            <div className={styles.questionBlock}>
              <label className={`${styles.questionLabel} ${isDropdownOpen ? styles.questionLabelActive : ''}`}>
                {isDropdownOpen ? 'SELECCIONA UNA ALTERNATIVA DE GASTO' : '¿EN QUE HAS GASTADO MENOS HOY?'}
              </label>
              <div className={`${styles.questionBox} ${isDropdownOpen ? styles.questionBoxOpen : ''}`}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <FillBlankInput
                    sentence={todayQuestion.text}
                    options={(todayQuestion.options ?? []).map((o: string) => ({ label: o, value: o }))}
                    value={signalValue}
                    customText={customText}
                    onSelect={setSignalValue}
                    onCustomTextChange={setCustomText}
                    disabled={submitting || confirmed}
                    onOpenChange={setIsDropdownOpen}
                  />
                </div>
                {!confirmed && !submitting && !isDropdownOpen && (
                  <button
                    type="button"
                    className={styles.shuffleBtn}
                    title="Cambiar pregunta"
                    onClick={() => {
                      const alt = getAlternativeQuestion(todayQuestion.questionId);
                      if (alt) {
                        setCurrentQuestion(alt);
                        setCustomAmount('');
                        setSelectedAnswer(null);
                        setSignalValue(null);
                        setCustomText('');
                      }
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 3 21 3 21 8"/>
                      <line x1="4" y1="20" x2="21" y2="3"/>
                      <polyline points="21 16 21 21 16 21"/>
                      <line x1="15" y1="15" x2="21" y2="21"/>
                      <line x1="4" y1="4" x2="9" y2="9"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Bloque de importe */}
            <div className={`${styles.amountBlock} ${isDropdownOpen ? styles.sectionDimmed : ''}`}>
              <label className={`${styles.amountLabel} ${hasAmount ? styles.amountLabelActive : ''}`}>
                {hasAmount ? '¡GENIAL! HAS SELECCIONADO UN AHORRO' : 'IMPORTE A AHORRAR'}
              </label>
              <div className={`${styles.amountInputBox} ${hasAmount ? styles.amountInputBoxActive : ''}`}>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  value={customAmount}
                  onChange={e => { setCustomAmount(e.target.value); if (!selectedAnswer) setSelectedAnswer('saved'); }}
                  placeholder="0.00"
                  disabled={submitting || confirmed}
                  className={styles.amountInput}
                />
                <span className={`${styles.amountUnit} ${hasAmount ? styles.amountUnitActive : ''}`}>€</span>
              </div>
              <p className={styles.amountHint}>
                {hasAmount
                  ? 'Este dinero se transferira automaticamente de tu cuenta corriente a tu hucha seleccionada.'
                  : 'Si hoy no has podido reducir este gasto, introduce 0 o pulsa el boton inferior.'}
              </p>
            </div>

            {/* Bloque de objetivos */}
            <div className={`${styles.goalsBlock} ${isDropdownOpen ? styles.sectionDimmed : ''}`}>
              <label className={`${styles.goalsSectionLabel} ${hasAmount ? styles.goalsSectionLabelActive : ''}`}>
                {hasAmount ? 'ASIGNAR AHORRO A UN OBJETIVO' : 'ASIGNAR A UN OBJETIVO'}
              </label>
              {!hasAmount ? (
                <div className={styles.goalsPlaceholder}>
                  Introduce un importe mayor que 0 € para asignar a un objetivo
                </div>
              ) : activeGoals.length === 0 ? (
                <div className={styles.noGoalsBox}>
                  <AlertIcon size={15} className={styles.noGoalsIcon} />
                  <div>
                    <p className={styles.noGoalsText}>No tienes objetivos creados.</p>
                    <button type="button" className={styles.noGoalsBtn} onClick={onCreateGoal}>Crear objetivo →</button>
                  </div>
                </div>
              ) : (
                <div className={styles.goalList}>
                  {sortedGoals.map(g => {
                    const isSelected = selectedGoalId === g.id;
                    const isPrimary = g.id === primaryGoal?.id;
                    const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => !submitting && !confirmed && setSelectedGoalId(g.id)}
                        disabled={submitting || confirmed}
                        className={`${styles.goalCard} ${isSelected ? styles.goalCardSelected : ''} ${(submitting || confirmed) ? styles.goalCardDisabled : ''}`}
                      >
                        <div className={styles.goalCardTop}>
                          <div className={styles.goalCardLeft}>
                            <span className={styles.goalCardTitle}>{g.title}</span>
                            <span className={styles.goalCardSub}>{isPrimary ? 'Objetivo Primario' : 'Objetivo Secundario'}</span>
                          </div>
                          <div className={styles.goalCardRight}>
                            <span className={styles.goalCardAmounts}>
                              <span className={`${styles.goalCardCurrent} ${isSelected ? styles.goalCardCurrentActive : ''}`}>{g.currentAmount.toLocaleString('es-ES')} €</span>
                              <span className={styles.goalCardOf}> de {g.targetAmount.toLocaleString('es-ES')} €</span>
                            </span>
                            <span className={styles.goalCardPct}>{pct}%</span>
                          </div>
                        </div>
                        <div className={styles.goalCardTrack}>
                          <div className={styles.goalCardFill} style={{ width: `${pct}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CTA confirmar */}
            <button
              type="button"
              disabled={!canConfirm}
              onClick={handleConfirm}
              className={`${styles.ctaBtn} ${!hasAmount && !confirmed ? styles.ctaBtnZero : ''} ${!canConfirm && hasAmount ? styles.ctaBtnDisabled : ''} ${isDropdownOpen ? styles.sectionDimmed : ''}`}
            >
              {submitting && !confirmed ? (
                <span className={styles.spinner} />
              ) : confirmed ? (
                <span className={styles.confirmedContent}><CheckSvg size={15} /> Decision Confirmada</span>
              ) : hasAmount ? (
                `Confirmar Ahorro de ${Number(customAmount).toFixed(2)} €`
              ) : (
                'No he ahorrado hoy'
              )}
            </button>

          </div>
        )}
      </div>

      <ExtraSavingModal
        isOpen={showExtraModal}
        allGoals={activeGoals}
        primaryGoal={primaryGoal}
        onSave={s => { onAddExtraSaving?.(s); setShowExtraModal(false); addToast(`+${s.amount}€ ahorro extra`, 'success'); }}
        onClose={() => setShowExtraModal(false)}
      />
    </>
  );
}

export default DailyDecisionWidget;
