"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { analytics } from "@/services/analytics";

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Establecer el nombre de la pantalla para analytics
    analytics.setScreen('settings');
    
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
    
    // Registrar evento de visualización de ajustes
    analytics.settingsViewed();
    
    setIsLoading(false);
  }, [router]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ahorro-500"></div>
      </div>
    );
  }
  
  return (
    <div className="p-6 bg-background">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Ajustes</h1>
        <p className="text-text-secondary">Configura tu experiencia.</p>
      </div>
      
      <div className="space-y-4">
        {/* Sección de Privacidad */}
        <Card className="p-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">Privacidad</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-primary font-medium">Política de Privacidad</p>
                <p className="text-sm text-text-secondary">Revisa nuestra política de privacidad</p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.alert("Disponible próximamente")}
              >
                Ver
              </Button>
            </div>
          </div>
        </Card>
        
        {/* Sección de Términos */}
        <Card className="p-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">Términos</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-primary font-medium">Términos de Servicio</p>
                <p className="text-sm text-text-secondary">Revisa nuestros términos de servicio</p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.alert("Disponible próximamente")}
              >
                Ver
              </Button>
            </div>
          </div>
        </Card>
        
        {/* Sección de Cuenta */}
        <Card className="p-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">Cuenta</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-primary font-medium">Cerrar sesión</p>
                <p className="text-sm text-text-secondary">Salir de tu cuenta</p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  analytics.logoutClicked('sidebar');
                  localStorage.removeItem("isAuthenticated");
                  analytics.logoutSuccess();
                  router.replace("/signup");
                }}
              >
                Cerrar sesión
              </Button>
            </div>
          </div>
        </Card>
        
        {/* Versión de la aplicación */}
        <div className="text-center text-xs text-text-secondary mt-8">
          <p>Ahorro Invisible MVP v1.0.0</p>
        </div>
      </div>
    </div>
  );
}
