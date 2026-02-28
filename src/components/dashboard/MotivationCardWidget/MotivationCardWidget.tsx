"use client";

import React, { useEffect } from 'react';
import { analytics } from '@/services/analytics';
import type { MotivationCardWidgetProps, MotivationIntensity, MotivationLevel } from './MotivationCardWidget.types';
import styles from './MotivationCardWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';

// ── Iconos SVG inline ────────────────────────────────────────────────────────
function FlameIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2c0 0-6 5.686-6 10a6 6 0 0 0 12 0c0-4.314-6-10-6-10zm0 16a4 4 0 0 1-4-4c0-2.343 2.5-5.893 4-8.028C13.5 8.107 16 11.657 16 14a4 4 0 0 1-4 4z"/>
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}

function TrendingUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

// ── Lógica de niveles ────────────────────────────────────────────────────────
interface LevelConfig {
  level: MotivationLevel;
  label: string;
  emoji: string;
  minSaved: number;   // euros mínimos para este nivel
  nextMin: number;    // euros para el siguiente nivel (0 = máximo)
  color: string;      // clase CSS
}

const LEVELS: LevelConfig[] = [
  { level: 'bronze',  label: 'Bronce',   emoji: '🥉', minSaved: 0,    nextMin: 500,  color: 'bronze'  },
  { level: 'silver',  label: 'Plata',    emoji: '🥈', minSaved: 500,  nextMin: 2000, color: 'silver'  },
  { level: 'gold',    label: 'Oro',      emoji: '🥇', minSaved: 2000, nextMin: 5000, color: 'gold'    },
  { level: 'diamond', label: 'Diamante', emoji: '💎', minSaved: 5000, nextMin: 0,    color: 'diamond' },
];

function getLevel(totalSaved: number): LevelConfig {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalSaved >= LEVELS[i].minSaved) return LEVELS[i];
  }
  return LEVELS[0];
}

function getLevelProgress(totalSaved: number, cfg: LevelConfig): number {
  if (cfg.nextMin === 0) return 100;
  const range = cfg.nextMin - cfg.minSaved;
  const progress = totalSaved - cfg.minSaved;
  return Math.min(100, Math.round((progress / range) * 100));
}

