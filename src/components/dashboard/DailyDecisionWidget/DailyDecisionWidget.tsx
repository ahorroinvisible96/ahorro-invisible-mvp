"use client";

import React, { useState, useEffect, useRef } from 'react';
import { analytics } from '@/services/analytics';
import { getTodayQuestion, getAlternativeQuestion } from '@/services/dashboardStore';
import type { DailyDecisionWidgetProps, ExtraSaving } from './DailyDecisionWidget.types';
import styles from './DailyDecisionWidget.module.css';
import { BoltIcon, AlertIcon } from '@/components/ui/AppIcons';
import { useToast } from '@/components/ui/Toast/Toast';
import { FillBlankInput } from '@/components/daily/FillBlankInput/FillBlankInput';
import { ModalPortal } from '@/components/ui/ModalPortal/ModalPortal';

/* ---- Iconos inline ---- */
function CheckSvg({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CloseSvg() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronSvg({ up }: { up?: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {up ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
    </svg>
  );
}

function ShuffleSvg() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
    </svg>
  );
}

/* ---- Modal de ahorro extra ---- */
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
      setName('');
      setAmount('');
      setError('');
      setGoalId(primaryGoal?.id ?? allGoals[0]?.id ?? '');
    }
  }, [isOpen, primaryGoal?.id, allGoals]);

  function handleSave() {
    setError('');
    if (!name.trim()) {
      setError('Escribe un nombre para el ahorro.');
      return;
    }
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      setError('Introduce una cantidad válida.');
      return;
    }
    if (!goalId) {
      setError('Selecciona un objetivo.');
      return;
    }
    onSave({ name: name.trim(), amount: amt, goalId });
  }

  if (!isOpen) return null;

  return (
    <ModalPortal>
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Añadir ahorro extra</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Cerrar">
            <CloseSvg />
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
          <label className={styles.modalLabel}>Cantidad</label>
          <div className={styles.modalAmountRow}>
            <input
              className={styles.modalAmountInput}
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
            <span className={styles.modalAmountUnit}>EUR (€)</span>
          </div>
        </div>
        {allGoals.length > 0 && (
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Objetivo destino</label>
            <div className={styles.modalSelectWrap}>
              <select className={styles.modalSelect} value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                {allGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
              <span className={styles.modalSelectChevron}>
                <ChevronSvg />
              </span>
            </div>
          </div>
        )}
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnCancel} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={styles.btnSave} onClick={handleSave}>
            Añadir ahorro
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

/* ======== WIDGET PRINCIPAL ======== */
export function DailyDecisionWidget({
  daily,
  primaryGoal,
  allGoals,
  onSubmitDecision,
  onCreateGoal,
  onResetDecision,
  onAddExtraSaving,
  onGoToHistory,
  variant = 'default',
}: DailyDecisionWidgetProps): React.ReactElement {
  const isHeader = variant === 'header';
  const activeGoals = allGoals.filter((g) => !g.archived);
  const [currentQuestion, setCurrentQuestion] = useState(() => getTodayQuestion());
  const todayQuestion = currentQuestion;
  const { addToast } = useToast();

  const sortedGoals = [
    ...activeGoals.filter((g) => g.id === primaryGoal?.id),
    ...activeGoals.filter((g) => g.id !== primaryGoal?.id),
  ];

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string>(
    primaryGoal?.id ?? activeGoals[0]?.id ?? '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [signalValue, setSignalValue] = useState<string | null>(null);
  const [customText, setCustomText] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);
  const goalPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    analytics.dailyCtaCardViewed(daily.status);
    if (daily.status === 'pending') {
      setSelectedAnswer(null);
      setConfirmed(false);
      setSubmitting(false);
      setCustomAmount('');
      setIsDropdownOpen(false);
      setGoalPickerOpen(false);
    }
  }, [daily.status]);

  useEffect(() => {
    const preferred = primaryGoal?.id ?? activeGoals[0]?.id ?? '';
    setSelectedGoalId(preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryGoal?.id, activeGoals.length]);

  useEffect(() => {
    if (!goalPickerOpen) return;
    function handleOutside(e: MouseEvent) {
      if (goalPickerRef.current && !goalPickerRef.current.contains(e.target as Node)) {
        setGoalPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [goalPickerOpen]);

  const parsedAmount = customAmount ? Number(customAmount) : 0;
  const hasAmount = !isNaN(parsedAmount) && parsedAmount > 0;
  const selectedGoal = sortedGoals.find((g) => g.id === selectedGoalId) ?? sortedGoals[0] ?? null;

  const canConfirm =
    !!selectedGoalId &&
    activeGoals.length > 0 &&
    !submitting &&
    !confirmed;

  /* ---- Estado: completado ---- */
  if (daily.status === 'completed') {
    return (
      <>
        <section
          className={`${styles.wrapper} ${isHeader ? styles.wrapperHeader : ''}`}
          aria-label="Decisión diaria"
        >
          <div className={styles.completedTop}>
            <div className={`${styles.iconCircleLg} ${styles.iconCircleGreen}`}>
              <CheckSvg size={18} />
            </div>
            <div className={styles.completedBody}>
              <div className={styles.completedTitleRow}>
                <h2 className={styles.completedTitle}>Decisión de hoy completada</h2>
                <span className={`${styles.statusPill} ${styles.statusPillDone}`}>Listo</span>
              </div>
              <p className={styles.completedSubtitle}>
                Ya registraste tu ahorro de hoy. Tu objetivo avanza.
              </p>
              {onGoToHistory && (
                <button
                  type="button"
                  className={styles.historyLink}
                  onClick={() => {
                    analytics.dailyCtaClicked('completed', 'history');
                    onGoToHistory();
                  }}
                >
                  Ver progreso completo →
                </button>
              )}
            </div>
          </div>

          {!showResetConfirm ? (
            <div className={styles.completedActions}>
              <button
                type="button"
                className={styles.btnPrimaryPill}
                onClick={() => setShowExtraModal(true)}
              >
                Ahorro extra
              </button>
              {onResetDecision && (
                <button
                  type="button"
                  className={styles.btnSecondaryPill}
                  onClick={() => setShowResetConfirm(true)}
                >
                  Reiniciar
                </button>
              )}
            </div>
          ) : (
            <div className={styles.resetConfirmBox}>
              <p className={styles.resetConfirmTitle}>¿Quieres reiniciar la decisión de hoy?</p>
              <p className={styles.resetConfirmText}>
                Esta acción revertirá el ahorro registrado y podrás rellenar el widget de nuevo.
              </p>
              <div className={styles.resetConfirmActions}>
                <button
                  type="button"
                  className={styles.btnDanger}
                  onClick={() => {
                    onResetDecision!();
                    setShowResetConfirm(false);
                    addToast('Decisión reiniciada', 'info');
                  }}
                >
                  Sí, reiniciar
                </button>
                <button
                  type="button"
                  className={styles.btnCancelSmall}
                  onClick={() => setShowResetConfirm(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </section>

        <ExtraSavingModal
          isOpen={showExtraModal}
          allGoals={activeGoals}
          primaryGoal={primaryGoal}
          onSave={(s) => {
            onAddExtraSaving?.(s);
            setShowExtraModal(false);
            addToast(`+${s.amount}€ ahorro extra`, 'success');
          }}
          onClose={() => setShowExtraModal(false)}
        />
      </>
    );
  }

  /* ---- Handler de confirmación ---- */
  function handleConfirm() {
    if (!canConfirm) return;
    const goalId = selectedGoalId || (activeGoals[0]?.id ?? '');
    const signalKey =
      signalValue === '__custom__'
        ? `custom:${customText}`
        : signalValue ?? '';
    const answerKey = signalKey
      ? hasAmount
        ? `saved|${signalKey}`
        : `zero|${signalKey}`
      : hasAmount
      ? 'saved'
      : 'zero';
    const finalAmount = hasAmount ? parsedAmount : undefined;
    setSubmitting(true);
    setSelectedAnswer(answerKey);
    analytics.dailyAnswerSubmitted(
      daily.date,
      todayQuestion.questionId,
      answerKey,
      primaryGoal?.id === goalId,
      'dashboard_widget',
    );
    onSubmitDecision(todayQuestion.questionId, answerKey, goalId, finalAmount);
    setConfirmed(true);
    addToast(hasAmount ? `+${parsedAmount}€ registrado ✓` : 'Decisión registrada', 'success');
    setTimeout(() => setSubmitting(false), 1800);
  }

  const formattedCtaAmount = hasAmount
    ? parsedAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';

  /* ---- Render pending ---- */
  return (
    <>
      <section
        className={`${styles.wrapper} ${isHeader ? styles.wrapperHeader : ''}`}
        aria-label="Decisión diaria"
      >
        {/* Cabecera discreta: icono + etiqueta + estado + shuffle */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={`${styles.iconMini} ${confirmed ? styles.iconCircleGreen : styles.iconCircleIndigo}`}>
              {confirmed ? <CheckSvg size={14} /> : <BoltIcon size={14} />}
            </div>
            <span className={styles.headerEyebrow}>Decisión diaria</span>
          </div>

          <div className={styles.headerRight}>
            <span className={`${styles.statusPill} ${confirmed ? styles.statusPillDone : styles.statusPillPending}`}>
              {confirmed ? 'Listo' : 'Pendiente'}
            </span>
            {!confirmed && !submitting && !isDropdownOpen && (
              <button
                type="button"
                className={styles.shuffleBtn}
                title="Cambiar pregunta"
                aria-label="Cambiar pregunta"
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
                <ShuffleSvg />
              </button>
            )}
          </div>
        </div>

        {/* Pregunta protagonista con fuerza tipográfica */}
        <div className={styles.questionHero}>
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

        {/* Tira compacta: importe a la izquierda + selector de objetivo a la derecha */}
        <div
          className={`${styles.inputSection} ${isDropdownOpen ? styles.sectionDimmed : ''}`}
          ref={goalPickerRef}
        >
          <div className={`${styles.inputStrip} ${hasAmount ? styles.inputStripActive : ''}`}>
            <div className={styles.amountGroup}>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  if (!selectedAnswer) setSelectedAnswer('saved');
                }}
                placeholder="0,00"
                disabled={submitting || confirmed}
                className={styles.amountInput}
                aria-label="Importe ahorrado hoy en euros"
              />
              <span className={`${styles.amountUnit} ${hasAmount ? styles.amountUnitActive : ''}`}>€</span>
            </div>

            {activeGoals.length === 0 ? (
              <button type="button" className={styles.goalChipEmpty} onClick={onCreateGoal}>
                <AlertIcon size={13} />
                <span>Crear meta</span>
              </button>
            ) : (
              <button
                type="button"
                className={styles.goalChip}
                disabled={submitting || confirmed}
                onClick={() => setGoalPickerOpen((o) => !o)}
                aria-expanded={goalPickerOpen}
                aria-label="Seleccionar objetivo destino"
              >
                <span className={styles.goalChipText}>{selectedGoal?.title ?? 'Objetivo'}</span>
                <ChevronSvg up={goalPickerOpen} />
              </button>
            )}
          </div>

          {/* Desplegable limpio de objetivos destino */}
          {goalPickerOpen && sortedGoals.length > 0 && (
            <div className={styles.goalMenu} role="listbox" aria-label="Objetivos disponibles">
              {sortedGoals.map((g) => {
                const isSelected = selectedGoalId === g.id;
                const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
                return (
                  <button
                    key={g.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`${styles.goalMenuItem} ${isSelected ? styles.goalMenuItemActive : ''}`}
                    onClick={() => {
                      setSelectedGoalId(g.id);
                      setGoalPickerOpen(false);
                    }}
                  >
                    <div className={styles.goalMenuLeft}>
                      <span className={styles.goalMenuTitle}>{g.title}</span>
                      <span className={styles.goalMenuMeta}>
                        {g.currentAmount.toLocaleString('es-ES')} € de {g.targetAmount.toLocaleString('es-ES')} €
                      </span>
                    </div>
                    <span className={styles.goalMenuPct}>{pct}%</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* CTA principal tipo píldora blanca */}
        <button
          type="button"
          disabled={!canConfirm}
          onClick={handleConfirm}
          className={`${styles.ctaBtn} ${!hasAmount && !confirmed ? styles.ctaBtnZero : ''} ${
            !canConfirm && hasAmount ? styles.ctaBtnDisabled : ''
          } ${isDropdownOpen ? styles.sectionDimmed : ''}`}
        >
          {submitting && !confirmed ? (
            <span className={styles.spinner} />
          ) : confirmed ? (
            <span className={styles.confirmedContent}>
              <CheckSvg size={15} /> Decisión confirmada
            </span>
          ) : hasAmount ? (
            `Confirmar ${formattedCtaAmount} €`
          ) : (
            'No he ahorrado hoy'
          )}
        </button>
      </section>

      <ExtraSavingModal
        isOpen={showExtraModal}
        allGoals={activeGoals}
        primaryGoal={primaryGoal}
        onSave={(s) => {
          onAddExtraSaving?.(s);
          setShowExtraModal(false);
          addToast(`+${s.amount}€ ahorro extra`, 'success');
        }}
        onClose={() => setShowExtraModal(false)}
      />
    </>
  );
}

export default DailyDecisionWidget;
