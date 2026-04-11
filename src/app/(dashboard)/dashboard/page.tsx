"use client";

import React, { useEffect, useState } from 'react';
import type { Goal, Hucha } from '@/types/Dashboard';
import type { ExtraSaving } from '@/components/dashboard/DailyDecisionWidget/DailyDecisionWidget.types';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { useDashboardSummary } from '@/hooks/useDashboardSummary';
import { storeArchiveGoalSafe, storeGetGoalBalance, storeTransferFromHucha, storeUseGraceDay, storeMarkMilestoneSeen, storeMarkGoalPercentMilestone, storeAcknowledgeAdaptiveEvaluation } from '@/services/dashboardStore';
import { syncGoalToSupabase } from '@/services/syncService';
import { sendMilestonePush } from '@/services/pushNotifications';
import { SavingsBadge } from '@/components/hucha/SavingsBadge';
import { SavingsModal } from '@/components/hucha/SavingsModal';
import { HeaderStatusBarWidget } from '@/components/dashboard/HeaderStatusBarWidget';
import { DailyDecisionWidget } from '@/components/dashboard/DailyDecisionWidget';
import { SavingsEvolutionWidget } from '@/components/dashboard/SavingsEvolutionWidget';
import { MotivationCardWidget } from '@/components/dashboard/MotivationCardWidget';
import { PrimaryGoalHeroWidget } from '@/components/dashboard/PrimaryGoalHeroWidget';
import styles from './Dashboard.module.css';

// ── Estilos dark glassmorphism compartidos ────────────────────────────────────
const DS = {
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(2,6,23,0.78)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 },
  box: { background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f172a 100%)', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 25px 50px -12px rgba(2,6,23,0.9)', display: 'flex', flexDirection: 'column' as const, gap: 16 },
  label: { fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,0.7)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: 6 },
  select: { width: '100%', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 12, padding: '11px 14px', fontSize: 14, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' as const },
  btnCancel: { flex: 1, padding: '11px 0', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 12, background: 'rgba(30,41,59,0.5)', color: 'rgba(203,213,225,0.8)', fontSize: 14, fontWeight: 600, cursor: 'pointer' as const },
  btnDanger: { flex: 2, padding: '11px 0', border: 'none', borderRadius: 12, background: 'linear-gradient(90deg,#ef4444,#dc2626)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' as const },
  btnClose: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(51,65,85,0.5)', color: 'rgba(148,163,184,0.7)', cursor: 'pointer' as const, fontSize: 14 },
};

