-- ============================================================
-- Ahorro Invisible — Data Model V2 — 5B.3 — 017 Soporte de coexistencia y corte
-- ADITIVA respecto a V1. Idempotente. Todas las funciones nuevas: search_path=''.
--
--  1. public.app_flags           — feature flags de servidor (V2_DUAL_WRITE, V2_READS, ...)
--  2. public.v2_client_events    — observabilidad del outbox (sin PII, sin importes)
--  3. private.v1_uuid            — identidad determinista V1→V2 (SHA-256 → UUID v8)
--  4. Relajaciones SOLO para filas no v2_live (histórico V1): horizontes legacy y surface NULL
--  5. Ledger: amends_transaction_id (corrección de ahorros extra)
--  6. Correcciones de RPC: puntuación real del onboarding (1/2/2), update_goal con horizonte
--     legacy, amend a 0 (paridad V1)
--  7. RPC nuevas: declare_income, amend_extra_saving, void_extra_saving,
--     import_legacy_local_state, get_dashboard_state, shadow_check
--  8. private.v1_v2_compare + private.migration_row_notes (conciliación reutilizable)
-- ============================================================

-- El propietario de las RPC necesita CREATE temporalmente para recibir la propiedad (se revoca al final).
GRANT CREATE ON SCHEMA public TO app_rpc_owner;

-- ─── 1. Feature flags ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_flags (
  key            text        PRIMARY KEY,
  enabled        boolean     NOT NULL DEFAULT false,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_reason text,
  CONSTRAINT app_flags_key_chk CHECK (key ~ '^[A-Z0-9_]{3,64}$'),
  CONSTRAINT app_flags_reason_chk CHECK (updated_reason IS NULL OR char_length(updated_reason) <= 200)
);
ALTER TABLE public.app_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_flags FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.app_flags TO anon, authenticated, service_role;
GRANT SELECT, UPDATE ON public.app_flags TO app_rpc_owner;
DROP POLICY IF EXISTS app_flags_read ON public.app_flags;
CREATE POLICY app_flags_read ON public.app_flags FOR SELECT TO anon, authenticated, service_role USING (true);
DROP POLICY IF EXISTS app_flags_owner_all ON public.app_flags;
CREATE POLICY app_flags_owner_all ON public.app_flags FOR ALL TO app_rpc_owner USING (true) WITH CHECK (true);

INSERT INTO public.app_flags (key, enabled, updated_reason) VALUES
  ('V2_DUAL_WRITE', false, '017: initial OFF'),
  ('V2_READS', false, '017: initial OFF'),
  ('V2_WRITE_AUTHORITY', false, '017: initial OFF (write cutover)'),
  ('V1_RUNTIME_RETIRED', false, '017: initial OFF (5B.7)'),
  ('V2_LOCAL_IMPORT', false, '017: initial OFF (import one-shot del navegador tras el backfill)')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS private.app_flag_history (
  id         bigserial   PRIMARY KEY,
  key        text        NOT NULL,
  enabled    boolean     NOT NULL,
  reason     text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text        NOT NULL DEFAULT current_user
);
ALTER TABLE private.app_flag_history OWNER TO app_rpc_owner;
REVOKE ALL ON private.app_flag_history FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.app_flags_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'immutable_table: app_flags no admite DELETE' USING ERRCODE = 'P0001';
  END IF;
  NEW.updated_at := pg_catalog.now();
  INSERT INTO private.app_flag_history(key, enabled, reason) VALUES (NEW.key, NEW.enabled, NEW.updated_reason);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS app_flags_audit_trg ON public.app_flags;
CREATE TRIGGER app_flags_audit_trg BEFORE INSERT OR UPDATE OR DELETE ON public.app_flags
  FOR EACH ROW EXECUTE FUNCTION private.app_flags_audit();

-- ─── 2. Observabilidad del cliente (outbox) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.v2_client_events (
  event_id    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text        NOT NULL,
  rpc_name    text,
  idem_key    uuid,
  error_code  text,
  attempts    int,
  app_version text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT v2ce_kind_chk CHECK (kind IN ('outbox_dead_letter','outbox_resolved_absent','outbox_retry','outbox_already_present','outbox_covered_by_backfill',
                                           'shadow_ok','shadow_mismatch','local_import_done','local_import_failed')),
  CONSTRAINT v2ce_rpc_chk CHECK (rpc_name IS NULL OR rpc_name ~ '^[a-z_]{1,64}$'),
  CONSTRAINT v2ce_code_chk CHECK (error_code IS NULL OR error_code ~ '^[a-z0-9_:.-]{1,80}$'),
  CONSTRAINT v2ce_attempts_chk CHECK (attempts IS NULL OR attempts BETWEEN 0 AND 100000),
  CONSTRAINT v2ce_version_chk CHECK (app_version IS NULL OR app_version ~ '^[A-Za-z0-9_.-]{1,40}$')
);
CREATE INDEX IF NOT EXISTS v2ce_kind_idx ON public.v2_client_events (kind, created_at DESC);
ALTER TABLE public.v2_client_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.v2_client_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.v2_client_events TO authenticated;
GRANT SELECT, INSERT ON public.v2_client_events TO app_rpc_owner;
DROP POLICY IF EXISTS v2ce_insert_own ON public.v2_client_events;
CREATE POLICY v2ce_insert_own ON public.v2_client_events FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS v2ce_select_own ON public.v2_client_events;
CREATE POLICY v2ce_select_own ON public.v2_client_events FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS v2ce_owner_all ON public.v2_client_events;
CREATE POLICY v2ce_owner_all ON public.v2_client_events FOR ALL TO app_rpc_owner USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS v2ce_immutable_trg ON public.v2_client_events;
CREATE TRIGGER v2ce_immutable_trg BEFORE UPDATE OR DELETE ON public.v2_client_events
  FOR EACH ROW EXECUTE FUNCTION private.forbid_mutation();

-- ─── 3. Identidad determinista V1 → V2 ────────────────────────────────────────
-- UUID v8 (RFC 9562) = SHA-256('ai:v1:<user>:<kind>:<legacy_id>') con bits de versión/variante.
-- El cliente (src/services/v2/ids.ts) calcula exactamente lo mismo.
CREATE OR REPLACE FUNCTION private.v1_uuid(p_user uuid, p_kind text, p_legacy text)
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT (substr(h, 1, 12) || '8' || substr(h, 14, 3)
          || pg_catalog.substr('89ab', (pg_catalog.get_byte(pg_catalog.decode(substr(h, 17, 2), 'hex'), 0) % 4) + 1, 1)
          || substr(h, 18, 15))::uuid
    FROM (SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
            'ai:v1:' || p_user::text || ':' || p_kind || ':' || p_legacy, 'UTF8')), 'hex') AS h) x
$$;

-- ─── 4. Relajaciones para histórico V1 (nunca para v2_live) ───────────────────
ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_v2_shape_chk;
ALTER TABLE public.goals ADD CONSTRAINT goals_v2_shape_chk CHECK (
  NOT ledger_managed OR (
    target_amount > 0 AND target_amount <= 100000 AND target_amount = round(target_amount, 2)
    AND (horizon_months IN (1,2,3,6,12) OR (data_origin <> 'v2_live' AND horizon_months BETWEEN 1 AND 120))
    AND start_date IS NOT NULL
    AND source IN ('onboarding','dashboard','goals_page')
    AND (final_target_amount IS NULL OR final_target_amount >= target_amount)
    AND current_amount = 0
    AND completed_at IS NULL
    AND (status <> 'archived' OR archived_at IS NOT NULL)
    AND (status <> 'deleted'  OR deleted_at  IS NOT NULL)
    AND (NOT is_primary OR status = 'active')
  ));

ALTER TABLE public.goal_events DROP CONSTRAINT IF EXISTS ge_horizon_chk;
ALTER TABLE public.goal_events ADD CONSTRAINT ge_horizon_chk CHECK (
  (horizon_months_before IS NULL OR horizon_months_before BETWEEN 1 AND 120) AND
  (horizon_months_after IS NULL OR horizon_months_after IN (1,2,3,6,12)
     OR (data_origin <> 'v2_live' AND horizon_months_after BETWEEN 1 AND 120)));

ALTER TABLE public.daily_decisions ALTER COLUMN surface DROP NOT NULL;
ALTER TABLE public.daily_decisions DROP CONSTRAINT IF EXISTS dd_surface_live_chk;
ALTER TABLE public.daily_decisions ADD CONSTRAINT dd_surface_live_chk
  CHECK (surface IS NOT NULL OR data_origin <> 'v2_live');

-- Notas de migración por fila V1 (por qué una fila V1 no tiene asiento, etc.)
CREATE TABLE IF NOT EXISTS private.migration_row_notes (
  user_id      uuid        NOT NULL,
  legacy_table text        NOT NULL,
  legacy_id    text        NOT NULL,
  reason       text        NOT NULL,
  amount       numeric(12,2),
  noted_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, legacy_table, legacy_id),
  CONSTRAINT mrn_table_chk CHECK (legacy_table IN ('decisions','goals','hucha_entries','user_profiles','question_interactions')),
  CONSTRAINT mrn_reason_chk CHECK (reason IN ('unbucketed_goal_missing','bucket_not_reconstructible','zero_amount',
    'question_not_in_catalog','duplicate_primary_resolved','impressions_v2_only','income_unmappable','hucha_entry_goal_missing',
    'local_only_history','hucha_outflow_unrecorded','v1_balance_without_history'))
);
ALTER TABLE private.migration_row_notes OWNER TO app_rpc_owner;
REVOKE ALL ON private.migration_row_notes FROM PUBLIC, anon, authenticated, service_role;

-- ─── 5. Ledger: corrección de ahorros extra ───────────────────────────────────
ALTER TABLE public.savings_transactions ADD COLUMN IF NOT EXISTS amends_transaction_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'st_amends_fk') THEN
    ALTER TABLE public.savings_transactions ADD CONSTRAINT st_amends_fk
      FOREIGN KEY (amends_transaction_id, user_id) REFERENCES public.savings_transactions (transaction_id, user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'st_amends_chk') THEN
    ALTER TABLE public.savings_transactions ADD CONSTRAINT st_amends_chk CHECK (
      (amends_transaction_id IS NULL OR (transaction_type = 'amendment' AND decision_id IS NULL)) AND
      (transaction_type <> 'amendment' OR ((decision_id IS NOT NULL) <> (amends_transaction_id IS NOT NULL)))) NOT VALID;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS st_amends_idx ON public.savings_transactions (amends_transaction_id) WHERE amends_transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.st_check_amends()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE o public.savings_transactions%ROWTYPE;
BEGIN
  IF NEW.amends_transaction_id IS NOT NULL THEN
    SELECT * INTO o FROM public.savings_transactions
     WHERE transaction_id = NEW.amends_transaction_id AND user_id = NEW.user_id;
    IF NOT FOUND OR o.transaction_type <> 'extra_saving' OR o.bucket_type <> NEW.bucket_type
       OR o.goal_id IS DISTINCT FROM NEW.goal_id THEN
      RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS st_check_amends_trg ON public.savings_transactions;
CREATE TRIGGER st_check_amends_trg BEFORE INSERT ON public.savings_transactions
  FOR EACH ROW EXECUTE FUNCTION private.st_check_amends();

