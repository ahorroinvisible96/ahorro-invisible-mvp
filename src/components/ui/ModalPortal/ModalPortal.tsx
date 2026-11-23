"use client";

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

let activePortalCount = 0;
let previousBodyOverflow = '';

/**
 * Renderiza cualquier modal o bottom-sheet directamente en `document.body`.
 * Evita que los contextos de apilamiento de `<main>` (p. ej. `-webkit-overflow-scrolling: touch`
 * en iOS Safari o `z-index` en cabeceras/widgets) atrapen el modal debajo del `BottomNav`.
 */
export function ModalPortal({ children }: { children: React.ReactNode }): React.ReactPortal | null {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (activePortalCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    activePortalCount += 1;

    return () => {
      activePortalCount = Math.max(0, activePortalCount - 1);
      if (activePortalCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
      }
    };
  }, []);

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

export default ModalPortal;
