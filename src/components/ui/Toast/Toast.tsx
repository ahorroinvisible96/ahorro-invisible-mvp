"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './Toast.module.css';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextType {
  addToast: (message: string, variant?: ToastVariant, duration?: number) => void;
}

const ToastContext = React.createContext<ToastContextType>({
  addToast: () => {},
});

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, variant: ToastVariant = 'success', duration = 3500) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, variant, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {typeof window !== 'undefined' && createPortal(
        <div className={styles.container}>
          {toasts.map((toast) => (
            <ToastMessage
              key={toast.id}
              toast={toast}
              onDismiss={() => removeToast(toast.id)}
            />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

function ToastMessage({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 300);
    }, toast.duration ?? 3500);
    return () => clearTimeout(timeout);
  }, [toast.duration, onDismiss]);

  const variantIcons: Record<ToastVariant, string> = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  };

  return (
    <div className={`${styles.toast} ${styles[toast.variant ?? 'success']} ${exiting ? styles.exit : ''}`}>
      <span className={styles.icon}>{variantIcons[toast.variant ?? 'success']}</span>
      <span className={styles.message}>{toast.message}</span>
      <button className={styles.dismiss} onClick={() => { setExiting(true); setTimeout(onDismiss, 300); }} aria-label="Cerrar">
        ×
      </button>
    </div>
  );
}

export default ToastProvider;
