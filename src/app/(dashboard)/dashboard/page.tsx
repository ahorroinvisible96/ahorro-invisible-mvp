"use client";

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

export default function DashboardPage() {
  const router = useRouter();
  const { summary, loading, error, changeRange, refresh } = useDashboardSummary();

  if (loading || !summary) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-gray-400 text-sm">Cargando dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    );
  }

  const activeGoals = summary.goals.filter((g) => !g.archived);

  const handleCreateGoal = () => {
    analytics.goalCreateStarted('dashboard');
    router.push('/goals/new');
  };

  const handleArchiveGoal = async (goalId: string) => {
    analytics.goalArchived(goalId, false);
    refresh();
  };

  return (
    <div className="p-6" style={{ backgroundColor: 'var(--color-background-main)' }}>

      {/* Header */}
      <HeaderStatusBarWidget
        userName={summary.userName}
        systemActive={summary.systemActive}
        onOpenProfile={() => router.push('/profile')}
      />

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Columna izquierda — 8 cols */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* Rango de ingresos */}
          <IncomeRangeWidget
            incomeRange={summary.incomeRange}
            onEditIncomeRange={() => router.push('/settings')}
          />

          {/* Objetivo principal */}
          <PrimaryGoalHeroWidget
            goal={summary.primaryGoal}
            onCreateGoal={handleCreateGoal}
            onOpenGoal={(id) => router.push(`/goals/${id}`)}
          />

          {/* Decisión diaria */}
          <DailyDecisionWidget
            daily={summary.daily}
            primaryGoal={summary.primaryGoal}
            onGoToDailyQuestion={() => router.push('/daily')}
            onGoToImpact={(id) => router.push(`/impact/${id}`)}
            onCreateGoal={handleCreateGoal}
          />

          {/* Evolución del ahorro */}
          <SavingsEvolutionWidget
            evolution={summary.savingsEvolution}
            onChangeRange={changeRange}
          />

          {/* Sección objetivos */}
          <GoalsSectionWidget
            goalsCount={activeGoals.length}
            onCreateGoal={handleCreateGoal}
          />

          <div className="flex flex-col gap-4">
            {activeGoals.map((goal) => (
              <GoalCardWidget
                key={goal.id}
                goal={goal}
                onOpenGoal={(id) => router.push(`/goals/${id}`)}
                onArchiveGoal={handleArchiveGoal}
              />
            ))}
          </div>
        </div>

        {/* Columna derecha — 4 cols */}
        <div className="lg:col-span-4">
          <MotivationCardWidget
            intensity="medium"
            onAdjustRules={() => router.push('/settings')}
          />
        </div>
      </div>
    </div>
  );
}
