"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name || !email || !password) {
      setError("Por favor completa todos los campos");
      return;
    }

    try {
      // Guardar datos del usuario en localStorage
      localStorage.setItem("userName", name);
      localStorage.setItem("userEmail", email);
      localStorage.setItem("isAuthenticated", "true");
      
      // Redirigir al onboarding
      router.push("/onboarding");
    } catch (err) {
      setError("Error al registrar usuario");
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Crea tu cuenta</h1>
        <p className="text-sm text-gray-600 mb-6">Comienza tu viaje hacia el ahorro inteligente</p>
        
        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tu nombre"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="tu@email.com"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>
          
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 text-white py-2 font-medium hover:bg-blue-700 transition"
          >
            Registrarme
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button 
            onClick={() => router.push("/login")}
            className="text-sm text-blue-600 hover:underline"
          >
            ¿Ya tienes cuenta? Inicia sesión
          </button>
        </div>
        
        <div className="text-xs text-gray-500 mt-4 text-center">
          Al registrarte aceptas el uso de localStorage para guardar tus datos
        </div>
      </div>
    </main>
  );
}
