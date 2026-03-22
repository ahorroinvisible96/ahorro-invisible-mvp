"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { pushLocalDataToSupabase, pullDataFromSupabase } from "@/services/syncService";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function SyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Restaurar sesión si iOS limpió localStorage pero Supabase tiene sesión activa
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      const isAuth = localStorage.getItem('isAuthenticated');
      if (isAuth === 'true') return; // Ya está restaurado
      // iOS limpió localStorage → restaurar datos de sesión y de usuario
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userEmail', session.user.email ?? '');
      localStorage.setItem('userName', session.user.user_metadata?.name ?? '');
      localStorage.setItem('supabaseUserId', session.user.id);
      localStorage.setItem('hasCompletedOnboarding', 'true');
      // Refrescar cookie de autenticación
      const remember = localStorage.getItem('rememberMe') === 'true';
      const days = remember ? 90 : 30;
      const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `ai_auth=1; path=/; expires=${expires}; SameSite=Lax`;
      // Restaurar datos del usuario desde Supabase
      await pullDataFromSupabase(session.user.id).catch(() => null);
      // Forzar re-evaluación de guardias de auth (critical for iOS PWA)
      router.refresh();
    });
  }, [router]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    function syncAll() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const userId = localStorage.getItem("supabaseUserId");
        if (!userId) return;
        pushLocalDataToSupabase(userId).catch(() => null);
      }, 2000);
    }

    // Sync al cargar
    syncAll();

    const handleFocus = () => syncAll();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncAll();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return <>{children}</>;
}
