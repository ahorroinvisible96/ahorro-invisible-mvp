"use client";

import React, { useEffect, useState } from 'react';
import type { Goal, Hucha } from '@/types/Dashboard';
import type { ExtraSaving } from '@/components/dashboard/DailyDecisionWidget/DailyDecisionWidget.types';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { useDashboardSummary } from '@/hooks/useDashboardSummary';
import { storeArchiveGoalSafe, storeGetGoalBalance, storeTransferFromHucha, storeUseGraceDay, storeMarkMilestoneSeen } from '@/services/dashboardStore';
import { sendMilestonePush } from '@/services/pushNotifications';
import { SavingsBadge } from '@/components/hucha/SavingsBadge';
import { SavingsModal } from '@/components/hucha/SavingsModal';
import { HeaderStatusBarWidget } from '@/components/dashboard/HeaderStatusBarWidget';
import { PrimaryGoalHeroWidget } from '@/components/dashboard/PrimaryGoalHeroWidget';
import { DailyDecisionWidget } from '@/components/dashboard/DailyDecisionWidget';
import { SavingsEvolutionWidget } from '@/components/dashboard/SavingsEvolutionWidget';
import { MotivationCardWidget } from '@/components/dashboard/MotivationCardWidget';
import { GoalsSectionWidget } from '@/components/dashboard/GoalsSectionWidget';
import { GoalCardWidget } from '@/components/dashboard/GoalCardWidget';
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

function MilestoneModal({ milestone, onClose }: { milestone: number; onClose: () => void }): React.ReactElement {
  const EMOJIS: Record<number, string> = { 50: '🌱', 100: '⭐', 500: '🏆', 1000: '💎', 2000: '🚀', 5000: '👑' };
  return (
    <div style={DS.overlay} onClick={onClose}>
      <div style={{ ...DS.box, textAlign: 'center', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 8 }}>{EMOJIS[milestone] ?? '🎉'}</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', margin: '0 0 6px' }}>¡Hito alcanzado!</h2>
        <p style={{ fontSize: 16, color: 'rgba(148,163,184,0.9)', margin: '0 0 4px' }}>
          Has ahorrado más de <strong style={{ color: '#4ade80' }}>€{milestone}</strong>
        </p>
        <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.6)', margin: '0 0 20px' }}>La constancia está dando sus frutos. ¡Sigue así!</p>
        <button
          onClick={onClose}
          style={{ padding: '13px 32px', background: 'linear-gradient(90deg,#16a34a,#15803d)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%' }}
        >
          ¡Gracias! Seguir ahorrando
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
    if (summary.streakBrokeYesterday && summary.graceAvailable && !lastStreakShown) {
      setShowStreakRecovery(true);
      setLastStreakShown(true);
    }
    // Alerta "racha en riesgo": después de las 18:00, decisión pendiente y racha activa
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
  }, [summary?.newMilestone, summary?.streakBrokeYesterday, summary?.streak, summary?.daily.status, streakAlertDismissed]);

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

      <HeaderStatusBarWidget
        userName={summary.userName}
        streak={summary.streak ?? 0}
        onOpenProfile={() => router.push('/profile')}
        onOpenSettings={() => router.push('/settings')}
      />

      <div className={styles.grid}>
        {/* Columna izquierda */}
        <div className={styles.mainCol}>
          {/* Banner: racha en riesgo */}
          {streakAtRisk && (
            <div style={{
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.35)',
              borderRadius: 14,
              padding: '14px 18px',
              marginBottom: 16,
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
          />

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
          />

          <SavingsBadge
            balance={summary.hucha.balance}
            hasActiveGoals={activeGoals.length > 0}
            onClick={() => setShowHuchaModal(true)}
          />

          <GoalsSectionWidget
            goalsCount={activeGoals.length}
            onCreateGoal={handleCreateGoal}
          />

          <div className={styles.goalsList}>
            {activeGoals.map((goal) => (
              <GoalCardWidget
                key={goal.id}
                goal={goal}
                onOpenGoal={(id) => router.push(`/goals/${id}`)}
                onArchiveGoal={handleArchiveRequest}
                onSetPrimary={setPrimaryGoal}
                onEditGoal={handleEditGoal}
              />
            ))}
            {activeGoals.length === 0 && (
              <p className={styles.emptyGoals}>
                No tienes objetivos aún.{' '}
                <button className={styles.emptyGoalsLink} onClick={handleCreateGoal}>
                  Crear objetivo →
                </button>
              </p>
            )}
          </div>
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
  );
}
