"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge/Badge';
import { analytics } from '@/services/analytics';
import { PrimaryGoalHeroWidget, computeGoalProgress } from '@/components/dashboard/PrimaryGoalHeroWidget';
import { DailyDecisionCardWidget } from '@/components/dashboard/DailyDecisionCardWidget';
import { SavingsEvolutionWidget } from '@/components/dashboard/SavingsEvolutionWidget';
import { MotivationCardWidget } from '@/components/dashboard/MotivationCardWidget';
import { widgetLoading, widgetActive, widgetEmpty, widgetError } from '@/types/WidgetState';
import type { Goal } from '@/types/Goal';
import type { DailyStatus } from '@/types/DailyQuestion';
import type { SavingsEvolutionData, SavingsRange } from '@/types/Dashboard';
import type { WidgetState } from '@/types/WidgetState';
import type { PrimaryGoalHeroData } from '@/components/dashboard/PrimaryGoalHeroWidget';
import type { DailyCardDestination } from '@/components/dashboard/DailyDecisionCardWidget';

const DEMO_SAVINGS_POINTS = [
  { date: '2025-01-01', amount: 0 },
  { date: '2025-02-01', amount: 80 },
  { date: '2025-03-01', amount: 150 },
  { date: '2025-04-01', amount: 210 },
  { date: '2025-05-01', amount: 300 },
  { date: '2025-06-01', amount: 380 },
  { date: '2025-07-01', amount: 470 },
  { date: '2025-08-01', amount: 540 },
  { date: '2025-09-01', amount: 650 },
  { date: '2025-10-01', amount: 740 },
  { date: '2025-11-01', amount: 850 },
];

function buildDailyStatus(): DailyStatus {
  const today = new Date().toISOString().split('T')[0];
  try {
    const stored = localStorage.getItem('dailyDecisions');
    if (stored) {
      const decisions = JSON.parse(stored);
      const todayDecision = decisions.find((d: { date: string; id: string }) =>
        d.date.startsWith(today)
      );
      if (todayDecision) {
        return { date: today, status: 'completed', decision_id: todayDecision.id };
      }
    }
  } catch {
    // fallthrough
  }
  return { date: today, status: 'pending', decision_id: null };
}

