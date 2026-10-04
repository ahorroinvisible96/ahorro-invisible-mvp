-- ============================================================
-- Ahorro Invisible — Data Model V2 — 5B.1 — 011 Propietario, RLS y grants
-- Spec §6.7 R8–R11, R13. Idempotente.
-- Tablas V2 financieras/históricas: la app (anon/authenticated) SOLO tiene SELECT con
-- RLS user_id = auth.uid(). Toda escritura pasa por RPC SECURITY DEFINER (5B.2).
-- ============================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'onboarding_sessions','avatar_assessments','avatar_assessment_answers','income_declarations',
    'goal_events','daily_prompt_impressions','daily_decisions','savings_transactions','user_free_text'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO app_rpc_owner', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO service_role', t);   -- export/analítica (solo lectura)
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_own', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))',
      t || '_select_own', t);
  END LOOP;
END $$;

-- Catálogos: lectura para authenticated (RLS activada para cumplir el linter de Supabase)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cat_income_bands','cat_recommendation_rules','cat_daily_questions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated, service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t || '_read', t);
  END LOOP;
END $$;

-- Tablas V1 compartidas (goals, user_profiles): las RPC (app_rpc_owner) necesitan escribir.
GRANT SELECT, INSERT, UPDATE ON public.goals         TO app_rpc_owner;
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO app_rpc_owner;

-- Compatibilidad V1: la app V1 sigue escribiendo goals directamente, pero NO puede
-- crear/modificar/borrar filas gestionadas por el ledger (ledger_managed): políticas RESTRICTIVE.
DROP POLICY IF EXISTS goals_v2_no_direct_insert ON public.goals;
CREATE POLICY goals_v2_no_direct_insert ON public.goals AS RESTRICTIVE
  FOR INSERT TO anon, authenticated WITH CHECK (NOT ledger_managed);
DROP POLICY IF EXISTS goals_v2_no_direct_update ON public.goals;
CREATE POLICY goals_v2_no_direct_update ON public.goals AS RESTRICTIVE
  FOR UPDATE TO anon, authenticated USING (NOT ledger_managed) WITH CHECK (NOT ledger_managed);
DROP POLICY IF EXISTS goals_v2_no_direct_delete ON public.goals;
CREATE POLICY goals_v2_no_direct_delete ON public.goals AS RESTRICTIVE
  FOR DELETE TO anon, authenticated USING (NOT ledger_managed);

-- Funciones del schema private: propietario app_rpc_owner, sin EXECUTE público.
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'private' LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO app_rpc_owner', f.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO app_rpc_owner', f.sig);
  END LOOP;
END $$;
