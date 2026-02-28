"use client";

import React from 'react';

interface CollapsibleWidgetProps {
  /** Clave única para sessionStorage */
  id: string;
  /** Indica si está plegado */
  collapsed: boolean;
  /** Callback para plegar/desplegar */
  onToggle: () => void;
  /** Resumen mínimo que se muestra en estado plegado */
  summary: React.ReactNode;
  /** Contenido completo (solo visible en estado desplegado) */
  children: React.ReactNode;
  /** Estilo adicional para el wrapper externo */
  style?: React.CSSProperties;
}

const chevronStyle = (collapsed: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 8,
  background: 'rgba(30,41,59,0.6)',
  border: '1px solid rgba(51,65,85,0.4)',
  flexShrink: 0,
  transition: 'transform 0.22s ease',
  transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
  color: 'rgba(148,163,184,0.7)',
  cursor: 'pointer',
});

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * Wrapper que añade comportamiento plegable a cualquier widget.
 * - Plegado: muestra `summary` + chevron
 * - Desplegado: oculta `summary`, muestra `children` + chevron
 */
export function CollapsibleWidget({
  collapsed,
  onToggle,
  summary,
  children,
  style,
}: CollapsibleWidgetProps) {
  return (
    <div style={{ position: 'relative', ...style }}>
      {/* Botón de colapso: siempre visible en la esquina superior derecha */}
      <button
        onClick={onToggle}
        aria-label={collapsed ? 'Desplegar widget' : 'Plegar widget'}
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          zIndex: 10,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <div style={chevronStyle(collapsed)}>
          <ChevronIcon />
        </div>
      </button>

      {/* Resumen (estado plegado) */}
      {collapsed && (
        <div
          onClick={onToggle}
          style={{ cursor: 'pointer', paddingRight: 48 }}
        >
          {summary}
        </div>
      )}

      {/* Contenido completo (estado desplegado) */}
      {!collapsed && children}
    </div>
  );
}

export default CollapsibleWidget;