function formatEURDash(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function ArchiveModal({
  goal,
  otherGoals,
  onConfirm,
  onClose,
}: {
  goal: Goal;
  otherGoals: Goal[];
  onConfirm: (destination: string | 'hucha') => void;
  onClose: () => void;
}): React.ReactElement {
  const hasOthers = otherGoals.length > 0;
  const [destination, setDestination] = useState<string>(hasOthers ? otherGoals[0].id : 'hucha');
  const hasBalance = goal.currentAmount > 0;

  return (
    <div style={DS.overlay} onClick={onClose}>
      <div style={DS.box} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Archivar objetivo</h2>
          <button style={DS.btnClose} onClick={onClose}>✕</button>
        </div>

        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 14px' }}>
          <p style={{ fontSize: 13, color: '#f87171', margin: 0, fontWeight: 600 }}>📦 {goal.title}</p>
          {hasBalance && (
            <p style={{ fontSize: 13, color: 'rgba(248,113,113,0.8)', margin: '4px 0 0' }}>
              Saldo acumulado: <strong style={{ color: '#f87171' }}>{formatEURDash(goal.currentAmount)}</strong>
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
                <label style={DS.label}>Transferir saldo a</label>
                <select style={DS.select} value={destination} onChange={e => setDestination(e.target.value)}>
                  {otherGoals.map(g => (
                    <option key={g.id} value={g.id} style={{ background: '#1e293b' }}>
                      {g.title} ({formatEURDash(g.currentAmount)} ahorrados)
                    </option>
                  ))}
                  <option value="hucha" style={{ background: '#1e293b' }}>🪣 Enviar a la Hucha</option>
                </select>
              </div>
            ) : (
              <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 12, padding: '12px 14px' }}>
                <p style={{ fontSize: 13, color: '#fbbf24', margin: 0, fontWeight: 600 }}>🪣 Sin otros objetivos activos</p>
                <p style={{ fontSize: 12, color: 'rgba(251,191,36,0.7)', margin: '4px 0 0' }}>
                  El saldo se guardará en la <strong>Hucha</strong> hasta que crees un nuevo objetivo.
                </p>
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', margin: 0 }}>
            Este objetivo no tiene saldo acumulado. Se archivará directamente.
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <button style={DS.btnCancel} onClick={onClose}>Cancelar</button>
          <button style={DS.btnDanger} onClick={() => onConfirm(hasBalance ? destination : 'hucha')}>
            Archivar objetivo
          </button>
        </div>
      </div>
    </div>
  );
}

function EditGoalModal({
  goal,
  onSave,
  onClose,
}: {
  goal: Goal;
  onSave: (patch: { title: string; targetAmount: number; horizonMonths: number }) => void;
  onClose: () => void;
}): React.ReactElement {
  const [title, setTitle] = useState(goal.title);
  const [targetAmount, setTargetAmount] = useState(String(goal.targetAmount));
  const [horizonMonths, setHorizonMonths] = useState(String(goal.horizonMonths));
  const [formError, setFormError] = useState('');

  function handleSave() {
    setFormError('');
    if (!title.trim()) { setFormError('Escribe un nombre para el objetivo.'); return; }
    const amount = Number(targetAmount);
    if (!targetAmount || isNaN(amount) || amount <= 0) { setFormError('Introduce una cantidad válida.'); return; }
    const months = Number(horizonMonths);
    if (!horizonMonths || isNaN(months) || months < 1) { setFormError('El horizonte debe ser al menos 1 mes.'); return; }
    onSave({ title: title.trim(), targetAmount: amount, horizonMonths: months });
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Editar objetivo</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {formError && <p className={styles.modalError}>{formError}</p>}

        <div className={styles.modalField}>
          <label className={styles.modalLabel}>Nombre del objetivo</label>
          <input className={styles.modalInput} type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className={styles.modalField}>
          <label className={styles.modalLabel}>Meta (€)</label>
          <input className={styles.modalInput} type="number" min="1" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} />
        </div>

        <div className={styles.modalField}>
          <label className={styles.modalLabel}>Horizonte (meses)</label>
          <input className={styles.modalInput} type="number" min="1" value={horizonMonths} onChange={(e) => setHorizonMonths(e.target.value)} />
        </div>

        <div className={styles.modalActions}>
          <button className={styles.modalCancelBtn} onClick={onClose}>Cancelar</button>
          <button className={styles.modalSaveBtn} onClick={handleSave}>Guardar cambios</button>
        </div>
      </div>
    </div>
  );
}

