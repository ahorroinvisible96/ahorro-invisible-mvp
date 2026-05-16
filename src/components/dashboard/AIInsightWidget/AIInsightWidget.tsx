"use client";

import React, { useState, useEffect } from 'react';
import styles from './AIInsightWidget.module.css';

export function AIInsightWidget() {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Obtener userId y cargar caché al montar
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

      // Guardar en caché
      try {
        localStorage.setItem('ai_weekly_insight', data.insight);
        localStorage.setItem('ai_weekly_insight_date', new Date().toISOString());
      } catch {}
    } catch (err) {
      console.error('Error fetching AI insight:', err);
      setError('No pudimos conectar con Gemini. Inténtalo más tarde.');
    } finally {
      setLoading(false);
    }
  };

  // Si no hay userId, no mostrar nada
  if (!userId) return null;

  // Estado inicial: botón para solicitar
  if (!insight && !loading && !error) {
    return (
      <button className={styles.actionBtn} onClick={fetchInsight}>
        <span>✨</span>
        <span>Obtener Consejo de la Semana</span>
      </button>
    );
  }

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.icon}>✨</span>
        <h3 className={styles.title}>Insight de la Semana</h3>
        {insight && !loading && (
          <button
            onClick={fetchInsight}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'rgba(148,163,184,0.4)',
              fontSize: 14,
              cursor: 'pointer',
              padding: '2px 4px',
            }}
            aria-label="Generar nuevo insight"
          >↻</button>
        )}
      </div>

      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.skeletonLine} style={{ width: '100%' }}></div>
          <div className={styles.skeletonLine} style={{ width: '85%' }}></div>
          <div className={styles.skeletonLine} style={{ width: '60%' }}></div>
        </div>
      ) : error ? (
        <>
          <div className={styles.error}>{error}</div>
          <button className={styles.actionBtn} onClick={fetchInsight} style={{ marginTop: 8 }}>
            Reintentar
          </button>
        </>
      ) : (
        <div className={styles.content}>
          {insight}
        </div>
      )}
    </div>
  );
}
