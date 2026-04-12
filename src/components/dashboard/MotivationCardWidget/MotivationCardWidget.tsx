"use client";

import React, { useEffect } from 'react';
import { analytics } from '@/services/analytics';
import type { MotivationCardWidgetProps, MotivationIntensity, MotivationLevel } from './MotivationCardWidget.types';
import styles from './MotivationCardWidget.module.css';
import { useWidgetCollapse } from '@/hooks/useWidgetCollapse';
import { CollapseChevron } from '@/components/dashboard/CollapsibleWidget/CollapsibleWidget';
import { 
  FlameIcon, 
  BoltIcon, 
  TrendingUpIcon, 
  SettingsIcon, 
  MedalIcon, 
  DiamondIcon, 
  SproutIcon 
} from '@/components/ui/AppIcons';


// ── Lógica de niveles ────────────────────────────────────────────────────────
interface LevelConfig {
  level: MotivationLevel;
  label: string;
  Icon: React.ElementType;
  minSaved: number;   // euros mínimos para este nivel
  nextMin: number;    // euros para el siguiente nivel (0 = máximo)
  color: string;      // clase CSS
}

const LEVELS: LevelConfig[] = [
  { level: 'seed',    label: 'Semilla',  Icon: SproutIcon,  minSaved: 0,    nextMin: 50,   color: 'bronze'  },
  { level: 'bronze',  label: 'Bronce',   Icon: MedalIcon,   minSaved: 50,   nextMin: 500,  color: 'bronze'  },
  { level: 'silver',  label: 'Plata',    Icon: MedalIcon,   minSaved: 500,  nextMin: 2000, color: 'silver'  },
  { level: 'gold',    label: 'Oro',      Icon: MedalIcon,   minSaved: 2000, nextMin: 5000, color: 'gold'    },
  { level: 'diamond', label: 'Diamante', Icon: DiamondIcon, minSaved: 5000, nextMin: 0,    color: 'diamond' },
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
  const { collapsed, toggle } = useWidgetCollapse('motivation_card', true);

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
            <div className={styles.iconWrap}><TrendingUpIcon size={14} /></div>
            <span className={styles.headerLabel}>MOTIVACIÓN</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className={`${styles.intensityBadge} ${styles[`intensity_${intensity}`]}`}>
              {intensity === 'high' ? <FlameIcon size={12} /> : <BoltIcon size={12} />}
              {intensity === 'high' ? 'ALTA' : intensity === 'medium' ? 'MEDIA' : intensity === 'low' ? 'BAJA' : '—'}
            </div>
            <CollapseChevron collapsed={collapsed} onToggle={toggle} />
          </div>
        </div>

        {/* Resumen mínimo plegado */}
        {collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={toggle}>
            <div className={`${styles.levelBadge} ${styles[`level_${levelCfg.color}`]}`}>
              <span className={styles.levelEmoji}><levelCfg.Icon size={16} /></span>
              <span className={styles.levelName}>{levelCfg.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(148,163,184,0.7)' }}>
              <FlameIcon size={13} style={{ color: '#fb923c' }} />
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
                <span className={styles.levelEmoji}><levelCfg.Icon size={18} /></span>
                <span className={styles.levelName}>{levelCfg.label}</span>
              </div>
              <div className={styles.totalSaved}>{formatEUR(totalSaved)} ahorrados</div>
            </div>

            {/* ── Barra de progreso al siguiente nivel ── */}
            <div className={styles.levelProgressSection}>
              <div className={styles.levelProgressHeader}>
                <span className={styles.levelProgressLabel}>
                  {nextLevelCfg
                    ? `Progreso a ${nextLevelCfg.label}`
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
                <span className={styles.streakIcon}><FlameIcon size={20} /></span>
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
              <SettingsIcon size={14} />
              Ajustar reglas
            </button>
          </>
        )}

      </div>
    </div>
  );
}

export default MotivationCardWidget;
