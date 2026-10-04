-- ============================================================
-- Ahorro Invisible — Data Model V2 — 5B.2 — 013 Helpers de negocio, RPC de objetivos, vistas
-- Spec §6.5–§6.7, §7.3. Todas las funciones: SECURITY DEFINER, search_path='' (R8).
-- Los permisos (propietario / EXECUTE) se fijan en 016.
-- Errores estables: RAISE EXCEPTION '<codigo>' USING ERRCODE='P0001'.
-- ============================================================

-- ─── Helpers privados ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.validate_surface(p_surface text)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
BEGIN
  IF p_surface IS NOT NULL AND p_surface NOT IN
     ('onboarding','dashboard_widget','daily_page','goals_page','goal_detail',
      'extra_saving_page','extra_saving_modal','history','profile','settings') THEN
    RAISE EXCEPTION 'invalid_argument: surface' USING ERRCODE = 'P0001';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.ledger_balance(p_user uuid, p_bucket text, p_goal text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE(SUM(amount), 0) FROM public.savings_transactions
   WHERE user_id = p_user AND bucket_type = p_bucket AND goal_id IS NOT DISTINCT FROM p_goal
$$;

-- Comprobación en la RPC con el lock tomado (§6.6 punto 3)
CREATE OR REPLACE FUNCTION private.assert_balance(p_user uuid, p_bucket text, p_goal text, p_delta numeric)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_delta < 0 AND private.ledger_balance(p_user, p_bucket, p_goal) + p_delta < 0 THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001';
  END IF;
END $$;

-- R2: carga un objetivo del usuario gestionado por el ledger; si no existe → not_found.
CREATE OR REPLACE FUNCTION private.load_goal(p_user uuid, p_goal_id text, p_lock boolean DEFAULT true)
RETURNS public.goals LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE g public.goals%ROWTYPE;
BEGIN
  IF p_goal_id IS NULL THEN
    RAISE EXCEPTION 'invalid_argument: goal_id' USING ERRCODE = 'P0001';
  END IF;
  IF p_lock THEN
    SELECT * INTO g FROM public.goals WHERE id = p_goal_id AND user_id = p_user AND ledger_managed FOR UPDATE;
  ELSE
    SELECT * INTO g FROM public.goals WHERE id = p_goal_id AND user_id = p_user AND ledger_managed;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;
  RETURN g;
END $$;

CREATE OR REPLACE FUNCTION private.require_active(g public.goals)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
BEGIN
  IF g.status <> 'active' THEN
    RAISE EXCEPTION 'goal_not_active' USING ERRCODE = 'P0001';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.ledger_insert(
  p_user uuid, p_type text, p_bucket text, p_goal text, p_amount numeric,
  p_decision uuid, p_group uuid, p_reverses uuid, p_reason text,
  p_occurred timestamptz, p_tz text, p_local date, p_surface text, p_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id uuid := COALESCE(p_id, gen_random_uuid());
BEGIN
  INSERT INTO public.savings_transactions
    (transaction_id, user_id, transaction_type, bucket_type, goal_id, amount, decision_id,
     transfer_group_id, reverses_transaction_id, reason, occurred_at, timezone, local_date, surface, actor, data_origin)
  VALUES (v_id, p_user, p_type, p_bucket, p_goal, p_amount, p_decision,
          p_group, p_reverses, p_reason, p_occurred, p_tz, p_local, p_surface, 'user', 'v2_live');
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION private.add_goal_event(
  p_user uuid, p_goal text, p_type text, p_cause text,
  p_occurred timestamptz, p_tz text, p_local date, p_surface text, p_x jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.goal_events
    (goal_event_id, user_id, goal_id, event_type, cause, completion_sequence,
     target_amount_before, target_amount_after, horizon_months_before, horizon_months_after,
     title_changed, balance_destination_type, destination_goal_id, balance_moved_amount,
     realism_is_unrealistic, realism_suggested_target, realism_suggested_horizon, accepted_step,
     related_transaction_id, balance_at_event, private_changes,
     occurred_at, timezone, local_date, surface, data_origin)
  VALUES
    (v_id, p_user, p_goal, p_type, p_cause, (p_x->>'completion_sequence')::int,
     (p_x->>'target_amount_before')::numeric, (p_x->>'target_amount_after')::numeric,
     (p_x->>'horizon_months_before')::int, (p_x->>'horizon_months_after')::int,
     COALESCE((p_x->>'title_changed')::boolean, false), p_x->>'balance_destination_type',
     p_x->>'destination_goal_id', (p_x->>'balance_moved_amount')::numeric,
     (p_x->>'realism_is_unrealistic')::boolean, (p_x->>'realism_suggested_target')::numeric,
     (p_x->>'realism_suggested_horizon')::int, (p_x->>'accepted_step')::boolean,
     (p_x->>'related_transaction_id')::uuid, (p_x->>'balance_at_event')::numeric, p_x->'private_changes',
     p_occurred, p_tz, p_local, p_surface, 'v2_live');
  RETURN v_id;
END $$;

-- Máquina de estados de completado (§7.3). Solo con el objetivo activo.
CREATE OR REPLACE FUNCTION private.eval_completion(
  p_user uuid, p_goal text, p_cause text,
  p_occurred timestamptz, p_tz text, p_local date, p_surface text, p_txn uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  g public.goals%ROWTYPE; v_bal numeric; v_n int; v_completed boolean;
BEGIN
  SELECT * INTO g FROM public.goals WHERE id = p_goal AND user_id = p_user AND ledger_managed;
  IF NOT FOUND OR g.status <> 'active' THEN RETURN NULL; END IF;
  v_bal := private.ledger_balance(p_user, 'goal', p_goal);
  SELECT MAX(completion_sequence) INTO v_n FROM public.goal_events
   WHERE goal_id = p_goal AND user_id = p_user AND event_type = 'completed';
  v_completed := v_n IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.goal_events WHERE goal_id = p_goal AND user_id = p_user
       AND event_type = 'completion_reverted' AND completion_sequence = v_n);

  IF v_bal >= g.target_amount AND NOT v_completed THEN
    PERFORM private.add_goal_event(p_user, p_goal, 'completed', p_cause, p_occurred, p_tz, p_local, p_surface,
      jsonb_build_object('completion_sequence', COALESCE(v_n, 0) + 1, 'balance_at_event', v_bal,
                         'related_transaction_id', p_txn, 'target_amount_after', g.target_amount));
    IF g.first_completed_at IS NULL THEN
      UPDATE public.goals SET first_completed_at = p_occurred WHERE id = p_goal AND user_id = p_user;
    END IF;
    RETURN 'completed';
  ELSIF v_bal < g.target_amount AND v_completed THEN
    PERFORM private.add_goal_event(p_user, p_goal, 'completion_reverted', p_cause, p_occurred, p_tz, p_local, p_surface,
      jsonb_build_object('completion_sequence', v_n, 'balance_at_event', v_bal,
                         'related_transaction_id', p_txn, 'target_amount_after', g.target_amount));
    RETURN 'completion_reverted';
  END IF;
  RETURN NULL;
END $$;

-- Transferencia de dos asientos (out + in) con el mismo transfer_group_id.
CREATE OR REPLACE FUNCTION private.do_transfer(
  p_user uuid, p_group uuid, p_from_bucket text, p_from_goal text, p_to_bucket text, p_to_goal text,
  p_amount numeric, p_reason text, p_occurred timestamptz, p_tz text, p_local date, p_surface text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_out uuid; v_in uuid;
BEGIN
  PERFORM private.assert_balance(p_user, p_from_bucket, p_from_goal, -p_amount);
  v_out := private.ledger_insert(p_user, 'transfer_out', p_from_bucket, p_from_goal, -p_amount, NULL, p_group, NULL,
                                 p_reason, p_occurred, p_tz, p_local, p_surface);
  v_in  := private.ledger_insert(p_user, 'transfer_in',  p_to_bucket,   p_to_goal,    p_amount, NULL, p_group, NULL,
                                 p_reason, p_occurred, p_tz, p_local, p_surface);
  RETURN jsonb_build_object('transfer_group_id', p_group, 'transfer_out_id', v_out, 'transfer_in_id', v_in);
END $$;

-- Reasignación de principal tras archivar/borrar el principal (el más antiguo activo).
CREATE OR REPLACE FUNCTION private.reassign_primary(
  p_user uuid, p_occurred timestamptz, p_tz text, p_local date, p_surface text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_next text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.goals WHERE user_id = p_user AND ledger_managed AND is_primary AND status = 'active') THEN
    RETURN NULL;
  END IF;
  SELECT id INTO v_next FROM public.goals
   WHERE user_id = p_user AND ledger_managed AND status = 'active'
   ORDER BY created_at, id LIMIT 1 FOR UPDATE;
  IF v_next IS NULL THEN RETURN NULL; END IF;
  UPDATE public.goals SET is_primary = true WHERE id = v_next AND user_id = p_user;
  PERFORM private.add_goal_event(p_user, v_next, 'primary_set', 'auto_primary_reassignment', p_occurred, p_tz, p_local, p_surface);
  RETURN v_next;
END $$;

-- Creación de objetivo (compartida por create_goal y complete_onboarding).
CREATE OR REPLACE FUNCTION private.do_create_goal(
  p_user uuid, p_goal_id uuid, p_title text, p_target numeric, p_horizon int, p_source text,
  p_set_primary boolean, p_occurred timestamptz, p_tz text, p_local date,
  p_final numeric, p_step int, p_r_unreal boolean, p_r_target numeric, p_r_horizon int, p_accepted_step boolean,
  p_surface text, p_onboarding_session uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_title text := pg_catalog.btrim(p_title); v_old text; v_primary boolean;
BEGIN
  IF v_title IS NULL OR pg_catalog.char_length(v_title) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'invalid_argument: title' USING ERRCODE = 'P0001';
  END IF;
  PERFORM private.validate_amount(p_target);
  IF p_horizon IS NULL OR p_horizon NOT IN (1,2,3,6,12) THEN
    RAISE EXCEPTION 'invalid_argument: horizon_months' USING ERRCODE = 'P0001';
  END IF;
  IF p_source NOT IN ('onboarding','dashboard','goals_page') THEN
    RAISE EXCEPTION 'invalid_argument: source' USING ERRCODE = 'P0001';
  END IF;
  IF p_final IS NOT NULL THEN
    PERFORM private.validate_amount(p_final);
    IF p_final < p_target THEN RAISE EXCEPTION 'invalid_amount' USING ERRCODE = 'P0001'; END IF;
  END IF;
  IF p_step IS NOT NULL AND p_step < 0 THEN
    RAISE EXCEPTION 'invalid_argument: step_index' USING ERRCODE = 'P0001';
  END IF;
  IF p_r_target IS NOT NULL THEN PERFORM private.validate_amount(p_r_target); END IF;
  IF p_r_horizon IS NOT NULL AND p_r_horizon NOT IN (1,2,3,6,12) THEN
    RAISE EXCEPTION 'invalid_argument: realism_suggested_horizon' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_old FROM public.goals
   WHERE user_id = p_user AND ledger_managed AND is_primary AND status = 'active' FOR UPDATE;
  v_primary := p_set_primary OR v_old IS NULL;

  IF v_old IS NOT NULL AND p_set_primary THEN
    UPDATE public.goals SET is_primary = false WHERE id = v_old AND user_id = p_user;
    PERFORM private.add_goal_event(p_user, v_old, 'primary_unset', 'auto_primary_reassignment',
                                   p_occurred, p_tz, p_local, p_surface);
  END IF;

  INSERT INTO public.goals
    (id, user_id, title, target_amount, current_amount, horizon_months, is_primary, archived,
     created_at, updated_at, source, status, final_target_amount, step_index, start_date,
     onboarding_session_id, data_origin, ledger_managed)
  VALUES
    (p_goal_id::text, p_user, v_title, p_target, 0, p_horizon, v_primary, false,
     pg_catalog.now(), pg_catalog.now(), p_source, 'active', p_final, p_step, p_local,
     p_onboarding_session, 'v2_live', true);

  PERFORM private.add_goal_event(p_user, p_goal_id::text, 'created', 'user_action', p_occurred, p_tz, p_local, p_surface,
    jsonb_build_object('target_amount_after', p_target, 'horizon_months_after', p_horizon,
                       'realism_is_unrealistic', p_r_unreal, 'realism_suggested_target', p_r_target,
                       'realism_suggested_horizon', p_r_horizon, 'accepted_step', p_accepted_step));
  IF v_primary THEN
    PERFORM private.add_goal_event(p_user, p_goal_id::text, 'primary_set', 'user_action', p_occurred, p_tz, p_local, p_surface);
  END IF;
  RETURN jsonb_build_object('goal_id', p_goal_id, 'is_primary', v_primary, 'status', 'active');
END $$;

-- Retirada de objetivo (archivar / borrar) con traspaso del saldo (§7.3).
CREATE OR REPLACE FUNCTION private.do_retire_goal(
  p_user uuid, p_goal_id text, p_new_status text, p_dest_type text, p_dest_goal text,
  p_occurred timestamptz, p_tz text, p_local date, p_surface text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  g public.goals%ROWTYPE; d public.goals%ROWTYPE; v_bal numeric; v_tr jsonb; v_group uuid;
  v_reason text := CASE WHEN p_new_status = 'archived' THEN 'goal_archived' ELSE 'goal_deleted' END;
  v_ev text := CASE WHEN p_new_status = 'archived' THEN 'archived' ELSE 'deleted' END;
  v_was_primary boolean; v_next text; v_dest_ev_type text;
BEGIN
  IF p_dest_type IS NULL OR p_dest_type NOT IN ('hucha','goal') THEN
    RAISE EXCEPTION 'invalid_argument: destination_type' USING ERRCODE = 'P0001';
  END IF;
  IF (p_dest_type = 'goal') <> (p_dest_goal IS NOT NULL) THEN
    RAISE EXCEPTION 'invalid_argument: destination_goal_id' USING ERRCODE = 'P0001';
  END IF;
  IF p_dest_goal = p_goal_id THEN
    RAISE EXCEPTION 'invalid_argument: destination_goal_id' USING ERRCODE = 'P0001';
  END IF;

  -- Bloqueo ordenado de filas de objetivos (origen y destino) para evitar deadlocks.
  IF p_dest_goal IS NOT NULL THEN
    PERFORM 1 FROM public.goals WHERE user_id = p_user AND id IN (p_goal_id, p_dest_goal) ORDER BY id FOR UPDATE;
    d := private.load_goal(p_user, p_dest_goal, false);
    PERFORM private.require_active(d);
  END IF;
  g := private.load_goal(p_user, p_goal_id, true);
  IF g.status = 'deleted' OR (p_new_status = 'archived' AND g.status <> 'active') THEN
    RAISE EXCEPTION 'goal_not_active' USING ERRCODE = 'P0001';
  END IF;

  v_bal := private.ledger_balance(p_user, 'goal', p_goal_id);
  v_was_primary := g.is_primary;

  IF v_bal > 0 THEN
    v_group := gen_random_uuid();
    v_tr := private.do_transfer(p_user, v_group, 'goal', p_goal_id,
                                CASE WHEN p_dest_type = 'goal' THEN 'goal' ELSE 'hucha' END, p_dest_goal,
                                v_bal, v_reason, p_occurred, p_tz, p_local, p_surface);
  END IF;

  UPDATE public.goals SET
    status = p_new_status, is_primary = false,
    archived_at = CASE WHEN p_new_status = 'archived' THEN p_occurred ELSE archived_at END,
    deleted_at  = CASE WHEN p_new_status = 'deleted'  THEN p_occurred ELSE deleted_at END
   WHERE id = p_goal_id AND user_id = p_user;

  PERFORM private.add_goal_event(p_user, p_goal_id, v_ev, 'user_action', p_occurred, p_tz, p_local, p_surface,
    jsonb_build_object('balance_destination_type', CASE WHEN v_bal > 0 THEN p_dest_type ELSE 'none' END,
                       'destination_goal_id', CASE WHEN v_bal > 0 THEN p_dest_goal END,
                       'balance_moved_amount', v_bal,
                       'related_transaction_id', v_tr->>'transfer_out_id'));

  IF v_was_primary THEN
    PERFORM private.add_goal_event(p_user, p_goal_id, 'primary_unset', 'auto_primary_reassignment', p_occurred, p_tz, p_local, p_surface);
    v_next := private.reassign_primary(p_user, p_occurred, p_tz, p_local, p_surface);
  END IF;
  IF p_dest_goal IS NOT NULL AND v_bal > 0 THEN
    PERFORM private.eval_completion(p_user, p_dest_goal, 'ledger_threshold', p_occurred, p_tz, p_local, p_surface,
                                    (v_tr->>'transfer_in_id')::uuid);
  END IF;
  RETURN jsonb_build_object('goal_id', p_goal_id, 'status', p_new_status, 'balance_moved_amount', v_bal,
                            'destination_type', CASE WHEN v_bal > 0 THEN p_dest_type ELSE 'none' END,
                            'destination_goal_id', CASE WHEN v_bal > 0 THEN p_dest_goal END,
                            'new_primary_goal_id', v_next);
END $$;

-- ─── RPC públicas de objetivos ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_goal(
  p_goal_id uuid, p_title text, p_target_amount numeric, p_horizon_months int, p_source text,
  p_set_primary boolean, p_occurred_at timestamptz, p_timezone text,
  p_final_target_amount numeric DEFAULT NULL, p_step_index int DEFAULT NULL,
  p_realism_is_unrealistic boolean DEFAULT NULL, p_realism_suggested_target numeric DEFAULT NULL,
  p_realism_suggested_horizon int DEFAULT NULL, p_accepted_step boolean DEFAULT NULL,
  p_surface text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('title', p_title, 'target', p_target_amount, 'horizon', p_horizon_months,
    'source', p_source, 'primary', p_set_primary, 'occurred_at', p_occurred_at, 'tz', p_timezone,
    'final', p_final_target_amount, 'step', p_step_index, 'r1', p_realism_is_unrealistic,
    'r2', p_realism_suggested_target, 'r3', p_realism_suggested_horizon, 'r4', p_accepted_step, 'surface', p_surface);
  v_res := private.idem_check(v_uid, p_goal_id, 'create_goal', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;
  IF p_source = 'onboarding' THEN
    RAISE EXCEPTION 'invalid_argument: source' USING ERRCODE = 'P0001';
  END IF;
  PERFORM private.validate_surface(p_surface);
  v_local := private.resolve_local_date(p_occurred_at, p_timezone);
  v_res := private.do_create_goal(v_uid, p_goal_id, p_title, p_target_amount, p_horizon_months, p_source,
    COALESCE(p_set_primary, false), p_occurred_at, p_timezone, v_local, p_final_target_amount, p_step_index,
    p_realism_is_unrealistic, p_realism_suggested_target, p_realism_suggested_horizon, p_accepted_step,
    p_surface, NULL);
  RETURN private.idem_store(v_uid, p_goal_id, 'create_goal', v_payload, v_res);
END $$;

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
  IF v_new_horizon NOT IN (1,2,3,6,12) THEN
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
         final_target_amount = v_final
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

CREATE OR REPLACE FUNCTION public.set_primary_goal(
  p_mutation_id uuid, p_goal_id text, p_occurred_at timestamptz, p_timezone text, p_surface text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date;
  g public.goals%ROWTYPE; v_old text;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('goal', p_goal_id, 'occurred_at', p_occurred_at, 'tz', p_timezone, 'surface', p_surface);
  v_res := private.idem_check(v_uid, p_mutation_id, 'set_primary_goal', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;
  PERFORM private.validate_surface(p_surface);
  v_local := private.resolve_local_date(p_occurred_at, p_timezone);
  g := private.load_goal(v_uid, p_goal_id, true);
  PERFORM private.require_active(g);
  IF g.is_primary THEN
    RETURN private.idem_store(v_uid, p_mutation_id, 'set_primary_goal', v_payload,
      jsonb_build_object('goal_id', p_goal_id, 'changed', false));
  END IF;
  SELECT id INTO v_old FROM public.goals
   WHERE user_id = v_uid AND ledger_managed AND is_primary AND status = 'active' FOR UPDATE;
  IF v_old IS NOT NULL THEN
    UPDATE public.goals SET is_primary = false WHERE id = v_old AND user_id = v_uid;
    PERFORM private.add_goal_event(v_uid, v_old, 'primary_unset', 'auto_primary_reassignment', p_occurred_at, p_timezone, v_local, p_surface);
  END IF;
  UPDATE public.goals SET is_primary = true WHERE id = p_goal_id AND user_id = v_uid;
  PERFORM private.add_goal_event(v_uid, p_goal_id, 'primary_set', 'user_action', p_occurred_at, p_timezone, v_local, p_surface);
  RETURN private.idem_store(v_uid, p_mutation_id, 'set_primary_goal', v_payload,
    jsonb_build_object('goal_id', p_goal_id, 'changed', true));
END $$;

CREATE OR REPLACE FUNCTION public.archive_goal(
  p_mutation_id uuid, p_goal_id text, p_occurred_at timestamptz, p_timezone text,
  p_destination_type text DEFAULT 'hucha', p_destination_goal_id text DEFAULT NULL, p_surface text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('goal', p_goal_id, 'occurred_at', p_occurred_at, 'tz', p_timezone,
    'dest_type', p_destination_type, 'dest_goal', p_destination_goal_id, 'surface', p_surface);
  v_res := private.idem_check(v_uid, p_mutation_id, 'archive_goal', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;
  PERFORM private.validate_surface(p_surface);
  v_local := private.resolve_local_date(p_occurred_at, p_timezone);
  v_res := private.do_retire_goal(v_uid, p_goal_id, 'archived', p_destination_type, p_destination_goal_id,
                                  p_occurred_at, p_timezone, v_local, p_surface);
  RETURN private.idem_store(v_uid, p_mutation_id, 'archive_goal', v_payload, v_res);
END $$;

CREATE OR REPLACE FUNCTION public.delete_goal(
  p_mutation_id uuid, p_goal_id text, p_occurred_at timestamptz, p_timezone text,
  p_destination_type text DEFAULT 'hucha', p_destination_goal_id text DEFAULT NULL, p_surface text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('goal', p_goal_id, 'occurred_at', p_occurred_at, 'tz', p_timezone,
    'dest_type', p_destination_type, 'dest_goal', p_destination_goal_id, 'surface', p_surface);
  v_res := private.idem_check(v_uid, p_mutation_id, 'delete_goal', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;
  PERFORM private.validate_surface(p_surface);
  v_local := private.resolve_local_date(p_occurred_at, p_timezone);
  v_res := private.do_retire_goal(v_uid, p_goal_id, 'deleted', p_destination_type, p_destination_goal_id,
                                  p_occurred_at, p_timezone, v_local, p_surface);
  RETURN private.idem_store(v_uid, p_mutation_id, 'delete_goal', v_payload, v_res);
END $$;

CREATE OR REPLACE FUNCTION public.reactivate_goal(
  p_mutation_id uuid, p_goal_id text, p_occurred_at timestamptz, p_timezone text, p_surface text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date;
  g public.goals%ROWTYPE; v_has_primary boolean;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('goal', p_goal_id, 'occurred_at', p_occurred_at, 'tz', p_timezone, 'surface', p_surface);
  v_res := private.idem_check(v_uid, p_mutation_id, 'reactivate_goal', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;
  PERFORM private.validate_surface(p_surface);
  v_local := private.resolve_local_date(p_occurred_at, p_timezone);
  g := private.load_goal(v_uid, p_goal_id, true);
  IF g.status <> 'archived' THEN
    RAISE EXCEPTION 'goal_not_active' USING ERRCODE = 'P0001';   -- activo o borrado: no reactivable
  END IF;
  v_has_primary := EXISTS (SELECT 1 FROM public.goals
                            WHERE user_id = v_uid AND ledger_managed AND is_primary AND status = 'active');
  UPDATE public.goals SET status = 'active', is_primary = NOT v_has_primary
   WHERE id = p_goal_id AND user_id = v_uid;
  PERFORM private.add_goal_event(v_uid, p_goal_id, 'reactivated', 'user_action', p_occurred_at, p_timezone, v_local, p_surface);
  IF NOT v_has_primary THEN
    PERFORM private.add_goal_event(v_uid, p_goal_id, 'primary_set', 'auto_primary_reassignment', p_occurred_at, p_timezone, v_local, p_surface);
  END IF;
  PERFORM private.eval_completion(v_uid, p_goal_id, 'reactivated_state', p_occurred_at, p_timezone, v_local, p_surface);
  RETURN private.idem_store(v_uid, p_mutation_id, 'reactivate_goal', v_payload,
    jsonb_build_object('goal_id', p_goal_id, 'status', 'active', 'is_primary', NOT v_has_primary));
END $$;

-- ─── Vistas de lectura (SECURITY INVOKER: respetan RLS del usuario) ──────────

CREATE OR REPLACE VIEW public.v_goal_state WITH (security_invoker = true) AS
SELECT g.id AS goal_id, g.user_id, g.title, g.target_amount, g.horizon_months, g.status, g.is_primary,
       g.first_completed_at, g.start_date,
       COALESCE(b.balance, 0) AS current_balance,
       CASE WHEN g.target_amount > 0 THEN LEAST(100, ROUND(COALESCE(b.balance, 0) / g.target_amount * 100, 2)) END AS progress_pct,
       (g.status = 'active' AND COALESCE(b.balance, 0) >= g.target_amount) AS is_currently_completed
  FROM public.goals g
  LEFT JOIN (SELECT user_id, goal_id, SUM(amount) AS balance
               FROM public.savings_transactions WHERE bucket_type = 'goal' GROUP BY user_id, goal_id) b
    ON b.user_id = g.user_id AND b.goal_id = g.id
 WHERE g.ledger_managed;

CREATE OR REPLACE VIEW public.v_hucha_balance WITH (security_invoker = true) AS
SELECT user_id, COALESCE(SUM(amount), 0) AS balance
  FROM public.savings_transactions WHERE bucket_type = 'hucha' GROUP BY user_id;