-- ─── 6. Correcciones de RPC existentes ────────────────────────────────────────
-- 6a. amend_decision_amount: permite 0 (paridad con V1: editar a 0 conserva la decisión del día).
CREATE OR REPLACE FUNCTION public.amend_decision_amount(
  p_mutation_id uuid, p_decision_id uuid, p_new_amount numeric,
  p_occurred_at timestamptz, p_timezone text, p_surface text DEFAULT 'history')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date;
  d public.daily_decisions%ROWTYPE; v_cur numeric; v_delta numeric; v_goal text; v_bucket text;
  g public.goals%ROWTYPE; v_txn uuid; v_completion text;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('decision', p_decision_id, 'new_amount', p_new_amount,
    'occurred_at', p_occurred_at, 'tz', p_timezone, 'surface', p_surface);
  v_res := private.idem_check(v_uid, p_mutation_id, 'amend_decision_amount', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;

  PERFORM private.validate_surface(p_surface);
  PERFORM private.validate_amount(p_new_amount, true);
  v_local := private.resolve_local_date(p_occurred_at, p_timezone);

  SELECT * INTO d FROM public.daily_decisions WHERE decision_id = p_decision_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001'; END IF;
  IF d.status <> 'active' OR d.outcome <> 'saved' THEN
    RAISE EXCEPTION 'decision_not_amendable' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_cur FROM public.savings_transactions
   WHERE user_id = v_uid AND decision_id = p_decision_id
     AND transaction_type IN ('daily_saving','amendment','reversal');
  v_delta := p_new_amount - v_cur;
  IF v_delta = 0 THEN
    RETURN private.idem_store(v_uid, p_mutation_id, 'amend_decision_amount', v_payload,
      jsonb_build_object('decision_id', p_decision_id, 'changed', false, 'current_amount', v_cur));
  END IF;

  SELECT goal_id, bucket_type INTO v_goal, v_bucket FROM public.savings_transactions
   WHERE user_id = v_uid AND decision_id = p_decision_id AND transaction_type = 'daily_saving';
  IF v_bucket IS NULL THEN
    RAISE EXCEPTION 'decision_not_amendable' USING ERRCODE = 'P0001';   -- decisión histórica sin asiento
  END IF;
  IF v_goal IS NOT NULL THEN
    g := private.load_goal(v_uid, v_goal, true);
    PERFORM private.require_active(g);
  END IF;
  PERFORM private.assert_balance(v_uid, v_bucket, v_goal, v_delta);
  v_txn := private.ledger_insert(v_uid, 'amendment', v_bucket, v_goal, v_delta, p_decision_id, NULL, NULL,
                                 'user_amend', p_occurred_at, p_timezone, v_local, p_surface, p_mutation_id);
  IF v_goal IS NOT NULL THEN
    v_completion := private.eval_completion(v_uid, v_goal, 'ledger_threshold', p_occurred_at, p_timezone, v_local, p_surface, v_txn);
  END IF;
  RETURN private.idem_store(v_uid, p_mutation_id, 'amend_decision_amount', v_payload,
    jsonb_build_object('decision_id', p_decision_id, 'changed', true, 'previous_amount', v_cur,
                       'current_amount', p_new_amount, 'delta', v_delta, 'transaction_id', v_txn,
                       'goal_completion', v_completion));
END $$;

-- 6b. update_goal: el horizonte solo se valida si se cambia (objetivos V1 con horizontes 4/5/9 meses).
CREATE OR REPLACE FUNCTION public.update_goal(
  p_mutation_id uuid, p_goal_id text, p_occurred_at timestamptz, p_timezone text,
  p_title text DEFAULT NULL, p_target_amount numeric DEFAULT NULL, p_horizon_months int DEFAULT NULL,
  p_surface text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date;
  g public.goals%ROWTYPE; v_title text; v_new_target numeric; v_new_horizon int;
  v_title_changed boolean; v_target_changed boolean; v_horizon_changed boolean; v_final numeric;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('goal', p_goal_id, 'occurred_at', p_occurred_at, 'tz', p_timezone,
    'title', p_title, 'target', p_target_amount, 'horizon', p_horizon_months, 'surface', p_surface);
  v_res := private.idem_check(v_uid, p_mutation_id, 'update_goal', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;
  PERFORM private.validate_surface(p_surface);
  v_local := private.resolve_local_date(p_occurred_at, p_timezone);
  g := private.load_goal(v_uid, p_goal_id, true);
  PERFORM private.require_active(g);

  v_title := CASE WHEN p_title IS NULL THEN g.title ELSE pg_catalog.btrim(p_title) END;
  IF pg_catalog.char_length(v_title) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'invalid_argument: title' USING ERRCODE = 'P0001';
  END IF;
  v_new_target := COALESCE(p_target_amount, g.target_amount);
  PERFORM private.validate_amount(v_new_target);
  v_new_horizon := COALESCE(p_horizon_months, g.horizon_months);
  IF p_horizon_months IS NOT NULL AND p_horizon_months <> g.horizon_months
     AND p_horizon_months NOT IN (1,2,3,6,12) THEN
    RAISE EXCEPTION 'invalid_argument: horizon_months' USING ERRCODE = 'P0001';
  END IF;
  v_title_changed   := v_title <> g.title;
  v_target_changed  := v_new_target <> g.target_amount;
  v_horizon_changed := v_new_horizon <> g.horizon_months;

  IF NOT (v_title_changed OR v_target_changed OR v_horizon_changed) THEN
    RETURN private.idem_store(v_uid, p_mutation_id, 'update_goal', v_payload,
      jsonb_build_object('goal_id', p_goal_id, 'changed', false));
  END IF;

  v_final := g.final_target_amount;
  IF v_final IS NOT NULL AND v_final < v_new_target THEN v_final := NULL; END IF;

  UPDATE public.goals SET title = v_title, target_amount = v_new_target, horizon_months = v_new_horizon,
         final_target_amount = v_final, updated_at = pg_catalog.now()
   WHERE id = p_goal_id AND user_id = v_uid;

  PERFORM private.add_goal_event(v_uid, p_goal_id, 'updated', 'user_action', p_occurred_at, p_timezone, v_local, p_surface,
    jsonb_build_object(
      'target_amount_before', CASE WHEN v_target_changed THEN g.target_amount END,
      'target_amount_after',  CASE WHEN v_target_changed THEN v_new_target END,
      'horizon_months_before', CASE WHEN v_horizon_changed THEN g.horizon_months END,
      'horizon_months_after',  CASE WHEN v_horizon_changed THEN v_new_horizon END,
      'title_changed', v_title_changed,
      'private_changes', CASE WHEN v_title_changed
        THEN jsonb_build_object('title', jsonb_build_object('from', g.title, 'to', v_title)) END));

  IF v_target_changed THEN
    PERFORM private.eval_completion(v_uid, p_goal_id, 'target_changed', p_occurred_at, p_timezone, v_local, p_surface);
  END IF;
  RETURN private.idem_store(v_uid, p_mutation_id, 'update_goal', v_payload,
    jsonb_build_object('goal_id', p_goal_id, 'changed', true));
END $$;

-- 6c. complete_onboarding: la puntuación real de la app (score_v1) pesa P1=1, P2=2, P3=2
--     (src/app/onboarding/page.tsx ONBOARDING_WEIGHTS). 015 usaba 2/2/1 por error.
--     + p_goal_legacy_id: id V1 del objetivo inicial durante el dual-write.
DROP FUNCTION IF EXISTS public.complete_onboarding(uuid, timestamptz, text, jsonb, uuid, text, text, text, jsonb, text,
  uuid, text, text, text, numeric, numeric, numeric, int, numeric, numeric, numeric, int, text, uuid, text, text);
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_session_id uuid, p_occurred_at timestamptz, p_timezone text,
  p_answers jsonb,
  p_assessment_id uuid, p_questionnaire_version text, p_scoring_version text,
  p_result_avatar text, p_scores jsonb,
  p_savings_habit text,
  p_income_declaration_id uuid, p_income_band_code text, p_income_band_catalog_version text,
  p_rule_version text, p_rec_reference_income_amount numeric, p_rec_savings_rate_pct numeric,
  p_rec_monthly_floor_amount numeric, p_rec_horizon_months int,
  p_recommended_monthly_amount numeric, p_recommended_target_amount numeric,
  p_chosen_target_amount numeric, p_chosen_horizon_months int, p_warning_shown text,
  p_goal_id uuid, p_goal_title text, p_client_app_version text DEFAULT NULL, p_goal_legacy_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date;
  s public.onboarding_sessions%ROWTYPE;
  v_keys text[]; v_set text; a jsonb; v_i int; v_w int; v_avatar text;
  v_sc jsonb := '{"comodo":0,"social":0,"impulsivo":0}'::jsonb;
  v_ref numeric; v_pct numeric; v_floor numeric; v_monthly numeric; v_target numeric;
  v_catver text; v_goal jsonb; v_max int;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('occurred_at', p_occurred_at, 'tz', p_timezone, 'answers', p_answers,
    'assessment', p_assessment_id, 'qv', p_questionnaire_version, 'sv', p_scoring_version,
    'avatar', p_result_avatar, 'scores', p_scores, 'habit', p_savings_habit,
    'income_id', p_income_declaration_id, 'band', p_income_band_code, 'band_cat', p_income_band_catalog_version,
    'rule', p_rule_version, 'ref', p_rec_reference_income_amount, 'pct', p_rec_savings_rate_pct,
    'floor', p_rec_monthly_floor_amount, 'rec_h', p_rec_horizon_months, 'rec_m', p_recommended_monthly_amount,
    'rec_t', p_recommended_target_amount, 'chosen_t', p_chosen_target_amount, 'chosen_h', p_chosen_horizon_months,
    'warning', p_warning_shown, 'goal', p_goal_id, 'title', p_goal_title, 'app', p_client_app_version,
    'goal_legacy', p_goal_legacy_id);
  v_res := private.idem_check(v_uid, p_session_id, 'complete_onboarding', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;

  SELECT * INTO s FROM public.onboarding_sessions
   WHERE onboarding_session_id = p_session_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001'; END IF;
  IF s.completed_at IS NOT NULL THEN RAISE EXCEPTION 'onboarding_already_completed' USING ERRCODE = 'P0001'; END IF;
  IF p_questionnaire_version IS NULL OR p_scoring_version IS NULL OR p_assessment_id IS NULL
     OR p_income_declaration_id IS NULL OR p_goal_id IS NULL THEN
    RAISE EXCEPTION 'invalid_argument: ids/versions' USING ERRCODE = 'P0001';
  END IF;
  v_local := private.resolve_local_date(p_occurred_at, p_timezone);

  IF p_scoring_version <> 'score_v1' OR p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array'
     OR jsonb_array_length(p_answers) <> 3 THEN
    RAISE EXCEPTION 'invalid_argument: answers' USING ERRCODE = 'P0001';
  END IF;
  v_set := CASE WHEN p_answers->0->>'question_key' LIKE 'onb\_q%' THEN 'onb' ELSE 'P' END;
  v_keys := CASE WHEN v_set = 'onb' THEN ARRAY['onb_q1','onb_q2','onb_q3'] ELSE ARRAY['P1','P2','P3'] END;
  FOR v_i IN 1..3 LOOP
    a := NULL;
    SELECT e INTO a FROM jsonb_array_elements(p_answers) e WHERE e->>'question_key' = v_keys[v_i];
    IF a IS NULL OR a->>'option_key' NOT IN ('a','b','c') THEN
      RAISE EXCEPTION 'invalid_argument: answers' USING ERRCODE = 'P0001';
    END IF;
    v_w := CASE WHEN v_i = 1 THEN 1 ELSE 2 END;
    v_sc := jsonb_set(v_sc, ARRAY[CASE a->>'option_key' WHEN 'a' THEN 'comodo' WHEN 'b' THEN 'social' ELSE 'impulsivo' END],
             to_jsonb((v_sc->>(CASE a->>'option_key' WHEN 'a' THEN 'comodo' WHEN 'b' THEN 'social' ELSE 'impulsivo' END))::int + v_w));
  END LOOP;
  v_max := GREATEST((v_sc->>'comodo')::int, (v_sc->>'social')::int, (v_sc->>'impulsivo')::int);
  v_avatar := CASE WHEN (v_sc->>'impulsivo')::int = v_max THEN 'impulsivo'
                   WHEN (v_sc->>'social')::int = v_max THEN 'social' ELSE 'comodo' END;
  IF p_result_avatar IS DISTINCT FROM v_avatar OR p_scores IS NULL OR jsonb_typeof(p_scores) <> 'object'
     OR (p_scores->>'comodo')::numeric IS DISTINCT FROM (v_sc->>'comodo')::numeric
     OR (p_scores->>'social')::numeric IS DISTINCT FROM (v_sc->>'social')::numeric
     OR (p_scores->>'impulsivo')::numeric IS DISTINCT FROM (v_sc->>'impulsivo')::numeric THEN
    RAISE EXCEPTION 'assessment_mismatch' USING ERRCODE = 'P0001';
  END IF;

  IF p_savings_habit IS NULL OR p_savings_habit NOT IN ('nunca','algo','suelo','bastante')
     OR p_rec_horizon_months IS NULL OR p_rec_horizon_months NOT IN (1,2,3,6,12)
     OR p_chosen_horizon_months IS NULL OR p_chosen_horizon_months NOT IN (1,2,3,6,12)
     OR p_warning_shown IS NULL OR p_warning_shown NOT IN ('none','over_recommendation','over_30pct_reference_income') THEN
    RAISE EXCEPTION 'invalid_argument: onboarding enums' USING ERRCODE = 'P0001';
  END IF;
  PERFORM private.validate_amount(p_chosen_target_amount);
  SELECT b.reference_income_amount INTO v_ref FROM public.cat_income_bands b
   WHERE b.catalog_version = p_income_band_catalog_version AND b.band_code = p_income_band_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_argument: income band' USING ERRCODE = 'P0001'; END IF;
  SELECT r.savings_rate_pct, r.monthly_floor_amount, r.income_band_catalog_version INTO v_pct, v_floor, v_catver
    FROM public.cat_recommendation_rules r
   WHERE r.rule_version = p_rule_version AND r.savings_habit = p_savings_habit;
  IF NOT FOUND OR v_catver <> p_income_band_catalog_version THEN
    RAISE EXCEPTION 'invalid_argument: recommendation rule' USING ERRCODE = 'P0001';
  END IF;
  v_monthly := GREATEST(v_floor, pg_catalog.round(v_ref * v_pct / 100));
  v_target := v_monthly * p_rec_horizon_months;
  IF p_rec_reference_income_amount IS DISTINCT FROM v_ref OR p_rec_savings_rate_pct IS DISTINCT FROM v_pct
     OR p_rec_monthly_floor_amount IS DISTINCT FROM v_floor
     OR p_recommended_monthly_amount IS DISTINCT FROM v_monthly
     OR p_recommended_target_amount IS DISTINCT FROM v_target THEN
    RAISE EXCEPTION 'recommendation_mismatch' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.avatar_assessments
    (assessment_id, user_id, questionnaire_key, questionnaire_version, scoring_version, onboarding_session_id,
     result_avatar, scores, completed_at, timezone, local_date, data_origin)
  VALUES (p_assessment_id, v_uid, 'onboarding_avatar', p_questionnaire_version, p_scoring_version, p_session_id,
          v_avatar, v_sc, p_occurred_at, p_timezone, v_local, 'v2_live');
  INSERT INTO public.avatar_assessment_answers (assessment_id, user_id, question_key, option_key, answered_at)
  SELECT p_assessment_id, v_uid, e->>'question_key', e->>'option_key', p_occurred_at
    FROM jsonb_array_elements(p_answers) e;

  INSERT INTO public.income_declarations
    (income_declaration_id, user_id, band_catalog_version, income_band_code, source, onboarding_session_id,
     declared_at, timezone, local_date, data_origin)
  VALUES (p_income_declaration_id, v_uid, p_income_band_catalog_version, p_income_band_code, 'onboarding',
          p_session_id, p_occurred_at, p_timezone, v_local, 'v2_live');

  IF p_goal_legacy_id IS NOT NULL AND (p_goal_legacy_id !~ '^goal_[0-9]{10,16}$'
       OR p_goal_id <> private.v1_uuid(v_uid, 'goal', p_goal_legacy_id)) THEN
    RAISE EXCEPTION 'invalid_argument: legacy_id' USING ERRCODE = 'P0001';
  END IF;
  v_goal := private.do_create_goal(v_uid, p_goal_id, p_goal_title, p_chosen_target_amount, p_chosen_horizon_months,
              'onboarding', true, p_occurred_at, p_timezone, v_local, NULL, NULL, NULL, NULL, NULL, NULL,
              'onboarding', p_session_id);
  IF p_goal_legacy_id IS NOT NULL THEN
    UPDATE public.goals SET legacy_id = p_goal_legacy_id WHERE id = p_goal_id::text AND user_id = v_uid;
  END IF;

  UPDATE public.onboarding_sessions SET
    completed_at = p_occurred_at, completed_timezone = p_timezone, completed_local_date = v_local,
    savings_habit = p_savings_habit, recommendation_rule_version = p_rule_version,
    income_band_catalog_version = p_income_band_catalog_version,
    rec_reference_income_amount = v_ref, rec_savings_rate_pct = v_pct, rec_monthly_floor_amount = v_floor,
    rec_horizon_months = p_rec_horizon_months, recommended_monthly_amount = v_monthly,
    recommended_target_amount = v_target, chosen_target_amount = p_chosen_target_amount,
    chosen_horizon_months = p_chosen_horizon_months, warning_shown = p_warning_shown,
    client_app_version = COALESCE(p_client_app_version, client_app_version)
   WHERE onboarding_session_id = p_session_id AND user_id = v_uid;

  RETURN private.idem_store(v_uid, p_session_id, 'complete_onboarding', v_payload,
    jsonb_build_object('onboarding_session_id', p_session_id, 'goal_id', p_goal_id, 'assessment_id', p_assessment_id,
                       'result_avatar', v_avatar, 'recommended_target_amount', v_target,
                       'accepted_recommendation', p_chosen_target_amount = v_target AND p_chosen_horizon_months = p_rec_horizon_months,
                       'completed_local_date', v_local));
END $$;

-- ─── 7. RPC nuevas ────────────────────────────────────────────────────────────

-- declare_income: cambio de tramo de ingresos fuera del onboarding (perfil / widget).
CREATE OR REPLACE FUNCTION public.declare_income(
  p_declaration_id uuid, p_band_code text, p_occurred_at timestamptz, p_timezone text,
  p_source text DEFAULT 'profile', p_catalog_version text DEFAULT 'income_ref_v1')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('band', p_band_code, 'occurred_at', p_occurred_at, 'tz', p_timezone,
                                  'source', p_source, 'cat', p_catalog_version);
  v_res := private.idem_check(v_uid, p_declaration_id, 'declare_income', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;
  IF p_source IS NULL OR p_source NOT IN ('dashboard_widget','profile') THEN
    RAISE EXCEPTION 'invalid_argument: source' USING ERRCODE = 'P0001';
  END IF;
  v_local := private.resolve_local_date(p_occurred_at, p_timezone);
  IF NOT EXISTS (SELECT 1 FROM public.cat_income_bands WHERE catalog_version = p_catalog_version AND band_code = p_band_code) THEN
    RAISE EXCEPTION 'invalid_argument: income band' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.income_declarations
    (income_declaration_id, user_id, band_catalog_version, income_band_code, source, declared_at, timezone, local_date, data_origin)
  VALUES (p_declaration_id, v_uid, p_catalog_version, p_band_code, p_source, p_occurred_at, p_timezone, v_local, 'v2_live');
  RETURN private.idem_store(v_uid, p_declaration_id, 'declare_income', v_payload,
    jsonb_build_object('income_declaration_id', p_declaration_id, 'band_code', p_band_code, 'local_date', v_local));
END $$;

-- Cadena viva de un ahorro extra: el asiento original + sus amendments (y sus reversals).
CREATE OR REPLACE FUNCTION private.extra_chain_amount(p_user uuid, p_txn uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH c AS (
    SELECT transaction_id, amount FROM public.savings_transactions
     WHERE user_id = p_user AND (transaction_id = p_txn OR amends_transaction_id = p_txn))
  SELECT COALESCE((SELECT SUM(amount) FROM c), 0)
       + COALESCE((SELECT SUM(r.amount) FROM public.savings_transactions r
                    WHERE r.user_id = p_user AND r.reverses_transaction_id IN (SELECT transaction_id FROM c)), 0)
$$;

CREATE OR REPLACE FUNCTION public.amend_extra_saving(
  p_mutation_id uuid, p_transaction_id uuid, p_new_amount numeric,
  p_occurred_at timestamptz, p_timezone text, p_surface text DEFAULT 'history')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date;
  t public.savings_transactions%ROWTYPE; v_cur numeric; v_delta numeric; g public.goals%ROWTYPE;
  v_completion text;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('txn', p_transaction_id, 'new_amount', p_new_amount,
    'occurred_at', p_occurred_at, 'tz', p_timezone, 'surface', p_surface);
  v_res := private.idem_check(v_uid, p_mutation_id, 'amend_extra_saving', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;
  PERFORM private.validate_surface(p_surface);
  PERFORM private.validate_amount(p_new_amount, true);
  v_local := private.resolve_local_date(p_occurred_at, p_timezone);
  SELECT * INTO t FROM public.savings_transactions
   WHERE transaction_id = p_transaction_id AND user_id = v_uid AND transaction_type = 'extra_saving';
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.savings_transactions WHERE reverses_transaction_id = t.transaction_id) THEN
    RAISE EXCEPTION 'transaction_not_active' USING ERRCODE = 'P0001';
  END IF;
  v_cur := private.extra_chain_amount(v_uid, t.transaction_id);
  v_delta := p_new_amount - v_cur;
  IF v_delta = 0 THEN
    RETURN private.idem_store(v_uid, p_mutation_id, 'amend_extra_saving', v_payload,
      jsonb_build_object('transaction_id', p_transaction_id, 'changed', false, 'current_amount', v_cur));
  END IF;
  IF t.goal_id IS NOT NULL THEN
    g := private.load_goal(v_uid, t.goal_id, true);
    PERFORM private.require_active(g);
  END IF;
  PERFORM private.assert_balance(v_uid, t.bucket_type, t.goal_id, v_delta);
  INSERT INTO public.savings_transactions
    (transaction_id, user_id, transaction_type, bucket_type, goal_id, amount, amends_transaction_id,
     reason, occurred_at, timezone, local_date, surface, actor, data_origin)
  VALUES (p_mutation_id, v_uid, 'amendment', t.bucket_type, t.goal_id, v_delta, t.transaction_id,
          'user_amend', p_occurred_at, p_timezone, v_local, p_surface, 'user', 'v2_live');
  IF t.goal_id IS NOT NULL THEN
    v_completion := private.eval_completion(v_uid, t.goal_id, 'ledger_threshold', p_occurred_at, p_timezone, v_local, p_surface, p_mutation_id);
  END IF;
  RETURN private.idem_store(v_uid, p_mutation_id, 'amend_extra_saving', v_payload,
    jsonb_build_object('transaction_id', p_transaction_id, 'changed', true, 'previous_amount', v_cur,
                       'current_amount', p_new_amount, 'delta', v_delta, 'goal_completion', v_completion));
END $$;

CREATE OR REPLACE FUNCTION public.void_extra_saving(
  p_mutation_id uuid, p_transaction_id uuid, p_occurred_at timestamptz, p_timezone text,
  p_surface text DEFAULT 'history')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date;
  t public.savings_transactions%ROWTYPE; r record; g public.goals%ROWTYPE; v_n int := 0; v_last uuid;
  v_completion text;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('txn', p_transaction_id, 'occurred_at', p_occurred_at, 'tz', p_timezone, 'surface', p_surface);
  v_res := private.idem_check(v_uid, p_mutation_id, 'void_extra_saving', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;
  PERFORM private.validate_surface(p_surface);
  v_local := private.resolve_local_date(p_occurred_at, p_timezone);
  SELECT * INTO t FROM public.savings_transactions
   WHERE transaction_id = p_transaction_id AND user_id = v_uid AND transaction_type = 'extra_saving';
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.savings_transactions WHERE reverses_transaction_id = t.transaction_id) THEN
    RAISE EXCEPTION 'transaction_not_active' USING ERRCODE = 'P0001';
  END IF;
  IF t.goal_id IS NOT NULL THEN
    g := private.load_goal(v_uid, t.goal_id, true);
    PERFORM private.require_active(g);
  END IF;
  FOR r IN
    SELECT s.* FROM public.savings_transactions s
     WHERE s.user_id = v_uid AND (s.transaction_id = t.transaction_id OR s.amends_transaction_id = t.transaction_id)
       AND NOT EXISTS (SELECT 1 FROM public.savings_transactions x WHERE x.reverses_transaction_id = s.transaction_id)
     ORDER BY s.amount, s.recorded_at, s.transaction_id
  LOOP
    PERFORM private.assert_balance(v_uid, r.bucket_type, r.goal_id, -r.amount);
    v_last := private.ledger_insert(v_uid, 'reversal', r.bucket_type, r.goal_id, -r.amount, NULL, NULL,
                                    r.transaction_id, 'user_void', p_occurred_at, p_timezone, v_local, p_surface);
    v_n := v_n + 1;
  END LOOP;
  IF t.goal_id IS NOT NULL THEN
    v_completion := private.eval_completion(v_uid, t.goal_id, 'ledger_threshold', p_occurred_at, p_timezone, v_local, p_surface, v_last);
  END IF;
  RETURN private.idem_store(v_uid, p_mutation_id, 'void_extra_saving', v_payload,
    jsonb_build_object('transaction_id', p_transaction_id, 'status', 'voided', 'reversals', v_n, 'goal_completion', v_completion));
END $$;

-- Lectura única del estado del usuario (SECURITY INVOKER: RLS del propio usuario).
-- Todas las cifras financieras salen del ledger; nada se calcula desde localStorage.
CREATE OR REPLACE FUNCTION public.get_dashboard_state(p_timezone text DEFAULT 'Europe/Madrid')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid(); v_tz text; v_today date; v_streak int := 0; v_cursor date; v_dates date[];
  v_res jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001'; END IF;
  v_tz := CASE WHEN EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_timezone) THEN p_timezone ELSE 'UTC' END;
  v_today := (pg_catalog.now() AT TIME ZONE v_tz)::date;

  SELECT COALESCE(array_agg(DISTINCT local_date), '{}') INTO v_dates FROM public.daily_decisions
   WHERE user_id = v_uid AND status = 'active';
  v_cursor := CASE WHEN v_today = ANY(v_dates) THEN v_today ELSE v_today - 1 END;
  WHILE v_cursor = ANY(v_dates) LOOP v_streak := v_streak + 1; v_cursor := v_cursor - 1; END LOOP;

  WITH bal AS (
    SELECT bucket_type, goal_id, SUM(amount) AS balance FROM public.savings_transactions
     WHERE user_id = v_uid GROUP BY bucket_type, goal_id
  ), goals AS (
    SELECT g.id, g.legacy_id, g.title, g.target_amount, g.final_target_amount, g.step_index, g.horizon_months,
           g.status, g.is_primary, g.source, g.start_date, g.created_at, g.updated_at, g.first_completed_at,
           g.archived_at, g.data_origin, COALESCE(b.balance, 0) AS balance
      FROM public.goals g LEFT JOIN bal b ON b.bucket_type = 'goal' AND b.goal_id = g.id
     WHERE g.user_id = v_uid AND g.ledger_managed
  ), dec AS (
    SELECT d.decision_id, d.local_date, d.occurred_at, d.outcome, d.question_bank_version, d.question_id,
           d.selected_option_key, d.goal_id, d.status, d.data_origin, d.credit_rule_version, d.legacy_id,
           (SELECT COALESCE(SUM(s.amount), 0) FROM public.savings_transactions s
             WHERE s.user_id = v_uid AND s.decision_id = d.decision_id) AS amount,
           EXISTS (SELECT 1 FROM public.savings_transactions s
                    WHERE s.user_id = v_uid AND s.decision_id = d.decision_id AND s.transaction_type = 'daily_saving') AS credited,
           (SELECT f.text FROM public.user_free_text f WHERE f.user_id = v_uid AND f.decision_id = d.decision_id) AS custom_text
      FROM public.daily_decisions d WHERE d.user_id = v_uid
  ), ext AS (
    SELECT t.transaction_id, t.local_date, t.occurred_at, t.goal_id, t.bucket_type, t.data_origin, t.legacy_id,
           private_amount.amount, NOT EXISTS (SELECT 1 FROM public.savings_transactions r
                                               WHERE r.user_id = v_uid AND r.reverses_transaction_id = t.transaction_id) AS active,
           (SELECT f.text FROM public.user_free_text f WHERE f.user_id = v_uid AND f.transaction_id = t.transaction_id) AS note
      FROM public.savings_transactions t
      CROSS JOIN LATERAL (
        SELECT COALESCE(SUM(c.amount), 0)
             + COALESCE((SELECT SUM(r.amount) FROM public.savings_transactions r
                          WHERE r.user_id = v_uid AND r.reverses_transaction_id IN (
                            SELECT c2.transaction_id FROM public.savings_transactions c2
                             WHERE c2.user_id = v_uid AND (c2.transaction_id = t.transaction_id OR c2.amends_transaction_id = t.transaction_id))), 0) AS amount
          FROM public.savings_transactions c
         WHERE c.user_id = v_uid AND (c.transaction_id = t.transaction_id OR c.amends_transaction_id = t.transaction_id)
      ) private_amount
     WHERE t.user_id = v_uid AND t.transaction_type = 'extra_saving'
  ), hucha_in AS (
    SELECT i.amount, i.local_date, o.goal_id AS from_goal_id, i.reason
      FROM public.savings_transactions i
      JOIN public.savings_transactions o ON o.transfer_group_id = i.transfer_group_id AND o.user_id = v_uid
                                         AND o.transaction_type = 'transfer_out'
     WHERE i.user_id = v_uid AND i.transaction_type = 'transfer_in' AND i.bucket_type = 'hucha'
  )
  SELECT jsonb_build_object(
    'server_time', pg_catalog.now(), 'timezone', v_tz, 'today', v_today,
    'onboarding', jsonb_build_object(
       'completed', EXISTS (SELECT 1 FROM public.onboarding_sessions WHERE user_id = v_uid AND completed_at IS NOT NULL)
                 OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_uid AND onboarding_completed_at IS NOT NULL)
                 OR EXISTS (SELECT 1 FROM goals WHERE data_origin <> 'v2_live'),
       'source', CASE WHEN EXISTS (SELECT 1 FROM public.onboarding_sessions WHERE user_id = v_uid AND completed_at IS NOT NULL) THEN 'v2'
                      WHEN EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_uid AND onboarding_completed_at IS NOT NULL)
                        OR EXISTS (SELECT 1 FROM goals WHERE data_origin <> 'v2_live') THEN 'legacy_v1' ELSE 'none' END),
    'income', (SELECT jsonb_build_object('band_code', income_band_code, 'catalog_version', band_catalog_version, 'declared_at', declared_at)
                 FROM public.income_declarations WHERE user_id = v_uid ORDER BY declared_at DESC, recorded_at DESC LIMIT 1),
    'avatar', (SELECT result_avatar FROM public.avatar_assessments WHERE user_id = v_uid ORDER BY completed_at DESC LIMIT 1),
    'goals', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'legacy_id', legacy_id, 'title', title, 'target_amount', target_amount,
        'final_target_amount', final_target_amount, 'step_index', step_index, 'horizon_months', horizon_months,
        'status', status, 'is_primary', is_primary, 'source', source, 'start_date', start_date,
        'created_at', created_at, 'updated_at', updated_at, 'first_completed_at', first_completed_at,
        'archived_at', archived_at, 'balance', balance,
        'is_currently_completed', status = 'active' AND balance >= target_amount) ORDER BY created_at, id)
      FROM goals WHERE status <> 'deleted'), '[]'::jsonb),
    'primary_goal_id', COALESCE(
        (SELECT id FROM goals WHERE status = 'active' AND is_primary LIMIT 1),
        (SELECT id FROM goals WHERE status = 'active' ORDER BY created_at, id LIMIT 1)),
    'hucha', jsonb_build_object(
        'balance', COALESCE((SELECT balance FROM bal WHERE bucket_type = 'hucha'), 0),
        'entries', COALESCE((SELECT jsonb_agg(jsonb_build_object('amount', amount, 'date', local_date,
                                                               'from_goal_id', from_goal_id, 'reason', reason) ORDER BY local_date)
                             FROM hucha_in), '[]'::jsonb)),
    'totals', jsonb_build_object(
        'total_balance', COALESCE((SELECT SUM(balance) FROM bal), 0),
        'registered_savings', COALESCE((SELECT SUM(amount) FROM public.savings_transactions
                                         WHERE user_id = v_uid AND transaction_type IN ('daily_saving','extra_saving','amendment','reversal')), 0),
        'daily_saved', COALESCE((SELECT SUM(amount) FROM public.savings_transactions
                                  WHERE user_id = v_uid AND decision_id IS NOT NULL), 0),
        'extra_saved', COALESCE((SELECT SUM(amount) FROM ext), 0),
        'opening_balances', COALESCE((SELECT SUM(amount) FROM public.savings_transactions
                                       WHERE user_id = v_uid AND transaction_type = 'migration_opening_balance'), 0)),
    'today_decision', (SELECT jsonb_build_object('decision_id', decision_id, 'outcome', outcome, 'amount', amount)
                         FROM dec WHERE local_date = v_today AND status = 'active' AND outcome <> 'grace' LIMIT 1),
    'streak', v_streak,
    'streak_broke_yesterday', v_streak = 0 AND NOT ((v_today - 1) = ANY(v_dates))
                              AND EXISTS (SELECT 1 FROM dec WHERE status = 'active' AND outcome <> 'grace'),
    'grace_available', NOT EXISTS (SELECT 1 FROM dec WHERE outcome = 'grace' AND status = 'active'
                                     AND date_trunc('month', local_date::timestamp) = date_trunc('month', v_today::timestamp)),
    'decisions', COALESCE((SELECT jsonb_agg(x ORDER BY x->>'local_date' DESC, x->>'occurred_at' DESC) FROM (
        SELECT jsonb_build_object('kind', CASE WHEN outcome = 'grace' THEN 'grace' ELSE 'daily' END,
          'id', decision_id, 'legacy_id', legacy_id, 'local_date', local_date, 'occurred_at', occurred_at,
          'outcome', outcome, 'question_id', question_id, 'option_key', selected_option_key, 'custom_text', custom_text,
          'goal_id', goal_id, 'amount', amount, 'credited', credited, 'data_origin', data_origin,
          'credit_rule_version', credit_rule_version) AS x
          FROM dec WHERE status = 'active'
        UNION ALL
        SELECT jsonb_build_object('kind', 'extra', 'id', transaction_id, 'legacy_id', legacy_id, 'local_date', local_date,
          'occurred_at', occurred_at, 'goal_id', goal_id, 'amount', amount, 'credited', true, 'note', note,
          'data_origin', data_origin)
          FROM ext WHERE active) s), '[]'::jsonb),
    'series', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', local_date, 'amount', amt) ORDER BY local_date) FROM (
        SELECT local_date, SUM(amount) AS amt FROM public.savings_transactions
         WHERE user_id = v_uid AND transaction_type IN ('daily_saving','extra_saving','amendment','reversal')
           AND local_date >= v_today - 120
         GROUP BY local_date) z), '[]'::jsonb)
  ) INTO v_res;
  RETURN v_res;
