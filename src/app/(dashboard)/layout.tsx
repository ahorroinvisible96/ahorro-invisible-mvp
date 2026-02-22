"use client";

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { DailyDecisionWidget } from '@/components/dashboard/DailyDecisionWidget';
import { useDashboardSummary } from '@/hooks/useDashboardSummary';
import layoutStyles from './DashboardLayout.module.css';

function DailyDecisionModalWrapper({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { summary, submitDecision, resetDecision, addExtraSaving, createGoal } = useDashboardSummary();

  if (!summary) return null;

  const activeGoals = summary.goals.filter((g) => !g.archived);

  return (
    <div className={layoutStyles.overlay} onClick={onClose}>
      <div className={layoutStyles.modalContainer} onClick={(e) => e.stopPropagation()}>
        <button className={layoutStyles.closeBtn} onClick={onClose} aria-label="Cerrar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <DailyDecisionWidget
          daily={summary.daily}
          primaryGoal={summary.primaryGoal}
          allGoals={activeGoals}
          onSubmitDecision={(qId, aKey, goalId, customAmount) => {
            submitDecision(qId, aKey, goalId, customAmount);
          }}
          onGoToImpact={(id) => { onClose(); router.push(`/impact/${id}`); }}
          onCreateGoal={() => { onClose(); createGoal({ title: 'Nuevo objetivo', targetAmount: 1000, horizonMonths: 12 }); }}
          onResetDecision={() => { resetDecision(); }}
          onAddExtraSaving={(s) => { addExtraSaving(s); }}
          onGoToHistory={() => { onClose(); router.push('/history'); }}
        />
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showDailyModal, setShowDailyModal] = useState(false);

  const handleOpenDailyDecision = useCallback(() => {
    setShowDailyModal(true);
  }, []);

  const handleCloseDailyModal = useCallback(() => {
    setShowDailyModal(false);
  }, []);

  return (
    <AppLayout onOpenDailyDecision={handleOpenDailyDecision}>
      {children}
      {showDailyModal && (
        <DailyDecisionModalWrapper onClose={handleCloseDailyModal} />
      )}
    </AppLayout>
  );
}
