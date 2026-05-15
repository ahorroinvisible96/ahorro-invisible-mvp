/**
 * AppIcons — Sistema de iconografía central de Ahorro Invisible
 *
 * ESTÁNDAR v2 — Geométrico minimalista:
 *   - strokeWidth: 1.2  (más fino, menos protagonismo)
 *   - fill: none        (sin rellenos, solo trazo)
 *   - strokeLinecap: round
 *   - strokeLinejoin: round
 *   - viewBox: 0 0 24 24
 *   - Paths simplificados: formas puras, sin detalles decorativos
 */

import React from 'react';

type IconProps = { size?: number; className?: string; style?: React.CSSProperties };
const base = (size: number, style?: React.CSSProperties) => ({
  width: size, height: size, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  style,
});

// ── Navegación ────────────────────────────────────────────────────────────────

/** Casa: tejado en V + cuerpo rectangular */
export const HomeIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M3 11.5L12 4l9 7.5"/>
    <path d="M5 10v10h5v-5h4v5h5V10"/>
  </svg>
);

/** Círculo objetivo con punto central — mira de precisión */
export const TargetIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <circle cx="12" cy="12" r="8.5"/>
    <circle cx="12" cy="12" r="3.5"/>
    <circle cx="12" cy="12" r="1" strokeWidth="0" fill="currentColor"/>
  </svg>
);

/** Relámpago: dos líneas oblicuas que forman una Z */
export const BoltIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M13 2L4 14h8l-1 8 9-12h-8z"/>
  </svg>
);

/** Tres líneas verticales de distinta altura — historial */
export const BarChartIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <line x1="5"  y1="21" x2="5"  y2="13"/>
    <line x1="12" y1="21" x2="12" y2="8"/>
    <line x1="19" y1="21" x2="19" y2="3"/>
  </svg>
);

/** Cabeza + hombros: perfil */
export const UserIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <circle cx="12" cy="7.5" r="4"/>
    <path d="M3.5 20.5c0-4.1 3.8-7 8.5-7s8.5 2.9 8.5 7"/>
  </svg>
);

// ── Acciones ──────────────────────────────────────────────────────────────────

/** Lápiz diagonal simple — editar */
export const EditIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M16 3l5 5L8 21H3v-5z"/>
    <line x1="13" y1="6" x2="18" y2="11"/>
  </svg>
);

/** Engranaje de 8 radios — ajustes */
export const SettingsIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>
);

/** Puerta con flecha: salir */
export const LogoutIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

/** Bandeja + tapa: archivar */
export const ArchiveIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <rect x="2" y="4" width="20" height="5" rx="1"/>
    <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/>
    <line x1="10" y1="14" x2="14" y2="14"/>
  </svg>
);

/** Cruz diagonal: cerrar */
export const CloseIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

/** Cruz vertical: añadir */
export const PlusIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <line x1="12" y1="4" x2="12" y2="20"/>
    <line x1="4" y1="12" x2="20" y2="12"/>
  </svg>
);

/** Ángulo derecho: navegar adelante */
export const ChevronRightIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

/** Ángulo abajo: expandir */
export const ChevronDownIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

/** Campana: notificaciones */
export const BellIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M6 8a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 14 6 8"/>
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
  </svg>
);

/** Rectángulo + arco: candado */
export const LockIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

/** Escudo: privacidad */
export const ShieldIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C18.25 22.15 22 17.25 22 12V7L12 2z"/>
  </svg>
);

/** Círculo con signo de interrogación: ayuda */
export const HelpIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <circle cx="12" cy="12" r="9"/>
    <path d="M9.5 9a3 3 0 0 1 5.5 1c0 1.5-2 2.5-2.5 3.5"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

/** Línea con ángulo al alza: tendencia positiva */
export const TrendingUpIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <polyline points="2 18 9 11 13 15 22 4"/>
    <polyline points="16 4 22 4 22 10"/>
  </svg>
);

/** Estrella de 5 puntas: destacado — solo trazo, sin fill */
export const StarIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

/** Rectángulo con líneas internas: documento */
export const FileIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

/** Círculo con línea y punto: alerta */
export const AlertIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <circle cx="12" cy="12" r="9"/>
    <line x1="12" y1="8" x2="12" y2="13"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

/** Calendario: fecha */
export const CalendarIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8"  y1="2" x2="8"  y2="6"/>
    <line x1="3"  y1="10" x2="21" y2="10"/>
  </svg>
);

/** Tres capas: logo / marca */
export const BrandIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
    <path d="M2 17l10 5 10-5"/>
    <path d="M2 12l10 5 10-5"/>
  </svg>
);

/** Flecha con bandeja: exportar */
export const DownloadIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

/** Papelera: eliminar */
export const TrashIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

// ── Gamificación ──────────────────────────────────────────────────────────────

/** Llama simple — racha de días */
export const FlameIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M12 2c0 5-5 8-5 13a5 5 0 0 0 10 0c0-3-2-5-2-7-1 1.5-1.5 3-1.5 4a2.5 2.5 0 0 1-5 0c0-3 3.5-6 3.5-10z"/>
  </svg>
);

/** Brote minimalista: nivel semilla */
export const SproutIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <line x1="12" y1="22" x2="12" y2="11"/>
    <path d="M12 11c1-2 4-3.5 6-3.5-0.5 2.5-3 4.5-6 3.5z"/>
    <path d="M12 15c-1-2-4-3-5.5-2.5 0.5 2 2.5 3.5 5.5 2.5z"/>
  </svg>
);

/** Círculo con cinta: medalla */
export const MedalIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <circle cx="12" cy="8.5" r="5.5"/>
    <path d="M8.5 13.5L7 22l5-2.5L17 22l-1.5-8.5"/>
  </svg>
);

/** Rombo con línea media: diamante */
export const DiamondIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M6 3h12l4 5.5L12 21 2 8.5z"/>
    <line x1="2" y1="8.5" x2="22" y2="8.5"/>
    <line x1="12" y1="3" x2="8" y2="8.5"/>
    <line x1="12" y1="3" x2="16" y2="8.5"/>
  </svg>
);

/** Tres picos + base: corona */
export const CrownIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M3 17h18l2-11-6.5 4.5L12 4l-4.5 6.5L2 6z"/>
    <line x1="3" y1="17" x2="21" y2="17"/>
  </svg>
);

/** Copa con asas: trofeo */
export const TrophyIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M6 4v7a6 6 0 0 0 12 0V4z"/>
    <path d="M6 7H3.5a2.5 2.5 0 0 1 0-5H6"/>
    <path d="M18 7h2.5a2.5 2.5 0 0 0 0-5H18"/>
    <line x1="9" y1="17" x2="15" y2="17"/>
    <path d="M9 17v3h6v-3"/>
    <line x1="4" y1="21" x2="20" y2="21"/>
  </svg>
);
