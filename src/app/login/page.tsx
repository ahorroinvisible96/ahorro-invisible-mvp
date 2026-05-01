"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FormInput } from "@/components/ui/FormInput";
import { analytics } from "@/services/analytics";
import { authSignIn, authSendMagicLink, authResetPassword } from "@/services/authService";
import { isSupabaseConfigured } from "@/lib/supabase";
import { hasLocalDataToMigrate, pushLocalDataToSupabase, pullDataFromSupabase } from "@/services/syncService";
import s from './login.module.css';

type Mode = "password" | "magic" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
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

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setInfo("");
    if (!email) { setError("Introduce tu email."); return; }
    if (!password) { setError("Introduce tu contraseña."); return; }

    setLoading(true);
    const { user, error: authErr } = await authSignIn(email, password, remember);
    setLoading(false);

    if (authErr || !user) { setError(authErr ?? "Error al iniciar sesión"); return; }

    if (isSupabaseConfigured && user.id !== "local") {
      if (hasLocalDataToMigrate()) {
        pushLocalDataToSupabase(user.id).catch(() => null);
      } else {
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

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setInfo("");
    if (!email) { setError("Introduce tu email."); return; }
    setLoading(true);
    const { error: resetErr } = await authResetPassword(email);
    setLoading(false);
    if (resetErr) { setError(resetErr); return; }
    setInfo("✅ Email enviado. Revisa tu bandeja de entrada y sigue las instrucciones para cambiar tu contraseña.");
  }

  return (
    <div className={s.page}>
      <div className={s.glowPurple} />
      <div className={s.glowBlue} />

      <div className={s.layout}>
        {/* ── Panel izquierdo ── */}
        <div className={s.brandPanel}>
          <div className={s.logo}>
            <div className={s.logoMark}>A</div>
            <div>
              <span className={s.logoName}>Ahorro </span>
              <span className={s.logoPurple}>Invisible</span>
            </div>
          </div>

          <div>
            <h1 className={s.claimTitle}>
              Bienvenido de<br />
              <span className={s.claimGradient}>vuelta.</span>
            </h1>
            <p className={s.claimSub}>
              Tu racha te espera.<br />Un hábito no se rompe en un día.
            </p>
            <div className={s.features}>
              {[
                { icon: "🔒", text: "Tus datos están seguros y cifrados" },
                { icon: "📱", text: "Accede desde cualquier dispositivo" },
                { icon: "🔄", text: "Sincronización automática en la nube" },
              ].map((f) => (
                <div key={f.text} className={s.featureItem}>
                  <span className={s.featureIcon}>{f.icon}</span>
                  <span className={s.featureText}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className={s.copyright}>© 2026 Ahorro Invisible.</p>
        </div>

        {/* ── Panel derecho ── */}
        <div className={s.formPanel}>
          <div className={s.formContainer}>
            <div className={s.logoMobile}>
              <div className={s.logoMobileMark}>A</div>
              <div>
                <span className={s.logoMobileName}>Ahorro </span>
                <span className={s.logoMobilePurple}>Invisible</span>
              </div>
            </div>

            <div className={s.card}>
              <div className={s.cardGlow} />

              <h2 className={s.cardTitle}>Iniciar sesión</h2>
              <p className={s.cardSub}>
                {isSupabaseConfigured ? "Accede a tu cuenta de Ahorro Invisible." : "Modo demo — accede con el email de tu registro."}
              </p>

              {/* Mode toggle */}
              {isSupabaseConfigured && mode !== "reset" && (
                <div className={s.modeToggle}>
                  {(["password", "magic"] as Mode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => { setMode(m); setError(""); setInfo(""); }}
                      className={`${s.modeBtn} ${mode === m ? s.modeBtnActive : ''}`}
                    >
                      {m === "password" ? "🔑 Contraseña" : "✉️ Magic link"}
                    </button>
                  ))}
                </div>
              )}

              {/* Reset header */}
              {mode === "reset" && (
                <div style={{ marginBottom: 20 }}>
                  <button onClick={() => { setMode("password"); setError(""); setInfo(""); }} className={s.backBtn}>
                    ← Volver al login
                  </button>
                  <h3 className={s.resetTitle}>Recuperar contraseña</h3>
                  <p className={s.resetSub}>Te enviaremos un enlace para restablecerla.</p>
                </div>
              )}

              {error && <div className={s.errorAlert}>{error}</div>}
              {info && <div className={s.infoAlert}>{info}</div>}

              <form
                onSubmit={mode === "password" ? handlePasswordLogin : mode === "magic" ? handleMagicLink : handleResetPassword}
                className={s.form}
              >
                <FormInput
                  variant="auth"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                />

                {mode === "password" && (
                  <div>
                    <div className={s.passwordRow}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Contraseña
                      </label>
                      {isSupabaseConfigured && (
                        <button type="button" onClick={() => { setMode("reset"); setError(""); setInfo(""); }} className={s.forgotLink}>
                          ¿Olvidaste tu contraseña?
                        </button>
                      )}
                    </div>
                    <FormInput
                      variant="auth"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Tu contraseña"
                    />
                  </div>
                )}

                {mode === "password" && (
                  <label className={s.checkboxLabel}>
                    <div
                      onClick={() => setRemember((r) => !r)}
                      className={`${s.checkboxBox} ${remember ? s.checkboxBoxChecked : s.checkboxBoxUnchecked}`}
                    >
                      {remember && (
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className={s.checkboxText}>Recuérdame en este dispositivo</span>
                  </label>
                )}

                <button type="submit" disabled={loading} className={s.submitBtn}>
                  {loading ? "Procesando..." : mode === "password" ? "Entrar →" : mode === "magic" ? "Enviar magic link →" : "Enviar instrucciones →"}
                </button>
              </form>

              <div className={s.divider}>
                <div className={s.dividerLine} />
                <span className={s.dividerText}>¿Primera vez?</span>
                <div className={s.dividerLine} />
              </div>

              <button onClick={() => router.push("/signup")} className={s.secondaryBtn}>
                Crear cuenta gratis
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
