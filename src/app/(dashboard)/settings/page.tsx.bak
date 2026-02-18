"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Settings() {
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
        <h1 className="text-2xl font-semibold text-gray-800 mb-6">Ajustes</h1>
        
        <div className="bg-white rounded-xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Notificaciones</h2>
            <div className="space-y-3">
              <label className="flex items-center">
                <input type="checkbox" className="mr-3" defaultChecked />
                <span className="text-gray-700">Recordatorio diario de ahorro</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-3" defaultChecked />
                <span className="text-gray-700">Resumen semanal</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-3" />
                <span className="text-gray-700">Notificaciones de objetivos</span>
              </label>
            </div>
          </div>
          
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Privacidad</h2>
            <div className="space-y-3">
              <label className="flex items-center">
                <input type="checkbox" className="mr-3" defaultChecked />
                <span className="text-gray-700">Perfil público</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-3" />
                <span className="text-gray-700">Compartir progreso</span>
              </label>
            </div>
          </div>
          
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Cuenta</h2>
            <div className="space-y-3">
              <button className="text-red-500 hover:text-red-600">Eliminar cuenta</button>
              <button className="text-gray-500 hover:text-gray-600 block">Cerrar sesión</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
