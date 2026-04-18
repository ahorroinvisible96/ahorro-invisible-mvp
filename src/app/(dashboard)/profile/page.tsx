"use client";

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { buildSummary, storeUpdateUserName, storeUpdateIncome } from '@/services/dashboardStore';
import { authSignOut } from '@/services/authService';
import { hasCompletedProfiling } from '@/services/profilingService';
import { ProfilingModal } from '@/components/profile/ProfilingModal/ProfilingModal';
import type { IncomeRange } from '@/types/Dashboard';
import styles from './Profile.module.css';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import {
  TargetIcon,
  BarChartIcon,
  SettingsIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  UserIcon,
  EditIcon,
  FlameIcon,
  SproutIcon,
  MedalIcon,
  DiamondIcon,
  CrownIcon,
  TrophyIcon,
  LogoutIcon,
} from '@/components/ui/AppIcons';

// ── Icono ojo inline (abre / cierra privacidad) ───────────────────────────────
function EyeIcon({ open, size = 14 }: { open: boolean; size?: number }) {
  return open ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

// ── Niveles de medalla ────────────────────────────────────────────────────────
const MEDAL_TIERS = [
  { amount: 5000, Icon: CrownIcon,   color: '#FFD700', label: 'Corona'   },
  { amount: 2000, Icon: TrophyIcon,  color: '#4ade80', label: 'Trofeo'   },
  { amount: 1000, Icon: DiamondIcon, color: '#60a5fa', label: 'Diamante' },
  { amount: 500,  Icon: MedalIcon,   color: '#fbbf24', label: 'Oro'      },
  { amount: 100,  Icon: MedalIcon,   color: '#cbd5e1', label: 'Plata'    },
  { amount: 50,   Icon: MedalIcon,   color: '#cd7f32', label: 'Bronce'   },
];

function getMedal(totalSaved: number) {
  return MEDAL_TIERS.find(t => totalSaved >= t.amount)
    ?? { amount: 0, Icon: SproutIcon, color: '#22c55e', label: 'Semilla' };
}

function formatIncome(range: IncomeRange | null): string {
  if (!range) return '—';
  const v = range.min ?? 0;
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(v);
}

function getInitials(name: string, email: string): string {
  const src = name.trim() || email;
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}

// ── Componente auxiliar: lee ?section= ───────────────────────────────────────
function SectionOpener({ onOpen }: { onOpen: (s: string) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const s = searchParams.get('section');
    if (s) onOpen(s);
  }, [searchParams, onOpen]);
  return null;
}

