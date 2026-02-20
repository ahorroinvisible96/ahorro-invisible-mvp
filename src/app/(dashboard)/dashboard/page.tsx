"use client";

import { useEffect } from 'react';
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

export default function DashboardPage() {
  const router = useRouter();
  const {
    summary,
    loading,
    error,
    changeRange,
    updateIncome,
    archiveGoal,
    setPrimaryGoal,
    submitDecision,
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
    router.push('/goals/new');
  };

  return (
    <div className={styles.page}>
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
            onCreateGoal={handleCreateGoal}
            onOpenGoal={(id) => router.push(`/goals/${id}`)}
          />

          <DailyDecisionWidget
            daily={summary.daily}
            primaryGoal={summary.primaryGoal}
            allGoals={summary.goals}
            onSubmitDecision={submitDecision}
            onGoToImpact={(id) => router.push(`/impact/${id}`)}
            onCreateGoal={handleCreateGoal}
          />

          <SavingsEvolutionWidget
            evolution={summary.savingsEvolution}
            onChangeRange={changeRange}
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
              />
            ))}
            {activeGoals.length === 0 && (
              <p className={styles.emptyGoals}>
                No tienes objetivos activos.{' '}
                <button className={styles.emptyGoalsLink} onClick={handleCreateGoal}>
                  Crear uno →
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Columna derecha */}
        <div className={styles.sideCol}>
          <MotivationCardWidget
            intensity={summary.intensity}
            onAdjustRules={() => router.push('/ajustes')}
          />
        </div>
      </div>
    </div>
  );
}
