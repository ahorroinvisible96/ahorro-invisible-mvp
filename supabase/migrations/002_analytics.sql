-- ─── Migration 002: Analytics & behavioral tracking ──────────────────────────
-- Ejecutar en Supabase SQL Editor

-- ─── Extender user_profiles con campos analíticos ────────────────────────────
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
  add column if not exists last_active_at     timestamptz,
  add column if not exists onboarding_completed_at timestamptz;

-- ─── Extender goals con campos analíticos ────────────────────────────────────
alter table public.goals
  add column if not exists source       text        default 'dashboard',
  add column if not exists completed_at timestamptz;

comment on column public.goals.source is 'onboarding | dashboard';
comment on column public.goals.completed_at is 'Fecha en que current_amount alcanzó target_amount';

-- ─── Vista analítica: estadísticas por usuario ───────────────────────────────
create or replace view public.v_user_stats as
select
  up.id,
  up.name,
  up.money_feeling,
  up.income_range,
  up.streak_current,
  up.streak_max,
  up.total_saved,
  up.decisions_count,
  up.extra_savings_count,
  up.goals_created_count,
  up.active_days_count,
  up.last_active_at,
  up.onboarding_completed_at,
  up.created_at,

  -- Goals en tiempo real desde la tabla goals
  count(distinct g.id) filter (where not g.archived)                         as active_goals,
  count(distinct g.id) filter (where g.archived)                             as archived_goals,
  count(distinct g.id) filter (where g.source = 'onboarding')               as onboarding_goals,
  count(distinct g.id) filter (where g.source = 'dashboard')                as dashboard_goals,
  count(distinct g.id) filter (where g.completed_at is not null)            as completed_goals,

  -- Decisiones en tiempo real desde la tabla decisions
  count(distinct d.id) filter (where d.question_id != 'extra_saving')       as daily_decisions_rt,
  count(distinct d.id) filter (where d.question_id = 'extra_saving')        as extra_savings_rt,
  count(distinct d.date) filter (where d.question_id != 'extra_saving')     as active_days_rt,
  sum(d.delta_amount) filter (where d.question_id != 'extra_saving')        as daily_saved_rt,
  sum(d.delta_amount) filter (where d.question_id = 'extra_saving')         as extra_saved_rt,
  sum(d.delta_amount)                                                        as total_saved_rt,
  min(d.date) filter (where d.question_id != 'extra_saving')                as first_decision_date,
  max(d.date) filter (where d.question_id != 'extra_saving')                as last_daily_date,

  -- Distribución de categorías de decisiones
  count(distinct d.id) filter (where d.question_id in ('coffee','delivery','impulse','impulse_online','ocio_bar'))      as consumo_decisions,
  count(distinct d.id) filter (where d.question_id in ('transport','transport_alt','transport_share'))                  as transport_decisions,
  count(distinct d.id) filter (where d.question_id in ('subscription','tech_apps'))                                     as subscription_decisions,
  count(distinct d.id) filter (where d.question_id in ('hogar_energy','hogar_water','hogar_meal_plan','hogar_heating')) as hogar_decisions,
  count(distinct d.id) filter (where d.question_id in ('salud_lunch','salud_exercise','salud_generic'))                 as salud_decisions,
  count(distinct d.id) filter (where d.question_id in ('ocio_streaming','ocio_library'))                               as ocio_decisions,
  count(distinct d.id) filter (where d.question_id in ('tech_gadget'))                                                  as tech_decisions

from public.user_profiles up
left join public.goals g on g.user_id = up.id
left join public.decisions d on d.user_id = up.id
group by up.id;

-- ─── Vista: distribución de respuestas por pregunta ──────────────────────────
create or replace view public.v_question_stats as
select
  question_id,
  answer_key,
  count(*)                             as answer_count,
  count(distinct user_id)             as unique_users,
  avg(delta_amount)                   as avg_delta,
  sum(delta_amount)                   as total_delta,
  round(100.0 * count(*) / sum(count(*)) over (partition by question_id), 1) as pct_in_question
from public.decisions
where question_id not in ('grace_day', 'extra_saving')
group by question_id, answer_key
order by question_id, answer_count desc;

-- ─── Vista: retención de usuarios (activos últimos N días) ───────────────────
create or replace view public.v_retention as
select
  count(distinct user_id) filter (where last_decision >= current_date - 1)   as dau,
  count(distinct user_id) filter (where last_decision >= current_date - 7)   as wau,
  count(distinct user_id) filter (where last_decision >= current_date - 30)  as mau,
  count(distinct user_id)                                                      as total_users,
  round(100.0 * count(distinct user_id) filter (where last_decision >= current_date - 1)
    / nullif(count(distinct user_id), 0), 1)                                  as dau_pct,
  round(100.0 * count(distinct user_id) filter (where last_decision >= current_date - 7)
    / nullif(count(distinct user_id), 0), 1)                                  as wau_pct
from (
  select user_id, max(date) as last_decision
  from public.decisions
  where question_id not in ('grace_day', 'extra_saving')
  group by user_id
) sub;

-- ─── Vista: cohort de registro vs primera decisión ───────────────────────────
create or replace view public.v_activation as
select
  up.id,
  up.created_at::date                                        as registered_date,
  min(d.date) filter (where d.question_id != 'extra_saving') as first_decision_date,
  min(d.date) filter (where d.question_id != 'extra_saving') - up.created_at::date as days_to_first_decision,
  up.money_feeling,
  up.income_range->>'min' || '-' || up.income_range->>'max'  as income_range_label
from public.user_profiles up
left join public.decisions d on d.user_id = up.id
group by up.id;
