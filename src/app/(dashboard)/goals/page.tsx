"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import {
  buildSummary,
  storeCreateGoal,
  storeArchiveGoal,
  storeSetPrimaryGoal,
  storeUpdateGoal,
  storeListArchivedGoals,
} from '@/services/dashboardStore';
import type { Goal } from '@/types/Dashboard';

function formatEUR(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function pct(g: Goal) {
  return Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
}

type ModalMode = 'create' | 'edit';

function GoalModal({
  mode,
  initial,
  onSave,
  onClose,
}: {
  mode: ModalMode;
  initial?: Goal;
  onSave: (data: { title: string; targetAmount: number; horizonMonths: number }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [amount, setAmount] = useState(String(initial?.targetAmount ?? ''));
  const [months, setMonths] = useState(String(initial?.horizonMonths ?? '12'));
  const [err, setErr] = useState('');

  function submit() {
    setErr('');
    if (!title.trim()) { setErr('Escribe un nombre.'); return; }
    const a = Number(amount);
    if (!a || a <= 0) { setErr('Introduce una cantidad válida.'); return; }
    const m = Number(months);
    if (!m || m < 1) { setErr('El horizonte debe ser al menos 1 mes.'); return; }
    onSave({ title: title.trim(), targetAmount: a, horizonMonths: m });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>{mode === 'create' ? 'Nuevo objetivo' : 'Editar objetivo'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', padding: 4 }}>✕</button>
        </div>
        {err && <p style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{err}</p>}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Nombre</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Viaje a Japón" style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Meta (€)</label>
          <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Ej: 2000" style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Horizonte (meses)</label>
          <input type="number" min="1" value={months} onChange={e => setMonths(e.target.value)} style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px 0', background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer', color: '#374151' }}>Cancelar</button>
          <button onClick={submit} style={{ flex: 2, padding: '12px 0', background: '#2563eb', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>{mode === 'create' ? 'Crear objetivo' : 'Guardar cambios'}</button>
        </div>
      </div>
    </div>
  );
}

function GoalCard({
  goal,
  onEdit,
  onArchive,
  onSetPrimary,
  onDetail,
}: {
  goal: Goal;
  onEdit: () => void;
  onArchive: () => void;
  onSetPrimary: () => void;
  onDetail: () => void;
}) {
  const p = pct(goal);
  const isCompleted = goal.currentAmount >= goal.targetAmount;
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '20px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', cursor: 'pointer' }} onClick={onDetail}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.title}</span>
            {goal.isPrimary && <span style={{ fontSize: 11, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>PRINCIPAL</span>}
            {isCompleted && <span style={{ fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>✓ COMPLETADO</span>}
          </div>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{goal.horizonMonths} meses · {formatEUR(goal.currentAmount)} / {formatEUR(goal.targetAmount)}</p>
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#2563eb', flexShrink: 0, marginLeft: 12 }}>{p}%</span>
      </div>
      <div style={{ background: '#e5e7eb', borderRadius: 999, height: 6, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ width: `${p}%`, height: 6, background: isCompleted ? '#16a34a' : 'linear-gradient(90deg,#60a5fa,#2563eb)', borderRadius: 999 }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
        {!goal.isPrimary && !isCompleted && (
          <button onClick={onSetPrimary} style={{ fontSize: 12, padding: '5px 10px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}>Principal</button>
        )}
        <button onClick={onEdit} style={{ fontSize: 12, padding: '5px 10px', border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', borderRadius: 7, cursor: 'pointer' }}>Editar</button>
        <button onClick={onArchive} style={{ fontSize: 12, padding: '5px 10px', border: '1px solid #fecaca', background: 'transparent', color: '#dc2626', borderRadius: 7, cursor: 'pointer' }}>Archivar</button>
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const router = useRouter();
  const [activeGoals, setActiveGoals] = useState<Goal[]>([]);
  const [archivedGoals, setArchivedGoals] = useState<Goal[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    const summary = buildSummary('30d');
    setActiveGoals(summary.goals.filter(g => !g.archived));
    setArchivedGoals(storeListArchivedGoals());
  };

  useEffect(() => {
    analytics.setScreen('goals');
    const isAuth = localStorage.getItem('isAuthenticated');
    if (isAuth !== 'true') { router.replace('/signup'); return; }
    refresh();
    setLoading(false);
  }, [router]);

  const handleCreate = (data: { title: string; targetAmount: number; horizonMonths: number }) => {
    const summary = storeCreateGoal({ ...data, currentAmount: 0 });
    analytics.goalCreated(`goal_${Date.now()}`, summary.goals.filter(g => !g.archived).length === 1, data.targetAmount, data.horizonMonths);
    setModalMode(null);
    refresh();
  };

  const handleEdit = (data: { title: string; targetAmount: number; horizonMonths: number }) => {
    if (!editingGoal) return;
    storeUpdateGoal(editingGoal.id, data);
    setModalMode(null);
    setEditingGoal(null);
    refresh();
  };

  const handleArchive = (goalId: string) => {
    if (!window.confirm('¿Archivar este objetivo?')) return;
    storeArchiveGoal(goalId);
    analytics.goalArchived(goalId, activeGoals.find(g => g.id === goalId)?.isPrimary ?? false);
    refresh();
  };

  const handleSetPrimary = (goalId: string) => {
    storeSetPrimaryGoal(goalId);
    refresh();
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}><span style={{ color: '#9ca3af' }}>Cargando...</span></div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '24px 16px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {modalMode && (
          <GoalModal
            mode={modalMode}
            initial={modalMode === 'edit' ? editingGoal ?? undefined : undefined}
            onSave={modalMode === 'create' ? handleCreate : handleEdit}
            onClose={() => { setModalMode(null); setEditingGoal(null); }}
          />
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 6 }}>← Dashboard</button>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>Mis Objetivos</h1>
          </div>
          <button onClick={() => setModalMode('create')} style={{ padding: '10px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            + Nuevo
          </button>
        </div>

        {/* Objetivos activos */}
        {activeGoals.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: '40px 24px', textAlign: 'center', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Sin objetivos activos</p>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>Crea tu primer objetivo para empezar a ahorrar.</p>
            <button onClick={() => setModalMode('create')} style={{ padding: '12px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Crear objetivo</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {activeGoals.map(g => (
              <GoalCard
                key={g.id}
                goal={g}
                onDetail={() => router.push(`/goals/${g.id}`)}
                onEdit={() => { setEditingGoal(g); setModalMode('edit'); }}
                onArchive={() => handleArchive(g.id)}
                onSetPrimary={() => handleSetPrimary(g.id)}
              />
            ))}
          </div>
        )}

        {/* Objetivos archivados */}
        {archivedGoals.length > 0 && (
          <div>
            <button onClick={() => setShowArchived(v => !v)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', marginBottom: 12, fontWeight: 600 }}>
              {showArchived ? '▲' : '▼'} Archivados ({archivedGoals.length})
            </button>
            {showArchived && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {archivedGoals.map(g => (
                  <div key={g.id} style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 18px', border: '1px solid #e5e7eb', opacity: 0.7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>{g.title}</span>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>{pct(g)}%</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>{formatEUR(g.currentAmount)} / {formatEUR(g.targetAmount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
