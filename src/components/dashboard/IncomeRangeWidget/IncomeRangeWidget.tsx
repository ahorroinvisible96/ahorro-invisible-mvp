"use client";

import React, { useState, useEffect } from 'react';
import { analytics } from '@/services/analytics';
import type { IncomeRangeWidgetProps } from './IncomeRangeWidget.types';
import styles from './IncomeRangeWidget.module.css';

const SLIDER_MAX = 10000;
const SLIDER_STEP = 100;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ── Iconos SVG inline ────────────────────────────────────────────────────────
function WalletIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
    </svg>
  );
}

function TrendingUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}

function Edit2Icon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

// ── Slider nativo estilizado ─────────────────────────────────────────────────
function StyledSlider({
  value,
  min = 0,
  max = SLIDER_MAX,
  step = SLIDER_STEP,
  onChange,
  accent = 'purple',
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  accent?: 'purple' | 'blue';
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={styles.sliderWrapper}>
      <div className={styles.sliderTrack}>
        <div
          className={`${styles.sliderRange} ${accent === 'blue' ? styles.sliderRangeBlue : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <input
        type="range"
        className={`${styles.sliderInput} ${accent === 'blue' ? styles.sliderInputBlue : ''}`}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export function IncomeRangeWidget({
  incomeRange,
  onSaveIncomeRange,
}: IncomeRangeWidgetProps): React.ReactElement {
  const isConfigured = incomeRange !== null;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [draftRange, setDraftRange] = useState<[number, number]>([
    incomeRange?.min ?? 2000,
    incomeRange?.max ?? 6000,
  ]);

  useEffect(() => {
    analytics.incomeRangeViewed();
  }, []);

  // Sincronizar draft cuando cambian props externas
  useEffect(() => {
    if (incomeRange) {
      setDraftRange([incomeRange.min, incomeRange.max]);
    }
  }, [incomeRange?.min, incomeRange?.max]);

  function openDialog() {
    setDraftRange([incomeRange?.min ?? 2000, incomeRange?.max ?? 6000]);
    analytics.incomeEditOpened();
    setIsDialogOpen(true);
  }

  function handleSave() {
    const [min, max] = draftRange;
    onSaveIncomeRange({ min, max, currency: 'EUR' });
    analytics.incomeUpdated(min, max);
    setIsDialogOpen(false);
  }

  function handleMinChange(v: number) {
    setDraftRange([v, Math.max(v, draftRange[1])]);
  }

  function handleMaxChange(v: number) {
    setDraftRange([Math.min(draftRange[0], v), v]);
  }

  return (
    <>
      {/* ── Widget principal ── */}
      <div className={styles.wrapper}>
        {/* Blur glows decorativos */}
        <div className={styles.glowPurple} />
        <div className={styles.glowBlue} />

        <div className={styles.inner}>
          {/* Icono + textos */}
          <div className={styles.left}>
            <div className={styles.iconWrap}>
              <WalletIcon size={22} />
              {isConfigured && <span className={styles.configuredDot} />}
            </div>

            <div className={styles.texts}>
              <div className={styles.labelRow}>
                <span className={styles.label}>Ingresos Mensuales</span>
                {isConfigured && (
                  <span className={styles.configuredBadge}>
                    <TrendingUpIcon /> Configurado
                  </span>
                )}
              </div>

              {isConfigured ? (
                <>
                  <button
                    className={`${styles.rangeValueWrap} ${revealed ? styles.rangeValueRevealed : ''}`}
                    onClick={() => setRevealed((v) => !v)}
                    aria-label={revealed ? 'Ocultar ingresos' : 'Mostrar ingresos'}
                    title={revealed ? 'Pulsa para ocultar' : 'Pulsa para ver'}
                  >
                    <div className={styles.rangeValue}>
                      {formatCurrency(incomeRange!.min)} – {formatCurrency(incomeRange!.max)}
                    </div>
                    <span className={styles.revealHint}>
                      {revealed ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </span>
                  </button>
                  <div className={styles.rangeSubtext}>Rango mensual estimado · {revealed ? 'visible' : 'oculto'}</div>
                </>
              ) : (
                <div className={styles.unconfigured}>
                  <span className={styles.dot} style={{ animationDelay: '0ms' }} />
                  <span className={styles.dot} style={{ animationDelay: '150ms' }} />
                  <span className={styles.dot} style={{ animationDelay: '300ms' }} />
                  <span className={styles.unconfiguredText}>No configurado</span>
                </div>
              )}
            </div>
          </div>

          {/* Botón configurar/editar */}
          <button className={styles.actionBtn} onClick={openDialog}>
            {isConfigured ? (
              <>
                <span className={styles.actionBtnIconEdit}><Edit2Icon /></span>
                Editar
              </>
            ) : (
              <>
                Configurar
                <span className={styles.actionBtnIconArrow}><ArrowRightIcon /></span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Modal de configuración ── */}
      {isDialogOpen && (
        <div className={styles.overlay} onClick={() => setIsDialogOpen(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className={styles.dialogHeader}>
              <div className={styles.dialogHeaderLeft}>
                <div className={styles.dialogIconWrap}><WalletIcon size={20} /></div>
                <h2 className={styles.dialogTitle}>Configurar Ingresos Mensuales</h2>
              </div>
              <button className={styles.dialogClose} onClick={() => setIsDialogOpen(false)}>
                <XIcon />
              </button>
            </div>

            {/* Card rango seleccionado */}
            <div className={styles.rangeCard}>
              <span className={styles.rangeCardLabel}>Rango seleccionado</span>
              <div className={styles.rangeCardValues}>
                <span className={styles.rangeCardMin}>{formatCurrency(draftRange[0])}</span>
                <span className={styles.rangeCardSep}>—</span>
                <span className={styles.rangeCardMax}>{formatCurrency(draftRange[1])}</span>
              </div>
            </div>

            {/* Sliders */}
            <div className={styles.sliders}>
              {/* Mínimo */}
              <div className={styles.sliderGroup}>
                <div className={styles.sliderLabelRow}>
                  <span className={styles.sliderLabel}>Ingreso Mínimo</span>
                  <span className={styles.sliderBadgePurple}>{formatCurrency(draftRange[0])}</span>
                </div>
                <StyledSlider value={draftRange[0]} onChange={handleMinChange} accent="purple" />
              </div>

              {/* Máximo */}
              <div className={styles.sliderGroup}>
                <div className={styles.sliderLabelRow}>
                  <span className={styles.sliderLabel}>Ingreso Máximo</span>
                  <span className={styles.sliderBadgeBlue}>{formatCurrency(draftRange[1])}</span>
                </div>
                <StyledSlider value={draftRange[1]} onChange={handleMaxChange} accent="blue" />
              </div>
            </div>

            {/* Footer */}
            <div className={styles.dialogFooter}>
              <button className={styles.btnCancel} onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </button>
              <button className={styles.btnSave} onClick={handleSave}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default IncomeRangeWidget;
