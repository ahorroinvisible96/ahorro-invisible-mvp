"use client";

import React from 'react';
import { PiggyBank, Sparkles, ChevronRight } from 'lucide-react';
import s from './SavingsBadge.module.css';

interface SavingsBadgeProps {
  balance: number;
  hasActiveGoals: boolean;
  onClick: () => void;
}

function formatEUR(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export function SavingsBadge({ balance, hasActiveGoals, onClick }: SavingsBadgeProps) {
  if (balance <= 0) return null;

  return (
    <button onClick={onClick} className={s.badge}>
      {/* Icono con badge Sparkles */}
      <div className={s.iconWrap}>
        <div className={s.iconBox}>
          <PiggyBank size={28} color="#fff" strokeWidth={1.8} />
        </div>
        <div className={s.sparklesBadge}>
          <Sparkles size={11} color="#fff" strokeWidth={2.5} />
        </div>
      </div>

      {/* Contenido */}
      <div className={s.content}>
        <p className={s.label}>Hucha de Ahorro</p>
        <div className={s.valueRow}>
          <span className={s.amount}>{formatEUR(balance)}</span>
          <span className={s.statusBadge}>Disponible</span>
        </div>
        <p className={s.description}>
          {hasActiveGoals
            ? 'Asigna este dinero a uno de tus objetivos'
            : 'Crea un objetivo para comenzar a asignar'}
        </p>
      </div>

      {/* Flecha + indicador */}
      <div className={s.arrowCol}>
        <div className={s.arrowBox}>
          <ChevronRight size={18} color="#34d399" strokeWidth={2.5} />
        </div>
        <span className={s.arrowLabel}>Asignar</span>
      </div>
    </button>
  );
}
