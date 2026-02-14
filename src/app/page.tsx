'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Verificar si ya está autenticado
    try {
      const isAuthenticated = localStorage.getItem("isAuthenticated");
      if (isAuthenticated === "true") {
        // Verificar si ya completó el onboarding
        const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding");
        if (hasCompletedOnboarding === "true") {
          router.replace("/dashboard");
        } else {
          router.replace("/onboarding");
        }
      } else {
        // Si no está autenticado, redirigir a signup
        router.replace('/signup');
      }
    } catch (err) {
      // En caso de error, redirigir a signup
      router.replace('/signup');
    }
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-background">
      <div className="flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ahorro-500"></div>
        <h2 className="mt-4 text-xl font-semibold text-text-primary">Redirigiendo...</h2>
      </div>
    </main>
  );
}
