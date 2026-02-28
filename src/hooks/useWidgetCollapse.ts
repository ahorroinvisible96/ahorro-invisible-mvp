"use client";

import { useState, useCallback } from 'react';

/**
 * Persiste el estado plegado/desplegado en sessionStorage.
 * - collapsed = true  → widget plegado (estado por defecto)
 * - collapsed = false → widget desplegado
 *
 * @param key     Clave única para el widget (ej: 'widget_primary_goal')
 * @param defaultCollapsed Estado inicial si no hay nada en sessionStorage
 */
export function useWidgetCollapse(key: string, defaultCollapsed = false) {
  const storageKey = `widget_collapse_${key}`;

  function readSession(): boolean {
    if (typeof window === 'undefined') return defaultCollapsed;
    const stored = sessionStorage.getItem(storageKey);
    if (stored === null) return defaultCollapsed;
    return stored === 'true';
  }

  const [collapsed, setCollapsedState] = useState<boolean>(readSession);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(storageKey, String(next));
      }
      return next;
    });
  }, [storageKey]);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(storageKey, String(value));
    }
  }, [storageKey]);

  return { collapsed, toggle, setCollapsed };
}
