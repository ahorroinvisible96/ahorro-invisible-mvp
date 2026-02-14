"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const isAuthenticated = typeof window !== "undefined" && localStorage.getItem("isAuthenticated");
      if (isAuthenticated === "true") {
        router.replace("/onboarding");
      }
    } catch {}
  }, [router]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Completa email y contraseña");
      return;
    }
    try {
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("userEmail", email);
      router.replace("/onboarding");
    } catch {
      setError("No se pudo iniciar sesión");
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
            Ahorra sin esfuerzo mientras vives tu vida normalmente. Nuestra tecnología
            detecta oportunidades de ahorro en tus gastos diarios.
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
          
          <h2 className="text-2xl font-semibold text-text-primary mb-2">Bienvenido de nuevo</h2>
          <p className="text-text-secondary mb-8">Accede para continuar tu progreso de ahorro</p>
          
          {error && <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>}
          
          <form onSubmit={onSubmit} className="space-y-5">
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
              <div className="flex justify-between mb-1.5">
                <label className="block text-sm font-medium text-text-primary">Contraseña</label>
                <a href="#" className="text-sm text-ahorro-600 hover:underline">¿Olvidaste tu contraseña?</a>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:border-ahorro-500"
                placeholder="••••••••"
              />
            </div>
            
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
            >
              Iniciar sesión
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-text-secondary">
              ¿No tienes cuenta? <a href="/register" className="text-ahorro-600 font-medium hover:underline">Regístrate</a>
            </p>
          </div>
          
          <div className="text-xs text-text-secondary mt-8 text-center">
            Al continuar aceptas nuestros <a href="#" className="text-ahorro-600 hover:underline">Términos de servicio</a> y
            <a href="#" className="text-ahorro-600 hover:underline"> Política de privacidad</a>
          </div>
        </div>
      </div>
    </div>
  );
}
