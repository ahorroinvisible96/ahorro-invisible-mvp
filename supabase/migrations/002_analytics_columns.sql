-- ============================================================
-- Ahorro Invisible — Migration 002: Analytics columns + schema fixes
-- Apply via: supabase db push  OR  run manually in Supabase SQL editor
-- ============================================================

-- ─── Añadir columnas de analytics a user_profiles ────────────────────────────
alter table public.user_profiles
  add column if not exists streak_current     integer     not null default 0,
  add column if not exists streak_max         integer     not null default 0,
  add column if not exists total_saved        numeric     not null default 0,
  add column if not exists daily_saved        numeric     not null default 0,
  add column if not exists extra_saved        numeric     not null default 0,
  add column if not exists decisions_count    integer     not null default 0,
  add column if not exists extra_savings_count integer    not null default 0,
  add column if not exists goals_created_count integer    not null default 0,
  add column if not exists active_days_count  integer     not null default 0,
  add column if not exists last_active_at     timestamptz;

-- ─── Añadir columnas extra a goals ───────────────────────────────────────────
alter table public.goals
  add column if not exists source       text,
  add column if not exists completed_at timestamptz;

-- ─── Fix push_subscriptions: constraint único por usuario ────────────────────
-- Eliminar el índice compuesto anterior (user_id, endpoint)
drop index if exists public.push_subscriptions_user_endpoint_idx;

-- Añadir restricción única solo por user_id (una suscripción activa por usuario)
-- Esto permite upsert con onConflict: 'user_id'
create unique index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);