function ExtraSavingDashboardModal({
  allGoals,
  primaryGoal,
  onSave,
  onClose,
}: {
  allGoals: Goal[];
  primaryGoal: Goal | null;
  onSave: (s: ExtraSaving) => void;
  onClose: () => void;
}): React.ReactElement {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [goalId, setGoalId] = useState(primaryGoal?.id ?? allGoals[0]?.id ?? '');
  const [formError, setFormError] = useState('');

  function handleSave() {
    setFormError('');
    if (!name.trim()) { setFormError('Escribe un nombre para el ahorro.'); return; }
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) { setFormError('Introduce una cantidad válida.'); return; }
    if (!goalId) { setFormError('Selecciona un objetivo.'); return; }
    onSave({ name: name.trim(), amount: amt, goalId });
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Añadir ahorro extra</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {formError && <p className={styles.modalError}>{formError}</p>}

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
              className={styles.modalInput}
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
            >
              {allGoals.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.modalActions}>
          <button className={styles.modalCancelBtn} onClick={onClose}>Cancelar</button>
          <button className={styles.modalSaveBtn} onClick={handleSave}>Guardar ahorro</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: hito % de objetivo ─────────────────────────────────────────────────
const GOAL_PCT_DATA: Record<number, { emoji: string; color: string; bg: string; border: string; msg: string }> = {
  25:  { emoji: '🌱', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.3)',  msg: '¡Primer cuarto completado! Cada pequeña decisión suma.' },
  50:  { emoji: '⚡', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)',  msg: '¡A mitad de camino! La constancia ya es un hábito en ti.' },
  75:  { emoji: '🚀', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)', msg: '¡75%! El final está muy cerca. ¡No te detengas ahora!' },
  100: { emoji: '🏆', color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)',  msg: '¡META ALCANZADA! Has convertido el ahorro en un hábito real.' },
};

function GoalPercentMilestoneModal({
  goalTitle, percent, onClose,
}: { goalTitle: string; percent: 25 | 50 | 75 | 100; onClose: () => void }): React.ReactElement {
  const d = GOAL_PCT_DATA[percent];
  return (
    <div style={DS.overlay} onClick={onClose}>
      <div style={{ ...DS.box, textAlign: 'center', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 4 }}>{d.emoji}</div>
        <div style={{ background: d.bg, border: `1px solid ${d.border}`, borderRadius: 20, padding: '4px 18px', marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: d.color }}>{percent}% completado</span>
        </div>
        <h2 style={{ fontSize: 19, fontWeight: 800, color: '#f1f5f9', margin: '0 0 6px', lineHeight: 1.3 }}>{goalTitle}</h2>
        <p style={{ fontSize: 14, color: 'rgba(148,163,184,0.8)', margin: '0 0 24px', lineHeight: 1.6 }}>{d.msg}</p>
        <button
          onClick={onClose}
          style={{ padding: '13px 0', background: `linear-gradient(90deg, ${d.color}99, ${d.color}cc)`, border: `1px solid ${d.border}`, borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%' }}
        >
          {d.emoji} Seguir ahorrando
        </button>
      </div>
    </div>
  );
}

const MILESTONE_TIERS: Record<number, { name: string; emoji: string; color: string; bg: string; border: string; msg: string }> = {
  50:   { name: 'Bronce',    emoji: '🥉', color: '#cd7f32', bg: 'rgba(205,127,50,0.12)',  border: 'rgba(205,127,50,0.35)',  msg: '¡Tu primer gran paso! Los hábitos pequeños construyen futuros grandes.' },
  100:  { name: 'Plata',     emoji: '🥈', color: '#c0c0c0', bg: 'rgba(192,192,192,0.12)', border: 'rgba(192,192,192,0.35)', msg: '¡Constancia comprobada! Estás construyendo el músculo del ahorro.' },
  500:  { name: 'Oro',       emoji: '🥇', color: '#ffd700', bg: 'rgba(255,215,0,0.12)',   border: 'rgba(255,215,0,0.35)',   msg: '¡Medio millar de euros! Cada decisión consciente ha valido la pena.' },
  1000: { name: 'Platino',   emoji: '💎', color: '#e5e4e2', bg: 'rgba(229,228,226,0.12)', border: 'rgba(229,228,226,0.35)', msg: '¡1.000€ ahorrados! Perteneces a una minoría que convierte intención en acción.' },
  2000: { name: 'Esmeralda', emoji: '💚', color: '#50c878', bg: 'rgba(80,200,120,0.12)',  border: 'rgba(80,200,120,0.35)',  msg: '¡Extraordinario! 2.000€ demuestran que el ahorro invisible es muy real.' },
  5000: { name: 'Diamante',  emoji: '👑', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)', msg: '¡Diamante! 5.000€ ahorrados con decisiones cotidianas. Eres un referente.' },
};

function MilestoneModal({ milestone, onClose }: { milestone: number; onClose: () => void }): React.ReactElement {
  const tier = MILESTONE_TIERS[milestone] ?? { name: 'Logro', emoji: '🎉', color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.3)', msg: '¡Increíble progreso! Sigue así.' };
  return (
    <div style={DS.overlay} onClick={onClose}>
      <div style={{ ...DS.box, textAlign: 'center', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
        {/* Badge de nivel */}
        <div style={{ background: tier.bg, border: `1px solid ${tier.border}`, borderRadius: 20, padding: '6px 20px', marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{tier.emoji}</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: tier.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{tier.name}</span>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px' }}>¡Hito alcanzado!</h2>
        <p style={{ fontSize: 28, fontWeight: 800, color: tier.color, margin: '0 0 12px' }}>
          +{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(milestone)}
        </p>
        <p style={{ fontSize: 14, color: 'rgba(148,163,184,0.8)', margin: '0 0 24px', lineHeight: 1.6 }}>{tier.msg}</p>
        <button
          onClick={onClose}
          style={{ padding: '13px 32px', background: `linear-gradient(90deg, ${tier.color}99, ${tier.color}cc)`, border: `1px solid ${tier.border}`, borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%' }}
        >
          {tier.emoji} ¡A por el siguiente nivel!
        </button>
      </div>
    </div>
  );
}

function StreakRecoveryModal({ lastStreak, onUseGrace, onDismiss }: { lastStreak: number; onUseGrace: () => void; onDismiss: () => void }): React.ReactElement {
  return (
    <div style={DS.overlay} onClick={onDismiss}>
      <div style={{ ...DS.box, alignItems: 'stretch' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>🔥 Tu racha se rompió</h2>
          <button style={DS.btnClose} onClick={onDismiss}>✕</button>
        </div>
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '12px 14px' }}>
          <p style={{ fontSize: 14, color: '#fbbf24', margin: 0 }}>
            Llevabas <strong>{lastStreak} día{lastStreak !== 1 ? 's' : ''}</strong> consecutivos. Ayer te lo saltaste.
          </p>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.8)', margin: 0, lineHeight: 1.6 }}>
          Tienes 1 <strong>día de gracia</strong> disponible este mes. Úsalo para recuperar tu racha automáticamente.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ ...DS.btnCancel, flex: 1 }} onClick={onDismiss}>Dejar ir la racha</button>
          <button
            style={{ flex: 2, padding: '11px 0', border: 'none', borderRadius: 12, background: 'linear-gradient(90deg,#f59e0b,#d97706)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            onClick={onUseGrace}
          >
            🔥 Usar día de gracia
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateGoalModal({
  onSave,
  onClose,
}: {
  onSave: (data: { title: string; targetAmount: number; horizonMonths: number }) => void;
  onClose: () => void;
}): React.ReactElement {
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [horizonMonths, setHorizonMonths] = useState('12');
  const [formError, setFormError] = useState('');

  function handleSave() {
    setFormError('');
    if (!title.trim()) { setFormError('Escribe un nombre para el objetivo.'); return; }
    const amount = Number(targetAmount);
    if (!targetAmount || isNaN(amount) || amount <= 0) { setFormError('Introduce una cantidad válida.'); return; }
    const months = Number(horizonMonths);
    if (!horizonMonths || isNaN(months) || months < 1) { setFormError('El horizonte debe ser al menos 1 mes.'); return; }
    onSave({ title: title.trim(), targetAmount: amount, horizonMonths: months });
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Nuevo objetivo</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {formError && <p className={styles.modalError}>{formError}</p>}

        <div className={styles.modalField}>
          <label className={styles.modalLabel}>Nombre del objetivo</label>
          <input
            className={styles.modalInput}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Viaje, emergencia, formación..."
            autoFocus
          />
        </div>

        <div className={styles.modalField}>
          <label className={styles.modalLabel}>Meta (€)</label>
          <input
            className={styles.modalInput}
            type="number"
            min="1"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            placeholder="5000"
          />
        </div>

        <div className={styles.modalField}>
          <label className={styles.modalLabel}>Horizonte (meses)</label>
          <input
            className={styles.modalInput}
            type="number"
            min="1"
            value={horizonMonths}
            onChange={(e) => setHorizonMonths(e.target.value)}
            placeholder="12"
          />
        </div>

        <div className={styles.modalActions}>
          <button className={styles.modalCancelBtn} onClick={onClose}>Cancelar</button>
          <button className={styles.modalSaveBtn} onClick={handleSave}>Guardar objetivo</button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [archivingGoal, setArchivingGoal] = useState<Goal | null>(null);
  const [showExtraSaving, setShowExtraSaving] = useState(false);
  const [showHuchaModal, setShowHuchaModal] = useState(false);
  const [activeMilestone, setActiveMilestone] = useState<number | null>(null);
  const [showStreakRecovery, setShowStreakRecovery] = useState(false);
  const [lastStreakShown, setLastStreakShown] = useState(false);
  const [streakAtRisk, setStreakAtRisk] = useState(false);
  const [streakAlertDismissed, setStreakAlertDismissed] = useState(false);
  const [activeGoalMilestone, setActiveGoalMilestone] = useState<{ goalId: string; goalTitle: string; percent: 25 | 50 | 75 | 100 } | null>(null);
  const [showAdaptiveBanner, setShowAdaptiveBanner] = useState(false);
  const [lowActivityDismissed, setLowActivityDismissed] = useState(false);
  const {
    summary,
    loading,
    error,
    changeRange,
    refresh,
    updateIncome,
    createGoal,
    updateGoal,
    archiveGoal,
    setPrimaryGoal,
    submitDecision,
    resetDecision,
    addExtraSaving,
  } = useDashboardSummary();

  useEffect(() => {
    analytics.setScreen('dashboard');
    if (typeof window !== 'undefined') {
      const isAuth = localStorage.getItem('isAuthenticated');
      if (isAuth !== 'true') { router.replace('/login'); return; }
      const hasOnboarding = localStorage.getItem('hasCompletedOnboarding');
      if (hasOnboarding !== 'true') { router.replace('/onboarding'); return; }
    }
  }, [router]);

  useEffect(() => {
    if (!summary) return;
    const activeGoals = summary.goals.filter((g) => !g.archived);
    analytics.dashboardViewed(
      summary.daily.status,
      activeGoals.length,
      !!summary.primaryGoal,
      !!summary.incomeRange,
    );
  }, [summary?.daily.status]);

  useEffect(() => {
    if (!summary) return;
    if (summary.newMilestone && !activeMilestone) {
      setActiveMilestone(summary.newMilestone);
      sendMilestonePush(summary.newMilestone).catch(() => null);
    }
    if (summary.goalPercentMilestone && !activeGoalMilestone) {
      setActiveGoalMilestone(summary.goalPercentMilestone);
    }
    if (summary.adaptiveEvaluation && !showAdaptiveBanner) {
      setShowAdaptiveBanner(true);
    }
    if (summary.streakBrokeYesterday && summary.graceAvailable && !lastStreakShown) {
      setShowStreakRecovery(true);
      setLastStreakShown(true);
    }
    if (
      summary.streak > 0 &&
      summary.daily.status === 'pending' &&
      !streakAlertDismissed
    ) {
      const hour = new Date().getHours();
      if (hour >= 18) setStreakAtRisk(true);
    } else {
      setStreakAtRisk(false);
    }
  }, [summary?.newMilestone, summary?.goalPercentMilestone?.goalId, summary?.adaptiveEvaluation?.type, summary?.streakBrokeYesterday, summary?.streak, summary?.daily.status, streakAlertDismissed]);

  if (loading || !summary) {
    return (
      <div className={styles.loadingScreen}>
        <span className={styles.loadingText}>Cargando dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.loadingScreen}>
        <span className={styles.errorText}>{error}</span>
      </div>
    );
  }

  const activeGoals = summary.goals.filter((g) => !g.archived);

  const handleCreateGoal = () => {
    analytics.goalCreateStarted('dashboard');
    setShowCreateGoal(true);
  };

  const handleSaveGoal = (data: { title: string; targetAmount: number; horizonMonths: number }) => {
    createGoal({ title: data.title, targetAmount: data.targetAmount, horizonMonths: data.horizonMonths });
    analytics.goalCreated(`goal_${Date.now()}`, activeGoals.length === 0, data.targetAmount, data.horizonMonths);
    setShowCreateGoal(false);
  };

  const handleEditGoal = (goalId: string) => {
    const goal = activeGoals.find((g) => g.id === goalId) ?? null;
    setEditingGoal(goal);
  };

  const handleSaveEditGoal = (patch: { title: string; targetAmount: number; horizonMonths: number }) => {
    if (!editingGoal) return;
    updateGoal(editingGoal.id, patch);
    setEditingGoal(null);
  };

  const handleArchiveRequest = (goalId: string) => {
    const goal = activeGoals.find((g) => g.id === goalId);
    if (!goal) return;
    setArchivingGoal(goal);
  };

  const handleArchiveConfirm = (destination: string | 'hucha') => {
    if (!archivingGoal) return;
    storeArchiveGoalSafe(archivingGoal.id, destination);
    analytics.goalArchived(archivingGoal.id, archivingGoal.isPrimary);
    syncGoalToSupabase({ ...archivingGoal, archived: true, currentAmount: 0 }).catch(() => null);
    setArchivingGoal(null);
    refresh();
  };

  return (
    <div className={styles.page}>
      {activeMilestone && (
        <MilestoneModal
          milestone={activeMilestone}
          onClose={() => { storeMarkMilestoneSeen(activeMilestone); setActiveMilestone(null); refresh(); }}
        />
      )}
      {activeGoalMilestone && (
        <GoalPercentMilestoneModal
          goalTitle={activeGoalMilestone.goalTitle}
          percent={activeGoalMilestone.percent}
          onClose={() => { storeMarkGoalPercentMilestone(activeGoalMilestone.goalId, activeGoalMilestone.percent); setActiveGoalMilestone(null); refresh(); }}
        />
      )}
      {showStreakRecovery && summary && (
        <StreakRecoveryModal
          lastStreak={summary.streak}
          onUseGrace={() => { storeUseGraceDay(); setShowStreakRecovery(false); refresh(); }}
          onDismiss={() => setShowStreakRecovery(false)}
        />
      )}
      {showCreateGoal && (
        <CreateGoalModal
          onSave={handleSaveGoal}
          onClose={() => setShowCreateGoal(false)}
        />
      )}
      {editingGoal && (
        <EditGoalModal
          goal={editingGoal}
          onSave={handleSaveEditGoal}
          onClose={() => setEditingGoal(null)}
        />
      )}
      {archivingGoal && (
        <ArchiveModal
          goal={archivingGoal}
          otherGoals={activeGoals.filter(g => g.id !== archivingGoal.id)}
          onConfirm={handleArchiveConfirm}
          onClose={() => setArchivingGoal(null)}
        />
      )}
      <SavingsModal
        isOpen={showHuchaModal && summary.hucha.balance > 0}
        onClose={() => setShowHuchaModal(false)}
        balance={summary.hucha.balance}
        activeGoals={activeGoals}
        onAssign={(goalId, amount) => {
          storeTransferFromHucha(goalId, amount);
          setShowHuchaModal(false);
          refresh();
        }}
        onCreateGoal={() => { setShowHuchaModal(false); setShowCreateGoal(true); }}
      />
      {showExtraSaving && (
        <ExtraSavingDashboardModal
          allGoals={activeGoals}
          primaryGoal={summary.primaryGoal}
          onSave={(s: ExtraSaving) => { addExtraSaving(s); setShowExtraSaving(false); }}
          onClose={() => setShowExtraSaving(false)}
        />
      )}

      {/* ══ ZONA HEADER: degradado púrpura — perfil + objetivo principal ══ */}
      <div className={styles.headerZone}>
        <div className={styles.zoneInner}>
          <div className={styles.headerProfile}>
            <HeaderStatusBarWidget
              userName={summary.userName}
              streak={summary.streak ?? 0}
              onOpenProfile={() => router.push('/profile')}
              onOpenSettings={() => router.push('/settings')}
            />
          </div>
          <div className={styles.headerDaily}>
            <PrimaryGoalHeroWidget
              goal={summary.primaryGoal}
              estimatedMonthsRemaining={summary.estimatedMonthsRemaining}
              avgMonthlySavings={summary.avgMonthlySavings}
              dailyCompleted={summary.daily.status === 'completed'}
              onCreateGoal={handleCreateGoal}
              onOpenGoal={(id) => router.push(`/goals/${id}`)}
              onGoToDailyDecision={() => {
                const el = document.getElementById('daily-decision-widget');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              onAddExtraSaving={() => setShowExtraSaving(true)}
              onGoToHistory={() => router.push('/history')}
              onEditGoal={(id) => handleEditGoal(id)}
              variant="header"
            />
          </div>
        </div>
      </div>

      {/* ══ ZONA CONTENIDO: fondo oscuro sólido — widgets funcionales ══ */}
      <div className={styles.contentZone}>
        <div className={styles.zoneInner}>
        <div className={styles.grid}>
          {/* Columna izquierda */}
          <div className={styles.mainCol}>

            {/* Banner: evaluación adaptativa (ajuste de ritmo) */}
            {showAdaptiveBanner && summary.adaptiveEvaluation && (
              <div style={{ background: summary.adaptiveEvaluation.type === 'increase' ? 'rgba(34,197,94,0.08)' : 'rgba(251,191,36,0.08)', border: `1px solid ${summary.adaptiveEvaluation.type === 'increase' ? 'rgba(34,197,94,0.25)' : 'rgba(251,191,36,0.25)'}`, borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: summary.adaptiveEvaluation.type === 'increase' ? '#4ade80' : '#fbbf24', margin: '0 0 4px' }}>
                      {summary.adaptiveEvaluation.type === 'increase' ? '📈 Propuesta de ajuste' : '🎯 Ajuste de objetivo'}
                    </p>
                    <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.85)', margin: '0 0 12px', lineHeight: 1.5 }}>
                      {summary.adaptiveEvaluation.message}
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => { storeAcknowledgeAdaptiveEvaluation(summary.adaptiveEvaluation!.newPercent); setShowAdaptiveBanner(false); refresh(); }}
                        style={{ padding: '8px 14px', border: 'none', borderRadius: 10, background: summary.adaptiveEvaluation.type === 'increase' ? '#16a34a' : '#d97706', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Aplicar ({summary.adaptiveEvaluation.newPercent}%)
                      </button>
                      <button
                        onClick={() => { storeAcknowledgeAdaptiveEvaluation(); setShowAdaptiveBanner(false); }}
                        style={{ padding: '8px 14px', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 10, background: 'transparent', color: 'rgba(148,163,184,0.7)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Ahora no
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Banner: anti-abandono */}
            {summary.lowActivityAlert && !lowActivityDismissed && (
              <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 28, flexShrink: 0 }}>💪</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#818cf8', margin: '0 0 2px' }}>Llevas unos días sin registrar</p>
                  <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.7)', margin: 0 }}>Solo necesitas una decisión hoy para retomar el hábito.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => router.push('/daily')} style={{ padding: '8px 12px', border: 'none', borderRadius: 10, background: '#4f46e5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Decidir →</button>
                  <button onClick={() => setLowActivityDismissed(true)} style={{ padding: '8px 10px', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 10, background: 'transparent', color: 'rgba(148,163,184,0.6)', fontSize: 12, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
            )}

            {/* Banner: racha en riesgo */}
            {streakAtRisk && (
              <div style={{
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.35)',
                borderRadius: 14,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 22 }}>⚡</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#fcd34d', margin: 0 }}>
                      Tu racha de {summary.streak} días está en riesgo
                    </p>
                    <p style={{ fontSize: 12, color: 'rgba(252,211,77,0.7)', margin: '2px 0 0' }}>
                      Completa tu decisión antes de medianoche
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => router.push('/daily')}
                    style={{ padding: '7px 14px', background: 'rgba(245,158,11,0.3)', border: '1px solid rgba(245,158,11,0.5)', borderRadius: 8, color: '#fcd34d', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Decidir ahora
                  </button>
                  <button
                    onClick={() => { setStreakAtRisk(false); setStreakAlertDismissed(true); }}
                    style={{ padding: '7px 10px', background: 'transparent', border: 'none', color: 'rgba(252,211,77,0.5)', fontSize: 16, cursor: 'pointer' }}
                    aria-label="Cerrar alerta"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            <div id="daily-decision-widget">
              <DailyDecisionWidget
                daily={summary.daily}
                primaryGoal={summary.primaryGoal}
                allGoals={activeGoals}
                onSubmitDecision={submitDecision}
                onGoToImpact={(id) => router.push(`/impact/${id}`)}
                onCreateGoal={handleCreateGoal}
                onResetDecision={resetDecision}
                onAddExtraSaving={addExtraSaving}
                onGoToHistory={() => router.push('/history')}
              />
            </div>

            <SavingsEvolutionWidget
              evolution={summary.savingsEvolution}
              onChangeRange={changeRange}
              onGoToDailyQuestion={() => router.push('/daily')}
              goals={activeGoals}
            />

            {/* ── Accesos rápidos a Objetivos ── */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => router.push('/goals')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 16px', background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 14, cursor: 'pointer', color: 'rgba(241,245,249,0.9)', fontSize: 14, fontWeight: 700 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                </svg>
                Ver objetivos
              </button>
              <button
                onClick={() => router.push('/goals')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 16px', background: 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(37,99,235,0.25))', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 14, cursor: 'pointer', color: '#c4b5fd', fontSize: 14, fontWeight: 700 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Añadir objetivo
              </button>
            </div>

            <SavingsBadge
              balance={summary.hucha.balance}
              hasActiveGoals={activeGoals.length > 0}
              onClick={() => setShowHuchaModal(true)}
            />

          </div>

          {/* Columna derecha */}
          <div className={styles.sideCol}>
            <MotivationCardWidget
              intensity={summary.intensity}
              streak={summary.streak ?? 0}
              totalSaved={summary.totalSaved ?? 0}
              moneyFeeling={summary.moneyFeeling}
              onAdjustRules={() => router.push('/settings')}
            />
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