function formatEUR(v: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

// ── Copy por intensidad ──────────────────────────────────────────────────────
const COPY: Record<MotivationIntensity, { headline: string; sub: string }> = {
  high:    { headline: 'Tu ahorro es imparable.', sub: 'Estás en racha. Cada decisión suma.' },
  medium:  { headline: 'Vas por buen camino.', sub: 'Sigue tomando decisiones inteligentes.' },
  low:     { headline: 'Pequeños pasos, gran impacto.', sub: 'Retoma el ritmo hoy.' },
  unknown: { headline: 'Empieza tu racha hoy.', sub: 'Cada decisión te acerca a tu objetivo.' },
};

// Copy adicional según relación con el dinero del onboarding
const MONEY_FEELING_HINT: Record<string, string> = {
  reactive:  'Cada pausa antes de gastar es una victoria.',
  avoidant:  'Mirar tus finanzas hoy es el primer paso.',
  anxious:   'Un pequeño hábito reduce la ansiedad financiera.',
  planning:  'Tu organización es tu mayor activo.',
};

// ── Componente ───────────────────────────────────────────────────────────────
export function MotivationCardWidget({
  intensity,
  streak,
  totalSaved,
  moneyFeeling,
  onAdjustRules,
}: MotivationCardWidgetProps): React.ReactElement {
  const { collapsed, toggle } = useWidgetCollapse('motivation_card', false);

  useEffect(() => {
    analytics.dashboardMotivationCardViewed();
  }, [intensity]);

  const { headline, sub } = COPY[intensity];
  const feelingHint = moneyFeeling ? MONEY_FEELING_HINT[moneyFeeling] ?? null : null;
  const levelCfg = getLevel(totalSaved);
  const levelPct = getLevelProgress(totalSaved, levelCfg);
  const nextLevelCfg = LEVELS[LEVELS.indexOf(levelCfg) + 1] ?? null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.bgGradient} />
      <div className={styles.glowOverlay}>
        <div className={styles.glowPurple} />
        <div className={styles.glowBlue} />
      </div>
      <div className={styles.borderLayer} />

      <div className={styles.content}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconWrap}><TrendingUpIcon /></div>
            <span className={styles.headerLabel}>MOTIVACIÓN</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className={`${styles.intensityBadge} ${styles[`intensity_${intensity}`]}`}>
              {intensity === 'high' ? <FlameIcon /> : <ZapIcon />}
              {intensity === 'high' ? 'ALTA' : intensity === 'medium' ? 'MEDIA' : intensity === 'low' ? 'BAJA' : '—'}
            </div>
            <CollapseChevron collapsed={collapsed} onToggle={toggle} />
          </div>
        </div>

        {/* Resumen mínimo plegado */}
        {collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={toggle}>
            <div className={`${styles.levelBadge} ${styles[`level_${levelCfg.color}`]}`}>
              <span className={styles.levelEmoji}>{levelCfg.emoji}</span>
              <span className={styles.levelName}>{levelCfg.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(148,163,184,0.7)' }}>
              <span>🔥</span>
              <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{streak}</span>
              <span>días</span>
            </div>
          </div>
        )}

        {/* ── Cuerpo colapsable ── */}
        {!collapsed && (
          <>
            {/* ── Nivel actual ── */}
            <div className={styles.levelRow}>
              <div className={`${styles.levelBadge} ${styles[`level_${levelCfg.color}`]}`}>
                <span className={styles.levelEmoji}>{levelCfg.emoji}</span>
                <span className={styles.levelName}>{levelCfg.label}</span>
              </div>
              <div className={styles.totalSaved}>{formatEUR(totalSaved)} ahorrados</div>
            </div>

            {/* ── Barra de progreso al siguiente nivel ── */}
            <div className={styles.levelProgressSection}>
              <div className={styles.levelProgressHeader}>
                <span className={styles.levelProgressLabel}>
                  {nextLevelCfg
                    ? `Progreso a ${nextLevelCfg.label} ${nextLevelCfg.emoji}`
                    : '¡Nivel máximo alcanzado!'}
                </span>
                <span className={styles.levelProgressPct}>{levelPct}%</span>
              </div>
              <div className={styles.levelProgressTrack}>
                <div
                  className={`${styles.levelProgressFill} ${styles[`levelFill_${levelCfg.color}`]}`}
                  style={{ width: `${levelPct}%` }}
                />
              </div>
              {nextLevelCfg && (
                <div className={styles.levelProgressHint}>
                  Faltan {formatEUR(nextLevelCfg.minSaved - totalSaved)} para {nextLevelCfg.label}
                </div>
              )}
            </div>

            {/* ── Racha de días ── */}
            <div className={styles.streakRow}>
              <div className={styles.streakBox}>
                <span className={styles.streakIcon}>🔥</span>
                <div className={styles.streakInfo}>
                  <span className={styles.streakCount}>{streak}</span>
                  <span className={styles.streakLabel}>días seguidos</span>
                </div>
              </div>
              <div className={styles.streakDots}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className={`${styles.streakDot} ${i < Math.min(streak, 7) ? styles.streakDotActive : ''}`}
                  />
                ))}
              </div>
            </div>

            {/* ── Copy motivacional ── */}
            <p className={styles.headline}>{headline}</p>
            <p className={styles.sub}>{feelingHint ?? sub}</p>

            {/* ── Botón ajustar ── */}
            <button
              className={styles.adjustBtn}
              onClick={() => {
                analytics.motivationCtaClicked('pending', 'impact');
                onAdjustRules();
              }}
            >
              <SettingsIcon />
              Ajustar reglas
            </button>
          </>
        )}

      </div>
    </div>
  );
}

export default MotivationCardWidget;
