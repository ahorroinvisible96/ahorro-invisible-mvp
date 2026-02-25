"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import {
  buildSummary,
  storeCreateGoal,
  storeArchiveGoalSafe,
  storeGetGoalBalance,
  storeSetPrimaryGoal,
  storeUpdateGoal,
  storeListArchivedGoals,
  storeTransferFromHucha,
  storeReactivateGoal,
  storeDeleteGoalPermanent,
} from '@/services/dashboardStore';
import type { Goal, Hucha } from '@/types/Dashboard';

function formatEUR(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function pct(g: Goal) {
  return Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
}

type ModalMode = 'create' | 'edit';

const S = {
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(2,6,23,0.78)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 },
  box: { background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f172a 100%)', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 25px 50px -12px rgba(2,6,23,0.9)', display: 'flex', flexDirection: 'column' as const, gap: 16 },
  label: { fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,0.7)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: 6 },
  input: { width: '100%', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 12, padding: '11px 14px', fontSize: 14, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' as const },
  select: { width: '100%', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 12, padding: '11px 14px', fontSize: 14, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' as const },
  btnCancel: { flex: 1, padding: '11px 0', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 12, background: 'rgba(30,41,59,0.5)', color: 'rgba(203,213,225,0.8)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnSave: { flex: 2, padding: '11px 0', border: 'none', borderRadius: 12, background: 'linear-gradient(90deg,#a855f7,#2563eb)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnDanger: { flex: 2, padding: '11px 0', border: 'none', borderRadius: 12, background: 'linear-gradient(90deg,#ef4444,#dc2626)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnClose: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(51,65,85,0.5)', color: 'rgba(148,163,184,0.7)', cursor: 'pointer', fontSize: 14 },
  modalTitle: { fontSize: 17, fontWeight: 700, color: '#f1f5f9', margin: 0 },
  errorBox: { fontSize: 13, color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 12px' },
};

function GoalModal({
  mode,
  initial,
  onSave,
  onClose,
  hucha,
}: {
  mode: ModalMode;
  initial?: Goal;
  onSave: (data: { title: string; targetAmount: number; horizonMonths: number; applyHucha: boolean }) => void;
  onClose: () => void;
  hucha: Hucha;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [amount, setAmount] = useState(String(initial?.targetAmount ?? ''));
  const [months, setMonths] = useState(String(initial?.horizonMonths ?? '12'));
  const [applyHucha, setApplyHucha] = useState(false);
  const [err, setErr] = useState('');
  const showHuchaOption = mode === 'create' && hucha.balance > 0;

  function submit() {
    setErr('');
    if (!title.trim()) { setErr('Escribe un nombre.'); return; }
    const a = Number(amount);
    if (!a || a <= 0) { setErr('Introduce una cantidad válida.'); return; }
    const m = Number(months);
    if (!m || m < 1) { setErr('El horizonte debe ser al menos 1 mes.'); return; }
    onSave({ title: title.trim(), targetAmount: a, horizonMonths: m, applyHucha });
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.box} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={S.modalTitle}>{mode === 'create' ? 'Nuevo objetivo' : 'Editar objetivo'}</h2>
          <button style={S.btnClose} onClick={onClose}>✕</button>
        </div>
        {err && <p style={S.errorBox}>{err}</p>}
        <div><label style={S.label}>Nombre</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Viaje a Japón" style={S.input} autoFocus />
        </div>
        <div><label style={S.label}>Meta (€)</label>
          <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="2000" style={S.input} />
        </div>
        <div><label style={S.label}>Horizonte (meses)</label>
          <input type="number" min="1" value={months} onChange={e => setMonths(e.target.value)} style={S.input} />
        </div>
        {showHuchaOption && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 12, padding: '12px 14px', cursor: 'pointer' }}>
            <input type="checkbox" checked={applyHucha} onChange={e => setApplyHucha(e.target.checked)} style={{ marginTop: 2, accentColor: '#a855f7', width: 16, height: 16, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#fbbf24', lineHeight: 1.4 }}>
              <strong>Asignar saldo de la Hucha</strong><br />
              <span style={{ color: 'rgba(251,191,36,0.7)', fontSize: 12 }}>Transferir {formatEUR(hucha.balance)} al nuevo objetivo</span>
            </span>
          </label>
        )}
        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <button style={S.btnCancel} onClick={onClose}>Cancelar</button>
          <button style={S.btnSave} onClick={submit}>{mode === 'create' ? 'Crear objetivo' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

function ArchiveModal({
  goal,
  otherGoals,
  onConfirm,
  onClose,
}: {
  goal: Goal;
  otherGoals: Goal[];
  onConfirm: (destination: string | 'hucha') => void;
  onClose: () => void;
}) {
  const hasOthers = otherGoals.length > 0;
  const [destination, setDestination] = useState<string>(hasOthers ? otherGoals[0].id : 'hucha');
  const hasBalance = goal.currentAmount > 0;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.box} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={S.modalTitle}>Archivar objetivo</h2>
          <button style={S.btnClose} onClick={onClose}>✕</button>
        </div>
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 14px' }}>
          <p style={{ fontSize: 13, color: '#f87171', margin: 0, fontWeight: 600 }}>📦 {goal.title}</p>
          {hasBalance && (
            <p style={{ fontSize: 13, color: 'rgba(248,113,113,0.8)', margin: '4px 0 0' }}>
              Saldo acumulado: <strong style={{ color: '#f87171' }}>{formatEUR(goal.currentAmount)}</strong>
            </p>
          )}
        </div>
        {hasBalance ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.9)', margin: 0 }}>
              ¿Dónde quieres transferir el saldo acumulado?
            </p>
            {hasOthers ? (
              <div>
                <label style={S.label}>Transferir saldo a</label>
                <select style={S.select} value={destination} onChange={e => setDestination(e.target.value)}>
                  {otherGoals.map(g => (
                    <option key={g.id} value={g.id} style={{ background: '#1e293b' }}>
                      {g.title} ({formatEUR(g.currentAmount)} ahorrados)
                    </option>
                  ))}
                  <option value="hucha" style={{ background: '#1e293b' }}>🪣 Enviar a la Hucha</option>
                </select>
              </div>
            ) : (
              <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 12, padding: '12px 14px' }}>
                <p style={{ fontSize: 13, color: '#fbbf24', margin: 0, fontWeight: 600 }}>🪣 Sin otros objetivos activos</p>
                <p style={{ fontSize: 12, color: 'rgba(251,191,36,0.7)', margin: '4px 0 0' }}>
                  El saldo se guardará en la <strong>Hucha</strong> hasta que crees un nuevo objetivo.
                </p>
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', margin: 0 }}>
            Este objetivo no tiene saldo acumulado. Se archivará directamente.
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <button style={S.btnCancel} onClick={onClose}>Cancelar</button>
          <button style={S.btnDanger} onClick={() => onConfirm(hasBalance ? destination : 'hucha')}>Archivar</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Hucha: asignar saldo a objetivo ────────────────────────────────────
function HuchaModal({
  hucha,
  activeGoals,
  onAssign,
  onCreateGoal,
  onClose,
}: {
  hucha: Hucha;
  activeGoals: Goal[];
  onAssign: (goalId: string, amount: number) => void;
  onCreateGoal: () => void;
  onClose: () => void;
}) {
  const hasGoals = activeGoals.length > 0;
  const [goalId, setGoalId] = useState(activeGoals[0]?.id ?? '');
  const [mode, setMode] = useState<'total' | 'partial'>('total');
  const [partial, setPartial] = useState('');
  const [err, setErr] = useState('');

  function submit() {
    setErr('');
    const amount = mode === 'total' ? hucha.balance : Number(partial);
    if (!amount || amount <= 0) { setErr('Introduce una cantidad válida.'); return; }
    if (amount > hucha.balance) { setErr(`Máximo disponible: ${formatEUR(hucha.balance)}`); return; }
    if (!goalId) { setErr('Selecciona un objetivo.'); return; }
    onAssign(goalId, amount);
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.box} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={S.modalTitle}>🪣 Asignar Hucha</h2>
          <button style={S.btnClose} onClick={onClose}>✕</button>
        </div>
        <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 12, padding: '12px 14px' }}>
          <p style={{ fontSize: 13, color: '#fbbf24', margin: 0, fontWeight: 700 }}>Saldo disponible: {formatEUR(hucha.balance)}</p>
          <p style={{ fontSize: 12, color: 'rgba(251,191,36,0.65)', margin: '3px 0 0' }}>Ahorro acumulado sin asignar a ningún objetivo</p>
        </div>
        {!hasGoals ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.8)', margin: 0 }}>No tienes objetivos activos. Crea uno para asignar este saldo.</p>
            <button style={S.btnSave} onClick={() => { onClose(); onCreateGoal(); }}>Crear nuevo objetivo</button>
          </div>
        ) : (
          <>
            <div>
              <label style={S.label}>Asignar a objetivo</label>
              <select style={S.select} value={goalId} onChange={e => setGoalId(e.target.value)}>
                {activeGoals.map(g => (
                  <option key={g.id} value={g.id} style={{ background: '#1e293b' }}>
                    {g.title} ({formatEUR(g.currentAmount)} ahorrados)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={S.label}>Importe a transferir</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button onClick={() => setMode('total')} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: `1px solid ${mode === 'total' ? 'rgba(168,85,247,0.5)' : 'rgba(51,65,85,0.5)'}`, background: mode === 'total' ? 'rgba(168,85,247,0.15)' : 'rgba(30,41,59,0.5)', color: mode === 'total' ? '#c084fc' : 'rgba(148,163,184,0.7)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Todo ({formatEUR(hucha.balance)})</button>
                <button onClick={() => setMode('partial')} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: `1px solid ${mode === 'partial' ? 'rgba(168,85,247,0.5)' : 'rgba(51,65,85,0.5)'}`, background: mode === 'partial' ? 'rgba(168,85,247,0.15)' : 'rgba(30,41,59,0.5)', color: mode === 'partial' ? '#c084fc' : 'rgba(148,163,184,0.7)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Importe parcial</button>
              </div>
              {mode === 'partial' && (
                <input type="number" min="1" max={hucha.balance} value={partial} onChange={e => setPartial(e.target.value)} placeholder={`Máx. ${formatEUR(hucha.balance)}`} style={S.input} autoFocus />
              )}
            </div>
            {err && <p style={S.errorBox}>{err}</p>}
            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button style={S.btnCancel} onClick={onClose}>Cancelar</button>
              <button style={S.btnSave} onClick={submit}>Asignar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Modal Eliminar definitivo (objetivo archivado) ────────────────────────────
function DeleteArchivedModal({
  goal,
  activeGoals,
  onConfirm,
  onClose,
}: {
  goal: Goal;
  activeGoals: Goal[];
  onConfirm: (destination: string | 'hucha' | null) => void;
  onClose: () => void;
}) {
  const hasBalance = goal.currentAmount > 0;
  const hasOthers = activeGoals.length > 0;
  const [destination, setDestination] = useState<string>(hasOthers ? activeGoals[0].id : 'hucha');

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.box} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ ...S.modalTitle, color: '#f87171' }}>Eliminar definitivamente</h2>
          <button style={S.btnClose} onClick={onClose}>✕</button>
        </div>
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 14px' }}>
          <p style={{ fontSize: 13, color: '#f87171', margin: 0, fontWeight: 600 }}>⚠️ Esta acción es irreversible</p>
          <p style={{ fontSize: 13, color: 'rgba(248,113,113,0.8)', margin: '4px 0 0' }}>Objetivo: <strong>{goal.title}</strong></p>
          {hasBalance && (
            <p style={{ fontSize: 13, color: 'rgba(248,113,113,0.8)', margin: '4px 0 0' }}>
              Saldo: <strong style={{ color: '#f87171' }}>{formatEUR(goal.currentAmount)}</strong> — debe reasignarse
            </p>
          )}
        </div>
        {hasBalance && (
          <div>
            <label style={S.label}>Reasignar saldo a</label>
            <select style={S.select} value={destination} onChange={e => setDestination(e.target.value)}>
              {hasOthers && activeGoals.map(g => (
                <option key={g.id} value={g.id} style={{ background: '#1e293b' }}>{g.title} ({formatEUR(g.currentAmount)})</option>
              ))}
              <option value="hucha" style={{ background: '#1e293b' }}>🪣 Enviar a la Hucha</option>
            </select>
          </div>
        )}
        {!hasBalance && (
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', margin: 0 }}>Este objetivo no tiene saldo. Se eliminará directamente.</p>
        )}
        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <button style={S.btnCancel} onClick={onClose}>Cancelar</button>
          <button style={S.btnDanger} onClick={() => onConfirm(hasBalance ? destination : null)}>Eliminar definitivamente</button>
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
    <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 16, padding: '18px 20px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2,6,23,0.4)' }} onClick={onDetail}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.title}</span>
            {goal.isPrimary && <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(37,99,235,0.2)', color: '#60a5fa', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(37,99,235,0.3)', flexShrink: 0 }}>PRINCIPAL</span>}
            {isCompleted && <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(22,163,74,0.15)', color: '#4ade80', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(22,163,74,0.3)', flexShrink: 0 }}>✓ COMPLETADO</span>}
          </div>
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', margin: 0 }}>{goal.horizonMonths} meses · {formatEUR(goal.currentAmount)} / {formatEUR(goal.targetAmount)}</p>
        </div>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#60a5fa', flexShrink: 0, marginLeft: 12 }}>{p}%</span>
      </div>
      <div style={{ background: 'rgba(30,41,59,0.8)', borderRadius: 999, height: 5, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ width: `${p}%`, height: 5, background: isCompleted ? 'linear-gradient(90deg,#4ade80,#16a34a)' : 'linear-gradient(90deg,#a855f7,#2563eb)', borderRadius: 999 }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
        {!goal.isPrimary && !isCompleted && (
          <button onClick={onSetPrimary} style={{ fontSize: 12, padding: '5px 10px', border: '1px solid rgba(37,99,235,0.35)', background: 'rgba(37,99,235,0.12)', color: '#60a5fa', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Principal</button>
        )}
        <button onClick={onEdit} style={{ fontSize: 12, padding: '5px 10px', border: '1px solid rgba(51,65,85,0.5)', background: 'rgba(30,41,59,0.5)', color: 'rgba(203,213,225,0.8)', borderRadius: 8, cursor: 'pointer' }}>Editar</button>
        <button onClick={onArchive} style={{ fontSize: 12, padding: '5px 10px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', borderRadius: 8, cursor: 'pointer' }}>Archivar</button>
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const router = useRouter();
  const [activeGoals, setActiveGoals] = useState<Goal[]>([]);
  const [archivedGoals, setArchivedGoals] = useState<Goal[]>([]);
  const [hucha, setHucha] = useState<Hucha>({ balance: 0, entries: [] });
  const [showArchived, setShowArchived] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [archivingGoal, setArchivingGoal] = useState<Goal | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null);
  const [showHuchaModal, setShowHuchaModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    const summary = buildSummary('30d');
    setActiveGoals(summary.goals.filter(g => !g.archived));
    setArchivedGoals(storeListArchivedGoals());
    setHucha(summary.hucha);
  };

  useEffect(() => {
    analytics.setScreen('goals');
    const isAuth = localStorage.getItem('isAuthenticated');
    if (isAuth !== 'true') { router.replace('/signup'); return; }
    refresh();
    setLoading(false);
  }, [router]);

  const handleCreate = (data: { title: string; targetAmount: number; horizonMonths: number; applyHucha: boolean }) => {
    const summary = storeCreateGoal({ title: data.title, targetAmount: data.targetAmount, horizonMonths: data.horizonMonths, currentAmount: 0 });
    const newGoal = summary.goals.filter(g => !g.archived).slice(-1)[0];
    if (data.applyHucha && newGoal && hucha.balance > 0) {
      storeTransferFromHucha(newGoal.id, hucha.balance);
    }
    analytics.goalCreated(newGoal?.id ?? '', summary.goals.filter(g => !g.archived).length === 1, data.targetAmount, data.horizonMonths);
    setModalMode(null);
    refresh();
  };

  const handleEdit = (data: { title: string; targetAmount: number; horizonMonths: number; applyHucha: boolean }) => {
    if (!editingGoal) return;
    storeUpdateGoal(editingGoal.id, { title: data.title, targetAmount: data.targetAmount, horizonMonths: data.horizonMonths });
    setModalMode(null);
    setEditingGoal(null);
    refresh();
  };

  const handleArchiveRequest = (goalId: string) => {
    const goal = activeGoals.find(g => g.id === goalId);
    if (!goal) return;
    const balance = storeGetGoalBalance(goalId);
    const others = activeGoals.filter(g => g.id !== goalId);
    if (balance > 0 || others.length > 0) {
      setArchivingGoal(goal);
    } else {
      storeArchiveGoalSafe(goalId, 'hucha');
      analytics.goalArchived(goalId, goal.isPrimary);
      refresh();
    }
  };

  const handleArchiveConfirm = (destination: string | 'hucha') => {
    if (!archivingGoal) return;
    storeArchiveGoalSafe(archivingGoal.id, destination);
    analytics.goalArchived(archivingGoal.id, archivingGoal.isPrimary);
    setArchivingGoal(null);
    refresh();
  };

  const handleSetPrimary = (goalId: string) => {
    storeSetPrimaryGoal(goalId);
    refresh();
  };

  const handleReactivate = (goalId: string) => {
    storeReactivateGoal(goalId);
    refresh();
  };

  const handleDeleteConfirm = (destination: string | 'hucha' | null) => {
    if (!deletingGoal) return;
    storeDeleteGoalPermanent(deletingGoal.id, destination);
    setDeletingGoal(null);
    refresh();
  };

  const handleHuchaAssign = (goalId: string, amount: number) => {
    storeTransferFromHucha(goalId, amount);
    setShowHuchaModal(false);
    refresh();
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617' }}>
        <span style={{ color: 'rgba(148,163,184,0.6)', fontSize: 14 }}>Cargando objetivos...</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#020617', padding: '24px 16px 80px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Modals */}
        {modalMode && (
          <GoalModal
            mode={modalMode}
            initial={modalMode === 'edit' ? editingGoal ?? undefined : undefined}
            onSave={modalMode === 'create' ? handleCreate : handleEdit}
            onClose={() => { setModalMode(null); setEditingGoal(null); }}
            hucha={hucha}
          />
        )}
        {archivingGoal && (
          <ArchiveModal
            goal={archivingGoal}
            otherGoals={activeGoals.filter(g => g.id !== archivingGoal.id)}
            onConfirm={handleArchiveConfirm}
            onClose={() => setArchivingGoal(null)}
          />
        )}
        {deletingGoal && (
          <DeleteArchivedModal
            goal={deletingGoal}
            activeGoals={activeGoals}
            onConfirm={handleDeleteConfirm}
            onClose={() => setDeletingGoal(null)}
          />
        )}
        {showHuchaModal && hucha.balance > 0 && (
          <HuchaModal
            hucha={hucha}
            activeGoals={activeGoals}
            onAssign={handleHuchaAssign}
            onCreateGoal={() => setModalMode('create')}
            onClose={() => setShowHuchaModal(false)}
          />
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: 'rgba(148,163,184,0.6)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 6 }}>← Dashboard</button>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Mis Objetivos</h1>
          </div>
          <button onClick={() => setModalMode('create')} style={{ padding: '10px 18px', background: 'linear-gradient(90deg,#a855f7,#2563eb)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(168,85,247,0.35)' }}>
            + Nuevo
          </button>
        </div>

        {/* Badge Hucha — clickable */}
        {hucha.balance > 0 && (
          <div onClick={() => setShowHuchaModal(true)} style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 14, padding: '14px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <span style={{ fontSize: 22 }}>🪣</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', margin: 0 }}>Hucha · {formatEUR(hucha.balance)}</p>
              <p style={{ fontSize: 12, color: 'rgba(251,191,36,0.65)', margin: '2px 0 0' }}>{activeGoals.length > 0 ? 'Toca para asignar a un objetivo' : 'Toca para crear un objetivo y asignar'}</p>
            </div>
            <span style={{ fontSize: 12, color: 'rgba(251,191,36,0.5)' }}>→</span>
          </div>
        )}

        {/* Objetivos activos */}
        {activeGoals.length === 0 ? (
          <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 16, padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 6 }}>Sin objetivos activos</p>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.6)', marginBottom: 20 }}>Crea tu primer objetivo para empezar a ahorrar.</p>
            <button onClick={() => setModalMode('create')} style={{ padding: '12px 24px', background: 'linear-gradient(90deg,#a855f7,#2563eb)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Crear objetivo</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {activeGoals.map(g => (
              <GoalCard
                key={g.id}
                goal={g}
                onDetail={() => router.push(`/goals/${g.id}`)}
                onEdit={() => { setEditingGoal(g); setModalMode('edit'); }}
                onArchive={() => handleArchiveRequest(g.id)}
                onSetPrimary={() => handleSetPrimary(g.id)}
              />
            ))}
          </div>
        )}

        {/* Objetivos archivados */}
        {archivedGoals.length > 0 && (
          <div>
            <button onClick={() => setShowArchived(v => !v)} style={{ background: 'none', border: 'none', color: 'rgba(148,163,184,0.5)', fontSize: 13, cursor: 'pointer', marginBottom: 12, fontWeight: 600 }}>
              {showArchived ? '▲' : '▼'} Archivados ({archivedGoals.length})
            </button>
            {showArchived && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {archivedGoals.map(g => (
                  <div key={g.id} style={{ background: 'rgba(15,23,42,0.6)', borderRadius: 12, padding: '14px 18px', border: '1px solid rgba(51,65,85,0.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(148,163,184,0.8)' }}>{g.title}</span>
                      <span style={{ fontSize: 12, color: 'rgba(100,116,139,0.7)' }}>{pct(g)}%</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(100,116,139,0.6)', margin: '0 0 10px' }}>{formatEUR(g.currentAmount)} / {formatEUR(g.targetAmount)}</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleReactivate(g.id)}
                        style={{ flex: 1, fontSize: 12, padding: '7px 0', border: '1px solid rgba(37,99,235,0.35)', background: 'rgba(37,99,235,0.12)', color: '#60a5fa', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                      >
                        ✓ Reactivar
                      </button>
                      <button
                        onClick={() => setDeletingGoal(g)}
                        style={{ flex: 1, fontSize: 12, padding: '7px 0', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                      >
                        🗑 Eliminar
                      </button>
                    </div>
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
