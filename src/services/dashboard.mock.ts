import type { DashboardSummary } from '@/types/Dashboard';

const today = new Date().toISOString().split('T')[0];

export function getMockDashboardSummary(range: '7d' | '30d' | '90d' = '30d'): DashboardSummary {
  const points30 = [
    { date: '2025-10-01', value: 0 },
    { date: '2025-10-08', value: 60 },
    { date: '2025-10-15', value: 140 },
    { date: '2025-10-22', value: 200 },
    { date: '2025-10-29', value: 260 },
    { date: '2025-11-05', value: 340 },
    { date: '2025-11-12', value: 410 },
    { date: '2025-11-19', value: 490 },
    { date: '2025-11-26', value: 580 },
    { date: '2025-12-03', value: 650 },
  ];
  const points7 = points30.slice(-3);
  const points90 = [
    { date: '2025-07-01', value: 0 },
    ...points30,
    { date: '2025-12-10', value: 720 },
    { date: '2025-12-17', value: 800 },
  ];

  const pointsMap = { '7d': points7, '30d': points30, '90d': points90 };

  return {
    userName: 'Javier',
    systemActive: true,
    incomeRange: '2.000 - 3.500€',
    primaryGoal: {
      id: 'goal_001',
      title: 'Viaje a Japón',
      targetAmount: 5000,
      currentAmount: 650,
      horizonMonths: 12,
      isPrimary: true,
      archived: false,
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
      },
      {
        id: 'goal_002',
        title: 'Fondo de emergencia',
        targetAmount: 3000,
        currentAmount: 900,
        horizonMonths: 18,
        isPrimary: false,
        archived: false,
      },
    ],
    daily: {
      date: today,
      status: 'pending',
      decisionId: null,
    },
    savingsEvolution: {
      range,
      mode: 'demo',
      points: pointsMap[range],
    },
  };
}
