"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validación básica
    if (!email || !name || !password) {
      setError("Por favor completa todos los campos");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      setIsLoading(false);
      return;
    }

    try {
      // Evento de analytics: signup_started
      console.log("Analytics: signup_started");

      // Simular creación de usuario (en un entorno real, esto sería una llamada a API)
      setTimeout(() => {
        // Guardar datos en localStorage (simulación)
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("userEmail", email);
        localStorage.setItem("userName", name);
        
        // Evento de analytics: signup_success
        console.log("Analytics: signup_success");
        
        // Redirigir al onboarding
        router.push("/onboarding/1");
      }, 1000);
    } catch (err) {
      // Evento de analytics: signup_error
      console.log("Analytics: signup_error");
      setError("Error al crear la cuenta. Por favor intenta de nuevo.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Panel izquierdo */}
      <div className="hidden md:flex md:w-1/2 bg-ahorro-700 text-white p-8 flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-12">
            <div className="w-10 h-10 rounded-md bg-ahorro-500 flex items-center justify-center text-white font-bold">
              AI
            </div>
            <div className="font-semibold">
              <div className="text-lg">Ahorro</div>
              <div className="text-xs opacity-80">INVISIBLE</div>
            </div>
          </div>
          
          <h1 className="text-4xl font-bold mb-4">Transforma tus pequeños gastos en grandes ahorros</h1>
          <p className="text-lg text-white/80">
            Crea una cuenta y descubre cómo nuestro sistema de ahorro invisible
            te ayuda a alcanzar tus metas financieras sin esfuerzo.
          </p>
        </div>
        
        <div className="text-sm text-white/60">
          © 2026 Ahorro Invisible. Todos los derechos reservados.
        </div>
      </div>
      
      {/* Panel derecho - formulario */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="md:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-md bg-ahorro-700 flex items-center justify-center text-white font-bold">
              AI
            </div>
            <div className="font-semibold">
              <div>Ahorro</div>
              <div className="text-xs text-ahorro-700/80">INVISIBLE</div>
            </div>
          </div>
          
          <h2 className="text-2xl font-semibold text-text-primary mb-2">Crea tu cuenta</h2>
          <p className="text-text-secondary mb-8">Comienza tu viaje hacia el ahorro inteligente</p>
          
          {error && <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>}
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:border-ahorro-500"
                placeholder="Tu nombre"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:border-ahorro-500"
                placeholder="tu@email.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:border-ahorro-500"
                placeholder="••••••••"
              />
              <p className="text-xs text-text-secondary mt-1">Mínimo 6 caracteres</p>
            </div>
            
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isLoading}
            >
              {isLoading ? "Creando cuenta..." : "Crear cuenta"}
            </Button>
          </form>
          
          <div className="text-xs text-text-secondary mt-8 text-center">
            Al registrarte aceptas nuestros <a href="#" className="text-ahorro-600 hover:underline">Términos de servicio</a> y
            <a href="#" className="text-ahorro-600 hover:underline"> Política de privacidad</a>
          </div>
        </div>
      </div>
    </div>
  );
}
