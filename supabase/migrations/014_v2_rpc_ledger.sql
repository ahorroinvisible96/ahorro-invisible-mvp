-- ============================================================
-- Ahorro Invisible — Data Model V2 — 5B.2 — 014 RPC de ahorro (ledger)
-- Spec §6.5–§6.7, §8, §9. SECURITY DEFINER, search_path=''. Permisos en 016.
-- Orden en cada RPC: auth → lock de usuario → idempotencia → validación → efectos.
-- ============================================================

-- record_prompt_impression ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_prompt_impression(
  p_impression_id uuid, p_shown_at timestamptz, p_timezone text,
  p_question_bank_version text, p_question_id text, p_avatar_used text, p_time_slot text,
  p_selection_reason text, p_first_surface text, p_replaces_impression_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date; v_existing uuid;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('shown_at', p_shown_at, 'tz', p_timezone, 'qbv', p_question_bank_version,
    'qid', p_question_id, 'avatar', p_avatar_used, 'slot', p_time_slot, 'reason', p_selection_reason,
    'surface', p_first_surface, 'replaces', p_replaces_impression_id);
  v_res := private.idem_check(v_uid, p_impression_id, 'record_prompt_impression', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;

  IF p_avatar_used IS NULL OR p_avatar_used NOT IN ('comodo','social','impulsivo')
     OR p_time_slot IS NULL OR p_time_slot NOT IN ('manana','tarde','noche')
     OR p_selection_reason IS NULL OR p_selection_reason NOT IN ('initial','slot_change','shuffle','answered_fallback')
     OR p_first_surface IS NULL OR p_first_surface NOT IN ('dashboard_widget','daily_page') THEN
    RAISE EXCEPTION 'invalid_argument: enum' USING ERRCODE = 'P0001';
  END IF;
  v_local := private.resolve_local_date(p_shown_at, p_timezone);
  IF NOT EXISTS (SELECT 1 FROM public.cat_daily_questions
                  WHERE question_bank_version = p_question_bank_version AND question_id = p_question_id) THEN
    RAISE EXCEPTION 'invalid_question' USING ERRCODE = 'P0001';
  END IF;
  IF p_replaces_impression_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.daily_prompt_impressions
        WHERE impression_id = p_replaces_impression_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;

  -- Misma (usuario, día, pregunta) con otra clave: la exposición ya está registrada.
  SELECT impression_id INTO v_existing FROM public.daily_prompt_impressions
   WHERE user_id = v_uid AND local_date = v_local
     AND question_bank_version = p_question_bank_version AND question_id = p_question_id;
  IF v_existing IS NOT NULL THEN
    RETURN private.idem_store(v_uid, p_impression_id, 'record_prompt_impression', v_payload,
      jsonb_build_object('impression_id', v_existing, 'local_date', v_local, 'deduplicated', true));
  END IF;

  INSERT INTO public.daily_prompt_impressions
    (impression_id, user_id, local_date, shown_at, timezone, question_bank_version, question_id,
     avatar_used, time_slot, selection_reason, replaces_impression_id, first_surface, data_origin)
  VALUES (p_impression_id, v_uid, v_local, p_shown_at, p_timezone, p_question_bank_version, p_question_id,
          p_avatar_used, p_time_slot, p_selection_reason, p_replaces_impression_id, p_first_surface, 'v2_live');
  RETURN private.idem_store(v_uid, p_impression_id, 'record_prompt_impression', v_payload,
    jsonb_build_object('impression_id', p_impression_id, 'local_date', v_local, 'deduplicated', false));
END $$;

-- record_daily_decision ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_daily_decision(
  p_decision_id uuid, p_occurred_at timestamptz, p_timezone text, p_outcome text,
  p_question_bank_version text, p_question_id text, p_selected_option_key text,
  p_declared_amount numeric, p_custom_text text DEFAULT NULL, p_goal_id text DEFAULT NULL,
  p_impression_id uuid DEFAULT NULL, p_surface text DEFAULT 'daily_page')
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
    'surface', p_surface);
  v_res := private.idem_check(v_uid, p_decision_id, 'record_daily_decision', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;

  PERFORM private.validate_surface(p_surface);
  IF p_surface IS NULL THEN RAISE EXCEPTION 'invalid_argument: surface' USING ERRCODE = 'P0001'; END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('saved','zero') THEN
    RAISE EXCEPTION 'invalid_argument: outcome' USING ERRCODE = 'P0001';
  END IF;
  v_local := private.resolve_local_date(p_occurred_at, p_timezone);

  -- Importe: D1 → lo declarado es lo registrado (sin multiplicador).
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
    (decision_id, user_id, local_date, occurred_at, timezone, outcome, question_bank_version, question_id,
     selected_option_key, has_custom_text, declared_amount, credit_rule_version, goal_id, impression_id,
     surface, status, data_origin)
  VALUES (p_decision_id, v_uid, v_local, p_occurred_at, p_timezone, p_outcome, p_question_bank_version,
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

-- record_extra_saving -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_extra_saving(
  p_transaction_id uuid, p_occurred_at timestamptz, p_timezone text, p_amount numeric,
  p_goal_id text DEFAULT NULL, p_note text DEFAULT NULL, p_surface text DEFAULT 'extra_saving_page')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date;
  v_note text; g public.goals%ROWTYPE; v_bucket text; v_completion text;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('occurred_at', p_occurred_at, 'tz', p_timezone, 'amount', p_amount,
    'goal', p_goal_id, 'note', p_note, 'surface', p_surface);
  v_res := private.idem_check(v_uid, p_transaction_id, 'record_extra_saving', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;

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
  PERFORM private.ledger_insert(v_uid, 'extra_saving', v_bucket, p_goal_id, p_amount, NULL, NULL, NULL,
                                'user_saving', p_occurred_at, p_timezone, v_local, p_surface, p_transaction_id);
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

-- amend_decision_amount -----------------------------------------------------------
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
  PERFORM private.validate_amount(p_new_amount);        -- 0 se rechaza: para anular usar void_decision
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

-- void_decision ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_decision(
  p_mutation_id uuid, p_decision_id uuid, p_reason text,
  p_occurred_at timestamptz, p_timezone text, p_surface text DEFAULT 'history')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date;
  d public.daily_decisions%ROWTYPE; t record; g public.goals%ROWTYPE; v_n int := 0; v_goal text;
  v_completion text; v_txn uuid;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('decision', p_decision_id, 'reason', p_reason,
    'occurred_at', p_occurred_at, 'tz', p_timezone, 'surface', p_surface);
  v_res := private.idem_check(v_uid, p_mutation_id, 'void_decision', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;

  PERFORM private.validate_surface(p_surface);
  IF p_reason IS NULL OR p_reason NOT IN ('user_reset_today','user_deleted_in_history') THEN
    RAISE EXCEPTION 'invalid_argument: reason' USING ERRCODE = 'P0001';
  END IF;
  v_local := private.resolve_local_date(p_occurred_at, p_timezone);

  SELECT * INTO d FROM public.daily_decisions WHERE decision_id = p_decision_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001'; END IF;
  IF d.status <> 'active' THEN RAISE EXCEPTION 'decision_not_active' USING ERRCODE = 'P0001'; END IF;

  -- Un reversal por cada asiento vivo (no revertido) de la decisión.
  FOR t IN
    SELECT s.* FROM public.savings_transactions s
     WHERE s.user_id = v_uid AND s.decision_id = p_decision_id
       AND s.transaction_type IN ('daily_saving','amendment')
       AND NOT EXISTS (SELECT 1 FROM public.savings_transactions r
                        WHERE r.reverses_transaction_id = s.transaction_id)
     ORDER BY s.amount, s.recorded_at, s.transaction_id   -- asientos negativos primero => sus reversals (+) se aplican antes
  LOOP
    IF t.goal_id IS NOT NULL THEN
      g := private.load_goal(v_uid, t.goal_id, true);
      PERFORM private.require_active(g);
      v_goal := t.goal_id;
    END IF;
    PERFORM private.assert_balance(v_uid, t.bucket_type, t.goal_id, -t.amount);
    v_txn := private.ledger_insert(v_uid, 'reversal', t.bucket_type, t.goal_id, -t.amount, p_decision_id, NULL,
                                   t.transaction_id, 'user_void', p_occurred_at, p_timezone, v_local, p_surface);
    v_n := v_n + 1;
  END LOOP;

  UPDATE public.daily_decisions SET status = 'voided', voided_at = p_occurred_at, void_reason = p_reason
   WHERE decision_id = p_decision_id AND user_id = v_uid;

  IF v_goal IS NOT NULL THEN
    v_completion := private.eval_completion(v_uid, v_goal, 'ledger_threshold', p_occurred_at, p_timezone, v_local, p_surface, v_txn);
  END IF;
  RETURN private.idem_store(v_uid, p_mutation_id, 'void_decision', v_payload,
    jsonb_build_object('decision_id', p_decision_id, 'status', 'voided', 'reversals', v_n, 'goal_completion', v_completion));
END $$;

-- use_grace_day -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.use_grace_day(
  p_decision_id uuid, p_occurred_at timestamptz, p_timezone text, p_surface text DEFAULT 'dashboard_widget')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_today date; v_target date;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('occurred_at', p_occurred_at, 'tz', p_timezone, 'surface', p_surface);
  v_res := private.idem_check(v_uid, p_decision_id, 'use_grace_day', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;

  PERFORM private.validate_surface(p_surface);
  IF p_surface IS NULL THEN RAISE EXCEPTION 'invalid_argument: surface' USING ERRCODE = 'P0001'; END IF;
  v_today := private.resolve_local_date(p_occurred_at, p_timezone);
  v_target := v_today - 1;                                -- la gracia imputa AYER (§9)
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
    (decision_id, user_id, local_date, occurred_at, timezone, outcome, has_custom_text, declared_amount,
     credit_rule_version, surface, status, data_origin)
  VALUES (p_decision_id, v_uid, v_target, p_occurred_at, p_timezone, 'grace', false, NULL,
          'identity_v1', p_surface, 'active', 'v2_live');
  RETURN private.idem_store(v_uid, p_decision_id, 'use_grace_day', v_payload,
    jsonb_build_object('decision_id', p_decision_id, 'local_date', v_target, 'outcome', 'grace'));
END $$;

-- transfer_between_buckets ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_between_buckets(
  p_transfer_group_id uuid, p_from_bucket text, p_from_goal_id text, p_to_bucket text, p_to_goal_id text,
  p_amount numeric, p_occurred_at timestamptz, p_timezone text, p_surface text DEFAULT 'goal_detail')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date;
  v_from public.goals%ROWTYPE; v_to public.goals%ROWTYPE; v_c1 text; v_c2 text;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('from_bucket', p_from_bucket, 'from_goal', p_from_goal_id,
    'to_bucket', p_to_bucket, 'to_goal', p_to_goal_id, 'amount', p_amount,
    'occurred_at', p_occurred_at, 'tz', p_timezone, 'surface', p_surface);
  v_res := private.idem_check(v_uid, p_transfer_group_id, 'transfer_between_buckets', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;

  PERFORM private.validate_surface(p_surface);
  PERFORM private.validate_amount(p_amount);
  IF p_from_bucket IS NULL OR p_from_bucket NOT IN ('goal','hucha')
     OR p_to_bucket IS NULL OR p_to_bucket NOT IN ('goal','hucha')
     OR (p_from_bucket = 'goal') <> (p_from_goal_id IS NOT NULL)
     OR (p_to_bucket = 'goal') <> (p_to_goal_id IS NOT NULL)
     OR (p_from_bucket = p_to_bucket AND p_from_goal_id IS NOT DISTINCT FROM p_to_goal_id) THEN
    RAISE EXCEPTION 'invalid_argument: buckets' USING ERRCODE = 'P0001';
  END IF;
  v_local := private.resolve_local_date(p_occurred_at, p_timezone);

  -- Bloqueo ordenado de las filas de objetivos implicadas
  PERFORM 1 FROM public.goals WHERE user_id = v_uid AND id IN (COALESCE(p_from_goal_id, ''), COALESCE(p_to_goal_id, ''))
   ORDER BY id FOR UPDATE;
  IF p_from_goal_id IS NOT NULL THEN
    v_from := private.load_goal(v_uid, p_from_goal_id, false);
    PERFORM private.require_active(v_from);
  END IF;
  IF p_to_goal_id IS NOT NULL THEN
    v_to := private.load_goal(v_uid, p_to_goal_id, false);
    PERFORM private.require_active(v_to);
  END IF;

  v_res := private.do_transfer(v_uid, p_transfer_group_id, p_from_bucket, p_from_goal_id, p_to_bucket, p_to_goal_id,
                               p_amount, 'manual_hucha_transfer', p_occurred_at, p_timezone, v_local, p_surface);
  IF p_to_goal_id IS NOT NULL THEN
    v_c1 := private.eval_completion(v_uid, p_to_goal_id, 'ledger_threshold', p_occurred_at, p_timezone, v_local,
                                    p_surface, (v_res->>'transfer_in_id')::uuid);
  END IF;
  IF p_from_goal_id IS NOT NULL THEN
    v_c2 := private.eval_completion(v_uid, p_from_goal_id, 'ledger_threshold', p_occurred_at, p_timezone, v_local,
                                    p_surface, (v_res->>'transfer_out_id')::uuid);
  END IF;
  RETURN private.idem_store(v_uid, p_transfer_group_id, 'transfer_between_buckets', v_payload,
    v_res || jsonb_build_object('amount', p_amount, 'local_date', v_local,
                                'to_goal_completion', v_c1, 'from_goal_completion', v_c2));
END $$;
