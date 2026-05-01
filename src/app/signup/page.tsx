"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FormInput } from "@/components/ui/FormInput";
import { analytics } from "@/services/analytics";
import { storeInitUser } from "@/services/dashboardStore";
import { authSignUp, authSendMagicLink } from '@/services/authService';
import { isSupabaseConfigured } from '@/lib/supabase';
import { saveUserProfileToSupabase } from "@/services/syncService";
import s from './signup.module.css';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [resendInfo, setResendInfo] = useState("");
  
  useEffect(() => {
    analytics.setScreen('signup');
    try {
      const isAuthenticated = localStorage.getItem("isAuthenticated");
      if (isAuthenticated === "true") {
        const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding");
        if (hasCompletedOnboarding === "true") {
          router.replace("/dashboard");
        } else {
          router.replace("/onboarding");
        }
      }
    } catch (err) {
      console.error("Error al verificar autenticación:", err);
    }
    analytics.signupStarted();
  }, [router]);
  
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) { analytics.signupError("VALIDATION_ERROR", "Revisa el email.", "email"); setError("Revisa el email."); return; }
    if (!name)  { analytics.signupError("VALIDATION_ERROR", "Escribe tu nombre.", "name"); setError("Escribe tu nombre."); return; }
    if (!password || password.length < 8) { analytics.signupError("VALIDATION_ERROR", "Usa al menos 8 caracteres.", "password"); setError("Usa al menos 8 caracteres."); return; }

    setLoading(true);
    try {
      const { user, error: authErr } = await authSignUp(email, password, name);
      if (authErr || !user) {
        setError(authErr ?? "No se pudo crear la cuenta.");
        analytics.signupError("AUTH_ERROR", authErr ?? "unknown");
        return;
      }
      if (user.id !== 'local') {
        await saveUserProfileToSupabase(user.id, name).catch(() => null);
        storeInitUser(name.trim(), email.trim());
        analytics.signupSuccess();
        setEmailVerificationSent(true);
        return;
      }
      storeInitUser(name.trim(), email.trim());
      analytics.signupSuccess();
      router.push("/onboarding");
    } catch (err) {
      setError("No se pudo crear la cuenta. Intenta de nuevo.");
      analytics.signupError("LOCAL_STORAGE_ERROR", String(err));
    } finally {
      setLoading(false);
    }
  };

  async function handleResendVerification() {
    setResendInfo('');
    const { error: err } = await authSendMagicLink(email);
    setResendInfo(err ? `Error: ${err}` : '✅ Email reenviado. Revisa tu bandeja de entrada.');
  }

  /* ═══════════════════════════════════════════════════════
     PANTALLA: Verificación de email
     ═══════════════════════════════════════════════════════ */
  if (emailVerificationSent) {
    return (
      <div className={s.verifyPage}>
        <div className={s.verifyContainer}>
          <div className={s.verifyCard}>
            <div className={s.verifyEmoji}>✉️</div>
            <h2 className={s.verifyTitle}>Verifica tu email</h2>
            <p className={s.verifyText}>Enviamos un enlace de confirmación a:</p>
            <p className={s.verifyEmail}>{email}</p>
            <div className={s.verifyInstructions}>
              <p className={s.verifyInstructionsText}>
                Haz clic en el enlace del email para activar tu cuenta. Luego inicia sesión normalmente.
              </p>
            </div>

            {resendInfo && (
              <div className={`${s.resendAlert} ${resendInfo.startsWith('Error') ? s.resendAlertError : s.resendAlertSuccess}`}>
                {resendInfo}
              </div>
            )}

            <button onClick={() => router.push('/login')} className={s.submitBtn}>
              Ir al login →
            </button>
            <button onClick={handleResendVerification} className={s.resendBtn}>
              ¿No recibiste el email? Reenviar
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     PANTALLA: Formulario de registro
     ═══════════════════════════════════════════════════════ */
  return (
    <div className={s.page}>
      <div className={s.glowPurple} />
      <div className={s.glowBlue} />

      <div className={s.layout}>
        {/* ── Panel izquierdo: branding ── */}
        <div className={s.brandPanel}>
          <div className={s.glowInner} />

          <div className={s.logo}>
            <div className={s.logoMark}>A</div>
            <div>
              <span className={s.logoName}>Ahorro </span>
              <span className={s.logoPurple}>Invisible</span>
            </div>
          </div>

          <div>
            <div className={s.claimPill}>✦ Ahorro inteligente</div>
            <h1 className={s.claimTitle}>
              Tu dinero crece<br />
              <span className={s.claimGradient}>sin que te des cuenta.</span>
            </h1>
            <p className={s.claimSub}>
              Pequeñas decisiones diarias.<br />Grandes resultados a largo plazo.
            </p>

            <div className={s.features}>
              {[
                { icon: '🎯', text: 'Define objetivos y sigue tu progreso' },
                { icon: '⚡', text: 'Decisiones diarias que generan ahorro real' },
                { icon: '📈', text: 'Visualiza tu evolución en el tiempo' },
              ].map((f) => (
                <div key={f.text} className={s.featureItem}>
                  <span className={s.featureIcon}>{f.icon}</span>
                  <span className={s.featureText}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className={s.copyright}>© 2026 Ahorro Invisible. Todos los derechos reservados.</p>
        </div>

        {/* ── Panel derecho: formulario ── */}
        <div className={s.formPanel}>
          <div className={s.formContainer}>

            {/* Logo mobile */}
            <div className={s.logoMobile}>
              <div className={s.logoMobileMark}>A</div>
              <div>
                <span className={s.logoMobileName}>Ahorro </span>
                <span className={s.logoMobilePurple}>Invisible</span>
              </div>
            </div>

            {/* Card */}
            <div className={s.card}>
              <div className={s.cardGlow} />

              <div className={s.stepHeader}>
                <div className={s.stepIcon}>✨</div>
                <span className={s.stepLabel}>PASO 1 DE 4 · REGISTRO</span>
              </div>

              <h2 className={s.cardTitle}>Crea tu cuenta</h2>
              <p className={s.cardSub}>Comienza a ahorrar sin darte cuenta.</p>

              {error && <div className={s.errorAlert}>{error}</div>}

              <form onSubmit={handleSubmit} className={s.form}>
                <FormInput
                  variant="auth"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                />

                <FormInput
                  variant="auth"
                  label="Nombre"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                />

                <FormInput
                  variant="auth"
                  label="Contraseña"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                />

                <button type="submit" disabled={loading} className={s.submitBtn}>
                  {loading ? 'Creando cuenta...' : (isSupabaseConfigured ? 'Crear cuenta →' : 'Empezar →')}
                </button>
              </form>

              <p className={s.legal}>
                Al registrarte aceptas nuestros{' '}
                <a href="/terms" className={s.legalLink}>Términos de servicio</a>
                {' '}y{' '}
                <a href="/privacy" className={s.legalLink}>Política de privacidad</a>
              </p>

              <div className={s.divider}>
                <div className={s.dividerLine} />
                <span className={s.dividerText}>¿Ya tienes cuenta?</span>
                <div className={s.dividerLine} />
              </div>

              <button onClick={() => router.push('/login')} className={s.secondaryBtn}>
                Iniciar sesión →
              </button>
            </div>

            <p className={s.footerHint}>Solo 3 preguntas más y estarás listo ✨</p>
          </div>
        </div>
      </div>
    </div>
  );
}
