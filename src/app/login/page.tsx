"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { analytics } from "@/services/analytics";
import { authSignIn, authSendMagicLink } from "@/services/authService";
import { isSupabaseConfigured } from "@/lib/supabase";
import { hasLocalDataToMigrate, pushLocalDataToSupabase, pullDataFromSupabase } from "@/services/syncService";

type Mode = "password" | "magic";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    analytics.setScreen("login");
    try {
      if (localStorage.getItem("isAuthenticated") === "true") {
        const done = localStorage.getItem("hasCompletedOnboarding");
        router.replace(done === "true" ? "/dashboard" : "/onboarding");
      }
    } catch { /* fallthrough */ }
  }, [router]);

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px",
    background: "rgba(15,23,42,0.6)", border: "1px solid rgba(51,65,85,0.55)",
    borderRadius: 10, color: "#f1f5f9", fontSize: 14, fontWeight: 500,
    outline: "none", boxSizing: "border-box",
    fontFamily: "var(--font-geist-sans, Arial, sans-serif)",
    transition: "border-color 180ms ease",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700,
    color: "rgba(148,163,184,0.6)", textTransform: "uppercase",
    letterSpacing: "0.06em", marginBottom: 6,
  };

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setInfo("");
    if (!email) { setError("Introduce tu email."); return; }
    if (!password) { setError("Introduce tu contraseña."); return; }

    setLoading(true);
    const { user, error: authErr } = await authSignIn(email, password);
    setLoading(false);

    if (authErr || !user) {
      setError(authErr ?? "Error al iniciar sesión");
      return;
    }

    if (isSupabaseConfigured && user.id !== "local") {
      if (hasLocalDataToMigrate()) {
        // Hay datos locales → push a Supabase (migración)
        pushLocalDataToSupabase(user.id).catch(() => null);
      } else {
        // Sin datos locales → pull desde Supabase (nuevo dispositivo / localStorage limpio)
        await pullDataFromSupabase(user.id).catch(() => null);
        if (user.name) localStorage.setItem("userName", user.name);
        localStorage.setItem("hasCompletedOnboarding", "true");
      }
    }

    const done = localStorage.getItem("hasCompletedOnboarding");
    router.replace(done === "true" ? "/dashboard" : "/onboarding");
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setInfo("");
    if (!email) { setError("Introduce tu email."); return; }

    setLoading(true);
    const { error: magicErr } = await authSendMagicLink(email);
    setLoading(false);

    if (magicErr) { setError(magicErr); return; }
    setInfo("✅ ¡Enviado! Revisa tu email y haz clic en el enlace para entrar.");
  }

  return (
    <div style={{
      minHeight: "100vh", width: "100%", display: "flex",
      background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
      fontFamily: "var(--font-geist-sans, Arial, sans-serif)",
    }}>
      {/* Glow decorativo */}
      <div style={{ position: "fixed", top: "15%", left: "25%", width: 500, height: 500, background: "radial-gradient(ellipse, rgba(168,85,247,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "10%", right: "20%", width: 400, height: 400, background: "radial-gradient(ellipse, rgba(37,99,235,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ display: "flex", width: "100%", minHeight: "100vh" }}>

        {/* Panel izquierdo — md+ */}
        <div style={{ flex: "0 0 50%", padding: "48px", flexDirection: "column", justifyContent: "space-between", borderRight: "1px solid rgba(51,65,85,0.3)", position: "relative", overflow: "hidden" }} className="hidden md:flex">
          <div style={{ position: "absolute", top: -80, left: -80, width: 360, height: 360, background: "radial-gradient(ellipse, rgba(168,85,247,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #a855f7, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 20, boxShadow: "0 4px 16px rgba(168,85,247,0.45)" }}>A</div>
            <div>
              <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 18 }}>Ahorro </span>
              <span style={{ color: "#a855f7", fontWeight: 700, fontSize: 18 }}>Invisible</span>
            </div>
          </div>

          <div>
            <h1 style={{ fontSize: 36, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.2, margin: "0 0 16px" }}>
              Bienvenido de<br />
              <span style={{ background: "linear-gradient(90deg, #a855f7, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>vuelta.</span>
            </h1>
            <p style={{ fontSize: 16, color: "rgba(148,163,184,0.75)", lineHeight: 1.6, margin: 0 }}>
              Tu racha te espera.<br />Un hábito no se rompe en un día.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 32 }}>
              {[
                { icon: "🔒", text: "Tus datos están seguros y cifrados" },
                { icon: "📱", text: "Accede desde cualquier dispositivo" },
                { icon: "🔄", text: "Sincronización automática en la nube" },
              ].map((f) => (
                <div key={f.text} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(51,65,85,0.4)", borderRadius: 12 }}>
                  <span style={{ fontSize: 16 }}>{f.icon}</span>
                  <span style={{ fontSize: 13, color: "rgba(203,213,225,0.85)", fontWeight: 500 }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontSize: 12, color: "rgba(100,116,139,0.6)", margin: 0 }}>© 2026 Ahorro Invisible.</p>
        </div>

        {/* Panel derecho — formulario */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
          <div style={{ width: "100%", maxWidth: 440 }}>

            {/* Logo mobile */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }} className="flex md:hidden">
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #a855f7, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 18 }}>A</div>
              <div>
                <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 16 }}>Ahorro </span>
                <span style={{ color: "#a855f7", fontWeight: 700, fontSize: 16 }}>Invisible</span>
              </div>
            </div>

            <div style={{ position: "relative", borderRadius: 20, background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", border: "1px solid rgba(51,65,85,0.6)", boxShadow: "0 25px 50px rgba(2,6,23,0.7)", overflow: "hidden", padding: "32px 28px" }}>
              <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, background: "radial-gradient(ellipse, rgba(168,85,247,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />

              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", margin: "0 0 6px" }}>Iniciar sesión</h2>
              <p style={{ fontSize: 13, color: "rgba(148,163,184,0.75)", margin: "0 0 24px", lineHeight: 1.5 }}>
                {isSupabaseConfigured ? "Accede a tu cuenta de Ahorro Invisible." : "Modo demo — accede con el email de tu registro."}
              </p>

              {/* Mode toggle */}
              {isSupabaseConfigured && (
                <div style={{ display: "flex", background: "rgba(15,23,42,0.6)", borderRadius: 10, padding: 3, marginBottom: 20, gap: 3 }}>
                  {(["password", "magic"] as Mode[]).map((m) => (
                    <button key={m} onClick={() => { setMode(m); setError(""); setInfo(""); }}
                      style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: mode === m ? "rgba(168,85,247,0.25)" : "transparent", color: mode === m ? "#c4b5fd" : "rgba(148,163,184,0.6)", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 200ms" }}>
                      {m === "password" ? "🔑 Contraseña" : "✉️ Magic link"}
                    </button>
                  ))}
                </div>
              )}

              {error && <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, fontSize: 13, color: "#fca5a5" }}>{error}</div>}
              {info  && <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.3)", borderRadius: 10, fontSize: 13, color: "#4ade80" }}>{info}</div>}

              <form onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = "rgba(168,85,247,0.5)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "rgba(51,65,85,0.55)"; }} />
                </div>

                {mode === "password" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>Contraseña</label>
                    </div>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña" style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = "rgba(168,85,247,0.5)"; }}
                      onBlur={(e) => { e.target.style.borderColor = "rgba(51,65,85,0.55)"; }} />
                  </div>
                )}

                <button type="submit" disabled={loading}
                  style={{ width: "100%", padding: "13px 0", marginTop: 4, background: loading ? "rgba(168,85,247,0.4)" : "linear-gradient(90deg, #a855f7, #2563eb)", border: "none", borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(168,85,247,0.35)", transition: "all 200ms" }}>
                  {loading ? "Procesando..." : mode === "password" ? "Entrar →" : "Enviar magic link →"}
                </button>
              </form>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20 }}>
                <div style={{ flex: 1, height: 1, background: "rgba(51,65,85,0.5)" }} />
                <span style={{ fontSize: 12, color: "rgba(100,116,139,0.5)" }}>¿Primera vez?</span>
                <div style={{ flex: 1, height: 1, background: "rgba(51,65,85,0.5)" }} />
              </div>

              <button onClick={() => router.push("/signup")}
                style={{ width: "100%", marginTop: 12, padding: "11px 0", background: "rgba(30,41,59,0.5)", border: "1px solid rgba(51,65,85,0.5)", borderRadius: 10, color: "rgba(203,213,225,0.8)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Crear cuenta gratis
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