END $$;

-- ─── 7b. Ajustes de integridad para coexistencia, import y reset ─────────────
-- Anulación por reinicio completo de datos (Ajustes → Borrar mis datos).
ALTER TABLE public.daily_decisions DROP CONSTRAINT IF EXISTS dd_void_reason_chk;
ALTER TABLE public.daily_decisions ADD CONSTRAINT dd_void_reason_chk
  CHECK (void_reason IS NULL OR void_reason IN ('user_reset_today','user_deleted_in_history','user_account_reset'));

-- Evaluación de avatar importada del navegador (v1_local_import): no existe sesión V2 de onboarding.
ALTER TABLE public.avatar_assessments DROP CONSTRAINT IF EXISTS avatar_assessments_session_link_chk;
ALTER TABLE public.avatar_assessments ADD CONSTRAINT avatar_assessments_session_link_chk CHECK (
  ((questionnaire_key = 'onboarding_avatar') = (onboarding_session_id IS NOT NULL))
  OR (data_origin = 'v1_local_import' AND questionnaire_key = 'onboarding_avatar' AND onboarding_session_id IS NULL));

-- El reset de cuenta revierte también saldos de apertura (único caso de reversal de migration_opening_balance).
CREATE OR REPLACE FUNCTION private.st_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE o public.savings_transactions%ROWTYPE;
BEGIN
  PERFORM private.lock_user_ledger(NEW.user_id);
  IF NEW.transaction_type = 'reversal' THEN
    SELECT * INTO o FROM public.savings_transactions
      WHERE transaction_id = NEW.reverses_transaction_id AND user_id = NEW.user_id;
    IF NOT FOUND
       OR o.transaction_type NOT IN ('daily_saving','extra_saving','amendment','migration_opening_balance')
       OR o.bucket_type <> NEW.bucket_type
       OR o.goal_id IS DISTINCT FROM NEW.goal_id
       OR o.amount <> -NEW.amount THEN
      RAISE EXCEPTION 'invalid_reversal' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- ─── 7c. RPC de creación con identidad legacy (dual-write) ───────────────────