// ── Fila de lista estilo iOS ──────────────────────────────────────────────────
function ListRow({
  icon,
  label,
  onClick,
  last = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  last?: boolean;
}) {
  return (
    <button className={`${styles.listRow} ${last ? styles.listRowLast : ''}`} onClick={onClick}>
      <span className={styles.listRowIcon}>{icon}</span>
      <span className={styles.listRowLabel}>{label}</span>
      <ChevronRightIcon size={14} className={styles.listRowChevron} />
    </button>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const [userName, setUserName]         = useState('');
  const [email, setEmail]               = useState('');
  const [incomeRange, setIncomeRange]   = useState<IncomeRange | null>(null);
  const [loading, setLoading]           = useState(true);
  const [totalSaved, setTotalSaved]     = useState(0);
  const [streak, setStreak]             = useState(0);
  const [infoOpen, setInfoOpen]           = useState(false);
  const [editingName, setEditingName]     = useState('');
  const [nameSaved, setNameSaved]         = useState(false);
  // Estado de privacidad de ingresos — persiste en localStorage
  const [incomeVisible, setIncomeVisible] = useState(true);
  // Estado del modal de personalización
  const [profilingOpen, setProfilingOpen]       = useState(false);
  const [profilingDone, setProfilingDone]       = useState(false);

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
    setEditingName(summary.userName);
    // Restaurar preferencia de privacidad
    const savedVisible = localStorage.getItem('profile_income_visible');
    if (savedVisible === '0') setIncomeVisible(false);
    // Comprobar si ya completó profiling
    setProfilingDone(hasCompletedProfiling());
    analytics.profileViewed();
    setLoading(false);
  }, [router]);

  const handleSaveIncome = useCallback((range: IncomeRange) => {
    storeUpdateIncome(range);
    setIncomeRange(range);
  }, []);

  const handleSaveName = useCallback(() => {
    if (!editingName.trim()) return;
    storeUpdateUserName(editingName.trim());
    setUserName(editingName.trim());
    analytics.profileUpdated(['userName']);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2500);
  }, [editingName]);

  const handleLogout = useCallback(async () => {
    await authSignOut();
    router.replace('/login');
  }, [router]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Cargando perfil…</div>
      </div>
    );
  }

  const initials = getInitials(userName, email);
  const firstName = userName.trim().split(' ')[0] || 'Usuario';
  const medal = getMedal(totalSaved);
  const incomeStr = formatIncome(incomeRange);

  // Muestra ingresos o blur
  const incomeDisplay = incomeVisible ? incomeStr : '••••••';

  return (
    <div className={styles.page}>
      <Suspense fallback={null}>
        <SectionOpener onOpen={handleSectionOpen} />
      </Suspense>

      {/* ══════════════════════════════════════════════════════════════════════
          ZONA 1 — HEADER PRINCIPAL (degradado púrpura)
          Contiene: avatar + nombre → métricas clave → ingresos con privacidad
          ══════════════════════════════════════════════════════════════════════ */}
      <div className={styles.headerZone}>
        <div className={styles.zoneInner}>
          <div className={styles.headerContent}>

            {/* Fila superior: avatar + nombre */}
            <div className={styles.heroTop}>
              <div className={styles.avatar}>{initials}</div>
              <div className={styles.heroGreeting}>
                <span className={styles.heroSub}>Bienvenido de nuevo</span>
                <span className={styles.heroName}>{firstName}</span>
              </div>
            </div>

            {/* Divisor */}
            <div className={styles.heroDivider} />

            {/* Tarjetas de métricas: total ahorrado · racha · nivel */}
            <div className={styles.metricsRow}>

              {/* Métrica 1: Total ahorrado */}
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Total ahorrado</span>
                <span className={styles.metricValueAccent} style={{ color: '#4ade80' }}>
                  {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalSaved)}
                </span>
                <span className={styles.metricSub}>acumulado</span>
              </div>

              {/* Métrica 2: Racha actual */}
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Racha</span>
                <span className={styles.metricValue} style={{ color: streak > 0 ? '#fb923c' : undefined }}>
                  {streak}
                </span>
                <span className={styles.metricSub}>{streak === 1 ? 'día seguido' : 'días seguidos'}</span>
              </div>

              {/* Métrica 3: Nivel actual (medalla) */}
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Nivel</span>
                <span className={styles.metricValueAccent} style={{ color: medal.color }}>
                  {medal.label}
                </span>
                <span className={styles.metricSub}>
                  {totalSaved > 0
                    ? `${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalSaved)} guardados`
                    : 'empieza a ahorrar'}
                </span>
              </div>

            </div>

            {/* Fila de ingresos compacta con toggle de privacidad */}
            <div className={styles.incomeRow}>
              <div className={styles.incomeLeft}>
                <span className={styles.incomeLabel}>INGRESOS MENSUALES</span>
                <span className={`${styles.incomeValue} ${!incomeVisible ? styles.incomeBlur : ''}`}>
                  {incomeDisplay}
                </span>
              </div>
              <div className={styles.incomePills}>
                <button
                  className={styles.heroIconPill}
                  onClick={toggleIncomeVisibility}
                  aria-label={incomeVisible ? 'Ocultar ingresos' : 'Mostrar ingresos'}
                >
                  <EyeIcon open={incomeVisible} size={13} />
                </button>
                <button
                  className={styles.heroEditPill}
                  onClick={() => setInfoOpen(true)}
                  aria-label="Editar ingresos"
                >
                  <EditIcon size={12} />
                  Editar
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ZONA 2 — CONTENIDO SECUNDARIO (fondo oscuro sólido, igual que dashboard)
          Contiene: acceso rápido, motivación, información personal
          ══════════════════════════════════════════════════════════════════════ */}
      <div className={styles.contentZone}>
        <div className={styles.zoneInner}>
          <div className={styles.contentCol}>

            {/* ─── Bloque: Acceso rápido ─── */}
            <div className={styles.sectionGroup}>
              <p className={styles.sectionLabel}>ACCESO RÁPIDO</p>
              <div className={styles.listCard}>
                <ListRow
                  icon={<TargetIcon size={16} />}
                  label="Mis objetivos"
                  onClick={() => router.push('/goals')}
                />
                <ListRow
                  icon={<BarChartIcon size={16} />}
                  label="Historial de ahorro"
                  onClick={() => router.push('/history')}
                />
                <ListRow
                  icon={<SettingsIcon size={16} />}
                  label="Configuración avanzada"
                  onClick={() => router.push('/settings')}
                  last
                />
              </div>
            </div>

            {/* ─── Bloque: Personalización ─── */}
            <div className={styles.sectionGroup}>
              <p className={styles.sectionLabel}>PERSONALIZACIÓN</p>
              <button
                className={styles.personalizationCard}
                onClick={() => setProfilingOpen(true)}
              >
                <div className={styles.personalizationIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26Z" />
                  </svg>
                </div>
                <div className={styles.personalizationContent}>
                  <span className={styles.personalizationTitle}>
                    {profilingDone ? 'Personalización completada' : 'Personaliza aún más tu experiencia'}
                  </span>
                  <span className={styles.personalizationSub}>
                    {profilingDone
                      ? 'Tu perfil ya está optimizado. Puedes repetirlo cuando quieras.'
                      : 'Responde unas preguntas rápidas para mejorar tu experiencia'}
                  </span>
                </div>
                <ChevronRightIcon size={14} className={styles.listRowChevron} />
              </button>
            </div>

            {/* ─── Bloque: Apariencia (modo oscuro / claro) ─── */}
            <div className={styles.sectionGroup}>
              <p className={styles.sectionLabel}>APARIENCIA</p>
              <div className={styles.listCard}>
                <div className={styles.listRow} style={{ cursor: 'default', justifyContent: 'space-between' }}>
                  <span className={styles.listRowIcon}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="4"/>
                      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                    </svg>
                  </span>
                  <span className={styles.listRowLabel}>Modo de pantalla</span>
                  <ThemeToggle />
                </div>
              </div>
            </div>

            {/* ─── Bloque: Motivación ─── */}
            <div className={styles.sectionGroup}>
              <p className={styles.sectionLabel}>MOTIVACIÓN</p>
              <div className={styles.listCard}>
                <div className={styles.motivationRow}>
                  {/* Medalla */}
                  <span className={styles.listRowIcon} style={{ color: medal.color }}>
                    <medal.Icon size={18} />
                  </span>
                  <div className={styles.motivationTexts}>
                    <span className={styles.listRowLabel}>{medal.label}</span>
                    <span className={styles.motivationSub}>Nivel actual</span>
                  </div>
                  {/* Racha */}
                  {streak > 0 && (
                    <div className={styles.streakPill}>
                      <FlameIcon size={13} className={styles.flameIcon} />
                      <span className={styles.streakNum}>{streak}</span>
                      <span className={styles.streakUnit}>días</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ─── Bloque: Información personal ─── */}
            <div className={styles.sectionGroup}>
              <p className={styles.sectionLabel}>INFORMACIÓN PERSONAL</p>
              <div className={styles.listCard}>

                {/* Cabecera colapsable */}
                <button
                  className={`${styles.listRow} ${!infoOpen ? styles.listRowLast : ''}`}
                  onClick={() => setInfoOpen(v => !v)}
                >
                  <span className={styles.listRowIcon}><UserIcon size={16} /></span>
                  <span className={styles.listRowLabel} style={{ flex: 1 }}>Datos de la cuenta</span>
                  <ChevronDownIcon
                    size={14}
                    className={`${styles.listRowChevron} ${infoOpen ? styles.chevronOpen : ''}`}
                  />
                </button>

                {/* Cuerpo expandible */}
                {infoOpen && (
                  <div className={styles.infoBody}>

                    {/* Fila nombre editable */}
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Nombre</span>
                      <input
                        className={styles.infoInput}
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                        placeholder="Tu nombre"
                      />
                    </div>

                    {/* Fila email (solo lectura) */}
                    {email && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Email</span>
                        <span className={styles.infoValue}>{email}</span>
                      </div>
                    )}

                    {/* Guardar nombre */}
                    <button className={styles.saveBtn} onClick={handleSaveName}>
                      {nameSaved ? '✓ Guardado' : 'Guardar cambios'}
                    </button>

                    {/* Cerrar sesión */}
                    <button className={styles.logoutBtn} onClick={handleLogout}>
                      <LogoutIcon size={14} />
                      Cerrar sesión
                    </button>

                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Modal de personalización ── */}
      {profilingOpen && (
        <ProfilingModal
          onClose={() => setProfilingOpen(false)}
          onCompleted={() => setProfilingDone(true)}
        />
      )}

    </div>
  );
}
