"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button/Button";
import { Card } from "@/components/ui/Card/Card";
import { FormInput } from "@/components/ui/FormInput";
import { analytics } from "@/services/analytics";
import { storeInitUser } from "@/services/dashboardStore";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  useEffect(() => {
    // Establecer el nombre de la pantalla para analytics
    analytics.setScreen('signup');
    
    try {
      // Verificar si ya está autenticado
      const isAuthenticated = localStorage.getItem("isAuthenticated");
      if (isAuthenticated === "true") {
        // Verificar si ya completó el onboarding
        const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding");
        if (hasCompletedOnboarding === "true") {
          router.replace("/dashboard");
        } else {
          router.replace("/onboarding");
        }
      }
    } catch (err) {
      console.error("Error al verificar autenticación:", err);
    }
    
    // Registrar evento de inicio de signup
    analytics.signupStarted();
  }, [router]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Validaciones
    if (!email) {
      setError("Revisa el email.");
      analytics.signupError("VALIDATION_ERROR", "Revisa el email.", "email");
      return;
    }
    
    if (!name) {
      setError("Escribe tu nombre.");
      analytics.signupError("VALIDATION_ERROR", "Escribe tu nombre.", "name");
      return;
    }
    
    if (!password || password.length < 8) {
      setError("Usa al menos 8 caracteres.");
      analytics.signupError("VALIDATION_ERROR", "Usa al menos 8 caracteres.", "password");
      return;
    }
    
    try {
      // Guardar datos del usuario en localStorage (claves legacy)
      localStorage.setItem("userName", name);
      localStorage.setItem("userEmail", email);
      localStorage.setItem("isAuthenticated", "true");
      
      // Inicializar el store con nombre y email reales
      storeInitUser(name.trim(), email.trim());
      
      // Registrar evento de signup exitoso
      analytics.signupSuccess();
      
      // Redirigir al onboarding
      router.push("/onboarding");
    } catch (err) {
      console.error("Error al registrar usuario:", err);
      setError("No se pudo crear la cuenta. Intenta de nuevo.");
      
      // Registrar evento de error
      analytics.signupError("LOCAL_STORAGE_ERROR", String(err));
    }
  };
  
  return (
    <div className="min-h-screen w-full flex bg-background p-0">
      {/* Panel izquierdo */}
      <div className="hidden md:flex md:w-1/2 bg-ahorro-700 text-white p-8 flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-12">
            <div className="w-10 h-10 rounded-md bg-black flex items-center justify-center text-white font-bold">
              A
            </div>
            <div className="font-semibold">
              <div className="text-lg">Ahorro</div>
              <div className="text-lg text-indigo-400">Invisible</div>
            </div>
          </div>
          
          <h1 className="text-4xl font-bold mb-4">Tu dinero crece sin que te des cuenta.</h1>
          <p className="text-lg text-white/80">
            La app de ahorro para la Generación Z.
          </p>
        </div>
        
        <div className="text-sm text-white/60">
          © 2026 Ahorro Invisible. Todos los derechos reservados.
        </div>
      </div>
      
      {/* Panel derecho - formulario */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-0">
        <div className="w-full">
          <div className="md:hidden flex items-center gap-2 mb-8 px-4">
            <div className="w-8 h-8 rounded-md bg-black flex items-center justify-center text-white font-bold">
              A
            </div>
            <div className="font-semibold">
              <div>Ahorro</div>
              <div className="text-lg text-indigo-400">Invisible</div>
            </div>
          </div>
          
          <Card variant="default" size="md" className="rounded-none md:rounded-xl">
            <Card.Content>
              <h2 className="text-2xl font-semibold text-text-primary mb-2">Crea tu cuenta</h2>
              <p className="text-text-secondary mb-8">Comienza a ahorrar sin darte cuenta</p>
              
              {error && <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>}
              
              <form onSubmit={handleSubmit} className="space-y-5">
                <FormInput
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                />
                
                <FormInput
                  label="Nombre"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                />
                
                <FormInput
                  label="Contraseña"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                >
                  Crear cuenta
                </Button>
              </form>
              
              <div className="text-xs text-text-secondary mt-8 text-center">
                Al registrarte aceptas nuestros <a href="#" className="text-primary-600 hover:underline">Términos de servicio</a> y
                <a href="#" className="text-primary-600 hover:underline"> Política de privacidad</a>
              </div>
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
