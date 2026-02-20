"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { buildSummary, storeUpdateUserName } from '@/services/dashboardStore';

export default function ProfilePage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [incomeLabel, setIncomeLabel] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analytics.setScreen('profile');
    const isAuth = localStorage.getItem('isAuthenticated');
    if (isAuth !== 'true') { router.replace('/signup'); return; }
    const summary = buildSummary('30d');
    setUserName(summary.userName);
    const storedEmail = localStorage.getItem('userEmail') ?? '';
    setEmail(storedEmail);
    if (summary.incomeRange) {
      setIncomeLabel(`${summary.incomeRange.min.toLocaleString('es-ES')}€ – ${summary.incomeRange.max.toLocaleString('es-ES')}€`);
    }
    analytics.profileViewed();
    setLoading(false);
  }, [router]);

  const handleSave = () => {
    if (!userName.trim()) return;
    storeUpdateUserName(userName.trim());
    analytics.profileUpdated(['userName']);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('hasCompletedOnboarding');
    router.replace('/signup');
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}><span style={{ color: '#9ca3af' }}>Cargando...</span></div>;
  }

  const card: React.CSSProperties = { background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 };
  const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 };
  const input: React.CSSProperties = { width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111827' };

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '24px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 20 }}>← Dashboard</button>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 24 }}>Mi Perfil</h1>

        {/* Información personal */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Información personal</h2>

          {saved && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#166534', fontWeight: 600 }}>
              ✓ Cambios guardados
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={label}>Nombre</label>
            <input value={userName} onChange={e => setUserName(e.target.value)} style={input} placeholder="Tu nombre" />
          </div>

          {email && (
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Email</label>
              <input value={email} disabled style={{ ...input, background: '#f9fafb', color: '#9ca3af', cursor: 'not-allowed' }} />
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>El email no se puede modificar</p>
            </div>
          )}

          {incomeLabel && (
            <div style={{ marginBottom: 16 }}>
              <label style={label}>Rango de ingresos</label>
              <div style={{ ...input, background: '#f9fafb', color: '#374151', display: 'flex', alignItems: 'center' }}>{incomeLabel}</div>
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Cámbialo en el widget de ingresos del dashboard</p>
            </div>
          )}

          <button
            onClick={handleSave}
            style={{ padding: '11px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Guardar cambios
          </button>
        </div>

        {/* Estado cuenta */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 14 }}>Cuenta</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <span style={{ width: 8, height: 8, background: '#22c55e', borderRadius: '50%', display: 'inline-block' }} />
            <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>Cuenta activa</span>
          </div>
          <button onClick={handleLogout} style={{ padding: '10px 20px', background: 'transparent', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, cursor: 'pointer', color: '#6b7280', fontWeight: 500 }}>
            Cerrar sesión
          </button>
        </div>

        {/* Ajustes rápidos */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 14 }}>Accesos rápidos</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => router.push('/settings')} style={{ textAlign: 'left', padding: '12px 16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer', fontSize: 14, color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
              <span>⚙️ Configuración avanzada</span><span style={{ color: '#9ca3af' }}>→</span>
            </button>
            <button onClick={() => router.push('/goals')} style={{ textAlign: 'left', padding: '12px 16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer', fontSize: 14, color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
              <span>🎯 Mis objetivos</span><span style={{ color: '#9ca3af' }}>→</span>
            </button>
            <button onClick={() => router.push('/history')} style={{ textAlign: 'left', padding: '12px 16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer', fontSize: 14, color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
              <span>📊 Historial</span><span style={{ color: '#9ca3af' }}>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
