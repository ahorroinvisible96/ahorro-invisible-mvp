"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { pushLocalDataToSupabase, hasLocalDataToMigrate } from "@/services/syncService";

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

      // Auto-migrate local data to Supabase on first sign-in
      if (hasLocalDataToMigrate()) {
        await pushLocalDataToSupabase(user.id).catch(() => { /* silent */ });
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
