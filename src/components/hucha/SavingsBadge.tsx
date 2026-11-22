"use client";

import React from 'react';
import { PiggyBank, ChevronRight } from 'lucide-react';
import s from './SavingsBadge.module.css';

interface SavingsBadgeProps {
  balance: number;
  hasActiveGoals: boolean;
  onClick: () => void;
}

function formatEUR(n: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function SavingsBadge({ balance, hasActiveGoals, onClick }: SavingsBadgeProps) {
  if (balance <= 0) return null;

  return (
    <button type="button" onClick={onClick} className={s.badge}>
      <div className={s.left}>
        <div className={s.iconCircle}>
          <PiggyBank size={19} color="#ffffff" strokeWidth={1.9} />
        </div>
        <div className={s.texts}>
          <span className={s.title}>Hucha de ahorro</span>
          <span className={s.subtitle}>
            {hasActiveGoals ? 'Disponible para asignar' : 'Crea una meta para asignar'}
          </span>
        </div>
      </div>

      <div className={s.right}>
        <span className={s.amount}>{formatEUR(balance)}</span>
        <ChevronRight size={16} className={s.chevron} />
      </div>
    </button>
  );
}
