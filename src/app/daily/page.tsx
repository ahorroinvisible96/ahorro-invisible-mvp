"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { analytics } from "@/services/analytics";
import { DailyQuestionWidget } from "@/components/daily/DailyQuestionWidget";
import { widgetLoading, widgetActive, widgetEmpty, widgetError } from "@/types/WidgetState";
import type { WidgetState } from "@/types/WidgetState";
import type { Goal } from "@/types/Goal";
import type {
  DailyQuestionResponse,
  DailyDecisionCreateRequest,
  DailyDate,
} from "@/types/DailyQuestion";
import type { DailyDecision } from "@/types/Impact";

const QUESTION_BANK: Array<{
  question_id: string;
  text: string;
  options: Array<{ answer_key: string; label: string }>;
  impact: Record<string, { monthly_delta: number; yearly_delta: number; label?: string }>;
}> = [
  {
    question_id: "dly_delivery_vs_cook",
    text: "Hoy, ¿qué eliges?",
    options: [
      { answer_key: "delivery", label: "Pido delivery" },
      { answer_key: "cook", label: "Cocino en casa" },
    ],
    impact: {
      delivery: { monthly_delta: -60, yearly_delta: -720 },
      cook: { monthly_delta: 60, yearly_delta: 720, label: "Pequeñas decisiones, gran diferencia" },
    },
  },
  {
    question_id: "dly_coffee_out_vs_home",
    text: "¿Café fuera o en casa?",
    options: [
      { answer_key: "out", label: "Lo compro fuera" },
      { answer_key: "home", label: "Lo preparo en casa" },
    ],
    impact: {
      out: { monthly_delta: -30, yearly_delta: -360 },
      home: { monthly_delta: 30, yearly_delta: 360, label: "Un paso hoy cuenta" },
    },
  },
  {
    question_id: "dly_impulse_vs_wait",
    text: "¿Comprar por impulso o esperar?",
    options: [
      { answer_key: "impulse", label: "Compro ahora" },
      { answer_key: "wait", label: "Espero 24h" },
    ],
    impact: {
      impulse: { monthly_delta: -45, yearly_delta: -540 },
      wait: { monthly_delta: 45, yearly_delta: 540, label: "Constancia > intensidad" },
    },
  },
];

function pickDailyQuestion(date: DailyDate) {
  const dayOfYear = Math.floor(
    (new Date(date).getTime() - new Date(new Date(date).getFullYear(), 0, 0).getTime()) /
      86400000
  );
  return QUESTION_BANK[dayOfYear % QUESTION_BANK.length];
}

export default function DailyPage() {
  const router = useRouter();
  const [questionState, setQuestionState] =
    useState<WidgetState<DailyQuestionResponse>>(widgetLoading<DailyQuestionResponse>());
  const [goals, setGoals] = useState<Goal[]>([]);
  const [primaryGoalId, setPrimaryGoalId] = useState<string | null>(null);

  const loadQuestion = useCallback(() => {
    try {
      const isAuthenticated = localStorage.getItem("isAuthenticated");
      if (isAuthenticated !== "true") { router.replace("/signup"); return; }

      const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding");
      if (hasCompletedOnboarding !== "true") { router.replace("/onboarding"); return; }

      const today: DailyDate = new Date().toISOString().split("T")[0];

      // Load goals
      const storedGoals = localStorage.getItem("goals");
      const parsedGoals: Goal[] = storedGoals ? JSON.parse(storedGoals) : [];
      const activeGoals = parsedGoals.filter((g) => !g.archived);

      if (activeGoals.length === 0) {
        router.replace("/goals/new");
        return;
      }

      setGoals(activeGoals);
      const primary = activeGoals.find((g) => g.is_primary) ?? activeGoals[0];
      setPrimaryGoalId(primary.id);

      // Check if already completed today
      const storedDecisions = localStorage.getItem("dailyDecisions");
      if (storedDecisions) {
        const decisions = JSON.parse(storedDecisions);
        const todayDecision = decisions.find(
          (d: { date: string; id: string }) => d.date.startsWith(today)
        );
        if (todayDecision) {
          const q = pickDailyQuestion(today);
          setQuestionState(
            widgetActive<DailyQuestionResponse>({
              date: today,
              question: { question_id: q.question_id, text: q.text, options: q.options },
              status: "completed",
              decision_id: todayDecision.id,
            })
          );
          analytics.dailyQuestionViewed(today, q.question_id, "completed");
          return;
        }
      }

      const q = pickDailyQuestion(today);
      setQuestionState(
        widgetActive<DailyQuestionResponse>({
          date: today,
          question: { question_id: q.question_id, text: q.text, options: q.options },
          status: "pending",
        })
      );
      analytics.dailyQuestionViewed(today, q.question_id, "pending");
    } catch {
      setQuestionState(widgetError<DailyQuestionResponse>("No se pudo cargar la pregunta."));
    }
  }, [router]);

  useEffect(() => {
    analytics.setScreen("daily_question");
    loadQuestion();
  }, [loadQuestion]);

  const handleSubmit = async (request: DailyDecisionCreateRequest): Promise<DailyDecision> => {
    const bank = QUESTION_BANK.find((q) => q.question_id === request.question_id);
    const impactData = bank?.impact[request.answer_key] ?? {
      monthly_delta: null,
      yearly_delta: null,
    };

    const decision: DailyDecision = {
      id: `dec_${Date.now()}`,
      date: request.date,
      question_id: request.question_id,
      answer_key: request.answer_key,
      goal_id: request.goal_id,
      impact: {
        question_id: request.question_id,
        answer_key: request.answer_key,
        monthly_delta: impactData.monthly_delta ?? null,
        yearly_delta: impactData.yearly_delta ?? null,
        label: "label" in impactData ? (impactData.label ?? null) : null,
      },
      created_at: new Date().toISOString(),
    };

    // Persist
    const stored = localStorage.getItem("dailyDecisions");
    const decisions = stored ? JSON.parse(stored) : [];
    decisions.push(decision);
    localStorage.setItem("dailyDecisions", JSON.stringify(decisions));

    const goal = goals.find((g) => g.id === request.goal_id);
    analytics.dailyAnswerSubmitted(
      request.date,
      request.question_id,
      request.answer_key,
      request.goal_id,
      goal?.is_primary ?? false
    );
    analytics.dailyCompleted(
      request.date,
      decision.id,
      request.question_id,
      request.answer_key,
      request.goal_id,
      true,
      decision.impact.monthly_delta ?? undefined,
      decision.impact.yearly_delta ?? undefined,
      goal?.is_primary ?? false
    );

    return decision;
  };

  const handleAnswerSelected = (payload: { date: string; question_id: string; answer_key: string }) => {
    analytics.dailyAnswerSelected(payload.date, payload.question_id, payload.answer_key);
  };

  const handleCompleted = (decisionId: string) => {
    router.push(`/impact/${decisionId}`);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ backgroundColor: "var(--color-background-main)" }}
    >
      <div className="w-full max-w-md">
        <DailyQuestionWidget
          questionState={questionState}
          goals={goals}
          primaryGoalId={primaryGoalId}
          onSubmit={handleSubmit}
          onAnswerSelected={handleAnswerSelected}
          onCompleted={handleCompleted}
          onRetry={loadQuestion}
          onCreateGoal={() => router.push("/goals/new")}
        />
      </div>
    </div>
  );
}
