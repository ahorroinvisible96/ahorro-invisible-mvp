"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

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
      router.replace("/onboarding/1");
      return;
    }
    
    setIsLoading(false);
    
    // Evento de analytics: settings_viewed
    console.log("Analytics: settings_viewed");
  }, [router]);

  const handleLogout = () => {
    try {
      // Eliminar datos de autenticación
      localStorage.removeItem("isAuthenticated");
      
      // Redirigir a signup
      router.replace("/signup");
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ahorro-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Ajustes</h1>
            <p className="text-text-secondary">Configura tu experiencia</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => router.push("/dashboard")}
          >
            Volver
          </Button>
        </div>
        
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <h2 className="text-lg font-medium text-text-primary mb-4">Legal y Privacidad</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-text-primary">Términos de servicio</span>
                  <Button variant="ghost" size="sm">Ver</Button>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-text-primary">Política de privacidad</span>
                  <Button variant="ghost" size="sm">Ver</Button>
                </div>
                
                <div className="flex justify-between items-center py-2">
                  <span className="text-text-primary">Aviso legal</span>
                  <Button variant="ghost" size="sm">Ver</Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <h2 className="text-lg font-medium text-text-primary mb-4">Cuenta</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <div>
                    <span className="text-text-primary block">Editar perfil</span>
                    <span className="text-text-secondary text-sm">Cambia tu nombre y foto</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => router.push("/profile")}
                  >
                    Editar
                  </Button>
                </div>
                
                <div className="flex justify-between items-center py-2">
                  <div>
                    <span className="text-text-primary block">Cerrar sesión</span>
                    <span className="text-text-secondary text-sm">Salir de tu cuenta</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleLogout}
                  >
                    Salir
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="text-center text-text-secondary text-sm">
            <p>Versión 1.0.0</p>
            <p className="mt-1">© 2026 Ahorro Invisible. Todos los derechos reservados.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
