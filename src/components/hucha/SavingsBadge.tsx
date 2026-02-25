"use client";

import React, { useState } from 'react';
import { PiggyBank, Sparkles, ChevronRight } from 'lucide-react';

interface SavingsBadgeProps {
  balance: number;
  hasActiveGoals: boolean;
  onClick: () => void;
}

function formatEUR(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export function SavingsBadge({ balance, hasActiveGoals, onClick }: SavingsBadgeProps) {
  const [hovered, setHovered] = useState(false);

  if (balance <= 0) return null;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        background: 'linear-gradient(to right, rgba(16,185,129,0.10), rgba(20,184,166,0.10), rgba(6,182,212,0.10))',
        border: `2px solid ${hovered ? 'rgba(52,211,153,0.50)' : 'rgba(16,185,129,0.30)'}`,
        borderRadius: 20,
        padding: '16px 20px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        cursor: 'pointer',
        textAlign: 'left',
        boxShadow: hovered ? '0 10px 25px -5px rgba(16,185,129,0.20)' : 'none',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Icono con badge Sparkles */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'linear-gradient(135deg, #34d399, #2dd4bf, #22d3ee)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(52,211,153,0.35)',
        }}>
          <PiggyBank size={28} color="#fff" strokeWidth={1.8} />
        </div>
        {/* Badge Sparkles dorado */}
        <div style={{
          position: 'absolute',
          top: -6,
          right: -6,
          width: 20,
          height: 20,
          borderRadius: 999,
          background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(251,191,36,0.5)',
        }}>
          <Sparkles size={11} color="#fff" strokeWidth={2.5} />
        </div>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(52,211,153,0.70)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>
          Hucha de Ahorro
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9', fontFamily: 'ui-monospace, monospace', letterSpacing: '-0.02em' }}>
            {formatEUR(balance)}
          </span>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 999,
            background: 'rgba(52,211,153,0.15)',
            border: '1px solid rgba(52,211,153,0.30)',
            color: '#34d399',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            Disponible
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.75)', margin: 0, lineHeight: 1.4 }}>
          {hasActiveGoals
            ? 'Asigna este dinero a uno de tus objetivos'
            : 'Crea un objetivo para comenzar a asignar'}
        </p>
      </div>

      {/* Flecha + indicador desktop */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: hovered ? 'rgba(52,211,153,0.15)' : 'rgba(52,211,153,0.08)',
          border: `1px solid ${hovered ? 'rgba(52,211,153,0.35)' : 'rgba(52,211,153,0.20)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}>
          <ChevronRight size={18} color="#34d399" strokeWidth={2.5} />
        </div>
        <span style={{ fontSize: 9, color: 'rgba(52,211,153,0.55)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
          Asignar
        </span>
      </div>
    </button>
  );
}
