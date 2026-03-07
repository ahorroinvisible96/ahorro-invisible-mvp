import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export type UserProfile    = { id: string; name: string | null; money_feeling: string | null; income_range: Record<string, unknown> | null; created_at: string; updated_at: string };
export type GoalRow        = { id: string; user_id: string; title: string; target_amount: number; current_amount: number; horizon_months: number; is_primary: boolean; archived: boolean; created_at: string; updated_at: string };
export type DecisionRow    = { id: string; user_id: string; date: string; question_id: string; answer_key: string; goal_id: string | null; delta_amount: number; monthly_projection: number; yearly_projection: number; created_at: string };
export type HuchaRow       = { user_id: string; balance: number; entries: unknown[] };
export type PushSubRow     = { id: string; user_id: string; subscription: Record<string, unknown>; created_at: string };
