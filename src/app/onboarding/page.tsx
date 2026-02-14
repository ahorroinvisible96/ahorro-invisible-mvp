"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [savingGoal, setSavingGoal] = useState(100);
  const [savingFrequency, setSavingFrequency] = useState("diario");
  const [userName, setUserName] = useState("");
  
  useEffect(() => {
    // Verificar autenticación
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated !== "true") {
      router.replace("/login");
      return;
    }
    
    // Cargar nombre de usuario
    const storedName = localStorage.getItem("userName");
    if (storedName) {
      setUserName(storedName);
    }
    
    // Verificar si ya completó el onboarding
    const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding");
    if (hasCompletedOnboarding === "true") {
      router.replace("/home");
    }
  }, [router]);
  
  const handleComplete = () => {
    try {
      // Guardar preferencias de ahorro
      localStorage.setItem("savingGoal", savingGoal.toString());
      localStorage.setItem("savingFrequency", savingFrequency);
      localStorage.setItem("hasCompletedOnboarding", "true");
      
      // Inicializar datos de ahorro
      const userData = {
        savingGoal,
        savingFrequency,
        currentSaving: 0,
        startDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem("userData", JSON.stringify(userData));
      localStorage.setItem("extraSavings", JSON.stringify([]));
      localStorage.setItem("dailyDecisions", JSON.stringify([]));
      
      // Redirigir al dashboard
      router.push("/home");
    } catch (err) {
      console.error("Error al guardar datos:", err);
    }
  };
  
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Paso {step} de 2</span>
            <span className="text-sm text-gray-500">{step * 50}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${step * 50}%` }}
            ></div>
          </div>
        </div>
        
        {step === 1 ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              ¡Bienvenido{userName ? `, ${userName}` : ''}!
            </h1>
            <p className="text-gray-600 mb-6">
              Vamos a configurar tu meta de ahorro para ayudarte a ahorrar sin esfuerzo.
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ¿Cuánto quieres ahorrar?
              </label>
              <div className="flex items-center">
                <span className="text-gray-500 text-lg mr-2">€</span>
                <input
                  type="number"
                  min="10"
                  value={savingGoal}
                  onChange={(e) => setSavingGoal(parseInt(e.target.value) || 0)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-lg"
                />
              </div>
            </div>
            
            <button
              onClick={() => setStep(2)}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Continuar
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Frecuencia de ahorro
            </h1>
            <p className="text-gray-600 mb-6">
              ¿Con qué frecuencia quieres que te ayudemos a ahorrar?
            </p>
            
            <div className="space-y-3 mb-6">
              {["diario", "semanal", "mensual"].map((frequency) => (
                <button
                  key={frequency}
                  onClick={() => setSavingFrequency(frequency)}
                  className={`w-full py-3 px-4 rounded-lg border ${
                    savingFrequency === frequency
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-300 text-gray-700"
                  }`}
                >
                  {frequency === "diario" && "Diario"}
                  {frequency === "semanal" && "Semanal"}
                  {frequency === "mensual" && "Mensual"}
                </button>
              ))}
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setStep(1)}
                className="w-1/3 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Atrás
              </button>
              <button
                onClick={handleComplete}
                className="w-2/3 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition"
              >
                Completar
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
