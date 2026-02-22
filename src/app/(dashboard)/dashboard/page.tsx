"use client";

import React, { useEffect, useState } from 'react';
import type { Goal } from '@/types/Dashboard';
import type { ExtraSaving } from '@/components/dashboard/DailyDecisionWidget/DailyDecisionWidget.types';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { useDashboardSummary } from '@/hooks/useDashboardSummary';
import { HeaderStatusBarWidget } from '@/components/dashboard/HeaderStatusBarWidget';
import { PrimaryGoalHeroWidget } from '@/components/dashboard/PrimaryGoalHeroWidget';
import { DailyDecisionWidget } from '@/components/dashboard/DailyDecisionWidget';
import { SavingsEvolutionWidget } from '@/components/dashboard/SavingsEvolutionWidget';
import { MotivationCardWidget } from '@/components/dashboard/MotivationCardWidget';
import { GoalsSectionWidget } from '@/components/dashboard/GoalsSectionWidget';
import { GoalCardWidget } from '@/components/dashboard/GoalCardWidget';
import { IncomeRangeWidget } from '@/components/dashboard/IncomeRangeWidget';
import styles from './Dashboard.module.css';

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
  const [showExtraSaving, setShowExtraSaving] = useState(false);
  const {
    summary,
    loading,
    error,
    changeRange,
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
      if (isAuth !== 'true') { router.replace('/signup'); return; }
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

  return (
    <div className={styles.page}>
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
        systemActive={summary.systemActive}
        onOpenProfile={() => router.push('/profile')}
      />

      <div className={styles.grid}>
        {/* Columna izquierda */}
        <div className={styles.mainCol}>
          <IncomeRangeWidget
            incomeRange={summary.incomeRange}
            onSaveIncomeRange={updateIncome}
          />

          <PrimaryGoalHeroWidget
            goal={summary.primaryGoal}
            estimatedMonthsRemaining={summary.estimatedMonthsRemaining}
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
                onArchiveGoal={archiveGoal}
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
            onAdjustRules={() => router.push('/settings')}
          />
        </div>
      </div>
    </div>
  );
}
