"use client";

import { useState, useEffect, useCallback } from 'react';
import { getTheme, applyTheme } from '@/styles/themes';
import type { Theme } from '@/styles/themes';

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const current = getTheme();
    const actual = current === 'system' ? 'dark' : (current as 'light' | 'dark');
    setTheme(actual);
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  }, [theme]);

  return { theme, toggle, isDark: theme === 'dark' };
}
