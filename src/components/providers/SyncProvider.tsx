"use client";

import { useEffect } from "react";
import { pushLocalDataToSupabase } from "@/services/syncService";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    function syncAll() {
      const userId = localStorage.getItem("supabaseUserId");
      if (!userId) return;
      pushLocalDataToSupabase(userId).catch(() => null);
    }

    // Sync al cargar
    syncAll();

    // Sync cuando el usuario vuelve a la pestaña
    window.addEventListener("focus", syncAll);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") syncAll();
    });

    return () => {
      window.removeEventListener("focus", syncAll);
    };
  }, []);

  return <>{children}</>;
}
