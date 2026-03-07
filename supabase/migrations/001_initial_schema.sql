-- ============================================================
-- Ahorro Invisible — Initial Schema
-- Apply via: supabase db push  OR  supabase migration up
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── User profiles ────────────────────────────────────────────────────────────
create table if not exists public.user_profiles (
  id            uuid        primary key references auth.users(id) on delete cascade,
  name          text,
  money_feeling text,
  income_range  jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.user_profiles enable row level security;
create policy "Users can manage own profile" on public.user_profiles
  for all using (auth.uid() = id);

-- ─── Goals ───────────────────────────────────────────────────────────────────
create table if not exists public.goals (
  id             text        primary key,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  title          text        not null,
  target_amount  numeric     not null default 0,
  current_amount numeric     not null default 0,
  horizon_months integer,
  is_primary     boolean     not null default false,
  archived       boolean     not null default false,
  created_at     timestamptz not null,
  updated_at     timestamptz not null
);
alter table public.goals enable row level security;
create policy "Users can manage own goals" on public.goals
  for all using (auth.uid() = user_id);

create index if not exists goals_user_id_idx on public.goals(user_id);
create index if not exists goals_user_active_idx on public.goals(user_id) where not archived;

-- ─── Daily decisions ─────────────────────────────────────────────────────────
create table if not exists public.decisions (
  id                  text        primary key,
  user_id             uuid        not null references auth.users(id) on delete cascade,
  date                date        not null,
  question_id         text        not null,
  answer_key          text        not null,
  goal_id             text        references public.goals(id) on delete set null,
  delta_amount        numeric     not null default 0,
  monthly_projection  numeric     not null default 0,
  yearly_projection   numeric     not null default 0,
  created_at          timestamptz not null
);
alter table public.decisions enable row level security;
create policy "Users can manage own decisions" on public.decisions
  for all using (auth.uid() = user_id);

create unique index if not exists decisions_user_date_idx on public.decisions(user_id, date)
  where question_id != 'grace_day';
create index if not exists decisions_user_id_idx on public.decisions(user_id);

-- ─── Hucha (savings jar) ──────────────────────────────────────────────────────
create table if not exists public.hucha (
  user_id    uuid     primary key references auth.users(id) on delete cascade,
  balance    numeric  not null default 0,
  entries    jsonb    not null default '[]'::jsonb
);
alter table public.hucha enable row level security;
create policy "Users can manage own hucha" on public.hucha
  for all using (auth.uid() = user_id);

-- ─── Push subscriptions ───────────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id           uuid        primary key default uuid_generate_v4(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  subscription jsonb       not null,
  created_at   timestamptz not null default now(),
  unique(user_id, (subscription->>'endpoint'))
);
alter table public.push_subscriptions enable row level security;
create policy "Users can manage own push subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id);

-- ─── Auto-update updated_at ───────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.handle_updated_at();
