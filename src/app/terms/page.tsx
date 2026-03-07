"use client";

import { useRouter } from "next/navigation";

export default function TermsPage() {
  const router = useRouter();
  const DARK = {
    page: '#0f172a', card: '#1e293b', border: 'rgba(51,65,85,0.6)',
    tp: '#f1f5f9', ts: 'rgba(148,163,184,0.85)', tm: 'rgba(148,163,184,0.5)',
  };

  return (
    <div style={{ minHeight: '100vh', background: DARK.page, padding: '32px 16px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: DARK.ts, fontSize: 13, cursor: 'pointer', marginBottom: 24, padding: 0 }}>
          ← Volver
        </button>

        <h1 style={{ fontSize: 28, fontWeight: 800, color: DARK.tp, marginBottom: 4 }}>Términos de Servicio</h1>
        <p style={{ fontSize: 13, color: DARK.tm, marginBottom: 32 }}>Última actualización: marzo 2026</p>

        {[
          {
            title: '1. Aceptación de los términos',
            body: 'Al acceder y usar Ahorro Invisible, aceptas estos términos de servicio en su totalidad. Si no estás de acuerdo con alguna parte, no debes usar la aplicación.',
          },
          {
            title: '2. Descripción del servicio',
            body: 'Ahorro Invisible es una herramienta educativa de seguimiento de hábitos financieros. Su objetivo es ayudarte a tomar consciencia de tus decisiones de gasto diarias. No constituye asesoramiento financiero profesional.',
          },
          {
            title: '3. Datos y privacidad',
            body: 'Todos tus datos se almacenan localmente en tu dispositivo (localStorage). No transmitimos información personal a servidores externos. Consulta nuestra Política de Privacidad para más detalles.',
          },
          {
            title: '4. Uso aceptable',
            body: 'Te comprometes a usar la aplicación únicamente para fines personales y legítimos. No está permitido el acceso automatizado, la ingeniería inversa ni cualquier uso que perjudique a otros usuarios.',
          },
          {
            title: '5. Limitación de responsabilidad',
            body: 'Las estimaciones de ahorro son orientativas y educativas. No garantizamos resultados financieros concretos. El uso de la aplicación es bajo tu propia responsabilidad.',
          },
          {
            title: '6. Propiedad intelectual',
            body: 'Todo el contenido, diseño y código de Ahorro Invisible son propiedad de sus creadores y están protegidos por las leyes de propiedad intelectual aplicables.',
          },
          {
            title: '7. Modificaciones',
            body: 'Podemos actualizar estos términos en cualquier momento. La fecha de actualización al inicio de esta página indica cuándo se revisaron por última vez. El uso continuado de la app implica la aceptación de los términos vigentes.',
          },
          {
            title: '8. Contacto',
            body: 'Para cualquier consulta sobre estos términos, puedes contactarnos a través de los canales indicados en la aplicación.',
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