-- p_legacy_id: id V1 (goal_<ms>, dec_<ms>, extra_<ms>, grace_<ms>). Si se informa, el id V2 DEBE ser
-- private.v1_uuid(usuario, tipo, legacy). Si la fila ya existe (backfill o réplica previa) → already_present.
DROP FUNCTION IF EXISTS public.create_goal(uuid, text, numeric, int, text, boolean, timestamptz, text,
                                           numeric, int, boolean, numeric, int, boolean, text);
CREATE OR REPLACE FUNCTION public.create_goal(
  p_goal_id uuid, p_title text, p_target_amount numeric, p_horizon_months int, p_source text,
  p_set_primary boolean, p_occurred_at timestamptz, p_timezone text,
  p_final_target_amount numeric DEFAULT NULL, p_step_index int DEFAULT NULL,
  p_realism_is_unrealistic boolean DEFAULT NULL, p_realism_suggested_target numeric DEFAULT NULL,
  p_realism_suggested_horizon int DEFAULT NULL, p_accepted_step boolean DEFAULT NULL,
  p_surface text DEFAULT NULL, p_legacy_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('title', p_title, 'target', p_target_amount, 'horizon', p_horizon_months,
    'source', p_source, 'primary', p_set_primary, 'occurred_at', p_occurred_at, 'tz', p_timezone,
    'final', p_final_target_amount, 'step', p_step_index, 'r1', p_realism_is_unrealistic,
    'r2', p_realism_suggested_target, 'r3', p_realism_suggested_horizon, 'r4', p_accepted_step, 'surface', p_surface,
    'legacy', p_legacy_id);
  v_res := private.idem_check(v_uid, p_goal_id, 'create_goal', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;
  IF p_legacy_id IS NOT NULL AND (p_legacy_id !~ '^goal_[0-9]{10,16}$'
       OR p_goal_id <> private.v1_uuid(v_uid, 'goal', p_legacy_id)) THEN
    RAISE EXCEPTION 'invalid_argument: legacy_id' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.goals WHERE id = p_goal_id::text AND user_id = v_uid) THEN
    RETURN private.idem_store(v_uid, p_goal_id, 'create_goal', v_payload,
      jsonb_build_object('goal_id', p_goal_id, 'already_present', true));
  END IF;
  IF p_source = 'onboarding' THEN
    RAISE EXCEPTION 'invalid_argument: source' USING ERRCODE = 'P0001';
  END IF;
  PERFORM private.validate_surface(p_surface);
  v_local := private.resolve_local_date(p_occurred_at, p_timezone);
  v_res := private.do_create_goal(v_uid, p_goal_id, p_title, p_target_amount, p_horizon_months, p_source,
    COALESCE(p_set_primary, false), p_occurred_at, p_timezone, v_local, p_final_target_amount, p_step_index,
    p_realism_is_unrealistic, p_realism_suggested_target, p_realism_suggested_horizon, p_accepted_step,
    p_surface, NULL);
  IF p_legacy_id IS NOT NULL THEN
    UPDATE public.goals SET legacy_id = p_legacy_id WHERE id = p_goal_id::text AND user_id = v_uid;
  END IF;
  RETURN private.idem_store(v_uid, p_goal_id, 'create_goal', v_payload, v_res);
END $$;

DROP FUNCTION IF EXISTS public.record_daily_decision(uuid, timestamptz, text, text, text, text, text, numeric, text, text, uuid, text);
CREATE OR REPLACE FUNCTION public.record_daily_decision(
  p_decision_id uuid, p_occurred_at timestamptz, p_timezone text, p_outcome text,
  p_question_bank_version text, p_question_id text, p_selected_option_key text,
  p_declared_amount numeric, p_custom_text text DEFAULT NULL, p_goal_id text DEFAULT NULL,
  p_impression_id uuid DEFAULT NULL, p_surface text DEFAULT 'daily_page', p_legacy_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date;
  v_opts jsonb; v_text text; v_amount numeric; g public.goals%ROWTYPE; v_bucket text; v_txn uuid;
  v_completion text;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('occurred_at', p_occurred_at, 'tz', p_timezone, 'outcome', p_outcome,
    'qbv', p_question_bank_version, 'qid', p_question_id, 'opt', p_selected_option_key,
    'amount', p_declared_amount, 'text', p_custom_text, 'goal', p_goal_id, 'impression', p_impression_id,
    'surface', p_surface, 'legacy', p_legacy_id);
  v_res := private.idem_check(v_uid, p_decision_id, 'record_daily_decision', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;
  IF p_legacy_id IS NOT NULL AND (p_legacy_id !~ '^dec_[0-9]{10,16}$'
       OR p_decision_id <> private.v1_uuid(v_uid, 'dec', p_legacy_id)) THEN
    RAISE EXCEPTION 'invalid_argument: legacy_id' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.daily_decisions WHERE decision_id = p_decision_id AND user_id = v_uid) THEN
    RETURN private.idem_store(v_uid, p_decision_id, 'record_daily_decision', v_payload,
      jsonb_build_object('decision_id', p_decision_id, 'already_present', true));
  END IF;

  PERFORM private.validate_surface(p_surface);
  IF p_surface IS NULL THEN RAISE EXCEPTION 'invalid_argument: surface' USING ERRCODE = 'P0001'; END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('saved','zero') THEN
    RAISE EXCEPTION 'invalid_argument: outcome' USING ERRCODE = 'P0001';
  END IF;
  v_local := private.resolve_local_date(p_occurred_at, p_timezone);

  IF p_outcome = 'saved' THEN
    PERFORM private.validate_amount(p_declared_amount);
    v_amount := p_declared_amount;
  ELSE
    IF COALESCE(p_declared_amount, 0) <> 0 THEN RAISE EXCEPTION 'invalid_amount' USING ERRCODE = 'P0001'; END IF;
    v_amount := 0;
  END IF;

  SELECT options INTO v_opts FROM public.cat_daily_questions
   WHERE question_bank_version = p_question_bank_version AND question_id = p_question_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_question' USING ERRCODE = 'P0001'; END IF;

  IF p_selected_option_key = '__custom__' THEN
    v_text := pg_catalog.btrim(p_custom_text);
    IF v_text IS NULL OR pg_catalog.char_length(v_text) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'invalid_argument: custom_text' USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_selected_option_key = '__unspecified__' THEN
    -- paridad V1: la app permite confirmar sin elegir hueco (no se inventa una opción)
    IF p_custom_text IS NOT NULL THEN RAISE EXCEPTION 'invalid_option' USING ERRCODE = 'P0001'; END IF;
  ELSE
    IF p_custom_text IS NOT NULL OR p_selected_option_key IS NULL
       OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_opts) o WHERE o->>'option_key' = p_selected_option_key) THEN
      RAISE EXCEPTION 'invalid_option' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_impression_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.daily_prompt_impressions WHERE impression_id = p_impression_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;
  IF p_goal_id IS NOT NULL THEN
    g := private.load_goal(v_uid, p_goal_id, true);
    PERFORM private.require_active(g);
  END IF;
  IF EXISTS (SELECT 1 FROM public.daily_decisions
              WHERE user_id = v_uid AND local_date = v_local AND status = 'active') THEN
    RAISE EXCEPTION 'daily_decision_exists' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.daily_decisions
    (decision_id, legacy_id, user_id, local_date, occurred_at, timezone, outcome, question_bank_version, question_id,
     selected_option_key, has_custom_text, declared_amount, credit_rule_version, goal_id, impression_id,
     surface, status, data_origin)
  VALUES (p_decision_id, p_legacy_id, v_uid, v_local, p_occurred_at, p_timezone, p_outcome, p_question_bank_version,
          p_question_id, p_selected_option_key, p_selected_option_key = '__custom__', v_amount, 'identity_v1',
          p_goal_id, p_impression_id, p_surface, 'active', 'v2_live');
  IF v_text IS NOT NULL THEN
    INSERT INTO public.user_free_text(free_text_id, user_id, kind, decision_id, text)
    VALUES (gen_random_uuid(), v_uid, 'decision_custom_option', p_decision_id, v_text);
  END IF;
  IF p_outcome = 'saved' THEN
    v_bucket := CASE WHEN p_goal_id IS NULL THEN 'hucha' ELSE 'goal' END;
    v_txn := private.ledger_insert(v_uid, 'daily_saving', v_bucket, p_goal_id, v_amount, p_decision_id, NULL, NULL,
                                   'user_saving', p_occurred_at, p_timezone, v_local, p_surface);
    IF p_goal_id IS NOT NULL THEN
      v_completion := private.eval_completion(v_uid, p_goal_id, 'ledger_threshold', p_occurred_at, p_timezone, v_local, p_surface, v_txn);
    END IF;
  END IF;
  RETURN private.idem_store(v_uid, p_decision_id, 'record_daily_decision', v_payload,
    jsonb_build_object('decision_id', p_decision_id, 'local_date', v_local, 'outcome', p_outcome,
                       'recorded_amount', v_amount, 'transaction_id', v_txn, 'goal_completion', v_completion));
