"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { analytics } from "@/services/analytics";
import { ImpactSummaryWidget } from "@/components/impact/ImpactSummaryWidget";
import { widgetLoading, widgetActive, widgetError, widgetEmpty } from "@/types/WidgetState";
import type { WidgetState } from "@/types/WidgetState";
import type { DailyDecision } from "@/types/Impact";

export default function ImpactPage({ params }: { params: { decision_id: string } }) {
  const router = useRouter();
  const [state, setState] = useState<WidgetState<DailyDecision>>(
    widgetLoading<DailyDecision>()
  );

  const loadDecision = useCallback(() => {
    try {
      const isAuthenticated = localStorage.getItem("isAuthenticated");
      if (isAuthenticated !== "true") { router.replace("/signup"); return; }

      const stored = localStorage.getItem("dailyDecisions");
      if (!stored) { setState(widgetEmpty<DailyDecision>()); return; }

      const decisions: DailyDecision[] = JSON.parse(stored);
      const found = decisions.find((d) => d.id === params.decision_id);

      if (!found) { setState(widgetEmpty<DailyDecision>()); return; }

      setState(widgetActive<DailyDecision>(found));

      analytics.impactViewed(
        found.date,
        found.id,
        found.question_id,
        found.answer_key,
        found.goal_id,
        found.impact.monthly_delta !== null || found.impact.yearly_delta !== null,
        found.impact.monthly_delta ?? undefined,
        found.impact.yearly_delta ?? undefined
      );
    } catch {
      setState(widgetError<DailyDecision>("No se pudo cargar el impacto."));
    }
  }, [params.decision_id, router]);

  useEffect(() => {
    analytics.setScreen("impact");
    loadDecision();
  }, [loadDecision]);

  const handleExtraSavings = () => {
    if (state.data) {
      analytics.impactCtaExtraSavingsClicked(state.data.id, state.data.goal_id);
    }
    router.push("/extra-saving");
  };

  const handleHistory = () => {
    analytics.impactCtaHistoryClicked();
    router.push("/history");
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ backgroundColor: "var(--color-background-main)" }}
    >
      <div className="w-full max-w-md">
        <ImpactSummaryWidget
          state={state}
          onExtraSavingsClick={handleExtraSavings}
          onHistoryClick={handleHistory}
          onRetry={loadDecision}
        />
      </div>
    </div>
  );
}
