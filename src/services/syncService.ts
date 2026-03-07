"use client";

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { GoalRow, DecisionRow } from '@/lib/supabase';

const STORAGE_KEY = 'ahorro_invisible_dashboard_v1';

// ─── Push local data → Supabase (migración de early adopters) ─────────────────
export async function pushLocalDataToSupabase(
  userId: string,
): Promise<{ success: boolean; migrated: number; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, migrated: 0, error: 'Supabase no está configurado. Consulta env.example.' };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { success: true, migrated: 0 };

    const store = JSON.parse(raw) as {
      userName?: string;
      moneyFeeling?: string;
      incomeRange?: Record<string, unknown>;
      goals?: GoalRow[];
      decisions?: DecisionRow[];
      hucha?: { balance: number; entries: unknown[] };
    };

    let migrated = 0;

    // 1. Perfil de usuario
    await supabase.from('user_profiles').upsert({
      id: userId,
      name: store.userName ?? null,
      money_feeling: store.moneyFeeling ?? null,
      income_range: store.incomeRange ?? null,
      updated_at: new Date().toISOString(),
    });

    // 2. Objetivos
    if (store.goals?.length) {
      const goals = store.goals.map((g: Record<string, unknown>) => ({
        id: g.id as string,
        user_id: userId,
        title: g.title as string,
        target_amount: g.targetAmount as number,
        current_amount: g.currentAmount as number,
        horizon_months: g.horizonMonths as number,
        is_primary: g.isPrimary as boolean,
        archived: g.archived as boolean,
        created_at: g.createdAt as string,
        updated_at: g.updatedAt as string,
      }));
      const { error } = await supabase.from('goals').upsert(goals, { onConflict: 'id' });
      if (!error) migrated += goals.length;
    }

    // 3. Decisiones
    if (store.decisions?.length) {
      const decisions = store.decisions
        .filter((d: Record<string, unknown>) => d.questionId !== 'grace_day') // skip synthetic
        .map((d: Record<string, unknown>) => ({
          id: d.id as string,
          user_id: userId,
          date: d.date as string,
          question_id: d.questionId as string,
          answer_key: d.answerKey as string,
          goal_id: (d.goalId as string) || null,
          delta_amount: d.deltaAmount as number,
          monthly_projection: d.monthlyProjection as number,
          yearly_projection: d.yearlyProjection as number,
          created_at: d.createdAt as string,
        }));
      const { error } = await supabase.from('decisions').upsert(decisions, { onConflict: 'id' });
      if (!error) migrated += decisions.length;
    }

    // 4. Hucha
    if (store.hucha) {
      await supabase.from('hucha').upsert(
        { user_id: userId, balance: store.hucha.balance, entries: store.hucha.entries ?? [] },
        { onConflict: 'user_id' },
      );
    }

    localStorage.setItem('supabase_last_sync', new Date().toISOString());
    return { success: true, migrated };
  } catch (err) {
    return { success: false, migrated: 0, error: String(err) };
  }
}

// ─── Pull Supabase → localStorage (restaurar en nuevo dispositivo) ────────────
export async function pullDataFromSupabase(
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Supabase no está configurado.' };
  }

  try {
    const [profileRes, goalsRes, decisionsRes, huchaRes] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', userId).single(),
      supabase.from('goals').select('*').eq('user_id', userId).eq('archived', false),
      supabase.from('decisions').select('*').eq('user_id', userId).order('date', { ascending: true }),
      supabase.from('hucha').select('*').eq('user_id', userId).single(),
    ]);

    const profile = profileRes.data;
    const goals = goalsRes.data ?? [];
    const decisions = decisionsRes.data ?? [];
    const hucha = huchaRes.data;

    const localStore = {
      userName: profile?.name ?? '',
      userEmail: '',
      incomeRange: profile?.income_range ?? null,
      moneyFeeling: profile?.money_feeling ?? null,
      goals: goals.map((g: Record<string, unknown>) => ({
        id: g.id,
        title: g.title,
        targetAmount: g.target_amount,
        currentAmount: g.current_amount,
        horizonMonths: g.horizon_months,
        isPrimary: g.is_primary,
        archived: g.archived,
        createdAt: g.created_at,
        updatedAt: g.updated_at,
      })),
      decisions: decisions.map((d: Record<string, unknown>) => ({
        id: d.id,
        date: d.date,
        questionId: d.question_id,
        answerKey: d.answer_key,
        goalId: d.goal_id ?? '',
        deltaAmount: d.delta_amount,
        monthlyProjection: d.monthly_projection,
        yearlyProjection: d.yearly_projection,
        createdAt: d.created_at,
      })),
      hucha: { balance: hucha?.balance ?? 0, entries: hucha?.entries ?? [] },
      seenMilestones: [],
      graceUsedMonth: null,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(localStore));
    localStorage.setItem('supabase_last_sync', new Date().toISOString());
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── Sync status ─────────────────────────────────────────────────────────────
export function getLastSyncTime(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('supabase_last_sync');
}

export function hasLocalDataToMigrate(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const store = JSON.parse(raw);
    return (store.goals?.length > 0 || store.decisions?.length > 0);
  } catch { return false; }
}