END $$;

DROP FUNCTION IF EXISTS public.record_extra_saving(uuid, timestamptz, text, numeric, text, text, text);
CREATE OR REPLACE FUNCTION public.record_extra_saving(
  p_transaction_id uuid, p_occurred_at timestamptz, p_timezone text, p_amount numeric,
  p_goal_id text DEFAULT NULL, p_note text DEFAULT NULL, p_surface text DEFAULT 'extra_saving_page',
  p_legacy_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date;
  v_note text; g public.goals%ROWTYPE; v_bucket text; v_completion text;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('occurred_at', p_occurred_at, 'tz', p_timezone, 'amount', p_amount,
    'goal', p_goal_id, 'note', p_note, 'surface', p_surface, 'legacy', p_legacy_id);
  v_res := private.idem_check(v_uid, p_transaction_id, 'record_extra_saving', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;
  IF p_legacy_id IS NOT NULL AND (p_legacy_id !~ '^extra_[0-9]{10,16}$'
       OR p_transaction_id <> private.v1_uuid(v_uid, 'extra', p_legacy_id)) THEN
    RAISE EXCEPTION 'invalid_argument: legacy_id' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.savings_transactions WHERE transaction_id = p_transaction_id AND user_id = v_uid) THEN
    RETURN private.idem_store(v_uid, p_transaction_id, 'record_extra_saving', v_payload,
      jsonb_build_object('transaction_id', p_transaction_id, 'already_present', true));
  END IF;
  PERFORM private.validate_surface(p_surface);
  PERFORM private.validate_amount(p_amount);
  v_local := private.resolve_local_date(p_occurred_at, p_timezone);
  IF p_note IS NOT NULL THEN
    v_note := pg_catalog.btrim(p_note);
    IF pg_catalog.char_length(v_note) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'invalid_argument: note' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF p_goal_id IS NOT NULL THEN
    g := private.load_goal(v_uid, p_goal_id, true);
    PERFORM private.require_active(g);
  END IF;
  v_bucket := CASE WHEN p_goal_id IS NULL THEN 'hucha' ELSE 'goal' END;
  INSERT INTO public.savings_transactions
    (transaction_id, user_id, transaction_type, bucket_type, goal_id, amount, reason, occurred_at, timezone,
     local_date, surface, actor, data_origin, legacy_id)
  VALUES (p_transaction_id, v_uid, 'extra_saving', v_bucket, p_goal_id, p_amount, 'user_saving', p_occurred_at,
          p_timezone, v_local, p_surface, 'user', 'v2_live', p_legacy_id);
  IF v_note IS NOT NULL THEN
    INSERT INTO public.user_free_text(free_text_id, user_id, kind, transaction_id, text)
    VALUES (gen_random_uuid(), v_uid, 'extra_saving_note', p_transaction_id, v_note);
  END IF;
  IF p_goal_id IS NOT NULL THEN
    v_completion := private.eval_completion(v_uid, p_goal_id, 'ledger_threshold', p_occurred_at, p_timezone, v_local, p_surface, p_transaction_id);
  END IF;
  RETURN private.idem_store(v_uid, p_transaction_id, 'record_extra_saving', v_payload,
    jsonb_build_object('transaction_id', p_transaction_id, 'local_date', v_local, 'recorded_amount', p_amount,
                       'bucket_type', v_bucket, 'goal_id', p_goal_id, 'goal_completion', v_completion));
END $$;

DROP FUNCTION IF EXISTS public.use_grace_day(uuid, timestamptz, text, text);
CREATE OR REPLACE FUNCTION public.use_grace_day(
  p_decision_id uuid, p_occurred_at timestamptz, p_timezone text, p_surface text DEFAULT 'dashboard_widget',
  p_legacy_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_today date; v_target date;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('occurred_at', p_occurred_at, 'tz', p_timezone, 'surface', p_surface, 'legacy', p_legacy_id);
  v_res := private.idem_check(v_uid, p_decision_id, 'use_grace_day', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;
  IF p_legacy_id IS NOT NULL AND (p_legacy_id !~ '^grace_[0-9]{10,16}$'
       OR p_decision_id <> private.v1_uuid(v_uid, 'grace', p_legacy_id)) THEN
    RAISE EXCEPTION 'invalid_argument: legacy_id' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.daily_decisions WHERE decision_id = p_decision_id AND user_id = v_uid) THEN
    RETURN private.idem_store(v_uid, p_decision_id, 'use_grace_day', v_payload,
      jsonb_build_object('decision_id', p_decision_id, 'already_present', true));
  END IF;
  PERFORM private.validate_surface(p_surface);
  IF p_surface IS NULL THEN RAISE EXCEPTION 'invalid_argument: surface' USING ERRCODE = 'P0001'; END IF;
  v_today := private.resolve_local_date(p_occurred_at, p_timezone);
  v_target := v_today - 1;
  IF EXISTS (SELECT 1 FROM public.daily_decisions
              WHERE user_id = v_uid AND local_date = v_target AND status = 'active') THEN
    RAISE EXCEPTION 'daily_decision_exists' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.daily_decisions
              WHERE user_id = v_uid AND outcome = 'grace' AND status = 'active'
                AND pg_catalog.date_trunc('month', local_date::timestamp) = pg_catalog.date_trunc('month', v_today::timestamp)) THEN
    RAISE EXCEPTION 'grace_already_used' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.daily_decisions
    (decision_id, legacy_id, user_id, local_date, occurred_at, timezone, outcome, has_custom_text, declared_amount,
     credit_rule_version, surface, status, data_origin)
  VALUES (p_decision_id, p_legacy_id, v_uid, v_target, p_occurred_at, p_timezone, 'grace', false, NULL,
          'identity_v1', p_surface, 'active', 'v2_live');
  RETURN private.idem_store(v_uid, p_decision_id, 'use_grace_day', v_payload,
    jsonb_build_object('decision_id', p_decision_id, 'local_date', v_target, 'outcome', 'grace'));
END $$;

-- ─── 7d. Reinicio completo de datos (Ajustes) ────────────────────────────────
-- Paridad con V1 "Borrar mis datos": tras el reset todos los saldos quedan a 0, las decisiones y
-- ahorros extra quedan anulados y los objetivos borrados. NADA se borra físicamente: se compensa
-- con asientos (reversal + transferencias de compensación) y queda auditado.
CREATE OR REPLACE FUNCTION public.reset_account_data(
  p_mutation_id uuid, p_occurred_at timestamptz, p_timezone text, p_surface text DEFAULT 'settings')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date;
  t record; b record; n record; v_rev int := 0; v_tr int := 0; v_goals int := 0; v_dec int := 0;
  v_need numeric; v_take numeric; v_group uuid;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('occurred_at', p_occurred_at, 'tz', p_timezone, 'surface', p_surface);
  v_res := private.idem_check(v_uid, p_mutation_id, 'reset_account_data', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;
  PERFORM private.validate_surface(p_surface);
  v_local := private.resolve_local_date(p_occurred_at, p_timezone);
  PERFORM 1 FROM public.goals WHERE user_id = v_uid AND ledger_managed ORDER BY id FOR UPDATE;

  -- 1) Revertir todo asiento de ahorro vivo (ahorros, correcciones, aperturas).
  FOR t IN
    SELECT s.* FROM public.savings_transactions s
     WHERE s.user_id = v_uid
       AND s.transaction_type IN ('daily_saving','extra_saving','amendment','migration_opening_balance')
       AND NOT EXISTS (SELECT 1 FROM public.savings_transactions r WHERE r.reverses_transaction_id = s.transaction_id)
     ORDER BY s.recorded_at, s.transaction_id
  LOOP
    PERFORM private.ledger_insert(v_uid, 'reversal', t.bucket_type, t.goal_id, -t.amount, t.decision_id, NULL,
                                  t.transaction_id, 'user_void', p_occurred_at, p_timezone, v_local, p_surface);
    v_rev := v_rev + 1;
  END LOOP;

  -- 2) Quedan solo transferencias internas (suman 0 en total): compensarlas para dejar cada bucket a 0.
  FOR n IN
    SELECT bucket_type, goal_id, -SUM(amount) AS need FROM public.savings_transactions
     WHERE user_id = v_uid GROUP BY bucket_type, goal_id HAVING SUM(amount) < 0
     ORDER BY bucket_type, goal_id
  LOOP
    v_need := n.need;
    FOR b IN
      SELECT bucket_type, goal_id, SUM(amount) AS bal FROM public.savings_transactions
       WHERE user_id = v_uid GROUP BY bucket_type, goal_id HAVING SUM(amount) > 0
       ORDER BY bucket_type, goal_id
    LOOP
      EXIT WHEN v_need <= 0;
      v_take := LEAST(v_need, b.bal);
      v_group := gen_random_uuid();
      PERFORM private.ledger_insert(v_uid, 'transfer_out', b.bucket_type, b.goal_id, -v_take, NULL, v_group, NULL,
                                    'manual_hucha_transfer', p_occurred_at, p_timezone, v_local, p_surface);
      PERFORM private.ledger_insert(v_uid, 'transfer_in', n.bucket_type, n.goal_id, v_take, NULL, v_group, NULL,
                                    'manual_hucha_transfer', p_occurred_at, p_timezone, v_local, p_surface);
      v_need := v_need - v_take; v_tr := v_tr + 1;
    END LOOP;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.savings_transactions WHERE user_id = v_uid
              GROUP BY bucket_type, goal_id HAVING SUM(amount) <> 0) THEN
    RAISE EXCEPTION 'internal: reset no deja saldos a 0' USING ERRCODE = 'P0001';
  END IF;

  -- 3) Anular decisiones vivas.
  UPDATE public.daily_decisions SET status = 'voided', voided_at = p_occurred_at, void_reason = 'user_account_reset'
   WHERE user_id = v_uid AND status = 'active';
  GET DIAGNOSTICS v_dec = ROW_COUNT;

  -- 4) Borrado lógico de objetivos (saldo ya 0).
  FOR t IN SELECT id, is_primary FROM public.goals WHERE user_id = v_uid AND ledger_managed AND status <> 'deleted' LOOP
    UPDATE public.goals SET status = 'deleted', is_primary = false, deleted_at = p_occurred_at
     WHERE id = t.id AND user_id = v_uid;
    PERFORM private.add_goal_event(v_uid, t.id, 'deleted', 'user_action', p_occurred_at, p_timezone, v_local, p_surface,
      jsonb_build_object('balance_destination_type', 'none', 'balance_moved_amount', 0));
    IF t.is_primary THEN
      PERFORM private.add_goal_event(v_uid, t.id, 'primary_unset', 'user_action', p_occurred_at, p_timezone, v_local, p_surface);
    END IF;
    v_goals := v_goals + 1;
  END LOOP;

  RETURN private.idem_store(v_uid, p_mutation_id, 'reset_account_data', v_payload,
    jsonb_build_object('reversals', v_rev, 'compensating_transfers', v_tr, 'voided_decisions', v_dec, 'deleted_goals', v_goals));
