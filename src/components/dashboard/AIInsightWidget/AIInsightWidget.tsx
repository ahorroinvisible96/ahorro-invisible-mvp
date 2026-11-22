"use client";

import React, { useState, useEffect } from 'react';
import styles from './AIInsightWidget.module.css';

function SparkleSvg() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function RefreshSvg() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

export function AIInsightWidget() {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const id = localStorage.getItem('supabaseUserId');
      setUserId(id);

      const cached = localStorage.getItem('ai_weekly_insight');
      const cachedDate = localStorage.getItem('ai_weekly_insight_date');

      if (cached && cachedDate) {
        const isToday = new Date().toDateString() === new Date(cachedDate).toDateString();
        if (isToday) {
          setInsight(cached);
        }
      }
    } catch {
      // Ignorar errores de localStorage
    }
  }, []);

  const fetchInsight = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al obtener insight');
      }

      setInsight(data.insight);

      try {
        localStorage.setItem('ai_weekly_insight', data.insight);
        localStorage.setItem('ai_weekly_insight_date', new Date().toISOString());
      } catch {}
    } catch (err) {
      console.error('Error fetching AI insight:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('429') || msg.includes('quota')) {
        setError('Gemini tiene un límite por minuto. Espera un momento e inténtalo de nuevo.');
      } else {
        setError(msg || 'No pudimos conectar con Gemini. Inténtalo más tarde.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!userId) return null;

  if (!insight && !loading && !error) {
    return (
      <button type="button" className={styles.actionCard} onClick={fetchInsight}>
        <div className={styles.iconCircle}>
          <SparkleSvg />
        </div>
        <div className={styles.actionTexts}>
          <span className={styles.title}>Insight de la semana</span>
          <span className={styles.actionSub}>Obtener consejo personalizado</span>
        </div>
        <svg className={styles.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    );
  }

  return (
    <section className={styles.widget} aria-label="Insight de la semana">
      <div className={styles.row}>
        <div className={styles.iconCircle}>
          <SparkleSvg />
        </div>

        <div className={styles.body}>
          <div className={styles.header}>
            <h3 className={styles.title}>Insight de la semana</h3>
            {insight && !loading && (
              <button
                type="button"
                className={styles.refreshBtn}
                onClick={fetchInsight}
                aria-label="Generar nuevo insight"
              >
                <RefreshSvg />
              </button>
            )}
          </div>

          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.skeletonLine} style={{ width: '100%' }} />
              <div className={styles.skeletonLine} style={{ width: '82%' }} />
            </div>
          ) : error ? (
            <>
              <div className={styles.error}>{error}</div>
              <button type="button" className={styles.retryBtn} onClick={fetchInsight}>
                Reintentar
              </button>
            </>
          ) : (
            <p className={styles.content}>{insight}</p>
          )}
        </div>
      </div>
    </section>
  );
}
