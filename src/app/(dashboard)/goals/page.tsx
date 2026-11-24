"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { SavingsBadge } from '@/components/hucha/SavingsBadge';
import { SavingsModal } from '@/components/hucha/SavingsModal';
import {
  buildSummary,
  storeCreateGoal,
  storeArchiveGoalSafe,
  storeGetGoalBalance,
  storeSetPrimaryGoal,
  storeUpdateGoal,
  storeListArchivedGoals,
  storeTransferFromHucha,
  storeReactivateGoal,
  storeDeleteGoalPermanent,
} from '@/services/dashboardStore';
import { pushLocalDataToSupabase, syncGoalToSupabase, deleteGoalFromSupabase } from '@/services/syncService';
import type { Goal, Hucha, DashboardSummary } from '@/types/Dashboard';
import { TargetIcon, PlusIcon, WalletIcon, CheckIcon, EditIcon, StarIcon, CloseIcon } from '@/components/ui/AppIcons';
import { WidgetSkeleton } from '@/components/ui/Skeleton/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { useToast } from '@/components/ui/Toast/Toast';
import { computeGoalPhases, fmtEUR as goalFmt, SAVINGS_PCT, type SavingsHabit as SavingsHabitType } from '@/app/onboarding/page';
import { STORE_UPDATED_EVENT } from '@/services/v2/runtime';
import { ModalPortal } from '@/components/ui/ModalPortal/ModalPortal';
import styles from './Goals.module.css';

