"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { pushLocalDataToSupabase, hasLocalDataToMigrate } from "@/services/syncService";
import { restoreAfterLogin, runSyncCycle } from "@/services/v2/runtime";
import { identifyUser } from "@/lib/posthog";
import { analytics } from "@/services/analytics";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      router.replace("/dashboard");
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }

      const user = session.user;
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("userEmail", user.email ?? "");
      localStorage.setItem("userName", user.user_metadata?.name ?? "");
      localStorage.setItem("supabaseUserId", user.id);
      // Cookie para middleware — respetar "Recuérdame" si existe
      const remember = localStorage.getItem('rememberMe') === 'true';
      const cookieDays = remember ? 90 : 30;
      const expires = new Date(Date.now() + cookieDays * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `ai_auth=1; path=/; expires=${expires}; SameSite=Lax`;

      // Identificar al usuario en PostHog con su UUID de Supabase
      identifyUser(user.id, { email: user.email ?? null, e2e: !!user.user_metadata?.e2e });
      analytics.setUserId(user.id);

      if (hasLocalDataToMigrate()) {
        await pushLocalDataToSupabase(user.id).catch(() => null);
        runSyncCycle().catch(() => null);
      } else {
        await restoreAfterLogin(user.id).catch(() => null);
        if (user.user_metadata?.name) localStorage.setItem("userName", user.user_metadata.name);
        localStorage.setItem("hasCompletedOnboarding", "true");
      }

      const done = localStorage.getItem("hasCompletedOnboarding");
      router.replace(done === "true" ? "/dashboard" : "/onboarding");
    });
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", color: "#f1f5f9" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✨</div>
        <p style={{ fontSize: 16, fontWeight: 600 }}>Verificando sesión...</p>
        <p style={{ fontSize: 13, color: "rgba(148,163,184,0.6)", marginTop: 8 }}>Serás redirigido en un momento.</p>
      </div>
    </div>
  );
}
