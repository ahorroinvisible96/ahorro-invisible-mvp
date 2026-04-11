"use client";

import React, { useState } from 'react';
import styles from './SettingsHelpWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';
import { HelpIcon, ChevronDownIcon } from '@/components/ui/AppIcons';

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
  const { collapsed, toggle: toggleCollapse } = useWidgetCollapse('settings_help', false);

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
            <HelpIcon size={16} />
          </div>
          <h2 className={styles.title} style={{ flex: 1 }}>Ayuda y FAQs</h2>
          <CollapseChevron collapsed={collapsed} onToggle={toggleCollapse} />
        </div>

        {!collapsed && <div className={styles.faqList}>
          {FAQS.map((faq, i) => (
            <div key={i} className={styles.faqItem}>
              <button className={styles.faqQuestion} onClick={() => toggle(i)}>
                <span className={styles.faqQuestionText}>{faq.q}</span>
                <span className={`${styles.faqChevron} ${openIndex === i ? styles.faqChevronOpen : ''}`}>
                  <ChevronDownIcon size={14} />
                </span>
              </button>
              {openIndex === i && (
                <div className={styles.faqAnswer}>{faq.a}</div>
              )}
            </div>
          ))}
        </div>}

        {!collapsed && <div className={styles.versionRow}>
          <span className={styles.versionText}>Ahorro Invisible</span>
          <span className={styles.versionBadge}>v1.1.0</span>
        </div>}
      </div>
    </div>
  );
}

export default SettingsHelpWidget;
