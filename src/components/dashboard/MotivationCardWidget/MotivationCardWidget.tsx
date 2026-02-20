"use client";

import React, { useEffect } from 'react';
import { analytics } from '@/services/analytics';
import type { MotivationCardWidgetProps, MotivationIntensity } from './MotivationCardWidget.types';
import styles from './MotivationCardWidget.module.css';

const COPY: Record<MotivationIntensity, { headline: string; sub: string }> = {
  high:    { headline: 'Tu ahorro es imparable.', sub: 'Estás en racha. Cada decisión cuenta.' },
  medium:  { headline: 'Vas por buen camino.', sub: 'Sigue tomando decisiones inteligentes.' },
  low:     { headline: 'Pequeños pasos, gran impacto.', sub: 'Retoma el ritmo hoy.' },
  unknown: { headline: 'Tu ahorro es imparable.', sub: 'Empieza a tomar decisiones y verás resultados.' },
};

const INTENSITY_LABEL: Record<MotivationIntensity, string> = {
  high: '🔥 ALTA', medium: '⚡ MEDIA', low: '🌱 BAJA', unknown: '—',
};

export function MotivationCardWidget({
  intensity,
  onAdjustRules,
}: MotivationCardWidgetProps): React.ReactElement {
  useEffect(() => {
    analytics.motivationCtaClicked('pending', 'daily_question');
  }, [intensity]);

  const { headline, sub } = COPY[intensity];

  return (
    <div className={styles.card} style={{ borderRadius: 16, padding: 24 }}>
      <div className={styles.label}>Motivación del sistema</div>
      <div className={styles.intensityBadge}>
        {INTENSITY_LABEL[intensity]}
      </div>
      <p className={styles.headline}>{headline}</p>
      <p className={styles.sub}>{sub}</p>
      <button
        className={styles.adjustBtn}
        onClick={() => {
          analytics.motivationCtaClicked('pending', 'daily_question');
          onAdjustRules();
        }}
      >
        Ajustar reglas →
      </button>
    </div>
  );
}

export default MotivationCardWidget;
