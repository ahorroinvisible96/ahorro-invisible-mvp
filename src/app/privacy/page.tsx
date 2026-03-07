"use client";

import { useRouter } from "next/navigation";

export default function PrivacyPage() {
  const router = useRouter();
  const DARK = {
    page: '#0f172a', card: '#1e293b', border: 'rgba(51,65,85,0.6)',
    tp: '#f1f5f9', ts: 'rgba(148,163,184,0.85)', tm: 'rgba(148,163,184,0.5)',
    green: { bg: 'rgba(22,163,74,0.1)', border: 'rgba(22,163,74,0.25)', text: '#4ade80' },
  };

  return (
    <div style={{ minHeight: '100vh', background: DARK.page, padding: '32px 16px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: DARK.ts, fontSize: 13, cursor: 'pointer', marginBottom: 24, padding: 0 }}>
          ← Volver
        </button>

        <h1 style={{ fontSize: 28, fontWeight: 800, color: DARK.tp, marginBottom: 4 }}>Política de Privacidad</h1>
        <p style={{ fontSize: 13, color: DARK.tm, marginBottom: 24 }}>Última actualización: marzo 2026</p>

        {/* Privacy-first badge */}
        <div style={{ background: DARK.green.bg, border: `1px solid ${DARK.green.border}`, borderRadius: 14, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🔒</span>
          <p style={{ fontSize: 14, color: DARK.green.text, fontWeight: 600, margin: 0 }}>Privacy-first: todos tus datos se quedan en tu dispositivo. No hay servidores ni cuentas en la nube.</p>
        </div>

        {[
          {
            title: '1. Datos que recopilamos',
            body: 'Ahorro Invisible almacena únicamente datos que tú introduces directamente: nombre de usuario, objetivos de ahorro, decisiones diarias y preferencias. Estos datos residen exclusivamente en el localStorage de tu navegador o dispositivo.',
          },
          {
            title: '2. Dónde se almacenan tus datos',
            body: 'Todos los datos se guardan de forma local en tu dispositivo bajo la clave "ahorro_invisible_dashboard_v1" en el almacenamiento local del navegador. No se transmiten a ningún servidor externo. Si limpias el almacenamiento del navegador, perderás tus datos de forma irreversible.',
          },
          {
            title: '3. Datos de analítica',
            body: 'Registramos eventos de uso (pantallas visitadas, acciones realizadas) también localmente en tu dispositivo bajo la clave "analyticsEvents" con un máximo de 200 entradas. Esta información no sale de tu dispositivo y se usa para mejorar tu experiencia dentro de la app.',
          },
          {
            title: '4. Cookies y tecnologías similares',
            body: 'No utilizamos cookies de terceros ni tecnologías de rastreo externas. El almacenamiento local (localStorage) que usamos es exclusivamente funcional y no contiene identificadores de seguimiento.',
          },
          {
            title: '5. Compartición de datos',
            body: 'No compartimos, vendemos ni transferimos ningún dato tuyo a terceros. No hay integración con redes sociales, publicidad ni plataformas de análisis externas en este MVP.',
          },
          {
            title: '6. Tus derechos',
            body: 'Tienes control total sobre tus datos. Puedes exportarlos desde la sección de Configuración, borrarlos en cualquier momento borrando el almacenamiento del navegador, o usar la opción "Borrar todos los datos" dentro de la aplicación.',
          },
          {
            title: '7. Seguridad',
            body: 'Dado que los datos residen en tu dispositivo local, su seguridad depende de la seguridad de tu dispositivo. Recomendamos no compartir tu dispositivo con personas no autorizadas si usas esta aplicación.',
          },
          {
            title: '8. Menores de edad',
            body: 'Esta aplicación no está dirigida a menores de 16 años. No recopilamos conscientemente datos de menores.',
          },
          {
            title: '9. Cambios en esta política',
            body: 'Cualquier cambio en esta política de privacidad se reflejará en la fecha de actualización al inicio de esta página. Te recomendamos revisarla periódicamente.',
          },
        ].map((section) => (
          <div key={section.title} style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 16, padding: '20px 24px', marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: DARK.tp, marginBottom: 8 }}>{section.title}</h2>
            <p style={{ fontSize: 14, color: DARK.ts, lineHeight: 1.7, margin: 0 }}>{section.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
