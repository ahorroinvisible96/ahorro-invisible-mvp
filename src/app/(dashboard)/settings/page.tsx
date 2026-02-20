"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { buildSummary, storeResetAllData, storeExportData, storeUpdateIncome } from '@/services/dashboardStore';
import type { IncomeRange } from '@/types/Dashboard';

const INCOME_OPTIONS: { label: string; range: IncomeRange }[] = [
  { label: 'Menos de 1.000€', range: { min: 0, max: 1000, currency: 'EUR' } },
  { label: '1.000€ – 1.500€', range: { min: 1000, max: 1500, currency: 'EUR' } },
  { label: '1.500€ – 2.500€', range: { min: 1500, max: 2500, currency: 'EUR' } },
  { label: '2.500€ – 4.000€', range: { min: 2500, max: 4000, currency: 'EUR' } },
  { label: '4.000€ – 6.000€', range: { min: 4000, max: 6000, currency: 'EUR' } },
  { label: 'Más de 6.000€',   range: { min: 6000, max: 12000, currency: 'EUR' } },
];

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedIncome, setSelectedIncome] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    analytics.setScreen('settings');
    const isAuth = localStorage.getItem('isAuthenticated');
    if (isAuth !== 'true') { router.replace('/signup'); return; }
    analytics.settingsViewed();
    const summary = buildSummary('30d');
    if (summary.incomeRange) {
      const match = INCOME_OPTIONS.find(o => o.range.min === summary.incomeRange!.min);
      setSelectedIncome(match?.label ?? '');
    }
    setLoading(false);
  }, [router]);

  const showMsg = (msg: string) => { setSavedMsg(msg); setTimeout(() => setSavedMsg(''), 3000); };

  const handleSaveIncome = () => {
    const opt = INCOME_OPTIONS.find(o => o.label === selectedIncome);
    if (!opt) return;
    storeUpdateIncome(opt.range);
    analytics.settingsUpdated();
    showMsg('✓ Rango de ingresos actualizado');
  };

  const handleExport = () => {
    const data = storeExportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ahorro-invisible-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMsg('✓ Datos exportados');
  };

  const handleResetOnboarding = () => {
    analytics.onboardingReset();
    localStorage.removeItem('hasCompletedOnboarding');
    localStorage.removeItem('onboarding_income_range');
    router.replace('/onboarding');
  };

  const handleResetAll = () => {
    if (!window.confirm('⚠️ Esto borrará TODOS tus objetivos, decisiones y datos. Esta acción no se puede deshacer. ¿Continuar?')) return;
    storeResetAllData();
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('hasCompletedOnboarding');
    router.replace('/signup');
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
  const sectionTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 14 };
  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6' };

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '24px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 20 }}>← Dashboard</button>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 24 }}>Configuración</h1>

        {savedMsg && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#166534', fontWeight: 600 }}>{savedMsg}</div>
        )}

        {/* Rango de ingresos */}
        <div style={card}>
          <h2 style={sectionTitle}>Rango de ingresos</h2>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>Ajusta el impacto de tus decisiones según tu nivel de ingresos.</p>
          <select
            value={selectedIncome}
            onChange={e => setSelectedIncome(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, color: '#111827', background: '#fff', marginBottom: 14, cursor: 'pointer', outline: 'none' }}
          >
            <option value="">Sin especificar</option>
            {INCOME_OPTIONS.map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
          </select>
          <button onClick={handleSaveIncome} disabled={!selectedIncome} style={{ padding: '10px 20px', background: selectedIncome ? '#2563eb' : '#e5e7eb', color: selectedIncome ? '#fff' : '#9ca3af', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: selectedIncome ? 'pointer' : 'not-allowed' }}>
            Guardar
          </button>
        </div>

        {/* Notificaciones */}
        <div style={card}>
          <h2 style={sectionTitle}>Notificaciones</h2>
          <div style={rowStyle}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#374151', margin: 0 }}>Recordatorio diario</p>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>Para no olvidar tu decisión del día</p>
            </div>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Próximamente</span>
          </div>
          <div style={{ ...rowStyle, borderBottom: 'none' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#374151', margin: 0 }}>Resumen semanal</p>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>Progreso de la semana</p>
            </div>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Próximamente</span>
          </div>
        </div>

        {/* Datos */}
        <div style={card}>
          <h2 style={sectionTitle}>Mis datos</h2>
          <div style={rowStyle}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#374151', margin: 0 }}>Exportar datos</p>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>Descarga un JSON con todos tus datos</p>
            </div>
            <button onClick={handleExport} style={{ padding: '7px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#374151', fontWeight: 500 }}>Exportar</button>
          </div>
          <div style={{ ...rowStyle, borderBottom: 'none' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#374151', margin: 0 }}>Reiniciar onboarding</p>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>Vuelve al proceso de configuración inicial</p>
            </div>
            <button onClick={handleResetOnboarding} style={{ padding: '7px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#374151', fontWeight: 500 }}>Reiniciar</button>
          </div>
        </div>

        {/* Sesión */}
        <div style={card}>
          <h2 style={sectionTitle}>Sesión</h2>
          <button onClick={handleLogout} style={{ width: '100%', padding: '12px 0', background: 'transparent', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, cursor: 'pointer', color: '#374151', fontWeight: 500, marginBottom: 10 }}>
            Cerrar sesión
          </button>
        </div>

        {/* Zona peligro */}
        <div style={{ ...card, border: '1.5px solid #fecaca' }}>
          <h2 style={{ ...sectionTitle, color: '#dc2626' }}>Zona de peligro</h2>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>Esta acción borrará <strong>todos</strong> tus datos permanentemente: objetivos, historial y configuración.</p>
          <button onClick={handleResetAll} style={{ padding: '10px 20px', background: 'transparent', border: '1.5px solid #dc2626', borderRadius: 10, fontSize: 14, cursor: 'pointer', color: '#dc2626', fontWeight: 600 }}>
            Borrar todos los datos
          </button>
        </div>
      </div>
    </div>
  );
}
