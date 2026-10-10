-- ============================================================================
-- 019_v1_retirement.sql — Fase 5B.7: retirada operativa de V1
--
-- Pre-requisitos (verificados por el propio script):
--   * app_flags: V2_READS, V2_WRITE_AUTHORITY y V1_RUNTIME_RETIRED = true
--   * backfill + conciliación completados (REAL_MISMATCH = 0)
--
-- Efecto:
--   * Tablas V1 congeladas: sin INSERT/UPDATE/DELETE/TRUNCATE para
--     anon/authenticated/service_role. SELECT se mantiene (auditoría,
--     export BigQuery histórico, conciliación).
--   * goals es tabla compartida V1/V2: los clientes pierden la escritura
--     directa; las metas V2 se escriben solo vía RPC SECURITY DEFINER
--     (owner app_rpc_owner), que no depende de estos grants.
--   * user_profiles y push_subscriptions se mantienen (tablas KEEP);
--     las columnas de métricas V1 de user_profiles se marcan DEPRECATED.
--   * NO hay DROP de nada. Reversible con 019_v1_retirement_rollback.sql.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(k, ', ') INTO v_missing
  FROM unnest(ARRAY['V2_READS','V2_WRITE_AUTHORITY','V1_RUNTIME_RETIRED']) k
  WHERE NOT EXISTS (SELECT 1 FROM public.app_flags f WHERE f.key = k AND f.enabled);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '019 abortada: flags no activos: %', v_missing;
  END IF;
END $$;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.decisions             FROM anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.hucha                 FROM anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.question_interactions FROM anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.goals                 FROM anon, authenticated, service_role;

-- anon nunca necesitó leer datos de usuario V1
REVOKE SELECT ON public.decisions, public.hucha, public.question_interactions FROM anon;

DO $$
DECLARE
  v_ts text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
BEGIN
  EXECUTE format('COMMENT ON TABLE public.decisions IS %L',
    'DEPRECATED V1 — read-only desde ' || v_ts || '. Fuente de verdad: daily_decisions + savings_transactions (Data Model V2).');
  EXECUTE format('COMMENT ON TABLE public.hucha IS %L',
    'DEPRECATED V1 — read-only desde ' || v_ts || '. Fuente de verdad: savings_transactions / v_hucha_balance (Data Model V2).');
  EXECUTE format('COMMENT ON TABLE public.question_interactions IS %L',
    'DEPRECATED V1 — read-only desde ' || v_ts || '. Fuente de verdad: daily_prompt_impressions + daily_decisions (Data Model V2).');
  EXECUTE format('COMMENT ON TABLE public.goals IS %L',
    'Tabla compartida. Filas ledger_managed=false = DEPRECATED V1 (read-only desde ' || v_ts ||
    '). Filas ledger_managed=true = metas V2, escritas solo vía RPC; saldo en v_goal_state.');
  EXECUTE format('COMMENT ON COLUMN public.goals.current_amount IS %L',
    'DEPRECATED V1 — no usar para saldos. Saldo V2: v_goal_state (ledger).');
END $$;

COMMENT ON COLUMN public.user_profiles.total_saved         IS 'DEPRECATED V1 — métrica derivada; usar ledger V2.';
COMMENT ON COLUMN public.user_profiles.daily_saved         IS 'DEPRECATED V1 — métrica derivada; usar ledger V2.';
COMMENT ON COLUMN public.user_profiles.extra_saved         IS 'DEPRECATED V1 — métrica derivada; usar ledger V2.';
COMMENT ON COLUMN public.user_profiles.decisions_count     IS 'DEPRECATED V1 — usar daily_decisions.';
COMMENT ON COLUMN public.user_profiles.extra_savings_count IS 'DEPRECATED V1 — usar savings_transactions.';
COMMENT ON COLUMN public.user_profiles.goals_created_count IS 'DEPRECATED V1 — usar goal_events.';
COMMENT ON COLUMN public.user_profiles.streak_current      IS 'DEPRECATED V1 — derivar de daily_decisions.';
COMMENT ON COLUMN public.user_profiles.streak_max          IS 'DEPRECATED V1 — derivar de daily_decisions.';
COMMENT ON COLUMN public.user_profiles.active_days_count   IS 'DEPRECATED V1 — derivar de daily_decisions.';
COMMENT ON COLUMN public.user_profiles.income_range        IS 'DEPRECATED V1 — usar income_declarations.';

COMMIT;