END $$;

-- ─── 7e. Import one-shot del estado que solo existe en el navegador ──────────
-- data_origin = 'v1_local_import'. Exento de la ventana de 72 h (datos históricos), una sola vez por
-- usuario. Importa SOLO lo demostrable y NUNCA crea asientos (los saldos vienen del backfill/conciliación
-- del servidor; un asiento aquí podría contar dos veces):
--   · días de gracia (V1 nunca los sincronizó)  → daily_decisions outcome='grace'
--   · decisiones diarias que nunca llegaron al servidor → daily_decisions SIN asiento (solo historial)
--   · evaluación del avatar del onboarding (respuestas guardadas en el navegador) → avatar_assessments
CREATE OR REPLACE FUNCTION public.import_legacy_local_state(
  p_import_id uuid, p_payload jsonb, p_occurred_at timestamptz, p_timezone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; e jsonb; v_d date; v_ts timestamptz;
  v_id uuid; v_n_grace int := 0; v_n_dec int := 0; v_n_skip int := 0; v_avatar int := 0;
  v_ans text[]; v_w int; v_i int; v_sc jsonb; v_max int; v_av text; v_assess uuid; v_goal text; v_qid text;
  v_opt text; v_amt numeric;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('payload', p_payload, 'occurred_at', p_occurred_at, 'tz', p_timezone);
  v_res := private.idem_check(v_uid, p_import_id, 'import_legacy_local_state', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;
  IF EXISTS (SELECT 1 FROM private.idempotency_keys WHERE user_id = v_uid AND rpc_name = 'import_legacy_local_state') THEN
    RETURN jsonb_build_object('already_imported', true);
  END IF;
  PERFORM private.validate_timezone(p_timezone);
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' OR pg_catalog.length(p_payload::text) > 300000 THEN
    RAISE EXCEPTION 'invalid_argument: payload' USING ERRCODE = 'P0001';
  END IF;

  -- (a) Días de gracia
  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'grace', '[]'::jsonb)) LIMIT 400 LOOP
    CONTINUE WHEN e->>'legacy_id' IS NULL OR e->>'legacy_id' !~ '^grace_[0-9]{10,16}$'
               OR e->>'date' IS NULL OR e->>'date' !~ '^\d{4}-\d{2}-\d{2}$';
    v_d := (e->>'date')::date;
    CONTINUE WHEN v_d > (pg_catalog.now() AT TIME ZONE 'UTC')::date + 1 OR v_d < date '2024-01-01';
    v_id := private.v1_uuid(v_uid, 'grace', e->>'legacy_id');
    IF EXISTS (SELECT 1 FROM public.daily_decisions WHERE decision_id = v_id)
       OR EXISTS (SELECT 1 FROM public.daily_decisions WHERE user_id = v_uid AND local_date = v_d AND status = 'active') THEN
      v_n_skip := v_n_skip + 1; CONTINUE;
    END IF;
    v_ts := LEAST(COALESCE((e->>'created_at')::timestamptz, v_d::timestamp AT TIME ZONE 'UTC'), pg_catalog.now());
    INSERT INTO public.daily_decisions (decision_id, legacy_id, user_id, local_date, occurred_at, timezone, outcome,
      has_custom_text, declared_amount, credit_rule_version, surface, status, data_origin)
    VALUES (v_id, e->>'legacy_id', v_uid, v_d, v_ts, 'UTC', 'grace', false, NULL, 'legacy_v1_income_multiplier',
            NULL, 'active', 'v1_local_import');
    v_n_grace := v_n_grace + 1;
  END LOOP;

  -- (b) Decisiones diarias locales que nunca llegaron al servidor (sin asiento: solo historial)
  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'decisions', '[]'::jsonb)) LIMIT 2000 LOOP
    CONTINUE WHEN e->>'legacy_id' IS NULL OR e->>'legacy_id' !~ '^dec_[0-9]{10,16}$'
               OR e->>'date' IS NULL OR e->>'date' !~ '^\d{4}-\d{2}-\d{2}$';
    v_d := (e->>'date')::date;
    CONTINUE WHEN v_d > (pg_catalog.now() AT TIME ZONE 'UTC')::date + 1 OR v_d < date '2024-01-01';
    v_id := private.v1_uuid(v_uid, 'dec', e->>'legacy_id');
    -- ya en el servidor (V1 o V2) → nada que importar
    IF EXISTS (SELECT 1 FROM public.daily_decisions WHERE decision_id = v_id)
       OR EXISTS (SELECT 1 FROM public.decisions WHERE id = e->>'legacy_id' AND user_id = v_uid)
       OR EXISTS (SELECT 1 FROM public.daily_decisions WHERE user_id = v_uid AND local_date = v_d AND status = 'active') THEN
      v_n_skip := v_n_skip + 1; CONTINUE;
    END IF;
    v_amt := COALESCE((e->>'amount')::numeric, 0);
    CONTINUE WHEN v_amt < 0 OR v_amt > 100000;
    v_qid := e->>'question_id';
    IF NOT EXISTS (SELECT 1 FROM public.cat_daily_questions WHERE question_bank_version = 'qb_v1' AND question_id = v_qid) THEN
      v_qid := NULL;
    END IF;
    v_opt := CASE WHEN v_qid IS NOT NULL AND e->>'option_key' ~ '^[a-z0-9_]{1,80}$'
                       AND EXISTS (SELECT 1 FROM public.cat_daily_questions q, jsonb_array_elements(q.options) o
                                    WHERE q.question_bank_version = 'qb_v1' AND q.question_id = v_qid
                                      AND o->>'option_key' = e->>'option_key')
                  THEN e->>'option_key' END;
    v_goal := NULL;
    IF e->>'goal_legacy_id' ~ '^goal_[0-9]{10,16}$' THEN
      SELECT id INTO v_goal FROM public.goals
       WHERE user_id = v_uid AND ledger_managed AND legacy_id = e->>'goal_legacy_id';
    END IF;
    v_ts := LEAST(COALESCE((e->>'created_at')::timestamptz, v_d::timestamp AT TIME ZONE 'UTC'), pg_catalog.now());
    INSERT INTO public.daily_decisions (decision_id, legacy_id, user_id, local_date, occurred_at, timezone, outcome,
      question_bank_version, question_id, selected_option_key, has_custom_text, declared_amount, credit_rule_version,
      goal_id, surface, status, data_origin)
    VALUES (v_id, e->>'legacy_id', v_uid, v_d, v_ts, 'UTC', CASE WHEN v_amt > 0 THEN 'saved' ELSE 'zero' END,
            CASE WHEN v_qid IS NOT NULL THEN 'qb_v1' END, v_qid, v_opt, false, NULL, 'legacy_v1_income_multiplier',
            v_goal, NULL, 'active', 'v1_local_import');
    INSERT INTO private.migration_row_notes (user_id, legacy_table, legacy_id, reason, amount)
    VALUES (v_uid, 'decisions', e->>'legacy_id', 'local_only_history', v_amt)
    ON CONFLICT DO NOTHING;
    v_n_dec := v_n_dec + 1;
  END LOOP;

  -- (c) Avatar del onboarding (respuestas guardadas en el navegador; puntuación score_v1 recalculada)
  IF jsonb_typeof(p_payload->'onboarding_answers') = 'array' AND jsonb_array_length(p_payload->'onboarding_answers') = 3
     AND NOT EXISTS (SELECT 1 FROM public.avatar_assessments WHERE user_id = v_uid AND questionnaire_key = 'onboarding_avatar') THEN
    SELECT array_agg(x ORDER BY ord) INTO v_ans
      FROM jsonb_array_elements_text(p_payload->'onboarding_answers') WITH ORDINALITY AS a(x, ord);
    IF v_ans <@ ARRAY['comodo','social','impulsivo'] THEN
      v_sc := '{"comodo":0,"social":0,"impulsivo":0}'::jsonb;
      FOR v_i IN 1..3 LOOP
        v_w := CASE WHEN v_i = 1 THEN 1 ELSE 2 END;
        v_sc := jsonb_set(v_sc, ARRAY[v_ans[v_i]], to_jsonb((v_sc->>v_ans[v_i])::int + v_w));
      END LOOP;
      v_max := GREATEST((v_sc->>'comodo')::int, (v_sc->>'social')::int, (v_sc->>'impulsivo')::int);
      v_av := CASE WHEN (v_sc->>'impulsivo')::int = v_max THEN 'impulsivo'
                   WHEN (v_sc->>'social')::int = v_max THEN 'social' ELSE 'comodo' END;
      v_ts := LEAST(COALESCE((p_payload->>'onboarding_completed_at')::timestamptz, pg_catalog.now()), pg_catalog.now());
      v_assess := private.v1_uuid(v_uid, 'avatar', 'onboarding');
      INSERT INTO public.avatar_assessments (assessment_id, user_id, questionnaire_key, questionnaire_version,
        scoring_version, onboarding_session_id, result_avatar, scores, completed_at, timezone, local_date, data_origin)
      VALUES (v_assess, v_uid, 'onboarding_avatar', 'onb_avatar_v1', 'score_v1', NULL, v_av, v_sc, v_ts, 'UTC',
              (v_ts AT TIME ZONE 'UTC')::date, 'v1_local_import');
      INSERT INTO public.avatar_assessment_answers (assessment_id, user_id, question_key, option_key, answered_at)
      SELECT v_assess, v_uid, 'onb_q' || i, CASE v_ans[i] WHEN 'comodo' THEN 'a' WHEN 'social' THEN 'b' ELSE 'c' END, v_ts
        FROM generate_series(1, 3) i;
      v_avatar := 1;
    END IF;
  END IF;

  RETURN private.idem_store(v_uid, p_import_id, 'import_legacy_local_state', v_payload,
    jsonb_build_object('grace_imported', v_n_grace, 'decisions_imported', v_n_dec, 'skipped', v_n_skip,
                       'avatar_imported', v_avatar = 1));
