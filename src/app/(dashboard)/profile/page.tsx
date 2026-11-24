"use client";

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { buildSummary, storeUpdateUserName, storeUpdateIncome, incomeBandFromRange } from '@/services/dashboardStore';
import { authSignOut } from '@/services/authService';
import { hasCompletedProfiling } from '@/services/profilingService';
import { ProfilingModal } from '@/components/profile/ProfilingModal/ProfilingModal';
import { ModalPortal } from '@/components/ui/ModalPortal/ModalPortal';
import type { IncomeRange } from '@/types/Dashboard';
import styles from './Profile.module.css';
import { getTheme, applyTheme, Theme } from '@/styles/themes';
import { WidgetSkeleton } from '@/components/ui/Skeleton/Skeleton';
import { useToast } from '@/components/ui/Toast/Toast';
import {
  TargetIcon,
  BarChartIcon,
  SettingsIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  UserIcon,
  WalletIcon,
  CloseIcon,
  CheckIcon,
  FlameIcon,
  SproutIcon,
  MedalIcon,
  DiamondIcon,
  CrownIcon,
  TrophyIcon,
  LogoutIcon,
} from '@/components/ui/AppIcons';

function EyeIcon({ open, size = 17 }: { open: boolean; size?: number }) {
  return open ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

const MEDAL_TIERS = [
  { amount: 5000, Icon: CrownIcon, color: '#FFD700', label: 'Corona' },
  { amount: 2000, Icon: TrophyIcon, color: '#4ade80', label: 'Trofeo' },
  { amount: 1000, Icon: DiamondIcon, color: '#60a5fa', label: 'Diamante' },
  { amount: 500, Icon: MedalIcon, color: '#fbbf24', label: 'Oro' },
  { amount: 100, Icon: MedalIcon, color: '#cbd5e1', label: 'Plata' },
  { amount: 50, Icon: MedalIcon, color: '#cd7f32', label: 'Bronce' },
];

function getMedal(totalSaved: number) {
  return MEDAL_TIERS.find(t => totalSaved >= t.amount)
    ?? { amount: 0, Icon: SproutIcon, color: '#22c55e', label: 'Semilla' };
}

const INCOME_BAND_OPTIONS: {
  band: string;
  label: string;
  shortLabel: string;
  min: number;
  max: number;
}[] = [
  { band: 'lt_1000',   label: 'Menos de 1.000 €', shortLabel: '< 1.000 €',    min: 0,    max: 1000 },
  { band: '1000_1500', label: '1.000 – 1.500 €',  shortLabel: '1.000–1.500 €', min: 1000, max: 1500 },
  { band: '1500_2000', label: '1.500 – 2.000 €',  shortLabel: '1.500–2.000 €', min: 1500, max: 2000 },
  { band: '2000_2500', label: '2.000 – 2.500 €',  shortLabel: '2.000–2.500 €', min: 2000, max: 2500 },
  { band: '2500_3000', label: '2.500 – 3.000 €',  shortLabel: '2.500–3.000 €', min: 2500, max: 3000 },
  { band: 'gt_3000',   label: 'Más de 3.000 €',   shortLabel: '> 3.000 €',    min: 3000, max: 10000 },
];

function getIncomeBandOption(range: IncomeRange | null) {
  if (!range) return null;
  const code = incomeBandFromRange(range);
  return INCOME_BAND_OPTIONS.find(o => o.band === code) ?? INCOME_BAND_OPTIONS[0];
}

function formatEUR(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n);
}

function getInitials(name: string, email: string): string {
  const src = name.trim() || email;
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}

