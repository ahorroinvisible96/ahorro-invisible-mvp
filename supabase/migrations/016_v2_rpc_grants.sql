-- ============================================================
-- Ahorro Invisible — Data Model V2 — 5B.2 — 016 Propietario y permisos de las RPC
-- Spec §6.7 R8, R9, R13. Idempotente.
--   · Propietario: app_rpc_owner (sin login, no superusuario).
--   · EXECUTE solo a authenticated; REVOKE de PUBLIC, anon y service_role.
--   · Helpers (schema private): sin EXECUTE para roles de la app.
-- ============================================================

DO $$
DECLARE f record;
BEGIN
  -- Helpers privados (incluye los creados en 013)
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'private' LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO app_rpc_owner', f.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO app_rpc_owner', f.sig);
  END LOOP;

  -- RPC públicas de negocio
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname IN (
              'start_onboarding','complete_onboarding','record_prompt_impression','record_daily_decision',
              'record_extra_saving','amend_decision_amount','void_decision','use_grace_day',
              'transfer_between_buckets','create_goal','update_goal','set_primary_goal',
              'archive_goal','reactivate_goal','delete_goal') LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO app_rpc_owner', f.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
  END LOOP;
END $$;

-- Vistas de lectura: SECURITY INVOKER (RLS del usuario); sin acceso anónimo.
REVOKE ALL ON public.v_goal_state, public.v_hucha_balance FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.v_goal_state, public.v_hucha_balance TO authenticated;

-- Defaults: cualquier función futura en public NO será ejecutable por anon/PUBLIC sin GRANT explícito.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- El propietario ya no necesita CREATE en public (se vuelve a conceder al reaplicar 006).
REVOKE CREATE ON SCHEMA public FROM app_rpc_owner;