function buildPrimaryGoalState(
  goals: Goal[]
): WidgetState<PrimaryGoalHeroData> {
  const activeGoals = goals.filter((g) => !g.archived);
  if (activeGoals.length === 0) return widgetEmpty<PrimaryGoalHeroData>();
  const primary = activeGoals.find((g) => g.is_primary) ?? activeGoals[0];
  return widgetActive<PrimaryGoalHeroData>({
    goal: primary,
    progress: computeGoalProgress(primary),
    systemActive: true,
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');

  const [heroState, setHeroState] =
    useState<WidgetState<PrimaryGoalHeroData>>(widgetLoading<PrimaryGoalHeroData>());
  const [dailyWidgetState, setDailyWidgetState] =
    useState<WidgetState<DailyStatus>>(widgetLoading<DailyStatus>());
  const [savingsState, setSavingsState] =
    useState<WidgetState<SavingsEvolutionData>>(widgetLoading<SavingsEvolutionData>());
  const [hasGoals, setHasGoals] = useState(false);

  const loadData = useCallback(() => {
    try {
      const storedName = localStorage.getItem('userName');
      if (storedName) setUserName(storedName);

      const storedGoals = localStorage.getItem('goals');
      const goals: Goal[] = storedGoals ? JSON.parse(storedGoals) : [];
      const activeGoals = goals.filter((g) => !g.archived);
      setHasGoals(activeGoals.length > 0);

      // Hero widget
      const newHeroState = buildPrimaryGoalState(goals);
      setHeroState(newHeroState);

      // Daily widget
      const dailyStatus = buildDailyStatus();
      const newDailyState =
        activeGoals.length === 0
          ? { status: 'disabled' as const, data: null, errorMessage: null }
          : widgetActive<DailyStatus>(dailyStatus);
      setDailyWidgetState(newDailyState);

      // Savings widget
      const savingsData: SavingsEvolutionData = {
        range: '30d',
        mode: 'demo',
        points: DEMO_SAVINGS_POINTS,
      };
      setSavingsState(widgetActive<SavingsEvolutionData>(savingsData));

      // Analytics
      analytics.dashboardViewed(
        dailyStatus.status,
        activeGoals.length,
        activeGoals.some((g) => g.is_primary),
        !!localStorage.getItem('onboarding_income_range')
      );
      analytics.dailyCtaCardViewed(dailyStatus.status);
    } catch {
      setHeroState(widgetError<PrimaryGoalHeroData>('Error al cargar datos'));
      setDailyWidgetState(widgetError<DailyStatus>('Error al cargar'));
      setSavingsState(widgetError<SavingsEvolutionData>('Error al cargar'));
    }
  }, []);

  useEffect(() => {
    analytics.setScreen('dashboard');

    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (isAuthenticated !== 'true') { router.replace('/signup'); return; }

    const hasCompletedOnboarding = localStorage.getItem('hasCompletedOnboarding');
    if (hasCompletedOnboarding !== 'true') { router.replace('/onboarding'); return; }

    loadData();
  }, [router, loadData]);

  const handleDailyCtaClick = (destination: DailyCardDestination) => {
    const status = dailyWidgetState.data?.status ?? 'pending';
    analytics.dailyCtaClicked(status, destination);
    if (destination === 'daily_question') router.push('/daily');
    else if (dailyWidgetState.data?.decision_id)
      router.push(`/impact/${dailyWidgetState.data.decision_id}`);
  };

  const handleMotivationCtaClick = (destination: 'daily_question' | 'impact') => {
    const status = dailyWidgetState.data?.status ?? 'pending';
    analytics.motivationCtaClicked(status, destination);
    if (destination === 'daily_question') router.push('/daily');
    else if (dailyWidgetState.data?.decision_id)
      router.push(`/impact/${dailyWidgetState.data.decision_id}`);
  };

  const handleCreateGoal = () => {
    analytics.goalCreateStarted('dashboard');
    router.push('/goals/new');
  };

  const handleRangeChange = (range: SavingsRange) => {
    analytics.savingsEvolutionRangeChanged(range, 'demo');
  };

  return (
    <div className="p-6" style={{ backgroundColor: 'var(--color-background-main)' }}>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-semibold mb-1 text-gray-800">Hola, {userName}</h1>
          <p className="text-gray-500">Tus ahorros crecen mientras brilla el día. ✨</p>
        </div>
        <Badge variant="success" size="md" shape="pill" withDot pulse uppercase bold>
          SISTEMA ACTIVO
        </Badge>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Columna izquierda — 8 cols */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* Objetivo principal */}
          <PrimaryGoalHeroWidget
            state={heroState}
            onRetry={loadData}
            onCreateGoal={handleCreateGoal}
          />

          {/* Decisión diaria */}
          <DailyDecisionCardWidget
            state={dailyWidgetState}
            onCtaClick={handleDailyCtaClick}
            onCreateGoal={handleCreateGoal}
          />

          {/* Evolución del ahorro */}
          <SavingsEvolutionWidget
            state={savingsState}
            daily={dailyWidgetState.data}
            onRangeChange={handleRangeChange}
            onCtaClick={(dest) => handleDailyCtaClick(dest)}
          />
        </div>

        {/* Columna derecha — 4 cols */}
        <div className="lg:col-span-4">
          <MotivationCardWidget
            dailyState={dailyWidgetState}
            hasGoals={hasGoals}
            onCtaClick={handleMotivationCtaClick}
            onCreateGoal={handleCreateGoal}
          />
        </div>
      </div>
    </div>
  );
}
