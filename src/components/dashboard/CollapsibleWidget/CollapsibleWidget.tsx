"use client";

import React from 'react';

/**
 * Icono chevron animado para usar dentro del header de cada widget.
 * collapsed=true → apunta abajo (▼), collapsed=false → apunta arriba (▲)
 */
export function CollapseChevron({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-label={collapsed ? 'Desplegar' : 'Plegar'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 8,
        background: 'rgba(30,41,59,0.6)',
        border: '1px solid rgba(51,65,85,0.4)',
        flexShrink: 0,
        cursor: 'pointer',
        padding: 0,
        color: 'rgba(148,163,184,0.8)',
        transition: 'background 0.15s ease',
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transition: 'transform 0.22s ease',
          transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
        }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}

interface CollapsibleWidgetProps {
  /** Indica si está plegado */
  collapsed: boolean;
  /** Contenido del header (debe incluir CollapseChevron integrado) */
  header: React.ReactNode;
  /** Contenido colapsable (solo visible cuando collapsed=false) */
  children: React.ReactNode;
  /** Estilo adicional para el wrapper */
  style?: React.CSSProperties;
}

/**
 * Wrapper minimalista: renderiza siempre el header (que contiene el chevron),
 * y solo muestra children cuando collapsed=false.
 */
export function CollapsibleWidget({
  collapsed,
  header,
  children,
  style,
}: CollapsibleWidgetProps) {
  return (
    <div style={style}>
      {header}
      {!collapsed && children}
    </div>
  );
}

export default CollapsibleWidget;