function formatEUR(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function pct(g: Goal) {
  return Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
}

type ModalMode = 'create' | 'edit';

const MEDALLION_CLASSES = [styles.mCobalt, styles.mSky, styles.mViolet, styles.mCyan];
const BAR_COLORS = ['#7C6BF9', '#38BDF8', '#A855F7', '#10B5CE'];
const NODE_COLORS = ['#5B6CF9', '#14A3F6', '#A855F7', '#10B5CE', '#7C6BF9'];

function GoalModal({
  mode,
  initial,
  onSave,
  onClose,
  hucha,
  incomeRange,
}: {
  mode: ModalMode;
  initial?: Goal;
  onSave: (data: { title: string; targetAmount: number; horizonMonths: number; applyHucha: boolean }) => void;
  onClose: () => void;
  hucha: Hucha;
  incomeRange?: { min: number; max: number; currency: string } | null;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [amount, setAmount] = useState(String(initial?.targetAmount ?? ''));
  const [months, setMonths] = useState(String(initial?.horizonMonths ?? '12'));
  const [applyHucha, setApplyHucha] = useState(false);
  const [err, setErr] = useState('');

  const [createStep, setCreateStep] = useState<1 | 2 | 'roadmap'>(1);
  const [horizonMonths, setHorizonMonths] = useState(3);
  const [goalAmount, setGoalAmount] = useState(0);
  const [goalInputValue, setGoalInputValue] = useState('');
  const [hasAutoFilled, setHasAutoFilled] = useState(false);

  const incomeMid = React.useMemo(() => {
    if (incomeRange) return Math.round((incomeRange.min + incomeRange.max) / 2);
    return 1_750;
  }, [incomeRange]);

  const savingsHabit = React.useMemo<SavingsHabitType>(() => {
    if (typeof window === 'undefined') return 'algo';
    try {
      const raw = localStorage.getItem('onboardingData');
      if (raw) { const d = JSON.parse(raw); if (d.savingsHabit) return d.savingsHabit as SavingsHabitType; }
    } catch { /* fallback */ }
    return 'algo';
  }, []);

  const savingsPct = SAVINGS_PCT[savingsHabit] ?? 0.10;
  const recMonthly = Math.max(50, Math.round(incomeMid * savingsPct));
  const recTotal = recMonthly * horizonMonths;
  const monthlyGoal = goalAmount > 0 ? goalAmount / horizonMonths : 0;
  const isOver30 = goalAmount > 0 && monthlyGoal > incomeMid * 0.30;
  const isOverRec = goalAmount > 0 && goalAmount > recTotal && !isOver30;

  React.useEffect(() => {
    if (mode === 'create' && createStep === 2 && !hasAutoFilled) {
      const total = recMonthly * horizonMonths;
      setGoalAmount(total); setGoalInputValue(String(total)); setHasAutoFilled(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createStep]);

  React.useEffect(() => { if (goalAmount > 0) setGoalInputValue(String(goalAmount)); }, [goalAmount]);

  const phases = computeGoalPhases(Math.max(50, goalAmount || recTotal), horizonMonths);

  function handleGoalInputBlur() {
    const num = parseInt(goalInputValue.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num >= 50) setGoalAmount(num);
    else setGoalInputValue(String(goalAmount));
  }

  const showHuchaOption = mode === 'create' && hucha.balance > 0;

  if (mode === 'edit') {
    function submitEdit() {
      setErr('');
      if (!title.trim()) { setErr('Escribe un nombre.'); return; }
      const a = Number(amount); if (!a || a <= 0) { setErr('Cantidad válida.'); return; }
      const m = Number(months); if (!m || m < 1) { setErr('Mínimo 1 mes.'); return; }
      onSave({ title: title.trim(), targetAmount: a, horizonMonths: m, applyHucha: false });
    }
    return (
      <ModalPortal>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modalSheet} onClick={e => e.stopPropagation()}>
          <div className={styles.modalGrabber} />
          <div className={styles.modalHead}>
            <h2 className={styles.modalTitle}>Editar objetivo</h2>
            <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Cerrar">✕</button>
          </div>
          {err && <p className={styles.modalError}>{err}</p>}
          <div><label className={styles.modalLabel}>Nombre</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Viaje" className={styles.modalInput} autoFocus /></div>
          <div><label className={styles.modalLabel}>Meta (€)</label><input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} className={styles.modalInput} /></div>
          <div><label className={styles.modalLabel}>Horizonte (meses)</label><input type="number" min="1" value={months} onChange={e => setMonths(e.target.value)} className={styles.modalInput} /></div>
          <div className={styles.modalActionsRow}>
            <button className={styles.btnGhost} onClick={onClose}>Cancelar</button>
            <button className={styles.btnWhite} onClick={submitEdit}>Guardar</button>
          </div>
        </div>
      </div>
      </ModalPortal>
    );
  }

  function handleCreateNext() {
    setErr('');
    if (createStep === 1) {
      if (!title.trim()) { setErr('Escribe un nombre.'); return; }
      setCreateStep(2);
    } else if (createStep === 2) {
      const num = parseInt(goalInputValue.replace(/\D/g, ''), 10);
      const resolved = !isNaN(num) && num >= 50 ? num : goalAmount;
      if (resolved <= 0) { setErr('Mínimo 50€.'); return; }
      setGoalAmount(resolved);
      onSave({ title: title.trim(), targetAmount: resolved, horizonMonths, applyHucha });
      setCreateStep('roadmap');
    }
  }

  if (createStep === 'roadmap') {
    return (
      <ModalPortal>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modalSheet} onClick={e => e.stopPropagation()}>
          <div className={styles.modalGrabber} />
          <div className={styles.modalHead}>
            <h2 className={styles.modalTitle}>Tu recorrido</h2>
            <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Cerrar">✕</button>
          </div>
          <div className={styles.modalInfoBox}>
            <div className={styles.roadmapTitle}>{title}</div>
            <div className={styles.roadmapSub}>{goalFmt(goalAmount)} · {horizonMonths} {horizonMonths === 1 ? 'mes' : 'meses'}</div>
          </div>
          <div className={styles.roadmapList}>
            {phases.map((phase, i) => {
              const isLast = i === phases.length - 1;
              const prevTarget = i > 0 ? phases[i - 1].target : 0;
              const increment = phase.target - prevTarget;
              return (
                <div key={i} className={styles.roadmapRow}>
                  <div
                    className={styles.roadmapNode}
                    style={{ background: isLast ? '#12C48B' : NODE_COLORS[i % NODE_COLORS.length] }}
                  >
                    {isLast ? <CheckIcon size={16} /> : i + 1}
                  </div>
                  <div className={styles.roadmapMid}>
                    <div className={styles.roadmapTitle} style={isLast ? { color: '#12C48B' } : undefined}>{phase.label}</div>
                    <div className={styles.roadmapSub}>
                      {isLast ? 'Objetivo alcanzado' : phase.type === 'week' ? `Ahorra ${goalFmt(increment)} esta semana` : `+${goalFmt(increment)} este mes`}
                    </div>
                  </div>
                  <span className={styles.roadmapVal} style={isLast ? { color: '#12C48B' } : undefined}>{goalFmt(phase.target)}</span>
                </div>
              );
            })}
          </div>
          <button onClick={onClose} className={styles.btnWhite} style={{ width: '100%', flex: 'none' }}>Comenzar</button>
        </div>
      </div>
      </ModalPortal>
    );
  }

  return (
    <ModalPortal>
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalSheet} onClick={e => e.stopPropagation()}>
        <div className={styles.modalGrabber} />
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>{createStep === 1 ? 'Nuevo objetivo' : 'Define la meta'}</h2>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className={styles.stepTrackRow}>
          {[1, 2].map(s => (
            <div key={s} className={`${styles.stepBar} ${s <= createStep ? styles.stepBarActive : ''}`} />
          ))}
        </div>

        {err && <p className={styles.modalError}>{err}</p>}

        {createStep === 1 && (<>
          <div>
            <label className={styles.modalLabel}>¿Cómo se llama tu objetivo?</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Viaje, emergencia, formación..." className={styles.modalInput} autoFocus />
          </div>
          <div>
            <label className={styles.modalLabel}>¿En cuántos meses?</label>
            <div className={styles.horizonGrid}>
              {[1, 2, 3, 6, 12].map(m => {
                const isSel = horizonMonths === m;
                const isRec = m === 3;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setHorizonMonths(m); setHasAutoFilled(false); }}
                    className={`${styles.horizonPill} ${isSel ? styles.horizonPillActive : ''}`}
                  >
                    {m}m
                    {isRec && !isSel && <span className={styles.horizonRecTag}>Rec</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </>)}

        {createStep === 2 && (<>
          <div className={styles.modalInfoBox}>
            <div className={styles.roadmapTitle}>{title}</div>
            <div className={styles.roadmapSub}>{horizonMonths} {horizonMonths === 1 ? 'mes' : 'meses'} · Recomendado: {goalFmt(recTotal)}</div>
          </div>

          <div>
            <label className={styles.modalLabel}>¿Cuánto quieres ahorrar?</label>
            <div className={styles.stepperBox}>
              <button type="button" onClick={() => setGoalAmount(a => Math.max(50, a - 50))} className={styles.stepperBtn} aria-label="Restar 50 euros">−</button>
              <div className={styles.stepperCenter}>
                <div className={styles.stepperAmountRow}>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={goalInputValue}
                    onChange={e => setGoalInputValue(e.target.value)}
                    onBlur={handleGoalInputBlur}
                    className={styles.stepperInput}
                    style={{ width: `${Math.max(4, String(goalInputValue).length + 1)}ch` }}
                  />
                  <span className={styles.stepperUnit}>€</span>
                </div>
                <div className={styles.stepperHint}>toca para escribir o usa los botones</div>
              </div>
              <button type="button" onClick={() => setGoalAmount(a => a + 50)} className={styles.stepperBtn} aria-label="Sumar 50 euros">+</button>
            </div>
          </div>

          {goalAmount > 0 && (
            isOver30 ? (
              <div className={styles.modalInfoBox} style={{ border: '1px solid rgba(245,158,11,0.28)' }}>
                <div style={{ fontSize: 13, fontWeight: 650, color: '#fbbf24', marginBottom: 4 }}>Una meta muy ambiciosa</div>
                <p style={{ fontSize: 12.5, color: '#9a9fb2', margin: '0 0 10px', lineHeight: 1.45 }}>Te recomendamos empezar con una cantidad más cómoda.</p>
                <button type="button" onClick={() => { setGoalAmount(recTotal); setGoalInputValue(String(recTotal)); }} className={styles.btnGhost} style={{ width: '100%', height: 38, fontSize: 12.5 }}>
                  Empezar con {goalFmt(recTotal)}
                </button>
              </div>
            ) : isOverRec ? (
              <div className={styles.modalInfoBox} style={{ border: '1px solid rgba(167,139,250,0.28)' }}>
                <div style={{ fontSize: 13, fontWeight: 650, color: '#c4b5fd', marginBottom: 8 }}>Propuesta recomendada: {goalFmt(recTotal)}</div>
                <button type="button" onClick={() => { setGoalAmount(recTotal); setGoalInputValue(String(recTotal)); }} className={styles.btnGhost} style={{ width: '100%', height: 38, fontSize: 12.5 }}>
                  Usar {goalFmt(recTotal)}
                </button>
              </div>
            ) : (
              <div className={styles.modalInfoBox} style={{ color: '#34d399', fontSize: 13, fontWeight: 600 }}>
                Buen punto de partida adaptado a tu ritmo
              </div>
            )
          )}

          {showHuchaOption && (
            <label className={styles.modalInfoBox} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={applyHucha} onChange={e => setApplyHucha(e.target.checked)} style={{ marginTop: 2, accentColor: '#12C48B', width: 17, height: 17, flexShrink: 0 }} />
              <span style={{ fontSize: 13, lineHeight: 1.4 }}>
                <strong>Asignar saldo de la Hucha</strong><br />
                <span style={{ color: '#9a9fb2', fontSize: 12 }}>Transferir {formatEUR(hucha.balance)} al nuevo objetivo</span>
              </span>
            </label>
          )}
        </>)}

        <div className={styles.modalActionsRow}>
          {createStep === 1 ? (
            <button type="button" className={styles.btnGhost} onClick={onClose}>Cancelar</button>
          ) : (
            <button type="button" className={styles.btnGhost} onClick={() => setCreateStep(1)}>Atrás</button>
          )}
          <button type="button" className={styles.btnWhite} onClick={handleCreateNext} disabled={createStep === 1 && !title.trim()}>
            {createStep === 1 ? 'Siguiente' : 'Ver mi plan'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

function ArchiveModal({
  goal,
  otherGoals,
  onConfirm,
  onClose,
  onCreateNew,
}: {
  goal: Goal;
  otherGoals: Goal[];
  onConfirm: (destination: string | 'hucha') => void;
  onClose: () => void;
  onCreateNew?: () => void;
}) {
  const hasOthers = otherGoals.length > 0;
  const [destination, setDestination] = useState<string>(hasOthers ? otherGoals[0].id : 'hucha');
  const hasBalance = goal.currentAmount > 0;

  return (
    <ModalPortal>
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalSheet} onClick={e => e.stopPropagation()}>
        <div className={styles.modalGrabber} />
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Archivar objetivo</h2>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className={styles.modalInfoBox}>
          <div className={styles.roadmapTitle}>{goal.title}</div>
          {hasBalance && (
            <div className={styles.roadmapSub}>Saldo acumulado: <strong>{formatEUR(goal.currentAmount)}</strong></div>
          )}
        </div>
        {hasBalance ? (
          hasOthers ? (
            <div>
              <label className={styles.modalLabel}>Transferir saldo a</label>
              <select className={styles.modalSelect} value={destination} onChange={e => setDestination(e.target.value)}>
                {otherGoals.map(g => (
                  <option key={g.id} value={g.id} style={{ background: '#171822' }}>
                    {g.title} ({formatEUR(g.currentAmount)} ahorrados)
                  </option>
                ))}
                <option value="hucha" style={{ background: '#171822' }}>Enviar a la Hucha</option>
              </select>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {onCreateNew && (
                <button type="button" onClick={onCreateNew} className={styles.btnWhite} style={{ width: '100%', flex: 'none' }}>
                  + Crear nuevo objetivo y transferir
                </button>
              )}
              <div className={styles.modalInfoBox}>
                <div className={styles.roadmapTitle}>O guardar en la Hucha</div>
                <div className={styles.roadmapSub}>El saldo quedará disponible hasta que crees un nuevo objetivo.</div>
              </div>
            </div>
          )
        ) : (
          <p className={styles.roadmapSub} style={{ margin: 0 }}>Este objetivo no tiene saldo acumulado. Se archivará directamente.</p>
        )}
        <div className={styles.modalActionsRow}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>Cancelar</button>
          <button type="button" className={styles.btnDanger} onClick={() => onConfirm(hasBalance ? destination : 'hucha')}>Archivar</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

function DeleteArchivedModal({
  goal,
  activeGoals,
  onConfirm,
  onClose,
}: {
  goal: Goal;
  activeGoals: Goal[];
  onConfirm: (destination: string | 'hucha' | null) => void;
  onClose: () => void;
}) {
  const hasBalance = goal.currentAmount > 0;
  const filteredActive = activeGoals.filter((g) => g.id !== goal.id);
  const hasOthers = filteredActive.length > 0;
  const [destination, setDestination] = useState<string>(hasOthers ? filteredActive[0].id : 'hucha');

  return (
    <ModalPortal>
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalSheet} onClick={e => e.stopPropagation()}>
        <div className={styles.modalGrabber} />
        <div className={styles.modalHead}>
          <h2 className={`${styles.modalTitle} ${styles.modalTitleDanger}`}>Eliminar definitivamente</h2>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className={styles.modalInfoBox}>
          <div className={styles.roadmapTitle}>{goal.title}</div>
          <div className={styles.roadmapSub}>
            Esta acción es irreversible.{hasBalance ? ` Saldo de ${formatEUR(goal.currentAmount)} debe reasignarse.` : ''}
          </div>
        </div>
        {hasBalance && (
          <div>
            <label className={styles.modalLabel}>Reasignar saldo a</label>
            <select className={styles.modalSelect} value={destination} onChange={e => setDestination(e.target.value)}>
              {hasOthers && filteredActive.map(g => (
                <option key={g.id} value={g.id} style={{ background: '#171822' }}>{g.title} ({formatEUR(g.currentAmount)})</option>
              ))}
              <option value="hucha" style={{ background: '#171822' }}>Enviar a la Hucha</option>
            </select>
          </div>
        )}
        <div className={styles.modalActionsRow}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>Cancelar</button>
          <button type="button" className={styles.btnDanger} onClick={() => onConfirm(hasBalance ? destination : null)}>Eliminar</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

function GoalRow({
  goal,
  index,
  onEdit,
  onArchive,
  onDelete,
  onSetPrimary,
  onDetail,
}: {
  goal: Goal;
  index: number;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onSetPrimary: () => void;
  onDetail: () => void;
}) {
  const p = pct(goal);
  const isCompleted = goal.currentAmount >= goal.targetAmount;
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuUp, setMenuUp] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const toggleMenu = () => {
    if (!menuOpen && menuRef.current && typeof window !== 'undefined') {
      const rect = menuRef.current.getBoundingClientRect();
      setMenuUp(window.innerHeight - rect.bottom < 240);
    }
    setMenuOpen(v => !v);
  };

  const medallionCls = isCompleted ? styles.mEmerald : MEDALLION_CLASSES[index % MEDALLION_CLASSES.length];
  const barColor = isCompleted ? '#12C48B' : BAR_COLORS[index % BAR_COLORS.length];

  return (
    <div className={`${styles.goalRowWrap} ${menuOpen ? styles.goalRowWrapMenuOpen : ''}`}>
      <button type="button" className={styles.goalRowMain} onClick={onDetail}>
        <div className={`${styles.medallion} ${medallionCls}`}>
          {isCompleted ? <CheckIcon size={18} /> : <TargetIcon size={18} />}
        </div>
        <div className={styles.goalMid}>
          <div className={styles.goalTitleRow}>
            <span className={styles.goalTitle}>{goal.title}</span>
            {goal.isPrimary && <span className={styles.chipPrimary}>Principal</span>}
            {isCompleted && <span className={styles.chipCompleted}>Completado</span>}
          </div>
          <div className={styles.goalSub}>
            Meta {formatEUR(goal.targetAmount)} · {goal.horizonMonths} {goal.horizonMonths === 1 ? 'mes' : 'meses'}
          </div>
          {!isCompleted && (
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${p}%`, background: barColor }} />
            </div>
          )}
        </div>
        <div className={styles.goalRight}>
          <div className={styles.goalCurrent}>{formatEUR(goal.currentAmount)}</div>
          <div className={`${styles.goalPct} ${isCompleted ? styles.goalPctDone : goal.isPrimary ? styles.goalPctPrimary : ''}`}>
            {p}%
          </div>
        </div>
      </button>

      <div className={styles.moreWrap} ref={menuRef}>
        <button
          type="button"
          className={styles.moreBtn}
          onClick={toggleMenu}
          aria-label={`Opciones de ${goal.title}`}
        >
          ⋯
        </button>
        {menuOpen && (
          <div className={`${styles.moreMenu} ${menuUp ? styles.moreMenuUp : ''}`}>
            <button type="button" className={styles.moreMenuItem} onClick={() => { onEdit(); setMenuOpen(false); }}>
              Editar
            </button>
            {!goal.isPrimary && (
              <button type="button" className={styles.moreMenuItem} onClick={() => { onSetPrimary(); setMenuOpen(false); }}>
                Hacer principal
              </button>
            )}
            <button type="button" className={styles.moreMenuItem} onClick={() => { onArchive(); setMenuOpen(false); }}>
              Archivar
            </button>
            <button type="button" className={`${styles.moreMenuItem} ${styles.moreMenuDanger}`} onClick={() => { onDelete(); setMenuOpen(false); }}>
              Eliminar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activeGoals, setActiveGoals] = useState<Goal[]>([]);
  const [archivedGoals, setArchivedGoals] = useState<Goal[]>([]);
  const [hucha, setHucha] = useState<Hucha>({ balance: 0, entries: [] });
  const [showArchived, setShowArchived] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [archivingGoal, setArchivingGoal] = useState<Goal | null>(null);
  const [pendingArchiveAfterCreate, setPendingArchiveAfterCreate] = useState<Goal | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null);
  const [showHuchaModal, setShowHuchaModal] = useState(false);
  const [showSwitchPrimaryModal, setShowSwitchPrimaryModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  const refresh = () => {
    const s = buildSummary('30d');
    setSummary(s);
    setActiveGoals(s.goals.filter(g => !g.archived));
    setArchivedGoals(storeListArchivedGoals());
    setHucha(s.hucha);
  };

  useEffect(() => {
    analytics.setScreen('goals');
    const isAuth = localStorage.getItem('isAuthenticated');
    if (isAuth !== 'true') { router.replace('/login'); return; }
    let active = true;
    const onStoreUpdated = () => {
      if (!active) return;
      refresh();
      setLoading(false);
    };
    queueMicrotask(onStoreUpdated);
    window.addEventListener(STORE_UPDATED_EVENT, onStoreUpdated);
    return () => {
      active = false;
      window.removeEventListener(STORE_UPDATED_EVENT, onStoreUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleCreate = async (data: { title: string; targetAmount: number; horizonMonths: number; applyHucha: boolean }) => {
    const s = storeCreateGoal({ title: data.title, targetAmount: data.targetAmount, horizonMonths: data.horizonMonths, currentAmount: 0 });
    const newGoal = s.goals.filter(g => !g.archived).slice(-1)[0];
    if (pendingArchiveAfterCreate && newGoal) {
      storeArchiveGoalSafe(pendingArchiveAfterCreate.id, newGoal.id);
      syncGoalToSupabase({ ...pendingArchiveAfterCreate, archived: true, currentAmount: 0 }).catch(() => null);
      setPendingArchiveAfterCreate(null);
    }
    if (data.applyHucha && newGoal && hucha.balance > 0) {
      storeTransferFromHucha(newGoal.id, hucha.balance);
    }
    analytics.goalCreateSubmitted(s.goals.filter(g => !g.archived).length === 1, data.targetAmount, data.horizonMonths, 'goals_page');
    if (newGoal) syncGoalToSupabase(newGoal).catch(() => null);
    const userId = localStorage.getItem('supabaseUserId');
    if (userId) pushLocalDataToSupabase(userId).catch(() => null);
    refresh();
    addToast('Objetivo creado correctamente', 'success');
  };

  const handleEdit = (data: { title: string; targetAmount: number; horizonMonths: number; applyHucha: boolean }) => {
    if (!editingGoal) return;
    const s = storeUpdateGoal(editingGoal.id, { title: data.title, targetAmount: data.targetAmount, horizonMonths: data.horizonMonths });
    const updatedGoal = s.goals.find(g => g.id === editingGoal.id);
    if (updatedGoal) syncGoalToSupabase(updatedGoal).catch(() => null);
    const userId = localStorage.getItem('supabaseUserId');
    if (userId) pushLocalDataToSupabase(userId).catch(() => null);
    setModalMode(null);
    setEditingGoal(null);
    refresh();
    addToast('Objetivo actualizado', 'success');
  };

  const handleArchiveRequest = (goalId: string) => {
    const goal = activeGoals.find(g => g.id === goalId);
    if (!goal) return;
    const balance = storeGetGoalBalance(goalId);
    const others = activeGoals.filter(g => g.id !== goalId);
    if (balance > 0 || others.length > 0) {
      setArchivingGoal(goal);
    } else {
      storeArchiveGoalSafe(goalId, 'hucha');
      analytics.goalArchiveSubmitted(goal.isPrimary, 'goals_page');
      syncGoalToSupabase({ ...goal, archived: true, currentAmount: 0 }).catch(() => null);
      refresh();
    }
  };

  const handleArchiveConfirm = (destination: string | 'hucha') => {
    if (!archivingGoal) return;
    storeArchiveGoalSafe(archivingGoal.id, destination);
    analytics.goalArchiveSubmitted(archivingGoal.isPrimary, 'goals_page');
    syncGoalToSupabase({ ...archivingGoal, archived: true, currentAmount: 0 }).catch(() => null);
    setArchivingGoal(null);
    refresh();
    addToast('Objetivo archivado', 'info');
  };

  const handleSetPrimary = (goalId: string) => {
    storeSetPrimaryGoal(goalId);
    setShowSwitchPrimaryModal(false);
    refresh();
    addToast('Objetivo principal actualizado', 'success');
  };

  const handleReactivate = (goalId: string) => {
    storeReactivateGoal(goalId);
    refresh();
  };

  const handleDeleteConfirm = (destination: string | 'hucha' | null) => {
    if (!deletingGoal) return;
    const goalId = deletingGoal.id;
    storeDeleteGoalPermanent(goalId, destination);
    deleteGoalFromSupabase(goalId).catch(() => null);
    setDeletingGoal(null);
    refresh();
    addToast('Objetivo eliminado', 'info');
  };

  const handleHuchaAssign = (goalId: string, amount: number) => {
    storeTransferFromHucha(goalId, amount);
    setShowHuchaModal(false);
    refresh();
    addToast('Saldo transferido al objetivo', 'success');
  };

  if (loading || !summary) {
    return (
      <div className={styles.page}>
        <div style={{ padding: '40px 16px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480, margin: '0 auto', width: '100%' }}>
          <WidgetSkeleton />
          <WidgetSkeleton />
        </div>
      </div>
    );
  }

  const primaryGoal = summary.primaryGoal;
  const primaryPct = primaryGoal && primaryGoal.targetAmount > 0
    ? Math.min(100, Math.round((primaryGoal.currentAmount / primaryGoal.targetAmount) * 100))
    : 0;
  const primaryRemaining = primaryGoal ? Math.max(0, primaryGoal.targetAmount - primaryGoal.currentAmount) : 0;
  const primaryCompleted = Boolean(primaryGoal && primaryGoal.currentAmount >= primaryGoal.targetAmount);
  const primaryMonthlyPace = primaryGoal && primaryRemaining > 0
    ? Math.ceil(primaryRemaining / Math.max(1, primaryGoal.horizonMonths))
    : 0;
  const inProgressGoals = activeGoals.filter(g => g.currentAmount < g.targetAmount);
  const completedGoals = activeGoals.filter(g => g.currentAmount >= g.targetAmount);

  return (
    <div className={styles.page}>
      {modalMode && (
        <GoalModal
          mode={modalMode}
          initial={modalMode === 'edit' ? editingGoal ?? undefined : undefined}
          onSave={modalMode === 'create' ? handleCreate : handleEdit}
          onClose={() => { setModalMode(null); setEditingGoal(null); }}
          hucha={hucha}
          incomeRange={summary?.incomeRange}
        />
      )}
      {archivingGoal && (
        <ArchiveModal
          goal={archivingGoal}
          otherGoals={activeGoals.filter(g => g.id !== archivingGoal.id)}
          onConfirm={handleArchiveConfirm}
          onClose={() => setArchivingGoal(null)}
          onCreateNew={() => {
            setPendingArchiveAfterCreate(archivingGoal);
            setArchivingGoal(null);
            setModalMode('create');
          }}
        />
      )}
      {deletingGoal && (
        <DeleteArchivedModal
          goal={deletingGoal}
          activeGoals={activeGoals}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeletingGoal(null)}
        />
      )}
      {showSwitchPrimaryModal && (
        <ModalPortal>
          <div className={styles.modalOverlay} onClick={() => setShowSwitchPrimaryModal(false)}>
            <div
              className={styles.modalSheet}
              role="dialog"
              aria-modal="true"
              aria-labelledby="switch-primary-title"
              onClick={e => e.stopPropagation()}
            >
              <div className={styles.modalHead}>
                <h2 id="switch-primary-title" className={styles.modalTitle}>Cambiar objetivo principal</h2>
                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={() => setShowSwitchPrimaryModal(false)}
                  aria-label="Cerrar"
                >
                  <CloseIcon size={15} />
                </button>
              </div>
              <p className={styles.switchSubtitle}>
                Elige en qué meta quieres centrar tu seguimiento principal.
              </p>
              <div className={styles.switchList}>
                {activeGoals.map((g, i) => {
                  const gPct = pct(g);
                  const isCur = g.id === primaryGoal?.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      className={`${styles.switchOption} ${isCur ? styles.switchOptionActive : ''}`}
                      onClick={() => isCur ? setShowSwitchPrimaryModal(false) : handleSetPrimary(g.id)}
                    >
                      <span className={`${styles.medallion} ${MEDALLION_CLASSES[i % MEDALLION_CLASSES.length]}`}>
                        <TargetIcon size={16} />
                      </span>
                      <span className={styles.switchOptionBody}>
                        <span className={styles.switchOptionTitle}>{g.title}</span>
                        <span className={styles.switchOptionSub}>
                          {formatEUR(g.currentAmount)} de {formatEUR(g.targetAmount)} · {gPct}%
                        </span>
                      </span>
                      <span className={`${styles.switchCheck} ${isCur ? styles.switchCheckActive : ''}`}>
                        {isCur && <CheckIcon size={13} />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className={styles.btnGhost}
                style={{ width: '100%' }}
                onClick={() => setShowSwitchPrimaryModal(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
      <SavingsModal
        isOpen={showHuchaModal && hucha.balance > 0}
        onClose={() => setShowHuchaModal(false)}
        balance={hucha.balance}
        activeGoals={activeGoals}
        onAssign={handleHuchaAssign}
        onCreateGoal={() => { setShowHuchaModal(false); setModalMode('create'); }}
      />

      {/* ── Open atmospheric sky hero (Expanded Primary Goal) ── */}
      <div className={styles.headerZone}>
        <div className={styles.zoneInner}>
          <div className={styles.headerContent}>
            <div className={styles.topBar}>
              <h1 className={styles.topBarTitle}>Objetivos</h1>
              <button
                type="button"
                className={styles.glassCircleBtn}
                onClick={() => setModalMode('create')}
                aria-label="Crear nuevo objetivo"
              >
                <PlusIcon size={17} />
              </button>
            </div>

            {primaryGoal ? (
              <div className={styles.heroCenter}>
                <button
                  type="button"
                  className={styles.heroPrimaryTag}
                  onClick={() => router.push(`/goals/${primaryGoal.id}`)}
                >
                  <StarIcon size={12} />
                  <span>Principal</span>
                  <span className={styles.heroTagDot} aria-hidden="true">·</span>
                  <span className={styles.heroTagName}>{primaryGoal.title}</span>
                </button>

                <button
                  type="button"
                  className={styles.heroAmountBtn}
                  onClick={() => router.push(`/goals/${primaryGoal.id}`)}
                  aria-label={`Ver detalle de ${primaryGoal.title}`}
                >
                  <span className={styles.heroAmount}>{formatEUR(primaryGoal.currentAmount)}</span>
                  <span className={styles.heroTargetLine}>
                    de {formatEUR(primaryGoal.targetAmount)} · {primaryGoal.horizonMonths} {primaryGoal.horizonMonths === 1 ? 'mes' : 'meses'}
                  </span>
                </button>

                <div
                  className={styles.heroProgressTrack}
                  role="progressbar"
                  aria-valuenow={primaryPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progreso de ${primaryGoal.title}`}
                >
                  <div
                    className={`${styles.heroProgressFill} ${primaryCompleted ? styles.heroProgressFillDone : ''}`}
                    style={{ width: `${primaryPct}%` }}
                  />
                </div>

                <div className={styles.heroStatsBar}>
                  <div className={styles.heroStatCell}>
                    <span className={styles.heroStatLabel}>Progreso</span>
                    <span className={styles.heroStatValue}>{primaryPct}%</span>
                  </div>
                  <span className={styles.heroStatDivider} aria-hidden="true" />
                  <div className={styles.heroStatCell}>
                    <span className={styles.heroStatLabel}>{primaryCompleted ? 'Estado' : 'Te faltan'}</span>
                    <span className={styles.heroStatValue}>
                      {primaryCompleted ? '¡Lograda!' : formatEUR(primaryRemaining)}
                    </span>
                  </div>
                  <span className={styles.heroStatDivider} aria-hidden="true" />
                  <div className={styles.heroStatCell}>
                    <span className={styles.heroStatLabel}>{primaryCompleted ? 'Plazo' : 'Ritmo ideal'}</span>
                    <span className={styles.heroStatValue}>
                      {primaryCompleted
                        ? `${primaryGoal.horizonMonths}m`
                        : `${formatEUR(primaryMonthlyPace)}/m`}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.heroCenter}>
                <span className={styles.heroKicker}>Objetivo principal</span>
                <div className={styles.heroAmount}>0 €</div>
                <div className={styles.heroPill}>Crea tu primer objetivo</div>
              </div>
            )}

            <div className={styles.circleActions}>
              <button type="button" className={styles.circleAction} onClick={() => setModalMode('create')}>
                <span className={styles.circleBtn}><PlusIcon size={19} /></span>
                <span className={styles.circleLbl}>Nuevo</span>
              </button>
              <button
                type="button"
                className={styles.circleAction}
                onClick={() => hucha.balance > 0 ? setShowHuchaModal(true) : addToast('Tu Hucha aún no tiene saldo disponible', 'info')}
              >
                <span className={styles.circleBtn}>
                  <WalletIcon size={18} />
                  {hucha.balance > 0 && <span className={styles.circleDot} aria-hidden="true" />}
                </span>
                <span className={styles.circleLbl}>Hucha</span>
              </button>
              {primaryGoal && (
                <button
                  type="button"
                  className={styles.circleAction}
                  onClick={() => { setEditingGoal(primaryGoal); setModalMode('edit'); }}
                >
                  <span className={styles.circleBtn}><EditIcon size={17} /></span>
                  <span className={styles.circleLbl}>Editar</span>
                </button>
              )}
              {primaryGoal && activeGoals.length > 1 && (
                <button
                  type="button"
                  className={styles.circleAction}
                  onClick={() => setShowSwitchPrimaryModal(true)}
                >
                  <span className={styles.circleBtn}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 3 21 3 21 8" />
                      <line x1="4" y1="20" x2="21" y2="3" />
                      <polyline points="21 16 21 21 16 21" />
                      <line x1="15" y1="15" x2="21" y2="21" />
                      <line x1="4" y1="4" x2="9" y2="9" />
                    </svg>
                  </span>
                  <span className={styles.circleLbl}>Cambiar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className={styles.contentZone}>
        <div className={styles.zoneInner}>
          <div className={styles.layoutGrid}>
            <div className={styles.mainCol}>
              {activeGoals.length === 0 ? (
                <EmptyState
                  icon="🎯"
                  title="Crea tu primer objetivo"
                  description="Define una meta sencilla y empieza a convertir pequeñas decisiones en progreso real."
                  action={{ label: 'Crear objetivo', onClick: () => setModalMode('create') }}
                />
              ) : (
                <>
                  {inProgressGoals.length > 0 && (
                    <section className={styles.card}>
                      <div className={styles.cardHead}>
                        <h2 className={styles.cardTitle}>En progreso</h2>
                        <span className={styles.countChip}>
                          {inProgressGoals.length} {inProgressGoals.length === 1 ? 'meta' : 'metas'}
                        </span>
                      </div>
                      <div className={styles.rowsStack}>
                        {inProgressGoals.map((g, idx) => (
                          <GoalRow
                            key={g.id}
                            goal={g}
                            index={idx}
                            onDetail={() => router.push(`/goals/${g.id}`)}
                            onEdit={() => { setEditingGoal(g); setModalMode('edit'); }}
                            onArchive={() => handleArchiveRequest(g.id)}
                            onDelete={() => setDeletingGoal(g)}
                            onSetPrimary={() => handleSetPrimary(g.id)}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>

            <div className={styles.sideCol}>
              <SavingsBadge
                balance={hucha.balance}
                hasActiveGoals={activeGoals.length > 0}
                onClick={() => setShowHuchaModal(true)}
              />

              {completedGoals.length > 0 && (
                <section className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2 className={styles.cardTitle}>Completados</h2>
                    <span className={`${styles.countChip} ${styles.countChipGreen}`}>100%</span>
                  </div>
                  <div className={styles.rowsStack}>
                    {completedGoals.map((g, idx) => (
                      <GoalRow
                        key={g.id}
                        goal={g}
                        index={idx}
                        onDetail={() => router.push(`/goals/${g.id}`)}
                        onEdit={() => { setEditingGoal(g); setModalMode('edit'); }}
                        onArchive={() => handleArchiveRequest(g.id)}
                        onDelete={() => setDeletingGoal(g)}
                        onSetPrimary={() => handleSetPrimary(g.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {archivedGoals.length > 0 && (
                <div>
                  <button type="button" className={styles.archivedToggle} onClick={() => setShowArchived(v => !v)}>
                    <span>Archivados ({archivedGoals.length})</span>
                    <span>{showArchived ? '▲' : '▼'}</span>
                  </button>
                  {showArchived && (
                    <div className={styles.archivedList}>
                      {archivedGoals.map(g => (
                        <div key={g.id} className={styles.archivedCard}>
                          <div className={styles.archivedTop}>
                            <span className={styles.archivedName}>{g.title}</span>
                            <span className={styles.goalPct}>{pct(g)}%</span>
                          </div>
                          <p className={styles.archivedMeta}>{formatEUR(g.currentAmount)} / {formatEUR(g.targetAmount)}</p>
                          <div className={styles.archivedActions}>
                            <button type="button" className={`${styles.archivedBtn} ${styles.archivedBtnReactivate}`} onClick={() => handleReactivate(g.id)}>Reactivar</button>
                            <button type="button" className={`${styles.archivedBtn} ${styles.archivedBtnDelete}`} onClick={() => setDeletingGoal(g)}>Eliminar</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
