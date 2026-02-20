// dashboard.mock.ts — ya no se usa en producción (sustituido por dashboardStore).
// Se mantiene como utilidad de test.
import type { DashboardSummary } from '@/types/Dashboard';

const NOW = new Date().toISOString();
const today = new Date().toISOString().split('T')[0];

export function getMockDashboardSummary(range: '7d' | '30d' | '90d' = '30d'): DashboardSummary {
  const points: { date: string; value: number }[] = [
    { date: '2025-10-01', value: 0 },
    { date: '2025-11-01', value: 200 },
    { date: '2025-12-01', value: 500 },
  ];

  return {
    userName: 'Javier',
    systemActive: true,
    incomeRange: { min: 2000, max: 3500, currency: 'EUR' },
    primaryGoal: {
      id: 'goal_001',
      title: 'Viaje a Japón',
      targetAmount: 5000,
      currentAmount: 650,
      horizonMonths: 12,
      isPrimary: true,
      archived: false,
      createdAt: NOW,
      updatedAt: NOW,
    },
    goals: [
      {
        id: 'goal_001',
        title: 'Viaje a Japón',
        targetAmount: 5000,
        currentAmount: 650,
        horizonMonths: 12,
        isPrimary: true,
        archived: false,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    daily: { date: today, status: 'pending', decisionId: null },
    savingsEvolution: { range, mode: 'demo', points },
    intensity: 'medium',
  };
}
