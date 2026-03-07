"use client";

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ─── Cookie de sesión (leída por middleware Next.js) ──────────────────────────
function setAuthCookie(days = 30) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `ai_auth=1; path=/; expires=${expires}; SameSite=Lax`;
}
function clearAuthCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = 'ai_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
}

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
};

export type AuthResult = {
  user: AuthUser | null;
  error: string | null;
};

// ─── Sign up ──────────────────────────────────────────────────────────────────
export async function authSignUp(
  email: string,
  password: string,
  name: string,
): Promise<AuthResult> {
  if (!isSupabaseConfigured || !supabase) {
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userName', name);
    setAuthCookie();
    return { user: { id: 'local', email, name }, error: null };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) return { user: null, error: error.message };
  if (!data.user) return { user: null, error: 'No se pudo crear la cuenta' };

  localStorage.setItem('isAuthenticated', 'true');
  localStorage.setItem('userEmail', email);
  localStorage.setItem('userName', name);
  localStorage.setItem('supabaseUserId', data.user.id);
  setAuthCookie();

  return { user: { id: data.user.id, email: data.user.email!, name }, error: null };
}

// ─── Sign in with email+password ─────────────────────────────────────────────
export async function authSignIn(
  email: string,
  password: string,
  remember = true,
): Promise<AuthResult> {
  if (!isSupabaseConfigured || !supabase) {
    const storedEmail = localStorage.getItem('userEmail');
    if (storedEmail && storedEmail === email) {
      localStorage.setItem('isAuthenticated', 'true');
      setAuthCookie(remember ? 90 : 7);
      return {
        user: { id: 'local', email, name: localStorage.getItem('userName') ?? '' },
        error: null,
      };
    }
    return { user: null, error: 'Credenciales incorrectas. Usa el email con el que te registraste.' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { user: null, error: error.message };
  if (!data.user) return { user: null, error: 'No se pudo iniciar sesión' };

  localStorage.setItem('isAuthenticated', 'true');
  localStorage.setItem('userEmail', data.user.email!);
  localStorage.setItem('userName', data.user.user_metadata?.name ?? '');
  localStorage.setItem('supabaseUserId', data.user.id);
  if (remember) localStorage.setItem('rememberMe', 'true');
  setAuthCookie(remember ? 90 : 7);

  return {
    user: { id: data.user.id, email: data.user.email!, name: data.user.user_metadata?.name },
    error: null,
  };
}

// ─── Magic link ───────────────────────────────────────────────────────────────
export async function authSendMagicLink(email: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'El magic link requiere Supabase configurado. Consulta env.example para configurarlo.' };
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  const redirectTo = appUrl ? `${appUrl}/auth/callback` : undefined;

  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  return { error: error?.message ?? null };
}

// ─── Sign out ─────────────────────────────────────────────────────────────────
export async function authSignOut(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut();
  }
  ['isAuthenticated', 'userEmail', 'userName', 'hasCompletedOnboarding', 'supabaseUserId'].forEach(
    (k) => localStorage.removeItem(k),
  );
  clearAuthCookie();
}

// ─── Current user ─────────────────────────────────────────────────────────────
export async function authGetCurrentUser(): Promise<AuthUser | null> {
  if (!isSupabaseConfigured || !supabase) {
    if (localStorage.getItem('isAuthenticated') !== 'true') return null;
    return {
      id: 'local',
      email: localStorage.getItem('userEmail') ?? '',
      name: localStorage.getItem('userName') ?? '',
    };
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  return {
    id: data.user.id,
    email: data.user.email!,
    name: data.user.user_metadata?.name ?? '',
  };
}
