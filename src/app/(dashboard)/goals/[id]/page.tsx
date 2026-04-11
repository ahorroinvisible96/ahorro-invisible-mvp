"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/services/analytics';
import {
  buildSummary,
  storeUpdateGoal,
  storeArchiveGoalSafe,
  storeSetPrimaryGoal,
  storeListActiveGoals,
  DAILY_QUESTIONS,
} from '@/services/dashboardStore';
import { syncGoalToSupabase } from '@/services/syncService';
import type { Goal, DailyDecision } from '@/types/Dashboard';

function formatEUR(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
}
function formatDate(d: string) {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d));
}

type StoreShape = { decisions: DailyDecision[]; goals: Goal[] };

export default function GoalDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [decisions, setDecisions] = useState<DailyDecision[]>([]);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [horizonMonths, setHorizonMonths] = useState('');
  const [editErr, setEditErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveDest, setArchiveDest] = useState<string>('hucha');
  const [otherGoals, setOtherGoals] = useState<{ id: string; title: string }[]>([]);

  const refresh = () => {
    const summary = buildSummary('30d');
    const found = summary.goals.find(g => g.id === params.id) ?? null;
    setGoal(found);
    if (found) {
      setTitle(found.title);
      setTargetAmount(String(found.targetAmount));
      setHorizonMonths(String(found.horizonMonths));
    }
    const raw = localStorage.getItem('ahorro_invisible_dashboard_v1');
    if (raw) {
      const store = JSON.parse(raw) as StoreShape;
      const goalDecisions = store.decisions.filter(d => d.goalId === params.id);
      setDecisions([...goalDecisions].sort((a, b) => b.date.localeCompare(a.date)));
    }
  };

  useEffect(() => {
    analytics.setScreen('goal_detail');
    const isAuth = localStorage.getItem('isAuthenticated');
    if (isAuth !== 'true') { router.replace('/signup'); return; }
    refresh();
    setLoading(false);
  }, [router, params.id]);

  const pct = goal ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
  const isCompleted = goal ? goal.currentAmount >= goal.targetAmount : false;
  const totalSaved = useMemo(() => decisions.reduce((s, d) => s + d.deltaAmount, 0), [decisions]);

  const avgMonthly = useMemo(() => {
    if (decisions.length === 0) return 0;
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
    const recent = decisions.filter(d => d.date >= cutoff);
    return recent.reduce((s, d) => s + d.deltaAmount, 0);
  }, [decisions]);

  const eta = useMemo(() => {
    if (!goal || isCompleted) return null;
    const remaining = goal.targetAmount - goal.currentAmount;
    if (avgMonthly <= 0) return goal.horizonMonths;
    return Math.ceil(remaining / avgMonthly);
  }, [goal, isCompleted, avgMonthly]);

  const handleSaveEdit = () => {
    setEditErr('');
    if (!title.trim()) { setEditErr('Escribe un nombre.'); return; }
    const a = Number(targetAmount);
    if (!a || a <= 0) { setEditErr('Cantidad inválida.'); return; }
    const m = Number(horizonMonths);
    if (!m || m < 1) { setEditErr('Horizonte inválido.'); return; }
    storeUpdateGoal(params.id, { title: title.trim(), targetAmount: a, horizonMonths: m });
    setEditing(false);
    refresh();
  };

  const openArchiveModal = () => {
    const active = storeListActiveGoals().filter((g) => g.id !== params.id);
    setOtherGoals(active);
    setArchiveDest(active.length > 0 ? active[0].id : 'hucha');
    setShowArchiveModal(true);
  };

  const handleConfirmArchive = () => {
    if (!goal) return;
    storeArchiveGoalSafe(params.id, archiveDest);
    analytics.goalArchived(params.id, goal.isPrimary);
    syncGoalToSupabase({ ...goal, archived: true, currentAmount: 0 }).catch(() => null);
    setShowArchiveModal(false);
    router.push('/goals');
  };

  const handleSetPrimary = () => {
    storeSetPrimaryGoal(params.id);
    refresh();
  };

  const D = {
    page: '#0f172a',
    card: '#1e293b',
    cardBorder: 'rgba(51,65,85,0.6)',
    tp: '#f1f5f9',
    ts: 'rgba(148,163,184,0.85)',
    tm: 'rgba(148,163,184,0.5)',
    border: 'rgba(51,65,85,0.55)',
    stat: 'rgba(15,23,42,0.7)',
    green: '#4ade80',
    blue: '#60a5fa',
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: D.page }}><span style={{ color: D.tm }}>Cargando...</span></div>;
  }

  if (!goal) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: D.page, padding: 24 }}>
        <p style={{ color: D.ts, fontSize: 14, marginBottom: 16 }}>Objetivo no encontrado.</p>
        <button onClick={() => router.push('/goals')} style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>Ver objetivos</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: D.page, padding: '24px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {/* Nav */}
        <button onClick={() => router.push('/goals')} style={{ background: 'none', border: 'none', color: D.ts, fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 20 }}>← Mis objetivos</button>

        {/* Hero card */}
        <div style={{ background: D.card, borderRadius: 20, padding: '24px', border: `1px solid ${D.cardBorder}`, marginBottom: 16 }}>
          {editing ? (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: D.tp, marginBottom: 16 }}>Editar objetivo</h2>
              {editErr && <p style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', color: '#fca5a5', fontSize: 13, marginBottom: 12 }}>{editErr}</p>}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: D.ts, display: 'block', marginBottom: 5 }}>Nombre</label>
                <input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${D.border}`, borderRadius: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none', background: D.stat, color: D.tp }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: D.ts, display: 'block', marginBottom: 5 }}>Meta (€)</label>
                <input type="number" min="1" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${D.border}`, borderRadius: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none', background: D.stat, color: D.tp }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: D.ts, display: 'block', marginBottom: 5 }}>Horizonte (meses)</label>
                <input type="number" min="1" value={horizonMonths} onChange={e => setHorizonMonths(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${D.border}`, borderRadius: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none', background: D.stat, color: D.tp }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setEditing(false)} style={{ flex: 1, padding: '11px 0', background: 'transparent', border: `1.5px solid ${D.border}`, borderRadius: 10, cursor: 'pointer', fontSize: 14, color: D.ts }}>Cancelar</button>
                <button onClick={handleSaveEdit} style={{ flex: 2, padding: '11px 0', background: '#2563eb', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#fff' }}>Guardar</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: D.tp, margin: 0 }}>{goal.title}</h1>
                    {goal.isPrimary && <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(37,99,235,0.2)', color: '#93c5fd', padding: '2px 8px', borderRadius: 20 }}>PRINCIPAL</span>}
                    {isCompleted && <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(22,163,74,0.2)', color: '#4ade80', padding: '2px 8px', borderRadius: 20 }}>✓ COMPLETADO</span>}
                  </div>
                  <p style={{ fontSize: 13, color: D.tm, margin: 0 }}>Creado {formatDate(goal.createdAt)}</p>
                </div>
                <button onClick={() => setEditing(true)} style={{ fontSize: 12, padding: '6px 12px', background: 'rgba(51,65,85,0.4)', border: `1px solid ${D.border}`, borderRadius: 8, cursor: 'pointer', color: D.ts, fontWeight: 500, flexShrink: 0, marginLeft: 12 }}>Editar</button>
              </div>

              {/* Amounts + Progress */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '16px 0 8px' }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: D.tp }}>{formatEUR(goal.currentAmount)}</span>
                <span style={{ fontSize: 16, color: D.tm }}>/ {formatEUR(goal.targetAmount)}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: D.blue, marginLeft: 'auto' }}>{pct}%</span>
              </div>
              <div style={{ background: 'rgba(51,65,85,0.6)', borderRadius: 999, height: 10, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ width: `${pct}%`, height: 10, background: isCompleted ? '#4ade80' : 'linear-gradient(90deg,#60a5fa,#2563eb)', borderRadius: 999, transition: 'width 0.5s' }} />
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 100, background: D.stat, borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ fontSize: 11, color: D.tm, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Horizonte</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: D.tp, margin: 0 }}>{goal.horizonMonths} meses</p>
                </div>
                <div style={{ flex: 1, minWidth: 100, background: D.stat, borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ fontSize: 11, color: D.tm, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Ahorrado</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: D.green, margin: 0 }}>{formatEUR(totalSaved)}</p>
                </div>
                {!isCompleted && eta !== null && (
                  <div style={{ flex: 1, minWidth: 100, background: 'rgba(37,99,235,0.12)', borderRadius: 10, padding: '10px 14px' }}>
                    <p style={{ fontSize: 11, color: '#93c5fd', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>ETA</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: D.blue, margin: 0 }}>{eta} mes{eta !== 1 ? 'es' : ''}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                {!goal.isPrimary && !goal.archived && (
                  <button onClick={handleSetPrimary} style={{ fontSize: 13, padding: '8px 14px', border: '1px solid rgba(37,99,235,0.4)', background: 'rgba(37,99,235,0.12)', color: '#93c5fd', borderRadius: 9, cursor: 'pointer', fontWeight: 600 }}>Hacer principal</button>
                )}
                {!goal.archived && (
                  <button onClick={openArchiveModal} style={{ fontSize: 13, padding: '8px 14px', border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#f87171', borderRadius: 9, cursor: 'pointer' }}>Archivar</button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Evolución individual */}
        {decisions.length > 0 && (
          <div style={{ background: D.card, borderRadius: 20, padding: '20px 24px', border: `1px solid ${D.cardBorder}`, marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: D.tp, marginBottom: 4 }}>Evolución del objetivo</h2>
            <p style={{ fontSize: 13, color: D.tm, marginBottom: 16 }}>{decisions.length} decisiones · media mensual {formatEUR(avgMonthly)}</p>
            {/* Mini bar chart */}
            {(() => {
              const max = Math.max(...decisions.slice(0, 10).map(d => d.deltaAmount), 1);
              return (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60, marginBottom: 8 }}>
                  {[...decisions].reverse().slice(0, 10).map((d, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{ width: '100%', background: '#2563eb', borderRadius: '3px 3px 0 0', height: `${Math.max(4, (d.deltaAmount / max) * 52)}px`, opacity: 0.7 + (i / 10) * 0.3 }} />
                    </div>
                  ))}
                </div>
              );
            })()}
            <p style={{ fontSize: 11, color: D.tm, textAlign: 'right' }}>Últimas {Math.min(10, decisions.length)} decisiones</p>
          </div>
        )}

        {/* Historial de decisiones del objetivo */}
        {decisions.length > 0 && (
          <div style={{ background: D.card, borderRadius: 20, padding: '20px 24px', border: `1px solid ${D.cardBorder}` }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: D.tp, marginBottom: 16 }}>Historial de decisiones</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {decisions.slice(0, 20).map(d => {
                const q = DAILY_QUESTIONS.find(q => q.questionId === d.questionId);
                const ans = q?.answers.find(a => a.key === d.answerKey);
                return (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${D.border}` }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: D.ts, marginBottom: 2 }}>{q?.text ?? d.questionId}</p>
                      <p style={{ fontSize: 12, color: D.tm, margin: 0 }}>{ans?.label ?? d.answerKey} · {formatDate(d.date)}</p>
                    </div>
                    {d.deltaAmount > 0 && (
                      <span style={{ fontSize: 14, fontWeight: 700, color: D.green, flexShrink: 0, marginLeft: 12 }}>+{formatEUR(d.deltaAmount)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal de archivar */}
        {showArchiveModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
            <div style={{ background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: D.tp, marginBottom: 6 }}>Archivar objetivo</h3>
              <p style={{ fontSize: 13, color: D.ts, marginBottom: 20 }}>
                {goal && goal.currentAmount > 0
                  ? `¿Dónde quieres transferir el saldo de ${formatEUR(goal.currentAmount)}?`
                  : '¿Confirmas que quieres archivar este objetivo?'}
              </p>
              {goal && goal.currentAmount > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  <button
                    onClick={() => setArchiveDest('hucha')}
                    style={{ padding: '12px 16px', borderRadius: 10, border: `2px solid ${archiveDest === 'hucha' ? '#2563eb' : D.border}`, background: archiveDest === 'hucha' ? 'rgba(37,99,235,0.15)' : D.stat, textAlign: 'left', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: archiveDest === 'hucha' ? '#93c5fd' : D.ts }}>🏦 Enviar a la Hucha</div>
                    <div style={{ fontSize: 12, color: D.tm }}>Guarda el saldo para usarlo después</div>
                  </button>
                  {otherGoals.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setArchiveDest(g.id)}
                      style={{ padding: '12px 16px', borderRadius: 10, border: `2px solid ${archiveDest === g.id ? '#2563eb' : D.border}`, background: archiveDest === g.id ? 'rgba(37,99,235,0.15)' : D.stat, textAlign: 'left', cursor: 'pointer' }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: archiveDest === g.id ? '#93c5fd' : D.ts }}>🎯 {g.title}</div>
                      <div style={{ fontSize: 12, color: D.tm }}>Transferir saldo a este objetivo</div>
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowArchiveModal(false)} style={{ flex: 1, padding: '11px 0', background: 'transparent', border: `1.5px solid ${D.border}`, borderRadius: 10, cursor: 'pointer', fontSize: 14, color: D.ts }}>Cancelar</button>
                <button onClick={handleConfirmArchive} style={{ flex: 1, padding: '11px 0', background: '#dc2626', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#fff' }}>Archivar</button>
              </div>
            </div>
          </div>
        )}

        {decisions.length === 0 && !editing && (
          <div style={{ background: D.card, borderRadius: 16, padding: '32px 24px', textAlign: 'center', border: `1px solid ${D.cardBorder}` }}>
            <p style={{ fontSize: 14, color: D.tm }}>Aún no hay decisiones asignadas a este objetivo.</p>
            <button onClick={() => router.push('/daily')} style={{ marginTop: 16, padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Tomar decisión diaria</button>
          </div>
        )}
      </div>
    </div>
  );
}
