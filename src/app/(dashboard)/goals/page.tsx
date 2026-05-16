"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { SavingsBadge } from '@/components/hucha/SavingsBadge';
import { SavingsModal } from '@/components/hucha/SavingsModal';
import { PrimaryGoalHeroWidget } from '@/components/dashboard/PrimaryGoalHeroWidget';
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
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';
import { TargetIcon, PlusIcon } from '@/components/ui/AppIcons';
import { WidgetSkeleton } from '@/components/ui/Skeleton/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { useToast } from '@/components/ui/Toast/Toast';
import { computeGoalPhases, PHASE_CONFIGS, fmtEUR as goalFmt, SAVINGS_PCT, type SavingsHabit as SavingsHabitType } from '@/app/onboarding/page';
import styles from './Goals.module.css';

function formatEUR(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function pct(g: Goal) {
  return Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
}

type ModalMode = 'create' | 'edit';

const S = {
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(2,6,23,0.78)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 },
  box: { background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f172a 100%)', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 25px 50px -12px rgba(2,6,23,0.9)', display: 'flex', flexDirection: 'column' as const, gap: 16 },
  label: { fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,0.7)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: 6 },
  input: { width: '100%', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 12, padding: '11px 14px', fontSize: 14, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' as const },
  select: { width: '100%', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 12, padding: '11px 14px', fontSize: 14, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' as const },
  btnCancel: { flex: 1, padding: '11px 0', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 12, background: 'rgba(30,41,59,0.5)', color: 'rgba(203,213,225,0.8)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnSave: { flex: 2, padding: '11px 0', border: 'none', borderRadius: 12, background: 'linear-gradient(90deg,#a855f7,#2563eb)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnDanger: { flex: 2, padding: '11px 0', border: 'none', borderRadius: 12, background: 'linear-gradient(90deg,#ef4444,#dc2626)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnClose: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(51,65,85,0.5)', color: 'rgba(148,163,184,0.7)', cursor: 'pointer', fontSize: 14 },
  modalTitle: { fontSize: 17, fontWeight: 700, color: '#f1f5f9', margin: 0 },
  errorBox: { fontSize: 13, color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 12px' },
};

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

  // ── Create mode: multi-step state ─────────────────────────────────────────
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

  // ── EDIT MODE: simple form ────────────────────────────────────────────────
  if (mode === 'edit') {
    function submitEdit() {
      setErr('');
      if (!title.trim()) { setErr('Escribe un nombre.'); return; }
      const a = Number(amount); if (!a || a <= 0) { setErr('Cantidad válida.'); return; }
      const m = Number(months); if (!m || m < 1) { setErr('Mínimo 1 mes.'); return; }
      onSave({ title: title.trim(), targetAmount: a, horizonMonths: m, applyHucha: false });
    }
    return (
      <div style={S.overlay} onClick={onClose}>
        <div style={S.box} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={S.modalTitle}>Editar objetivo</h2>
            <button style={S.btnClose} onClick={onClose}>✕</button>
          </div>
          {err && <p style={S.errorBox}>{err}</p>}
          <div><label style={S.label}>Nombre</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Viaje" style={S.input} autoFocus /></div>
          <div><label style={S.label}>Meta (€)</label><input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} style={S.input} /></div>
          <div><label style={S.label}>Horizonte (meses)</label><input type="number" min="1" value={months} onChange={e => setMonths(e.target.value)} style={S.input} /></div>
          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button style={S.btnCancel} onClick={onClose}>Cancelar</button>
            <button style={S.btnSave} onClick={submitEdit}>Guardar</button>
          </div>
        </div>
      </div>
    );
  }

  // ── CREATE MODE: multi-step ───────────────────────────────────────────────

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

  // ── ROADMAP SCREEN ────────────────────────────────────────────────────────
  if (createStep === 'roadmap') {
    return (
      <div style={S.overlay} onClick={onClose}>
        <div style={{ ...S.box, maxHeight: '90vh', overflowY: 'auto' as const }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={S.modalTitle}>Tu recorrido</h2>
            <button style={S.btnClose} onClick={onClose}>✕</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, padding: '10px 16px' }}>
            <span style={{ fontSize: 18 }}>🏆</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>{title}</div>
              <div style={{ fontSize: 11, color: 'rgba(251,191,36,0.6)' }}>{goalFmt(goalAmount)} · {horizonMonths} {horizonMonths === 1 ? 'mes' : 'meses'}</div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.55)', margin: '4px 0 0', lineHeight: 1.5 }}>Hemos dividido tu reto en pequeñas fases para que el progreso sea visible desde el primer día.</p>
          <div style={{ maxHeight: 340, overflowY: 'auto', paddingRight: 2, marginTop: 8 }}>
            {phases.map((phase, i) => {
              const isLast = i === phases.length - 1;
              const conf = isLast ? { emoji: '🏆', color: '#fbbf24', rgba: '251,191,36' } : PHASE_CONFIGS[Math.min(i, PHASE_CONFIGS.length - 1)];
              const nextConf = PHASE_CONFIGS[Math.min(i + 1, PHASE_CONFIGS.length - 1)];
              const prevTarget = i > 0 ? phases[i - 1].target : 0;
              const increment = phase.target - prevTarget;
              return (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: isLast ? 'linear-gradient(135deg,#fbbf24,#f97316)' : `rgba(${conf.rgba},0.15)`, border: `2px solid rgba(${conf.rgba},${isLast ? 0.8 : 0.4})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, boxShadow: isLast ? '0 0 18px rgba(251,191,36,0.4)' : `0 0 8px rgba(${conf.rgba},0.2)` }}>{conf.emoji}</div>
                    {!isLast && <div style={{ width: 2, flex: 1, minHeight: 20, background: `linear-gradient(to bottom, rgba(${conf.rgba},0.4), rgba(${nextConf.rgba},0.25))`, margin: '3px 0' }} />}
                  </div>
                  <div style={{ flex: 1, paddingTop: 6, paddingBottom: isLast ? 4 : 18 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: `rgba(${conf.rgba},0.85)`, textTransform: 'uppercase' }}>{phase.label}</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: isLast ? '#fbbf24' : conf.color, flexShrink: 0 }}>{goalFmt(phase.target)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)', lineHeight: 1.4 }}>
                      {isLast ? '🏆 ¡Objetivo alcanzado!' : phase.type === 'week' ? `Ahorra ${goalFmt(increment)} esta semana` : `+${goalFmt(increment)} este mes · acumulas ${goalFmt(phase.target)}`}
                    </div>
                    {!isLast && <div style={{ height: 1, background: `rgba(${conf.rgba},0.1)`, marginTop: 10 }} />}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>💜</span>
            <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.7)', margin: 0, lineHeight: 1.5 }}>Cada pequeña fase que superes es una victoria real.</p>
          </div>
          <button onClick={onClose} style={{ ...S.btnSave, marginTop: 4, width: '100%' }}>¡Empezar! 🚀</button>
        </div>
      </div>
    );
  }

  // ── STEP 1 & 2 ────────────────────────────────────────────────────────────
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.box, maxHeight: '90vh', overflowY: 'auto' as const }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={S.modalTitle}>{createStep === 1 ? 'Nuevo objetivo' : 'Define la meta'}</h2>
          <button style={S.btnClose} onClick={onClose}>✕</button>
        </div>
        {/* Progress */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2].map(s => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 999, background: s <= createStep ? 'linear-gradient(90deg,#a855f7,#2563eb)' : 'rgba(255,255,255,0.06)', transition: 'all 300ms', boxShadow: s <= createStep ? '0 0 8px rgba(168,85,247,0.4)' : 'none' }} />
          ))}
        </div>
        {err && <p style={S.errorBox}>{err}</p>}

        {createStep === 1 && (<>
          <div><label style={S.label}>¿Cómo se llama tu objetivo?</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Viaje, emergencia, formación..." style={S.input} autoFocus />
          </div>
          <div><label style={S.label}>¿En cuántos meses?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 6, 12].map(m => {
                const isSel = horizonMonths === m; const isRec = m === 3;
                return (
                  <button key={m} onClick={() => { setHorizonMonths(m); setHasAutoFilled(false); }}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 10, position: 'relative', background: isSel ? 'linear-gradient(135deg,#a855f7,#2563eb)' : 'rgba(10,8,25,0.50)', border: isSel ? 'none' : isRec ? '1px solid rgba(168,85,247,0.35)' : '1px solid rgba(255,255,255,0.06)', color: isSel ? '#fff' : isRec ? '#c4b5fd' : 'rgba(148,163,184,0.55)', fontSize: 13, fontWeight: isSel ? 700 : 600, cursor: 'pointer', boxShadow: isSel ? '0 4px 14px rgba(168,85,247,0.3)' : 'none', fontFamily: 'inherit', transition: 'all 200ms' }}>
                    {m}m
                    {isRec && !isSel && <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg,#a855f7,#2563eb)', borderRadius: 999, padding: '1px 6px', fontSize: 8, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', pointerEvents: 'none' }}>★ REC</div>}
                  </button>
                );
              })}
            </div>
          </div>
        </>)}

        {createStep === 2 && (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)', borderRadius: 12, padding: '10px 14px' }}>
            <span style={{ fontSize: 15 }}>🎯</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{title}</div>
              <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)' }}>{horizonMonths} {horizonMonths === 1 ? 'mes' : 'meses'}</div>
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ ...S.label, margin: 0 }}>¿Cuánto quieres ahorrar?</label>
              <div style={{ fontSize: 11, color: 'rgba(168,85,247,0.7)', fontWeight: 600 }}>Recomendamos: {goalFmt(recTotal)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'stretch', background: 'rgba(10,8,25,0.60)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
              <button onClick={() => setGoalAmount(a => Math.max(50, a - 50))} style={{ width: 52, background: 'rgba(255,255,255,0.04)', color: 'rgba(148,163,184,0.8)', fontSize: 26, flexShrink: 0, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>−</button>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <input type="number" inputMode="numeric" value={goalInputValue} onChange={e => setGoalInputValue(e.target.value)} onBlur={handleGoalInputBlur}
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: '#f1f5f9', fontWeight: 800, fontSize: 26, letterSpacing: '-0.5px', fontFamily: 'inherit', textAlign: 'right', width: `${Math.max(3, String(goalInputValue).length)}ch`, minWidth: '3ch', maxWidth: '10ch' } as React.CSSProperties} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(241,245,249,0.5)', flexShrink: 0 }}>€</span>
                </div>
                <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.3)', marginTop: 2 }}>toca para escribir · o usa los botones</div>
              </div>
              <button onClick={() => setGoalAmount(a => a + 50)} style={{ width: 52, background: 'rgba(255,255,255,0.04)', color: 'rgba(148,163,184,0.8)', fontSize: 26, flexShrink: 0, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>+</button>
            </div>
          </div>
          {/* Validation */}
          {goalAmount > 0 && (
            isOver30 ? (
              <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><span style={{ fontSize: 16 }}>💡</span><span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>Una meta muy ambiciosa</span></div>
                <p style={{ fontSize: 12, color: 'rgba(251,191,36,0.8)', margin: '0 0 8px', lineHeight: 1.6 }}>Te recomendamos empezar con una cantidad más cómoda.</p>
                <button onClick={() => { setGoalAmount(recTotal); setGoalInputValue(String(recTotal)); }} style={{ width: '100%', padding: '9px', borderRadius: 10, background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.28)', color: '#fbbf24', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Empezar con {goalFmt(recTotal)} →</button>
              </div>
            ) : isOverRec ? (
              <div style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><span style={{ fontSize: 16 }}>💜</span><span style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd' }}>Una propuesta amigable</span></div>
                <button onClick={() => { setGoalAmount(recTotal); setGoalInputValue(String(recTotal)); }} style={{ width: '100%', padding: '9px', borderRadius: 10, background: 'rgba(168,85,247,0.10)', border: '1px solid rgba(168,85,247,0.28)', color: '#c4b5fd', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Usar {goalFmt(recTotal)} →</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: 10, padding: '10px 14px' }}>
                <span style={{ fontSize: 15 }}>✅</span><span style={{ fontSize: 12, color: '#34d399' }}>¡Buen punto de partida!</span>
              </div>
            )
          )}
          {/* Hucha option */}
          {showHuchaOption && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 12, padding: '12px 14px', cursor: 'pointer' }}>
              <input type="checkbox" checked={applyHucha} onChange={e => setApplyHucha(e.target.checked)} style={{ marginTop: 2, accentColor: '#a855f7', width: 16, height: 16, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#fbbf24', lineHeight: 1.4 }}>
                <strong>Asignar saldo de la Hucha</strong><br />
                <span style={{ color: 'rgba(251,191,36,0.7)', fontSize: 12 }}>Transferir {formatEUR(hucha.balance)} al nuevo objetivo</span>
              </span>
            </label>
          )}
        </>)}

        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          {createStep === 1 ? (
            <button style={S.btnCancel} onClick={onClose}>Cancelar</button>
          ) : (
            <button style={S.btnCancel} onClick={() => setCreateStep(1)}>Atrás</button>
          )}
          <button style={{ ...S.btnSave, opacity: (createStep === 1 && !title.trim()) ? 0.5 : 1 }} onClick={handleCreateNext} disabled={createStep === 1 && !title.trim()}>
            {createStep === 1 ? 'Siguiente →' : 'Ver mi plan →'}
          </button>
        </div>
      </div>
    </div>
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
    <div style={S.overlay} onClick={onClose}>
      <div style={S.box} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={S.modalTitle}>Archivar objetivo</h2>
          <button style={S.btnClose} onClick={onClose}>✕</button>
        </div>
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 14px' }}>
          <p style={{ fontSize: 13, color: '#f87171', margin: 0, fontWeight: 600 }}>📦 {goal.title}</p>
          {hasBalance && (
            <p style={{ fontSize: 13, color: 'rgba(248,113,113,0.8)', margin: '4px 0 0' }}>
              Saldo acumulado: <strong style={{ color: '#f87171' }}>{formatEUR(goal.currentAmount)}</strong>
            </p>
          )}
        </div>
        {hasBalance ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.9)', margin: 0 }}>
              ¿Dónde quieres transferir el saldo acumulado?
            </p>
            {hasOthers ? (
              <div>
                <label style={S.label}>Transferir saldo a</label>
                <select style={S.select} value={destination} onChange={e => setDestination(e.target.value)}>
                  {otherGoals.map(g => (
                    <option key={g.id} value={g.id} style={{ background: '#1e293b' }}>
                      {g.title} ({formatEUR(g.currentAmount)} ahorrados)
                    </option>
                  ))}
                  <option value="hucha" style={{ background: '#1e293b' }}>🪣 Enviar a la Hucha</option>
                </select>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {onCreateNew && (
                  <button
                    onClick={onCreateNew}
                    style={{ padding: '11px 0', border: 'none', borderRadius: 12, background: 'linear-gradient(90deg,#a855f7,#2563eb)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                  >
                    + Crear nuevo objetivo y transferir
                  </button>
                )}
                <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 12, padding: '12px 14px' }}>
                  <p style={{ fontSize: 13, color: '#fbbf24', margin: 0, fontWeight: 600 }}>🪣 O guardar en la Hucha</p>
                  <p style={{ fontSize: 12, color: 'rgba(251,191,36,0.7)', margin: '4px 0 0' }}>
                    El saldo se guardará hasta que crees un nuevo objetivo.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', margin: 0 }}>
            Este objetivo no tiene saldo acumulado. Se archivará directamente.
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <button style={S.btnCancel} onClick={onClose}>Cancelar</button>
          <button style={S.btnDanger} onClick={() => onConfirm(hasBalance ? destination : 'hucha')}>Archivar</button>
        </div>
      </div>
    </div>
  );
}


// ── Modal Eliminar definitivo (objetivo archivado) ────────────────────────────
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
  const hasOthers = activeGoals.length > 0;
  const [destination, setDestination] = useState<string>(hasOthers ? activeGoals[0].id : 'hucha');

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.box} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ ...S.modalTitle, color: '#f87171' }}>Eliminar definitivamente</h2>
          <button style={S.btnClose} onClick={onClose}>✕</button>
        </div>
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 14px' }}>
          <p style={{ fontSize: 13, color: '#f87171', margin: 0, fontWeight: 600 }}>⚠️ Esta acción es irreversible</p>
          <p style={{ fontSize: 13, color: 'rgba(248,113,113,0.8)', margin: '4px 0 0' }}>Objetivo: <strong>{goal.title}</strong></p>
          {hasBalance && (
            <p style={{ fontSize: 13, color: 'rgba(248,113,113,0.8)', margin: '4px 0 0' }}>
              Saldo: <strong style={{ color: '#f87171' }}>{formatEUR(goal.currentAmount)}</strong> — debe reasignarse
            </p>
          )}
        </div>
        {hasBalance && (
          <div>
            <label style={S.label}>Reasignar saldo a</label>
            <select style={S.select} value={destination} onChange={e => setDestination(e.target.value)}>
              {hasOthers && activeGoals.map(g => (
                <option key={g.id} value={g.id} style={{ background: '#1e293b' }}>{g.title} ({formatEUR(g.currentAmount)})</option>
              ))}
              <option value="hucha" style={{ background: '#1e293b' }}>🪣 Enviar a la Hucha</option>
            </select>
          </div>
        )}
        {!hasBalance && (
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', margin: 0 }}>Este objetivo no tiene saldo. Se eliminará directamente.</p>
        )}
        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <button style={S.btnCancel} onClick={onClose}>Cancelar</button>
          <button style={S.btnDanger} onClick={() => onConfirm(hasBalance ? destination : null)}>Eliminar definitivamente</button>
        </div>
      </div>
    </div>
  );
}

function GoalCard({
  goal,
  onEdit,
  onArchive,
  onDelete,
  onSetPrimary,
  onDetail,
}: {
  goal: Goal;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onSetPrimary: () => void;
  onDetail: () => void;
}) {
  const p = pct(goal);
  const isCompleted = goal.currentAmount >= goal.targetAmount;
  return (
    <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', border: goal.isPrimary ? '1px solid rgba(168,85,247,0.35)' : '1px solid rgba(51,65,85,0.4)', borderRadius: 16, padding: '18px 20px', cursor: 'pointer', boxShadow: goal.isPrimary ? '0 4px 16px rgba(168,85,247,0.12)' : '0 4px 12px rgba(2,6,23,0.4)' }} onClick={onDetail}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.title}</span>
            {goal.isPrimary && <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(168,85,247,0.2)', color: '#c4b5fd', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(168,85,247,0.35)', flexShrink: 0 }}>⭐ PRINCIPAL</span>}
            {isCompleted && <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(22,163,74,0.15)', color: '#4ade80', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(22,163,74,0.3)', flexShrink: 0 }}>✓ COMPLETADO</span>}
          </div>
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', margin: 0 }}>{goal.horizonMonths} meses · {formatEUR(goal.currentAmount)} / {formatEUR(goal.targetAmount)}</p>
        </div>
        <span style={{ fontSize: 15, fontWeight: 800, color: isCompleted ? '#4ade80' : '#60a5fa', flexShrink: 0, marginLeft: 12 }}>{p}%</span>
      </div>
      <div style={{ background: 'rgba(30,41,59,0.8)', borderRadius: 999, height: 5, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ width: `${p}%`, height: 5, background: isCompleted ? 'linear-gradient(90deg,#4ade80,#16a34a)' : 'linear-gradient(90deg,#a855f7,#2563eb)', borderRadius: 999 }} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
        {!goal.isPrimary && (
          <button onClick={onSetPrimary} style={{ fontSize: 12, padding: '5px 10px', border: '1px solid rgba(168,85,247,0.35)', background: 'rgba(168,85,247,0.1)', color: '#c4b5fd', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>⭐ Principal</button>
        )}
        <button onClick={onEdit} style={{ fontSize: 12, padding: '5px 10px', border: '1px solid rgba(51,65,85,0.5)', background: 'rgba(30,41,59,0.5)', color: 'rgba(203,213,225,0.8)', borderRadius: 8, cursor: 'pointer' }}>Editar</button>
        <button onClick={onArchive} style={{ fontSize: 12, padding: '5px 10px', border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.06)', color: '#fbbf24', borderRadius: 8, cursor: 'pointer' }}>Archivar</button>
        <button onClick={onDelete} style={{ fontSize: 12, padding: '5px 10px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', borderRadius: 8, cursor: 'pointer' }}>Eliminar</button>
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
  const [openSec, setOpenSec] = useState({ progreso: false, completados: false });
  const toggleSec = (k: keyof typeof openSec) => setOpenSec(p => ({ ...p, [k]: !p[k] }));
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [archivingGoal, setArchivingGoal] = useState<Goal | null>(null);
  const [pendingArchiveAfterCreate, setPendingArchiveAfterCreate] = useState<Goal | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null);
  const [showHuchaModal, setShowHuchaModal] = useState(false);
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
    refresh();
    setLoading(false);
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
    analytics.goalCreated(newGoal?.id ?? '', s.goals.filter(g => !g.archived).length === 1, data.targetAmount, data.horizonMonths);
    if (newGoal) syncGoalToSupabase(newGoal).catch(() => null);
    const userId = localStorage.getItem('supabaseUserId');
    if (userId) pushLocalDataToSupabase(userId).catch(() => null);
    // No cerramos el modal: el GoalModal mostrará el roadmap de fases
    refresh();
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
      analytics.goalArchived(goalId, goal.isPrimary);
      syncGoalToSupabase({ ...goal, archived: true, currentAmount: 0 }).catch(() => null);
      refresh();
    }
  };

  const handleArchiveConfirm = (destination: string | 'hucha') => {
    if (!archivingGoal) return;
    storeArchiveGoalSafe(archivingGoal.id, destination);
    analytics.goalArchived(archivingGoal.id, archivingGoal.isPrimary);
    syncGoalToSupabase({ ...archivingGoal, archived: true, currentAmount: 0 }).catch(() => null);
    setArchivingGoal(null);
    refresh();
    addToast('Objetivo archivado', 'info');
  };

  const handleSetPrimary = (goalId: string) => {
    storeSetPrimaryGoal(goalId);
    refresh();
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

  const primaryGoal     = summary.primaryGoal;
  const primaryPct      = primaryGoal ? Math.min(100, Math.round((primaryGoal.currentAmount / primaryGoal.targetAmount) * 100)) : 0;
  const primaryTitle    = primaryGoal ? (primaryGoal.title.length > 16 ? primaryGoal.title.slice(0, 15) + '…' : primaryGoal.title) : 'Sin objetivo';
  const inProgressGoals = activeGoals.filter(g => g.currentAmount < g.targetAmount);
  const completedGoals  = activeGoals.filter(g => g.currentAmount >= g.targetAmount);

  return (
    <div className={styles.page}>

      {/* ── Modals ── */}
      {modalMode && (
        <GoalModal
          mode={modalMode}
          initial={modalMode === 'edit' ? editingGoal ?? undefined : undefined}
          onSave={modalMode === 'create' ? handleCreate : handleEdit}
          onClose={() => { setModalMode(null); setEditingGoal(null); if (modalMode === 'create') addToast('Objetivo creado correctamente', 'success'); }}
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
      <SavingsModal
        isOpen={showHuchaModal && hucha.balance > 0}
        onClose={() => setShowHuchaModal(false)}
        balance={hucha.balance}
        activeGoals={activeGoals}
        onAssign={handleHuchaAssign}
        onCreateGoal={() => { setShowHuchaModal(false); setModalMode('create'); }}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          ZONA 1 — HEADER PRINCIPAL (degradado índigo-púrpura)
          Contiene: título + 3 métricas clave + botón nuevo objetivo
          ══════════════════════════════════════════════════════════════════════ */}
      <div className={styles.headerZone}>
        <div className={styles.zoneInner}>
          <div className={styles.headerContent}>

            {/* Fila superior: icono + título + botón nuevo */}
            <div className={styles.headerTop}>
              <div className={styles.headerLeft}>
                <div className={styles.headerIconWrap}>
                  <TargetIcon size={22} />
                </div>
                <div className={styles.headerTitles}>
                  <span className={styles.headerSub}>Tu planificación</span>
                  <h1 className={styles.headerTitle}>Objetivos</h1>
                </div>
              </div>
              <button
                className={styles.newGoalBtn}
                onClick={() => setModalMode('create')}
                aria-label="Crear nuevo objetivo"
              >
                <PlusIcon size={14} />
                Nuevo
              </button>
            </div>

            {/* Divisor */}
            <div className={styles.headerDivider} />

            {/* Tarjetas métricas: objetivo principal · progreso · activos */}
            <div className={styles.metricsRow}>

              {/* Métrica 1: Nombre del objetivo principal */}
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Principal</span>
                <span className={styles.metricValueAccent} style={{ color: primaryGoal ? '#c4b5fd' : 'rgba(255,255,255,0.30)' }}>
                  {primaryTitle}
                </span>
                <span className={styles.metricSub}>
                  {primaryGoal ? `${formatEUR(primaryGoal.currentAmount)} ahorrados` : 'sin objetivo'}
                </span>
              </div>

              {/* Métrica 2: % de progreso del principal */}
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Progreso</span>
                <span className={styles.metricValue} style={{ color: primaryPct >= 100 ? '#4ade80' : primaryPct > 0 ? '#a78bfa' : 'rgba(255,255,255,0.40)' }}>
                  {primaryPct}<span style={{ fontSize: 14, fontWeight: 500 }}>%</span>
                </span>
                <span className={styles.metricSub}>
                  {primaryGoal ? `meta: ${formatEUR(primaryGoal.targetAmount)}` : 'crea un objetivo'}
                </span>
              </div>

              {/* Métrica 3: Objetivos activos */}
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Activos</span>
                <span className={styles.metricValue}>{activeGoals.length}</span>
                <span className={styles.metricSub}>
                  {completedGoals.length > 0 ? `${completedGoals.length} completado${completedGoals.length > 1 ? 's' : ''}` : 'en curso'}
                </span>
              </div>

            </div>

          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ZONA 2 — CONTENIDO SECUNDARIO (fondo oscuro sólido)
          Hero del objetivo principal + lista de todos los objetivos
          ══════════════════════════════════════════════════════════════════════ */}
      <div className={styles.contentZone}>
        <div className={styles.zoneInner}>
          <div className={styles.contentCol}>

            {/* ─── Widget hero: objetivo primario (tarjeta detalle) ─── */}
            <PrimaryGoalHeroWidget
              goal={summary.primaryGoal}
              estimatedMonthsRemaining={summary.estimatedMonthsRemaining}
              avgMonthlySavings={summary.avgMonthlySavings}
              dailyCompleted={summary.daily.status === 'completed'}
              onCreateGoal={() => setModalMode('create')}
              onOpenGoal={(id) => router.push(`/goals/${id}`)}
              onGoToDailyDecision={() => router.push('/daily')}
              onAddExtraSaving={() => router.push('/extra-saving')}
              onGoToHistory={() => router.push('/history')}
              onEditGoal={(id) => {
                const g = activeGoals.find(x => x.id === id);
                if (g) { setEditingGoal(g); setModalMode('edit'); }
              }}
              variant="header"
            />

            {/* ─── Hucha badge ─── */}
            <SavingsBadge
              balance={hucha.balance}
              hasActiveGoals={activeGoals.length > 0}
              onClick={() => setShowHuchaModal(true)}
            />

            {/* ─── Lista de objetivos ─── */}
            {activeGoals.length === 0 ? (
              <EmptyState
                icon="🎯"
                title="Sin objetivos activos"
                description="Crea tu primer objetivo para empezar a ahorrar."
                action={{ label: 'Crear objetivo', onClick: () => setModalMode('create') }}
              />
            ) : (
              <>
                {inProgressGoals.length > 0 && (
                  <div>
                    <div onClick={() => toggleSec('progreso')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 14, cursor: 'pointer', userSelect: 'none', marginBottom: openSec.progreso ? 12 : 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(241,245,249,0.9)' }}>🟢 En progreso ({inProgressGoals.length})</span>
                      <CollapseChevron collapsed={!openSec.progreso} onToggle={() => toggleSec('progreso')} />
                    </div>
                    {openSec.progreso && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {inProgressGoals.map(g => (
                          <GoalCard key={g.id} goal={g}
                            onDetail={() => router.push(`/goals/${g.id}`)}
                            onEdit={() => { setEditingGoal(g); setModalMode('edit'); }}
                            onArchive={() => handleArchiveRequest(g.id)}
                            onDelete={() => setDeletingGoal(g)}
                            onSetPrimary={() => handleSetPrimary(g.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {completedGoals.length > 0 && (
                  <div>
                    <div onClick={() => toggleSec('completados')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 14, cursor: 'pointer', userSelect: 'none', marginBottom: openSec.completados ? 12 : 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(241,245,249,0.9)' }}>🏆 Completados ({completedGoals.length})</span>
                      <CollapseChevron collapsed={!openSec.completados} onToggle={() => toggleSec('completados')} />
                    </div>
                    {openSec.completados && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {completedGoals.map(g => (
                          <GoalCard key={g.id} goal={g}
                            onDetail={() => router.push(`/goals/${g.id}`)}
                            onEdit={() => { setEditingGoal(g); setModalMode('edit'); }}
                            onArchive={() => handleArchiveRequest(g.id)}
                            onDelete={() => setDeletingGoal(g)}
                            onSetPrimary={() => handleSetPrimary(g.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ─── Archivados ─── */}
            {archivedGoals.length > 0 && (
              <div>
                <button onClick={() => setShowArchived(v => !v)} style={{ background: 'none', border: 'none', color: 'rgba(148,163,184,0.5)', fontSize: 13, cursor: 'pointer', marginBottom: 12, fontWeight: 600, padding: 0 }}>
                  {showArchived ? '▲' : '▼'} Archivados ({archivedGoals.length})
                </button>
                {showArchived && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {archivedGoals.map(g => (
                      <div key={g.id} style={{ background: 'rgba(15,23,42,0.6)', borderRadius: 12, padding: '14px 18px', border: '1px solid rgba(51,65,85,0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(148,163,184,0.8)' }}>{g.title}</span>
                          <span style={{ fontSize: 12, color: 'rgba(100,116,139,0.7)' }}>{pct(g)}%</span>
                        </div>
                        <p style={{ fontSize: 12, color: 'rgba(100,116,139,0.6)', margin: '0 0 10px' }}>{formatEUR(g.currentAmount)} / {formatEUR(g.targetAmount)}</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleReactivate(g.id)} style={{ flex: 1, fontSize: 12, padding: '7px 0', border: '1px solid rgba(37,99,235,0.35)', background: 'rgba(37,99,235,0.12)', color: '#60a5fa', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>✓ Reactivar</button>
                          <button onClick={() => setDeletingGoal(g)} style={{ flex: 1, fontSize: 12, padding: '7px 0', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>🗑 Eliminar</button>
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
  );
}

