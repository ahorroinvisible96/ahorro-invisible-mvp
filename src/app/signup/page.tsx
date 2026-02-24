"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button/Button";
import { Card } from "@/components/ui/Card/Card";
import { FormInput } from "@/components/ui/FormInput";
import { analytics } from "@/services/analytics";
import { storeInitUser } from "@/services/dashboardStore";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  useEffect(() => {
    // Establecer el nombre de la pantalla para analytics
    analytics.setScreen('signup');
    
    try {
      // Verificar si ya está autenticado
      const isAuthenticated = localStorage.getItem("isAuthenticated");
      if (isAuthenticated === "true") {
        // Verificar si ya completó el onboarding
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
    
    // Registrar evento de inicio de signup
    analytics.signupStarted();
  }, [router]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Validaciones
    if (!email) {
      setError("Revisa el email.");
      analytics.signupError("VALIDATION_ERROR", "Revisa el email.", "email");
      return;
    }
    
    if (!name) {
      setError("Escribe tu nombre.");
      analytics.signupError("VALIDATION_ERROR", "Escribe tu nombre.", "name");
      return;
    }
    
    if (!password || password.length < 8) {
      setError("Usa al menos 8 caracteres.");
      analytics.signupError("VALIDATION_ERROR", "Usa al menos 8 caracteres.", "password");
      return;
    }
    
    try {
      // Guardar datos del usuario en localStorage (claves legacy)
      localStorage.setItem("userName", name);
      localStorage.setItem("userEmail", email);
      localStorage.setItem("isAuthenticated", "true");
      
      // Inicializar el store con nombre y email reales
      storeInitUser(name.trim(), email.trim());
      
      // Registrar evento de signup exitoso
      analytics.signupSuccess();
      
      // Redirigir al onboarding
      router.push("/onboarding");
    } catch (err) {
      console.error("Error al registrar usuario:", err);
      setError("No se pudo crear la cuenta. Intenta de nuevo.");
      
      // Registrar evento de error
      analytics.signupError("LOCAL_STORAGE_ERROR", String(err));
    }
  };
  
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(51,65,85,0.55)',
    borderRadius: 10,
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: 500,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-geist-sans, Arial, sans-serif)',
    transition: 'border-color 180ms ease',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(148,163,184,0.6)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 6,
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      fontFamily: 'var(--font-geist-sans, Arial, sans-serif)',
    }}>
      {/* Glow decorativo fijo */}
      <div style={{
        position: 'fixed', top: '15%', left: '25%',
        width: 500, height: 500,
        background: 'radial-gradient(ellipse, rgba(168,85,247,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '10%', right: '20%',
        width: 400, height: 400,
        background: 'radial-gradient(ellipse, rgba(37,99,235,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* ── Layout completo responsive ── */}
      <div style={{ display: 'flex', width: '100%', minHeight: '100vh' }}>

        {/* Panel izquierdo — solo ≥ md */}
        <div style={{
          flex: '0 0 50%',
          padding: '48px',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRight: '1px solid rgba(51,65,85,0.3)',
          position: 'relative',
          overflow: 'hidden',
        }} className="hidden md:flex">
          {/* Glow interior */}
          <div style={{
            position: 'absolute', top: -80, left: -80,
            width: 360, height: 360,
            background: 'radial-gradient(ellipse, rgba(168,85,247,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #a855f7, #2563eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 20,
              boxShadow: '0 4px 16px rgba(168,85,247,0.45)',
              flexShrink: 0,
            }}>A</div>
            <div>
              <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 18 }}>Ahorro </span>
              <span style={{ color: '#a855f7', fontWeight: 700, fontSize: 18 }}>Invisible</span>
            </div>
          </div>

          {/* Claim principal */}
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 14px',
              background: 'rgba(168,85,247,0.12)',
              border: '1px solid rgba(168,85,247,0.25)',
              borderRadius: 999,
              marginBottom: 24,
            }}>
              <span style={{ fontSize: 13, color: '#c4b5fd', fontWeight: 600 }}>
                ✦ Ahorro inteligente
              </span>
            </div>
            <h1 style={{
              fontSize: 36, fontWeight: 800,
              color: '#f1f5f9', lineHeight: 1.2,
              margin: '0 0 16px',
            }}>
              Tu dinero crece<br />
              <span style={{ background: 'linear-gradient(90deg, #a855f7, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                sin que te des cuenta.
              </span>
            </h1>
            <p style={{ fontSize: 16, color: 'rgba(148,163,184,0.75)', lineHeight: 1.6, margin: 0 }}>
              Pequeñas decisiones diarias.<br />Grandes resultados a largo plazo.
            </p>

            {/* Feature pills */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 36 }}>
              {[
                { icon: '🎯', text: 'Define objetivos y sigue tu progreso' },
                { icon: '⚡', text: 'Decisiones diarias que generan ahorro real' },
                { icon: '📈', text: 'Visualiza tu evolución en el tiempo' },
              ].map((f) => (
                <div key={f.text} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(51,65,85,0.4)',
                  borderRadius: 12,
                }}>
                  <span style={{ fontSize: 18 }}>{f.icon}</span>
                  <span style={{ fontSize: 14, color: 'rgba(203,213,225,0.85)', fontWeight: 500 }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontSize: 12, color: 'rgba(100,116,139,0.6)', margin: 0 }}>
            © 2026 Ahorro Invisible. Todos los derechos reservados.
          </p>
        </div>

        {/* ── Panel derecho — formulario ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
        }}>
          <div style={{ width: '100%', maxWidth: 440 }}>

            {/* Logo mobile */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              marginBottom: 32,
            }} className="flex md:hidden">
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #a855f7, #2563eb)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800, fontSize: 18,
                boxShadow: '0 4px 14px rgba(168,85,247,0.4)',
              }}>A</div>
              <div>
                <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16 }}>Ahorro </span>
                <span style={{ color: '#a855f7', fontWeight: 700, fontSize: 16 }}>Invisible</span>
              </div>
            </div>

            {/* Card */}
            <div style={{
              position: 'relative',
              borderRadius: 20,
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              border: '1px solid rgba(51,65,85,0.6)',
              boxShadow: '0 25px 50px rgba(2,6,23,0.7)',
              overflow: 'hidden',
              padding: '32px 28px',
            }}>
              {/* Glow interior */}
              <div style={{
                position: 'absolute', top: -40, right: -40,
                width: 200, height: 200,
                background: 'radial-gradient(ellipse, rgba(168,85,247,0.1) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'linear-gradient(135deg, #a855f7, #2563eb)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0,
                  boxShadow: '0 4px 14px rgba(168,85,247,0.3)',
                }}>✨</div>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: 'rgba(148,163,184,0.7)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}>PASO 1 DE 4 · REGISTRO</span>
              </div>

              <h2 style={{
                fontSize: 22, fontWeight: 800,
                color: '#f1f5f9', margin: '0 0 6px',
              }}>Crea tu cuenta</h2>
              <p style={{
                fontSize: 13, color: 'rgba(148,163,184,0.75)',
                margin: '0 0 28px', lineHeight: 1.5,
              }}>
                Comienza a ahorrar sin darte cuenta.
              </p>

              {/* Error */}
              {error && (
                <div style={{
                  marginBottom: 20,
                  padding: '10px 14px',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 10,
                  fontSize: 13, color: '#fca5a5',
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(168,85,247,0.5)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(51,65,85,0.55)'; }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Nombre</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(168,85,247,0.5)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(51,65,85,0.55)'; }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(168,85,247,0.5)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(51,65,85,0.55)'; }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    width: '100%', padding: '13px 0', marginTop: 4,
                    background: 'linear-gradient(90deg, #a855f7, #2563eb)',
                    border: 'none', borderRadius: 10,
                    color: '#fff', fontSize: 15, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: '0 4px 14px rgba(168,85,247,0.35)',
                    transition: 'all 200ms ease',
                  }}
                >
                  Crear cuenta →
                </button>

              </form>

              <p style={{
                textAlign: 'center', marginTop: 20,
                fontSize: 12, color: 'rgba(100,116,139,0.6)',
                lineHeight: 1.5,
              }}>
                Al registrarte aceptas nuestros{' '}
                <a href="#" style={{ color: '#a78bfa', textDecoration: 'none' }}>Términos de servicio</a>
                {' '}y{' '}
                <a href="#" style={{ color: '#a78bfa', textDecoration: 'none' }}>Política de privacidad</a>
              </p>
            </div>

            <p style={{
              textAlign: 'center', marginTop: 20,
              fontSize: 13, color: 'rgba(148,163,184,0.4)',
            }}>
              Solo 3 preguntas más y estarás listo ✨
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