function SectionOpener({ onOpen }: { onOpen: (s: string) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const s = searchParams.get('section');
    if (s) onOpen(s);
  }, [searchParams, onOpen]);
  return null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [incomeRange, setIncomeRange] = useState<IncomeRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalSaved, setTotalSaved] = useState(0);
  const [streak, setStreak] = useState(0);
  const [activeGoalsCount, setActiveGoalsCount] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [incomeVisible, setIncomeVisible] = useState(true);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [draftBand, setDraftBand] = useState<string>('1500_2000');
  const [profilingOpen, setProfilingOpen] = useState(false);
  const [profilingDone, setProfilingDone] = useState(false);
  const { addToast } = useToast();
  const [currentTheme, setCurrentTheme] = useState<Theme>('dark');

  const toggleIncomeVisibility = useCallback(() => {
    setIncomeVisible(v => {
      const next = !v;
      localStorage.setItem('profile_income_visible', next ? '1' : '0');
      return next;
    });
  }, []);

  const handleSectionOpen = useCallback((s: string) => {
    if (s === 'info') setInfoOpen(true);
  }, []);

  useEffect(() => {
    analytics.setScreen('profile');
    const isAuth = localStorage.getItem('isAuthenticated');
    if (isAuth !== 'true') { router.replace('/login'); return; }
    const summary = buildSummary('30d');
    setUserName(summary.userName);
    setEmail(summary.userEmail);
    setIncomeRange(summary.incomeRange);
    setTotalSaved(summary.totalSaved);
    setStreak(summary.streak ?? 0);
    setActiveGoalsCount(summary.goals.filter(g => !g.archived).length);
    setEditingName(summary.userName);
    const savedVisible = localStorage.getItem('profile_income_visible');
    if (savedVisible === '0') setIncomeVisible(false);
    setProfilingDone(hasCompletedProfiling());
    setCurrentTheme(getTheme());
    analytics.profileViewed();
    setLoading(false);
  }, [router]);

  const openIncomeModal = useCallback(() => {
    const currentOpt = getIncomeBandOption(incomeRange);
    setDraftBand(currentOpt?.band ?? '1500_2000');
    analytics.incomeEditOpened();
    setIncomeModalOpen(true);
  }, [incomeRange]);

  const handleSaveIncome = useCallback(() => {
    const opt = INCOME_BAND_OPTIONS.find(o => o.band === draftBand);
    if (!opt) return;
    const nextRange: IncomeRange = { min: opt.min, max: opt.max, currency: 'EUR' };
    storeUpdateIncome(nextRange, '30d', { source: 'profile' });
    setIncomeRange(nextRange);
    analytics.incomeUpdateSubmitted();
    analytics.profileUpdated(['incomeRange']);
    setIncomeModalOpen(false);
    addToast('Ingresos mensuales actualizados', 'success');
  }, [draftBand, addToast]);

  const handleSaveName = useCallback(() => {
    if (!editingName.trim()) return;
    storeUpdateUserName(editingName.trim());
    setUserName(editingName.trim());
    analytics.profileUpdated(['userName']);
    setNameSaved(true);
    addToast('Nombre guardado', 'success');
    setTimeout(() => setNameSaved(false), 2500);
  }, [editingName, addToast]);

  const handleLogout = useCallback(async () => {
    await authSignOut();
    router.replace('/login');
  }, [router]);

  const toggleThemeQuick = useCallback(() => {
    const next: Theme = currentTheme === 'dark' ? 'light' : 'dark';
    setCurrentTheme(next);
    applyTheme(next);
  }, [currentTheme]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div style={{ padding: '40px 16px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480, margin: '0 auto', width: '100%' }}>
          <WidgetSkeleton />
          <WidgetSkeleton />
        </div>
      </div>
    );
  }

  const initials = getInitials(userName, email);
  const firstName = userName.trim().split(' ')[0] || 'Usuario';
  const medal = getMedal(totalSaved);
  const incomeOption = getIncomeBandOption(incomeRange);
  const incomeDisplay = incomeOption ? (incomeVisible ? incomeOption.shortLabel : '••••') : 'Ingresos';
  const incomeRowSub = incomeOption
    ? (incomeVisible ? `${incomeOption.label}/mes` : '••••••')
    : 'Sin configurar · pulsa para elegir';

  return (
    <div className={styles.page}>
      <Suspense fallback={null}>
        <SectionOpener onOpen={handleSectionOpen} />
      </Suspense>

      <div className={styles.headerZone}>
        <div className={styles.zoneInner}>
          <div className={styles.headerContent}>
            <div className={styles.topBar}>
              <div className={styles.topBarSpacer} />
              <span className={styles.topBarTitle}>Perfil</span>
              <button
                type="button"
                className={styles.glassCircleBtn}
                onClick={() => router.push('/settings')}
                aria-label="Configuración avanzada"
              >
                <SettingsIcon size={17} />
              </button>
            </div>

            <div className={styles.heroCenter}>
              <div className={styles.avatar}>{initials}</div>
              <h1 className={styles.heroName}>{firstName}</h1>
              <div className={styles.heroPill}>
                {formatEUR(totalSaved)} ahorrados · Racha {streak} d · {medal.label}
              </div>
            </div>

            <div className={styles.circleActions}>
              <button type="button" className={styles.circleAction} onClick={() => setProfilingOpen(true)}>
                <span className={styles.circleBtn}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </span>
                <span className={styles.circleLbl}>Personalizar</span>
              </button>

              <button
                type="button"
                className={styles.circleAction}
                onClick={incomeOption ? toggleIncomeVisibility : openIncomeModal}
                aria-label={incomeOption ? (incomeVisible ? 'Ocultar ingresos' : 'Mostrar ingresos') : 'Configurar ingresos mensuales'}
              >
                <span className={styles.circleBtn}><EyeIcon open={incomeVisible} size={18} /></span>
                <span className={`${styles.circleLbl} ${incomeOption && !incomeVisible ? styles.incomeBlur : ''}`}>{incomeDisplay}</span>
              </button>

              <button type="button" className={styles.circleAction} onClick={toggleThemeQuick}>
                <span className={styles.circleBtn}>
                  {currentTheme === 'dark' ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2" />
                    </svg>
                  )}
                </span>
                <span className={styles.circleLbl}>{currentTheme === 'dark' ? 'Oscuro' : 'Claro'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.contentZone}>
        <div className={styles.zoneInner}>
          <div className={styles.contentGrid}>
            {/* Columna principal: menú Revolut con medallones cromáticos */}
            <div className={styles.colStack}>
              <section className={styles.card}>
                <div className={styles.rowsStack}>
                  <button type="button" className={styles.listRow} onClick={() => setProfilingOpen(true)}>
                    <span className={`${styles.medallion} ${styles.mViolet}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </span>
                    <span className={styles.rowMid}>
                      <span className={styles.rowTitle}>
                        {profilingDone ? 'Personalización completada' : 'Personaliza tu experiencia'}
                      </span>
                      <span className={styles.rowSub}>
                        {profilingDone ? 'Tu perfil está optimizado · repetir' : 'Afina tus preguntas y recomendaciones'}
                      </span>
                    </span>
                    <ChevronRightIcon size={16} className={styles.rowChevron} />
                  </button>

                  <button type="button" className={styles.listRow} onClick={openIncomeModal}>
                    <span className={`${styles.medallion} ${styles.mEmerald}`}><WalletIcon size={18} /></span>
                    <span className={styles.rowMid}>
                      <span className={styles.rowTitle}>Ingresos mensuales</span>
                      <span className={`${styles.rowSub} ${incomeOption && !incomeVisible ? styles.incomeBlur : ''}`}>
                        {incomeRowSub}
                      </span>
                    </span>
                    <ChevronRightIcon size={16} className={styles.rowChevron} />
                  </button>

                  <button type="button" className={styles.listRow} onClick={() => router.push('/goals')}>
                    <span className={`${styles.medallion} ${styles.mCobalt}`}><TargetIcon size={18} /></span>
                    <span className={styles.rowMid}>
                      <span className={styles.rowTitle}>Mis objetivos</span>
                      <span className={styles.rowSub}>{activeGoalsCount} {activeGoalsCount === 1 ? 'activo' : 'activos'}</span>
                    </span>
                    <ChevronRightIcon size={16} className={styles.rowChevron} />
                  </button>

                  <button type="button" className={styles.listRow} onClick={() => router.push('/history')}>
                    <span className={`${styles.medallion} ${styles.mSky}`}><BarChartIcon size={18} /></span>
                    <span className={styles.rowMid}>
                      <span className={styles.rowTitle}>Historial de ahorro</span>
                      <span className={styles.rowSub}>Revisa tus decisiones pasadas</span>
                    </span>
                    <ChevronRightIcon size={16} className={styles.rowChevron} />
                  </button>

                  <div className={`${styles.listRow} ${styles.listRowStatic}`}>
                    <span className={`${styles.medallion} ${styles.mAmber}`}><medal.Icon size={18} /></span>
                    <span className={styles.rowMid}>
                      <span className={styles.rowTitle}>Nivel {medal.label}</span>
                      <span className={styles.rowSub}>
                        {streak > 0 ? `Racha actual de ${streak} ${streak === 1 ? 'día' : 'días'}` : 'Empieza tu racha hoy'}
                      </span>
                    </span>
                    {streak > 0 && (
                      <span className={styles.streakPill}>
                        <FlameIcon size={13} />
                        {streak}d
                      </span>
                    )}
                  </div>

                  <button type="button" className={styles.listRow} onClick={() => router.push('/settings')}>
                    <span className={`${styles.medallion} ${styles.mCyan}`}><SettingsIcon size={18} /></span>
                    <span className={styles.rowMid}>
                      <span className={styles.rowTitle}>Configuración avanzada</span>
                      <span className={styles.rowSub}>Datos, avisos y sesión</span>
                    </span>
                    <ChevronRightIcon size={16} className={styles.rowChevron} />
                  </button>
                </div>
              </section>
            </div>

            {/* Columna secundaria: apariencia + datos de la cuenta */}
            <div className={styles.colStack}>
              <section className={styles.card}>
                <div className={`${styles.listRow} ${styles.listRowStatic}`}>
                  <span className={`${styles.medallion} ${styles.mSlate}`}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2" />
                    </svg>
                  </span>
                  <span className={styles.rowMid}>
                    <span className={styles.rowTitle}>Apariencia</span>
                    <span className={styles.rowSub}>Modo de pantalla</span>
                  </span>
                  <div className={styles.themeSegmented}>
                    <button
                      type="button"
                      className={`${styles.themeSegBtn} ${currentTheme === 'light' ? styles.themeSegActive : ''}`}
                      onClick={() => { setCurrentTheme('light'); applyTheme('light'); }}
                    >
                      Claro
                    </button>
                    <button
                      type="button"
                      className={`${styles.themeSegBtn} ${currentTheme === 'dark' ? styles.themeSegActive : ''}`}
                      onClick={() => { setCurrentTheme('dark'); applyTheme('dark'); }}
                    >
                      Oscuro
                    </button>
                  </div>
                </div>
              </section>

              <section className={styles.card}>
                <button type="button" className={styles.listRow} onClick={() => setInfoOpen(v => !v)}>
                  <span className={`${styles.medallion} ${styles.mSlate}`}><UserIcon size={17} /></span>
                  <span className={styles.rowMid}>
                    <span className={styles.rowTitle}>Datos de la cuenta</span>
                    <span className={styles.rowSub}>Nombre, email y sesión</span>
                  </span>
                  <ChevronDownIcon size={16} className={`${styles.rowChevron} ${infoOpen ? styles.chevronOpen : ''}`} />
                </button>

                {infoOpen && (
                  <div className={styles.infoBody}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.infoLabel}>Nombre</label>
                      <input
                        className={styles.infoInput}
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                        placeholder="Tu nombre"
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <span className={styles.infoLabel}>Ingresos mensuales</span>
                      <div className={styles.infoInlineRow}>
                        <span className={`${styles.infoStaticFlex} ${incomeOption && !incomeVisible ? styles.incomeBlur : ''}`}>
                          {incomeOption ? `${incomeOption.label}/mes` : 'Sin configurar'}
                        </span>
                        <button type="button" className={styles.infoEditChip} onClick={openIncomeModal}>
                          Cambiar
                        </button>
                      </div>
                    </div>
                    {email && (
                      <div className={styles.fieldGroup}>
                        <span className={styles.infoLabel}>Email</span>
                        <div className={styles.infoStatic}>{email}</div>
                      </div>
                    )}
                    <button type="button" className={styles.saveBtn} onClick={handleSaveName}>
                      {nameSaved ? 'Guardado' : 'Guardar cambios'}
                    </button>
                    <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
                      <LogoutIcon size={15} />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>

      {incomeModalOpen && (
        <ModalPortal>
          <div className={styles.modalOverlay} onClick={() => setIncomeModalOpen(false)}>
            <div
              className={styles.modalCard}
              role="dialog"
              aria-modal="true"
              aria-labelledby="income-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <div>
                  <h2 id="income-modal-title" className={styles.modalTitle}>Ingresos mensuales</h2>
                  <p className={styles.modalSubtitle}>
                    Elige tu tramo neto orientativo para adaptar las metas recomendadas.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={() => setIncomeModalOpen(false)}
                  aria-label="Cerrar"
                >
                  <CloseIcon size={16} />
                </button>
              </div>

              <div className={styles.bandList} role="radiogroup" aria-label="Tramo de ingresos mensuales">
                {INCOME_BAND_OPTIONS.map((opt) => {
                  const selected = draftBand === opt.band;
                  return (
                    <button
                      key={opt.band}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`${styles.bandOption} ${selected ? styles.bandOptionActive : ''}`}
                      onClick={() => setDraftBand(opt.band)}
                    >
                      <span className={styles.bandLabel}>{opt.label}</span>
                      <span className={`${styles.bandCheck} ${selected ? styles.bandCheckActive : ''}`}>
                        {selected && <CheckIcon size={13} />}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.modalCancelBtn}
                  onClick={() => setIncomeModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={styles.modalSaveBtn}
                  onClick={handleSaveIncome}
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {profilingOpen && (
        <ProfilingModal
          onClose={() => setProfilingOpen(false)}
          onCompleted={() => setProfilingDone(true)}
        />
      )}
    </div>
  );
}
