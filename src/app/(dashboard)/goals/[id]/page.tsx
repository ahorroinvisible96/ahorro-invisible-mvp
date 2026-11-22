"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { analytics } from '@/services/analytics';
import {
  buildSummary,
  storeUpdateGoal,
  storeArchiveGoalSafe,
  storeSetPrimaryGoal,
  storeListActiveGoals,
} from '@/services/dashboardStore';
import { QUESTIONS_BANK } from '@/services/dailyQuestionsBank';
import { syncGoalToSupabase } from '@/services/syncService';
import type { Goal, DailyDecision } from '@/types/Dashboard';
import { PlusIcon, EditIcon, StarIcon, BoltIcon } from '@/components/ui/AppIcons';
import styles from './GoalDetail.module.css';

function formatEUR(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
}
function formatDate(d: string) {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d));
}

type StoreShape = { decisions: DailyDecision[]; goals: Goal[] };

export default function GoalDetailPage() {
  const router = useRouter();
  const routeParams = useParams();
  const goalId = typeof routeParams?.id === 'string'
    ? routeParams.id
    : Array.isArray(routeParams?.id)
      ? routeParams.id[0]
      : '';
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
    const found = summary.goals.find(g => g.id === goalId) ?? null;
    setGoal(found);
    if (found) {
      setTitle(found.title);
      setTargetAmount(String(found.targetAmount));
      setHorizonMonths(String(found.horizonMonths));
    }
    const raw = localStorage.getItem('ahorro_invisible_dashboard_v1');
    if (raw) {
      const store = JSON.parse(raw) as StoreShape;
      const goalDecisions = store.decisions.filter(d => d.goalId === goalId);
      setDecisions([...goalDecisions].sort((a, b) => b.date.localeCompare(a.date)));
    }
  };

  useEffect(() => {
    analytics.setScreen('goal_detail');
    const isAuth = localStorage.getItem('isAuthenticated');
    if (isAuth !== 'true') { router.replace('/signup'); return; }
    refresh();
    setLoading(false);
  }, [router, goalId]);

  const pct = goal ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
  const isCompleted = goal ? goal.currentAmount >= goal.targetAmount : false;

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

  const curveData = useMemo(() => {
    const ordered = [...decisions].reverse().slice(-10);
    if (ordered.length === 0) return null;
    let running = 0;
    const pts = ordered.map((d) => {
      running += d.deltaAmount;
      return running;
    });
    const maxVal = Math.max(...pts, 1);
    const w = 320;
    const h = 84;
    const coords = pts.map((v, idx) => {
      const x = pts.length === 1 ? w - 8 : (idx / (pts.length - 1)) * (w - 12) + 4;
      const y = h - 10 - (v / maxVal) * (h - 22);
      return { x, y };
    });
    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)} ${h} L${coords[0].x.toFixed(1)} ${h} Z`;
    return { linePath, areaPath, last: coords[coords.length - 1] };
  }, [decisions]);

  const handleSaveEdit = () => {
    setEditErr('');
    if (!title.trim()) { setEditErr('Escribe un nombre.'); return; }
    const a = Number(targetAmount);
    if (!a || a <= 0) { setEditErr('Cantidad inválida.'); return; }
    const m = Number(horizonMonths);
    if (!m || m < 1) { setEditErr('Horizonte inválido.'); return; }
    storeUpdateGoal(goalId, { title: title.trim(), targetAmount: a, horizonMonths: m });
    setEditing(false);
    refresh();
  };

  const openArchiveModal = () => {
    const active = storeListActiveGoals().filter((g) => g.id !== goalId);
    setOtherGoals(active);
    setArchiveDest(active.length > 0 ? active[0].id : 'hucha');
    setShowArchiveModal(true);
  };

  const handleConfirmArchive = () => {
    if (!goal) return;
    storeArchiveGoalSafe(goalId, archiveDest, '30d', { surface: 'goal_detail' });
    analytics.goalArchiveSubmitted(goal.isPrimary, 'goal_detail');
    syncGoalToSupabase({ ...goal, archived: true, currentAmount: 0 }).catch(() => null);
    setShowArchiveModal(false);
    router.push('/goals');
  };

  const handleSetPrimary = () => {
    storeSetPrimaryGoal(goalId);
    refresh();
  };

  if (loading) {
    return <div className={styles.centerState}>Cargando...</div>;
  }

  if (!goal) {
    return (
      <div className={styles.centerState}>
        <p style={{ margin: 0, fontSize: 14 }}>Objetivo no encontrado.</p>
        <button type="button" onClick={() => router.push('/goals')} className={styles.btnWhite} style={{ padding: '0 24px', flex: 'none' }}>
          Ver objetivos
        </button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.sky}>
        <div className={styles.inner}>
          <div className={styles.topBar}>
            <button type="button" className={styles.glassBtn} onClick={() => router.push('/goals')} aria-label="Volver a objetivos">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <h1 className={styles.topTitle}>{goal.title}</h1>
            <button type="button" className={styles.glassBtn} onClick={() => setEditing(v => !v)} aria-label="Editar objetivo">
              <EditIcon size={16} />
            </button>
          </div>

          <div className={styles.heroCenter}>
            <span className={styles.heroKicker}>
              {goal.isPrimary ? 'Principal · ' : ''}{isCompleted ? 'Completado · ' : ''}{pct}% completado
            </span>
            <div className={styles.heroAmount}>{formatEUR(goal.currentAmount)}</div>
            <div className={styles.heroPill}>
              Meta {formatEUR(goal.targetAmount)}{!isCompleted && eta !== null ? ` · ETA ~${eta} ${eta === 1 ? 'mes' : 'meses'}` : ` · ${goal.horizonMonths}m`}
            </div>
            <div className={styles.heroBarTrack}>
              <div className={`${styles.heroBarFill} ${isCompleted ? styles.heroBarFillDone : ''}`} style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className={styles.circleActions}>
            <button type="button" className={styles.circleAction} onClick={() => router.push('/extra-saving')}>
              <span className={styles.circleBtn}><PlusIcon size={19} /></span>
              <span className={styles.circleLbl}>Aportar</span>
            </button>
            <button type="button" className={styles.circleAction} onClick={() => setEditing(v => !v)}>
              <span className={styles.circleBtn}><EditIcon size={17} /></span>
              <span className={styles.circleLbl}>Editar</span>
            </button>
            {!goal.isPrimary && !goal.archived && (
              <button type="button" className={styles.circleAction} onClick={handleSetPrimary}>
                <span className={styles.circleBtn}><StarIcon size={17} /></span>
                <span className={styles.circleLbl}>Principal</span>
              </button>
            )}
            {!goal.archived && (
              <button type="button" className={styles.circleAction} onClick={openArchiveModal}>
                <span className={styles.circleBtn}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="4" rx="1" />
                    <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
                  </svg>
                </span>
                <span className={styles.circleLbl}>Archivar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={styles.inner}>
        <div className={styles.content}>
          {editing && (
            <section className={styles.card}>
              <div className={styles.cardHead} style={{ marginBottom: 14 }}>
                <h2 className={styles.cardLabel}>Editar objetivo</h2>
              </div>
              {editErr && <p className={styles.errorBox}>{editErr}</p>}
              <div className={styles.formGroup}>
                <label className={styles.label}>Nombre</label>
                <input value={title} onChange={e => setTitle(e.target.value)} className={styles.input} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Meta (€)</label>
                <input type="number" min="1" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} className={styles.input} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Horizonte (meses)</label>
                <input type="number" min="1" value={horizonMonths} onChange={e => setHorizonMonths(e.target.value)} className={styles.input} />
              </div>
              <div className={styles.btnRow}>
                <button type="button" onClick={() => setEditing(false)} className={styles.btnGhost}>Cancelar</button>
                <button type="button" onClick={handleSaveEdit} className={styles.btnWhite}>Guardar</button>
              </div>
            </section>
          )}

          {decisions.length > 0 && curveData && (
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardLabel}>Evolución del objetivo</h2>
                <span className={styles.cardAccent}>+{formatEUR(avgMonthly)} / mes</span>
              </div>
              <p className={styles.cardBigStat}>{decisions.length} {decisions.length === 1 ? 'decisión' : 'decisiones'}</p>
              <svg viewBox="0 0 320 84" width="100%" height="84" style={{ display: 'block', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="goalAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.36" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={curveData.areaPath} fill="url(#goalAreaGrad)" />
                <path d={curveData.linePath} fill="none" stroke="#9F7AEA" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={curveData.last.x} cy={curveData.last.y} r="4" fill="#FFFFFF" stroke="#8B5CF6" strokeWidth="2.5" />
              </svg>
            </section>
          )}

          {decisions.length > 0 && (
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardLabel}>Actividad reciente</h2>
              </div>
              <div className={styles.rowsStack}>
                {decisions.slice(0, 20).map(d => {
                  const q = QUESTIONS_BANK.find(item => item.id === d.questionId);
                  const isExtra = d.questionId === 'extra_saving';
                  return (
                    <div key={d.id} className={styles.row}>
                      <div className={`${styles.medallion} ${isExtra ? styles.medallionExtra : ''}`}>
                        {isExtra ? <PlusIcon size={16} /> : <BoltIcon size={16} />}
                      </div>
                      <div className={styles.rowMid}>
                        <p className={styles.rowTitle}>{q?.text ?? (isExtra ? 'Ahorro extra' : d.questionId)}</p>
                        <p className={styles.rowSub}>{formatDate(d.date)}</p>
                      </div>
                      {d.deltaAmount > 0 && (
                        <span className={styles.rowAmount}>+{formatEUR(d.deltaAmount)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {decisions.length === 0 && !editing && (
            <div className={styles.emptyCard}>
              <p className={styles.emptyText}>Aún no hay decisiones asignadas a este objetivo.</p>
              <button type="button" onClick={() => router.push('/daily')} className={styles.btnWhite} style={{ padding: '0 24px', flex: 'none' }}>
                Tomar decisión diaria
              </button>
            </div>
          )}
        </div>
      </div>

      {showArchiveModal && (
        <div className={styles.modalOverlay} onClick={() => setShowArchiveModal(false)}>
          <div className={styles.modalSheet} onClick={e => e.stopPropagation()}>
            <div className={styles.grabber} />
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>Archivar objetivo</h3>
            <p className={styles.rowSub} style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              {goal.currentAmount > 0
                ? `¿Dónde quieres transferir el saldo de ${formatEUR(goal.currentAmount)}?`
                : '¿Confirmas que quieres archivar este objetivo?'}
            </p>
            {goal.currentAmount > 0 && (
              <div className={styles.destList}>
                <button
                  type="button"
                  onClick={() => setArchiveDest('hucha')}
                  className={`${styles.destOption} ${archiveDest === 'hucha' ? styles.destOptionActive : ''}`}
                >
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Enviar a la Hucha</div>
                  <div className={styles.rowSub}>Guarda el saldo para usarlo después</div>
                </button>
                {otherGoals.map((g) => (
                  <button
                    type="button"
                    key={g.id}
                    onClick={() => setArchiveDest(g.id)}
                    className={`${styles.destOption} ${archiveDest === g.id ? styles.destOptionActive : ''}`}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{g.title}</div>
                    <div className={styles.rowSub}>Transferir saldo a este objetivo</div>
                  </button>
                ))}
              </div>
            )}
            <div className={styles.btnRow}>
              <button type="button" onClick={() => setShowArchiveModal(false)} className={styles.btnGhost}>Cancelar</button>
              <button type="button" onClick={handleConfirmArchive} className={styles.btnDanger}>Archivar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
