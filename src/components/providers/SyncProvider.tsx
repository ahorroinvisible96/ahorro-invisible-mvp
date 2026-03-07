"use client";

import { useEffect } from "react";
import { pushLocalDataToSupabase } from "@/services/syncService";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function SyncProvider({ children }: { children: React.ReactNode }) {
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
