/**
 * AppIcons — Sistema de iconografía central de Ahorro Invisible
 *
 * ESTÁNDAR:
 *   - strokeWidth: 1.5
 *   - fill: none  (excepto puntos o fills explícitos)
 *   - strokeLinecap: round
 *   - strokeLinejoin: round
 *   - viewBox: 0 0 24 24
 *
 * Todos los iconos de la app deben importarse desde aquí.
 */

import React from 'react';

type IconProps = { size?: number; className?: string; style?: React.CSSProperties };
const base = (size: number, style?: React.CSSProperties) => ({
  width: size, height: size, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  style,
});

// ── Navegación ────────────────────────────────────────────────────────────────

/** Casa: tejado triangular + cuerpo con puerta */
export const HomeIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9.5z"/>
    <rect x="9" y="14" width="6" height="7" rx="0.5"/>
  </svg>
);

/** Rombo con punto: objetivos */
export const TargetIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M12 3L21 12L12 21L3 12Z"/>
    <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/>
  </svg>
);

/** Relámpago: decisión / acción rápida */
export const BoltIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M13 3L5 13h7l-1 8 9-10h-7l1-8z"/>
  </svg>
);

/** Barras ascendentes: historial / progreso */
export const BarChartIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <rect x="3"  y="13" width="4" height="8"  rx="1"/>
    <rect x="10" y="8"  width="4" height="13" rx="1"/>
    <rect x="17" y="3"  width="4" height="18" rx="1"/>
  </svg>
);

/** Persona: perfil / usuario */
export const UserIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <circle cx="12" cy="7" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);

// ── Acciones ──────────────────────────────────────────────────────────────────

/** Engranaje: ajustes */
export const SettingsIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>
);

/** Puerta con flecha: logout / salir */
export const LogoutIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

/** Lápiz minimalista: editar */
export const EditIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

/** Bandeja apilada: archivar */
export const ArchiveIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <rect x="2" y="4" width="20" height="5" rx="1"/>
    <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/>
    <line x1="10" y1="14" x2="14" y2="14"/>
  </svg>
);

/** Cruz: cerrar / eliminar */
export const CloseIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

/** Más: añadir */
export const PlusIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

/** Flecha derecha: navegar / avanzar */
export const ChevronRightIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

/** Flecha abajo: expandir */
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

/** Candado: seguridad / sesión */
export const LockIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

/** Escudo: datos / privacidad */
export const ShieldIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C18.25 22.15 22 17.25 22 12V7L12 2z"/>
  </svg>
);

/** Signo de interrogación: ayuda / FAQ */
export const HelpIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <circle cx="12" cy="12" r="9"/>
    <path d="M9 9a3 3 0 0 1 6 0c0 2-3 3-3 3"/>
    <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none"/>
  </svg>
);

/** Tendencia al alza: progreso / crecimiento */
export const TrendingUpIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
    <polyline points="16 7 22 7 22 13"/>
  </svg>
);

/** Estrella: destacado / primario */
export const StarIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className} fill="currentColor">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

/** Calendario: tiempo / fecha */
export const CalendarIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8"  y1="2" x2="8"  y2="6"/>
    <line x1="3"  y1="10" x2="21" y2="10"/>
  </svg>
);

/** Documento / archivo */
export const FileIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

/** Círculo de alerta: advertencia */
export const AlertIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <circle cx="12" cy="12" r="9"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="none"/>
  </svg>
);

/** Capas apiladas: logo / marca */
export const BrandIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className} strokeWidth={2}>
    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
    <path d="M2 17l10 5 10-5"/>
    <path d="M2 12l10 5 10-5"/>
  </svg>
);

/** Export / descarga */
export const DownloadIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

/** Borrar / papelera */
export const TrashIcon = ({ size = 24, className, style }: IconProps) => (
  <svg {...base(size, style)} className={className}>
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
