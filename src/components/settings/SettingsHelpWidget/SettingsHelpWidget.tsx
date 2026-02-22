"use client";

import React, { useState } from 'react';
import styles from './SettingsHelpWidget.module.css';

const FAQS = [
  {
    q: '¿Cómo funciona la decisión diaria?',
    a: 'Cada día se te presenta una pregunta sobre un gasto cotidiano. Según tu respuesta, se calcula cuánto podrías ahorrar y se asigna al objetivo que elijas.',
  },
  {
    q: '¿Puedo tener varios objetivos de ahorro?',
    a: 'Sí. Puedes crear tantos objetivos como quieras desde la sección "Objetivos". Uno de ellos será el principal y recibirá las decisiones diarias por defecto.',
  },
  {
    q: '¿Qué es un ahorro extra?',
    a: 'Es un ahorro puntual que puedes registrar manualmente, independiente de la decisión diaria. Útil para ingresos inesperados o ahorros adicionales.',
  },
  {
    q: '¿Los datos se guardan en la nube?',
    a: 'Actualmente todos los datos se almacenan localmente en tu dispositivo. Puedes exportarlos desde "Mis datos" para hacer una copia de seguridad.',
  },
  {
    q: '¿Cómo se calcula el ahorro mensual proyectado?',
    a: 'Se extrapola el ahorro registrado en el periodo seleccionado a 30 días, ponderando la frecuencia de tus decisiones.',
  },
];

export function SettingsHelpWidget(): React.ReactElement {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function toggle(i: number) {
    setOpenIndex(openIndex === i ? null : i);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.bgGradient} />
      <div className={styles.glowPurple} />
      <div className={styles.borderLayer} />

      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h2 className={styles.title}>Ayuda y FAQs</h2>
        </div>

        <div className={styles.faqList}>
          {FAQS.map((faq, i) => (
            <div key={i} className={styles.faqItem}>
              <button className={styles.faqQuestion} onClick={() => toggle(i)}>
                <span className={styles.faqQuestionText}>{faq.q}</span>
                <span className={`${styles.faqChevron} ${openIndex === i ? styles.faqChevronOpen : ''}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </span>
              </button>
              {openIndex === i && (
                <div className={styles.faqAnswer}>{faq.a}</div>
              )}
            </div>
          ))}
        </div>

        <div className={styles.versionRow}>
          <span className={styles.versionText}>Ahorro Invisible</span>
          <span className={styles.versionBadge}>v1.1.0</span>
        </div>
      </div>
    </div>
  );
}

export default SettingsHelpWidget;
