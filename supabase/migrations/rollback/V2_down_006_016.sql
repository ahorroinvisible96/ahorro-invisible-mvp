-- ============================================================
-- ROLLBACK del schema V2 (006–016). SOLO válido ANTES de 5B.3 (sin datos V2 reales).
-- Deja public.* V1 exactamente como estaba: no toca filas ni columnas V1.
-- Ensayado en staging real (5B.2.5): tras ejecutarlo, el catálogo V1 = producción PRE.
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

-- 1) RPC públicas y vistas
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure sig FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
           AND pg_get_userbyid(p.proowner) = 'app_rpc_owner' LOOP
    EXECUTE format('DROP FUNCTION %s CASCADE', f.sig);
  END LOOP;
END $$;
DROP VIEW IF EXISTS public.v_goal_state, public.v_hucha_balance;

-- 2) Objetos V2 sobre goals / user_profiles (V1 intacto)
DROP TRIGGER IF EXISTS goals_require_event_ctrg ON public.goals;
DROP TRIGGER IF EXISTS goals_guard_trg ON public.goals;
DROP POLICY IF EXISTS goals_v2_no_direct_insert ON public.goals;
DROP POLICY IF EXISTS goals_v2_no_direct_update ON public.goals;
DROP POLICY IF EXISTS goals_v2_no_direct_delete ON public.goals;
DROP INDEX IF EXISTS public.goals_one_primary_v2_uq, public.goals_user_status_idx;
ALTER TABLE public.goals
  DROP CONSTRAINT IF EXISTS goals_onboarding_session_fk,
  DROP CONSTRAINT IF EXISTS goals_status_chk, DROP CONSTRAINT IF EXISTS goals_origin_chk,
  DROP CONSTRAINT IF EXISTS goals_v2_live_managed_chk, DROP CONSTRAINT IF EXISTS goals_step_chk,
  DROP CONSTRAINT IF EXISTS goals_v2_shape_chk;

-- 3) Tablas V2 (CASCADE elimina FKs, políticas y triggers propios; goals_id_user_uq tiene dependientes V2)
DROP TABLE IF EXISTS public.savings_transactions, public.daily_decisions, public.daily_prompt_impressions,
  public.user_free_text, public.goal_events, public.income_declarations, public.avatar_assessment_answers,
  public.avatar_assessments, public.onboarding_sessions, public.cat_daily_questions,
  public.cat_recommendation_rules, public.cat_income_bands CASCADE;
ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_id_user_uq;
ALTER TABLE public.goals
  DROP COLUMN IF EXISTS status, DROP COLUMN IF EXISTS final_target_amount, DROP COLUMN IF EXISTS step_index,
  DROP COLUMN IF EXISTS start_date, DROP COLUMN IF EXISTS first_completed_at, DROP COLUMN IF EXISTS archived_at,
  DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS onboarding_session_id, DROP COLUMN IF EXISTS data_origin,
  DROP COLUMN IF EXISTS legacy_id, DROP COLUMN IF EXISTS ledger_managed;
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_currency_chk, DROP CONSTRAINT IF EXISTS user_profiles_timezone_len_chk,
  DROP COLUMN IF EXISTS timezone, DROP COLUMN IF EXISTS locale, DROP COLUMN IF EXISTS currency;

-- 4) Schema private, permisos y rol
DROP SCHEMA IF EXISTS private CASCADE;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rpc_owner') THEN
    REVOKE ALL ON public.goals, public.user_profiles FROM app_rpc_owner;
    REVOKE ALL ON SCHEMA public FROM app_rpc_owner;
    BEGIN REVOKE ALL ON SCHEMA auth FROM app_rpc_owner; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION auth.uid() FROM app_rpc_owner; EXCEPTION WHEN OTHERS THEN NULL; END;
    DROP OWNED BY app_rpc_owner;
    DROP ROLE app_rpc_owner;
  END IF;
END $$;
COMMIT;