END $$;

-- ─── 8. Comparación V1 ↔ V2 reutilizable (conciliación / shadow) ─────────────
-- Una fila por (usuario, métrica, clave). Clasificación:
--   OK                    · coincide
--   MIGRATION_ADJUSTMENT  · coincide gracias a un saldo de apertura justificado (migration_row_notes)
--   EXPECTED_LEGACY       · diferencia explicada por un defecto documentado de V1 (nota por fila)
--   REAL_MISMATCH         · cualquier otra diferencia (bloquea el corte)
-- Válida mientras V1 sea escrito (hasta WRITE_CUTOVER). Ejecutable solo por el propietario.
CREATE OR REPLACE FUNCTION private.v1_v2_compare(p_user uuid DEFAULT NULL)
RETURNS TABLE (user_id uuid, metric text, item text, v1 numeric, v2 numeric, classification text, detail text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH users AS (
    SELECT DISTINCT u FROM (
      SELECT g.user_id AS u FROM public.goals g WHERE NOT g.ledger_managed
      UNION SELECT d.user_id FROM public.decisions d
      UNION SELECT h.user_id FROM public.hucha h
      UNION SELECT s.user_id FROM public.savings_transactions s
      UNION SELECT g.user_id FROM public.goals g WHERE g.ledger_managed) x
    WHERE p_user IS NULL OR u = p_user
  ),
  v1g AS (
    SELECT g.user_id, g.id, g.current_amount::numeric AS bal, g.archived, g.is_primary, g.updated_at, g.created_at
      FROM public.goals g JOIN users ON users.u = g.user_id WHERE NOT g.ledger_managed
  ),
  v2g AS (
    SELECT g.user_id, g.id, g.legacy_id, g.status, g.is_primary,
           COALESCE((SELECT SUM(s.amount) FROM public.savings_transactions s
                      WHERE s.user_id = g.user_id AND s.bucket_type = 'goal' AND s.goal_id = g.id), 0) AS bal,
           EXISTS (SELECT 1 FROM public.savings_transactions s WHERE s.user_id = g.user_id AND s.goal_id = g.id
                    AND s.transaction_type = 'migration_opening_balance') AS has_opening
      FROM public.goals g JOIN users ON users.u = g.user_id WHERE g.ledger_managed
  ),
  goal_cmp AS (
    SELECT COALESCE(a.user_id, b.user_id) AS user_id, COALESCE(a.id, b.legacy_id, b.id) AS item,
           a.bal AS v1, b.bal AS v2, a.archived, b.status, b.has_opening, (b.id IS NULL) AS missing_v2, (a.id IS NULL) AS missing_v1
      FROM v1g a FULL JOIN v2g b ON b.user_id = a.user_id AND b.legacy_id = a.id
  ),
  hucha_cmp AS (
    SELECT u AS user_id,
           COALESCE((SELECT h.balance::numeric FROM public.hucha h WHERE h.user_id = u), 0) AS v1,
           COALESCE((SELECT SUM(s.amount) FROM public.savings_transactions s WHERE s.user_id = u AND s.bucket_type = 'hucha'), 0) AS v2,
           EXISTS (SELECT 1 FROM public.savings_transactions s WHERE s.user_id = u AND s.bucket_type = 'hucha'
                    AND s.transaction_type = 'migration_opening_balance') AS has_opening
      FROM users
  ),
  dec_v1 AS (
    SELECT d.user_id, d.id, d.question_id, d.delta_amount::numeric AS amt, d.goal_id
      FROM public.decisions d JOIN users ON users.u = d.user_id
  ),
  dec_pair AS (
    SELECT a.user_id, a.id, a.question_id, a.amt,
           (SELECT dd.decision_id FROM public.daily_decisions dd
             WHERE dd.user_id = a.user_id AND dd.legacy_id = a.id) AS v2_dec,
           (SELECT s.transaction_id FROM public.savings_transactions s
             WHERE s.user_id = a.user_id AND s.legacy_id = a.id AND s.transaction_type = 'extra_saving') AS v2_extra,
           EXISTS (SELECT 1 FROM private.migration_row_notes n
                    WHERE n.user_id = a.user_id AND n.legacy_table = 'decisions' AND n.legacy_id = a.id) AS noted
      FROM dec_v1 a
  ),
  v1_primary AS (
    SELECT DISTINCT ON (g.user_id) g.user_id, g.id
      FROM v1g g WHERE NOT g.archived AND g.is_primary
     ORDER BY g.user_id, (g.bal >= COALESCE((SELECT x.target_amount FROM public.goals x WHERE x.id = g.id), 0)) ASC,
              g.updated_at DESC, g.created_at DESC, g.id DESC
  ),
  v1_primary_n AS (SELECT g.user_id, COUNT(*) AS n FROM v1g g WHERE NOT g.archived AND g.is_primary GROUP BY g.user_id),
  v2_primary AS (SELECT g.user_id, g.legacy_id, g.id FROM v2g g WHERE g.status = 'active' AND g.is_primary)
  -- saldos por objetivo
  SELECT c.user_id, 'goal_balance', c.item, c.v1, c.v2,
         CASE WHEN c.missing_v2 OR c.missing_v1 THEN
                CASE WHEN c.missing_v1 AND c.status = 'deleted' AND c.v2 = 0 THEN 'OK'
                     WHEN c.missing_v1 AND c.v2 IS NOT NULL AND EXISTS (SELECT 1 FROM public.goals x WHERE x.user_id = c.user_id AND x.id = c.item AND x.data_origin = 'v2_live' AND x.legacy_id IS NULL) THEN 'OK'
                     ELSE 'REAL_MISMATCH' END
              WHEN c.v1 = c.v2 THEN CASE WHEN c.has_opening THEN 'MIGRATION_ADJUSTMENT' ELSE 'OK' END
              ELSE 'REAL_MISMATCH' END,
         CASE WHEN c.missing_v2 THEN 'sin pareja V2' WHEN c.missing_v1 THEN 'sin pareja V1' ELSE NULL END
    FROM goal_cmp c
  UNION ALL
  -- estado del objetivo (archivado ↔ status)
  SELECT c.user_id, 'goal_status', c.item, CASE WHEN c.archived THEN 1 ELSE 0 END,
         CASE WHEN c.status = 'active' THEN 0 ELSE 1 END,
         CASE WHEN (c.archived) = (c.status <> 'active') THEN 'OK' ELSE 'REAL_MISMATCH' END, c.status
    FROM goal_cmp c WHERE NOT c.missing_v1 AND NOT c.missing_v2
  UNION ALL
  -- hucha
  SELECT h.user_id, 'hucha', 'hucha', h.v1, h.v2,
         CASE WHEN h.v1 = h.v2 THEN CASE WHEN h.has_opening THEN 'MIGRATION_ADJUSTMENT' ELSE 'OK' END ELSE 'REAL_MISMATCH' END, NULL
    FROM hucha_cmp h
  UNION ALL
  -- total por usuario (objetivos V1 no borrados + hucha) vs V2 (todos los buckets)
  SELECT u, 'total', 'total',
         COALESCE((SELECT SUM(g.bal) FROM v1g g WHERE g.user_id = u), 0) + COALESCE((SELECT h.v1 FROM hucha_cmp h WHERE h.user_id = u), 0),
         COALESCE((SELECT SUM(s.amount) FROM public.savings_transactions s WHERE s.user_id = u), 0),
         CASE WHEN COALESCE((SELECT SUM(g.bal) FROM v1g g WHERE g.user_id = u), 0) + COALESCE((SELECT h.v1 FROM hucha_cmp h WHERE h.user_id = u), 0)
                 = COALESCE((SELECT SUM(s.amount) FROM public.savings_transactions s WHERE s.user_id = u), 0)
              THEN 'OK' ELSE 'REAL_MISMATCH' END, NULL
    FROM users
  UNION ALL
  -- decisiones / ahorros extra V1 con pareja V2
  SELECT p.user_id, CASE WHEN p.question_id = 'extra_saving' THEN 'extra_saving' ELSE 'daily_decision' END, p.id, p.amt,
         CASE WHEN p.question_id = 'extra_saving'
              THEN (SELECT private.extra_chain_amount(p.user_id, p.v2_extra))
              ELSE (SELECT COALESCE(SUM(s.amount), 0) FROM public.savings_transactions s
                     WHERE s.user_id = p.user_id AND s.decision_id = p.v2_dec) END,
         CASE WHEN p.question_id = 'extra_saving' THEN
                CASE WHEN p.v2_extra IS NULL THEN CASE WHEN p.noted THEN 'EXPECTED_LEGACY' ELSE 'REAL_MISMATCH' END
                     WHEN private.extra_chain_amount(p.user_id, p.v2_extra) = p.amt THEN 'OK'
                     WHEN p.noted THEN 'EXPECTED_LEGACY' ELSE 'REAL_MISMATCH' END
              ELSE
                CASE WHEN p.v2_dec IS NULL THEN 'REAL_MISMATCH'
                     WHEN (SELECT COALESCE(SUM(s.amount), 0) FROM public.savings_transactions s
                            WHERE s.user_id = p.user_id AND s.decision_id = p.v2_dec) = p.amt THEN 'OK'
                     WHEN p.noted THEN 'EXPECTED_LEGACY' ELSE 'REAL_MISMATCH' END END,
         CASE WHEN p.noted THEN (SELECT n.reason FROM private.migration_row_notes n
                                  WHERE n.user_id = p.user_id AND n.legacy_table = 'decisions' AND n.legacy_id = p.id) END
    FROM dec_pair p
  UNION ALL
  -- objetivo principal
  SELECT u, 'primary_goal', COALESCE((SELECT p.id FROM v1_primary p WHERE p.user_id = u), '-'),
         COALESCE((SELECT n.n FROM v1_primary_n n WHERE n.user_id = u), 0),
         (SELECT COUNT(*) FROM v2_primary p WHERE p.user_id = u),
         CASE WHEN (SELECT COUNT(*) FROM v2_primary p WHERE p.user_id = u) > 1 THEN 'REAL_MISMATCH'
              WHEN COALESCE((SELECT p.id FROM v1_primary p WHERE p.user_id = u), '-')
                   = COALESCE((SELECT COALESCE(p.legacy_id, p.id) FROM v2_primary p WHERE p.user_id = u LIMIT 1), '-')
              THEN CASE WHEN COALESCE((SELECT n.n FROM v1_primary_n n WHERE n.user_id = u), 0) > 1 THEN 'EXPECTED_LEGACY' ELSE 'OK' END
              WHEN (SELECT p.id FROM v1_primary p WHERE p.user_id = u) IS NULL
                   AND (SELECT COUNT(*) FROM v2_primary p WHERE p.user_id = u) = 1 THEN 'EXPECTED_LEGACY'
              ELSE 'REAL_MISMATCH' END,
         'v1=nº principales activos V1, v2=nº principales V2'
    FROM users
$$;

-- Comprobación sombra durante el corte de lecturas: compara (en servidor, sin datos del cliente) V1 y V2
-- del usuario. Si aparece REAL_MISMATCH, registra el evento y apaga V2_READS globalmente (kill-switch).
CREATE OR REPLACE FUNCTION public.shadow_check(p_app_version text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := private.current_uid(); v_bad int; v_reads boolean; v_write boolean;
BEGIN
  SELECT enabled INTO v_reads FROM public.app_flags WHERE key = 'V2_READS';
  SELECT enabled INTO v_write FROM public.app_flags WHERE key = 'V2_WRITE_AUTHORITY';
  IF NOT COALESCE(v_reads, false) OR COALESCE(v_write, false) THEN
    RETURN jsonb_build_object('checked', false);     -- solo durante la ventana READ_CUTOVER → WRITE_CUTOVER
  END IF;
  SELECT COUNT(*) INTO v_bad FROM private.v1_v2_compare(v_uid) c WHERE c.classification = 'REAL_MISMATCH';
  INSERT INTO public.v2_client_events (user_id, kind, rpc_name, error_code, app_version)
  VALUES (v_uid, CASE WHEN v_bad = 0 THEN 'shadow_ok' ELSE 'shadow_mismatch' END, 'shadow_check',
          CASE WHEN v_bad = 0 THEN NULL ELSE 'real_mismatch' END,
          CASE WHEN p_app_version ~ '^[A-Za-z0-9_.-]{1,40}$' THEN p_app_version END);
  IF v_bad > 0 THEN
    UPDATE public.app_flags SET enabled = false, updated_reason = 'auto: shadow REAL_MISMATCH'
     WHERE key = 'V2_READS' AND enabled;
  END IF;
  RETURN jsonb_build_object('checked', true, 'real_mismatch', v_bad);
END $$;

-- ─── 9. Propietario y permisos de todo lo nuevo / recreado ───────────────────
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'private' LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO app_rpc_owner', f.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO app_rpc_owner', f.sig);
  END LOOP;
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname IN (
              'start_onboarding','complete_onboarding','record_prompt_impression','record_daily_decision',
              'record_extra_saving','amend_decision_amount','void_decision','use_grace_day',
              'transfer_between_buckets','create_goal','update_goal','set_primary_goal',
              'archive_goal','reactivate_goal','delete_goal',
              'declare_income','amend_extra_saving','void_extra_saving','reset_account_data',
              'import_legacy_local_state','get_dashboard_state','shadow_check') LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO app_rpc_owner', f.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
  END LOOP;
END $$;

-- get_dashboard_state es SECURITY INVOKER: el lector (authenticated) necesita SELECT con RLS propia,
-- ya concedido en 011 para las tablas V2. app_rpc_owner necesita leer V1 para la comparación.
GRANT SELECT ON public.decisions, public.hucha TO app_rpc_owner;
GRANT SELECT, INSERT ON public.v2_client_events TO app_rpc_owner;

REVOKE CREATE ON SCHEMA public FROM app_rpc_owner;
