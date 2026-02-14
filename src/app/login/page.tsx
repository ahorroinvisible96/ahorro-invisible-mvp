"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

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
    <main className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Ahorro Invisible</h1>
        <p className="text-sm text-gray-600 mb-6">Accede para continuar tu progreso</p>
        {error ? (
          <div className="mb-4 text-sm text-red-600">{error}</div>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-4">
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
            Entrar
          </button>
        </form>
        <div className="text-xs text-gray-500 mt-4 text-center">Al continuar aceptas el uso de localStorage</div>
      </div>
    </main>
  );
}
