"use client";

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { DailyDecisionWidget } from '@/components/dashboard/DailyDecisionWidget';
import { useDashboardSummary } from '@/hooks/useDashboardSummary';
import layoutStyles from './DashboardLayout.module.css';
import { CloseIcon } from '@/components/ui/AppIcons';

function DailyDecisionModalWrapper({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { summary, submitDecision, resetDecision, addExtraSaving, createGoal } = useDashboardSummary();

  if (!summary) return null;

  const activeGoals = summary.goals.filter((g) => !g.archived);

  return (
    <div className={layoutStyles.overlay} onClick={onClose}>
      <div className={layoutStyles.modalContainer} onClick={(e) => e.stopPropagation()}>
        <button className={layoutStyles.closeBtn} onClick={onClose} aria-label="Cerrar">
          <CloseIcon size={18} />
        </button>
        <DailyDecisionWidget
          daily={summary.daily}
          primaryGoal={summary.primaryGoal}
          allGoals={activeGoals}
          onSubmitDecision={(qId, aKey, goalId, customAmount) => {
            submitDecision(qId, aKey, goalId, customAmount);
          }}
          onGoToImpact={(id) => { onClose(); router.push(`/impact/${id}`); }}
          onCreateGoal={() => { onClose(); router.push('/goals/new'); }}
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
