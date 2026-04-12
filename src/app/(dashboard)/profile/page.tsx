"use client";

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { analytics } from '@/services/analytics';
import { buildSummary, storeUpdateUserName, storeUpdateIncome } from '@/services/dashboardStore';
import { authSignOut } from '@/services/authService';
import type { IncomeRange } from '@/types/Dashboard';
import styles from './Profile.module.css';
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
  const [userName, setUserName]       = useState('');
  const [email, setEmail]             = useState('');
  const [incomeRange, setIncomeRange] = useState<IncomeRange | null>(null);
  const [loading, setLoading]         = useState(true);
  const [totalSaved, setTotalSaved]   = useState(0);
  const [streak, setStreak]           = useState(0);
  const [infoOpen, setInfoOpen]       = useState(false);
  const [editingName, setEditingName] = useState('');
  const [nameSaved, setNameSaved]     = useState(false);

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
    return <div className={styles.page}><div className={styles.loading}>Cargando perfil…</div></div>;
  }

  const initials = getInitials(userName, email);
  const firstName = userName.trim().split(' ')[0] || 'Usuario';
  const medal = getMedal(totalSaved);
  const incomeStr = formatIncome(incomeRange);

  return (
    <div className={styles.page}>
      <Suspense fallback={null}>
        <SectionOpener onOpen={handleSectionOpen} />
      </Suspense>

      {/* ══════════════════════════════════════════
          BLOQUE 1 — HERO HEADER
      ══════════════════════════════════════════ */}
      <header className={styles.hero}>

        {/* Zona alta: avatar + saludo */}
        <div className={styles.heroTop}>
          <div className={styles.avatar}>{initials}</div>
          <div className={styles.heroGreeting}>
            <span className={styles.heroSub}>Bienvenido de nuevo</span>
            <span className={styles.heroName}>{firstName}</span>
          </div>
        </div>

        {/* Divisor */}
        <div className={styles.heroDivider} />

        {/* Zona baja: ingresos + acción editar */}
        <div className={styles.heroBottom}>
          <div className={styles.heroIncomeBlock}>
            <span className={styles.heroIncomeLabel}>INGRESOS MENSUALES</span>
            <span className={styles.heroIncomeValue}>{incomeStr}</span>
          </div>
          <button
            className={styles.heroEditPill}
            onClick={() => setInfoOpen(true)}
            aria-label="Editar ingresos"
          >
            <EditIcon size={12} />
            Editar
          </button>
        </div>

      </header>

      {/* ── Contenido scrollable ── */}
      <div className={styles.content}>

        {/* ══════════════════════════════════════
            BLOQUE 2 — ACCESO RÁPIDO
        ══════════════════════════════════════ */}
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

        {/* ══════════════════════════════════════
            BLOQUE 3 — MOTIVACIÓN
        ══════════════════════════════════════ */}
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

        {/* ══════════════════════════════════════
            BLOQUE 4 — INFORMACIÓN PERSONAL
        ══════════════════════════════════════ */}
        <div className={styles.listCard}>

          {/* Cabecera colapsable */}
          <button
            className={`${styles.listRow} ${!infoOpen ? styles.listRowLast : ''}`}
            onClick={() => setInfoOpen(v => !v)}
          >
            <span className={styles.listRowIcon}><UserIcon size={16} /></span>
            <span className={styles.listRowLabel} style={{ flex: 1 }}>Información personal</span>
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
  );
}
