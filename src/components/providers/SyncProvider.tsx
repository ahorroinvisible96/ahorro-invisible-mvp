"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { identifyUser } from "@/lib/posthog";
import { analytics } from "@/services/analytics";
import { runSyncCycle, restoreAfterLogin } from "@/services/v2/runtime";
import { onEnqueue, flushOutbox } from "@/services/v2/outbox";

export default function SyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Restaurar sesión si iOS limpió localStorage pero Supabase tiene sesión activa
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      const isAuth = localStorage.getItem('isAuthenticated');
      if (isAuth === 'true') {
        // Sesión ya restaurada: solo garantizar identidad PostHog
        identifyUser(session.user.id, { email: session.user.email ?? null, e2e: !!session.user.user_metadata?.e2e });
        analytics.setUserId(session.user.id);
        return;
      }
      // iOS limpió localStorage → restaurar datos de sesión y de usuario
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userEmail', session.user.email ?? '');
      localStorage.setItem('userName', session.user.user_metadata?.name ?? '');
      localStorage.setItem('supabaseUserId', session.user.id);
      localStorage.setItem('hasCompletedOnboarding', 'true');
      // Identificar al usuario en PostHog (sesión restaurada)
      identifyUser(session.user.id, { email: session.user.email ?? null, e2e: !!session.user.user_metadata?.e2e });
      analytics.setUserId(session.user.id);
      // Refrescar cookie de autenticación
      const remember = localStorage.getItem('rememberMe') === 'true';
      const days = remember ? 90 : 30;
      const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `ai_auth=1; path=/; expires=${expires}; SameSite=Lax`;
      // Restaurar datos del usuario desde la fuente de verdad vigente (V2 o, en transición, V1)
      await restoreAfterLogin(session.user.id).catch(() => null);
      // Forzar re-evaluación de guardias de auth (critical for iOS PWA)
      router.refresh();
    });
  }, [router]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    function syncAll(delay = 2000) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { runSyncCycle().catch(() => null); }, delay);
    }

    // Cada acción encolada se envía casi inmediatamente (agrupando ráfagas / doble clic).
    const off = onEnqueue(() => {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(() => { flushOutbox().catch(() => null); }, 300);
    });

    // Sync al cargar
    syncAll();

    const handleFocus = () => syncAll();
    const handleOnline = () => syncAll(500);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncAll();
    };
    // Reintentos con backoff de la cola aunque el usuario no interactúe
    const interval = setInterval(() => { flushOutbox().catch(() => null); }, 30_000);

    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      off();
      clearInterval(interval);
      if (debounceTimer) clearTimeout(debounceTimer);
      if (flushTimer) clearTimeout(flushTimer);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return <>{children}</>;
}
