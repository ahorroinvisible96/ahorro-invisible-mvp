"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function History() {
  const router = useRouter();

  useEffect(() => {
    // Verificar autenticación
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated !== "true") {
      router.replace("/signup");
      return;
    }
    
    // Verificar onboarding
    const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding");
    if (hasCompletedOnboarding !== "true") {
      router.replace("/onboarding");
      return;
    }
  }, [router]);

  return (
    <div className="p-6" style={{ backgroundColor: '#F5F5F0' }}>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-800 mb-6">Historial</h1>
        
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="space-y-4">
            <div className="border-b pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-800">Decisión diaria</h3>
                  <p className="text-sm text-gray-600">Ahorro: 5€</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">18/02/2026</p>
                  <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-700 rounded">Completado</span>
                </div>
              </div>
            </div>
            
            <div className="border-b pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-800">Decisión diaria</h3>
                  <p className="text-sm text-gray-600">Ahorro: 3€</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">17/02/2026</p>
                  <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-700 rounded">Completado</span>
                </div>
              </div>
            </div>
            
            <div className="border-b pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-800">Decisión diaria</h3>
                  <p className="text-sm text-gray-600">Ahorro: 7€</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">16/02/2026</p>
                  <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-700 rounded">Completado</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
