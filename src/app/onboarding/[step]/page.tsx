"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { analytics } from "@/services/analytics";

export default function OnboardingStepPage() {
  const router = useRouter();
  const params = useParams();
  const [step, setStep] = useState<number>(1);
  const [userName, setUserName] = useState("");
  const [incomeRange, setIncomeRange] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verificar autenticación
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated !== "true") {
      router.replace("/signup");
      return;
    }

    // Obtener el step de la URL
    const stepParam = params?.step;
    if (stepParam && !isNaN(Number(stepParam))) {
      const stepNumber = Number(stepParam);
      if (stepNumber >= 1 && stepNumber <= 3) {
        setStep(stepNumber);
      } else {
        router.replace("/onboarding/1");
        return;
      }
    } else {
      router.replace("/onboarding/1");
      return;
    }

    // Cargar datos guardados
    const savedName = localStorage.getItem("onboarding_name");
    const savedIncome = localStorage.getItem("onboarding_income_range");
    const savedGoals = localStorage.getItem("onboarding_goals");

    if (savedName) setUserName(savedName);
    if (savedIncome) setIncomeRange(savedIncome);
    if (savedGoals) setSelectedGoals(JSON.parse(savedGoals));

    setIsLoading(false);
  }, [router, params]);

  const handleNext = () => {
    if (step < 3) {
      router.push(`/onboarding/${step + 1}`);
    } else {
      // Completar onboarding
      localStorage.setItem("hasCompletedOnboarding", "true");
      localStorage.setItem("userName", userName);
      localStorage.setItem("onboarding_income_range", incomeRange);
      
      // Crear objetivos iniciales
      if (selectedGoals.length > 0) {
        const goals = selectedGoals.map((goalTitle, index) => ({
          id: `goal_${Date.now()}_${index}`,
          title: goalTitle,
          target_amount: 5000,
          current_amount: 0,
          time_horizon_months: 12,
          is_primary: index === 0,
          archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        localStorage.setItem("goals", JSON.stringify(goals));
      }

      analytics.onboardingCompleted();
      router.replace("/dashboard");
    }
  };

  const handlePrevious = () => {
    if (step > 1) {
      router.push(`/onboarding/${step - 1}`);
    }
  };

  const saveStepData = () => {
    localStorage.setItem("onboarding_name", userName);
    localStorage.setItem("onboarding_income_range", incomeRange);
    localStorage.setItem("onboarding_goals", JSON.stringify(selectedGoals));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ahorro-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md" rounded2xl>
        <Card.Header title={`Paso ${step} de 3`} className="text-center" />
        <Card.Content className="space-y-4">
          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">¿Cómo te llamas?</h2>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full p-3 border rounded-lg"
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">¿Cuáles son tus ingresos mensuales?</h2>
              <div className="space-y-2">
                {["< 1.000€", "1.000 - 2.000€", "2.000 - 3.500€", "> 3.500€"].map((range) => (
                  <button
                    key={range}
                    onClick={() => setIncomeRange(range)}
                    className={`w-full p-3 text-left border rounded-lg ${
                      incomeRange === range ? "bg-ahorro-500 text-white" : "hover:bg-gray-100"
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">¿Qué objetivos tienes?</h2>
              <div className="space-y-2">
                {["Viaje", "Emergencia", "Coche nuevo", "Casa"].map((goal) => (
                  <button
                    key={goal}
                    onClick={() => {
                      if (selectedGoals.includes(goal)) {
                        setSelectedGoals(selectedGoals.filter(g => g !== goal));
                      } else {
                        setSelectedGoals([...selectedGoals, goal]);
                      }
                    }}
                    className={`w-full p-3 text-left border rounded-lg ${
                      selectedGoals.includes(goal) ? "bg-ahorro-500 text-white" : "hover:bg-gray-100"
                    }`}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={step === 1}
            >
              Anterior
            </Button>
            <Button
              onClick={() => {
                saveStepData();
                handleNext();
              }}
              disabled={step === 1 && !userName.trim()}
            >
              {step === 3 ? "Comenzar" : "Siguiente"}
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}