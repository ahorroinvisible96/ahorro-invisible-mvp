-- ============================================================
-- Ahorro Invisible — Data Model V2 — 5B.2 — 015 RPC de onboarding
-- Spec §5, §4.2–§4.4. SECURITY DEFINER, search_path=''. Permisos en 016.
-- complete_onboarding es UNA transacción: verifica en servidor la recomendación y el
-- avatar, inserta evaluación + respuestas + ingresos + objetivo + eventos y cierra la sesión.
-- ============================================================

CREATE OR REPLACE FUNCTION public.start_onboarding(
  p_session_id uuid, p_occurred_at timestamptz, p_timezone text,
  p_flow_version text DEFAULT 'onb_5steps_v1', p_client_app_version text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := private.current_uid(); v_payload jsonb; v_res jsonb; v_local date; v_attempt int;
BEGIN
  PERFORM private.lock_user_ledger(v_uid);
  v_payload := jsonb_build_object('occurred_at', p_occurred_at, 'tz', p_timezone, 'flow', p_flow_version,
                                  'app', p_client_app_version);
  v_res := private.idem_check(v_uid, p_session_id, 'start_onboarding', v_payload);
  IF v_res IS NOT NULL THEN RETURN v_res; END IF;
  IF p_flow_version IS DISTINCT FROM 'onb_5steps_v1' THEN
    RAISE EXCEPTION 'invalid_argument: flow_version' USING ERRCODE = 'P0001';
  END IF;
  v_local := private.resolve_local_date(p_occurred_at, p_timezone);
  SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO v_attempt FROM public.onboarding_sessions WHERE user_id = v_uid;
  INSERT INTO public.onboarding_sessions
    (onboarding_session_id, user_id, attempt_number, flow_version, started_at, started_timezone,
     started_local_date, client_app_version, data_origin)
  VALUES (p_session_id, v_uid, v_attempt, p_flow_version, p_occurred_at, p_timezone, v_local,
          p_client_app_version, 'v2_live');
  -- zona actual del dispositivo (solo si el perfil existe o se crea mínimo)
  INSERT INTO public.user_profiles (id, timezone) VALUES (v_uid, p_timezone)
  ON CONFLICT (id) DO UPDATE SET timezone = EXCLUDED.timezone;
  RETURN private.idem_store(v_uid, p_session_id, 'start_onboarding', v_payload,
    jsonb_build_object('onboarding_session_id', p_session_id, 'attempt_number', v_attempt, 'started_local_date', v_local));
END $$;

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
  p_goal_id uuid, p_goal_title text, p_client_app_version text DEFAULT NULL)
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
    'warning', p_warning_shown, 'goal', p_goal_id, 'title', p_goal_title, 'app', p_client_app_version);
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

  -- ── Avatar: recalculado en servidor (scoring score_v1: pesos 2/2/1; a=comodo, b=social, c=impulsivo;
  --    desempate impulsivo > social > comodo) ──
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
    v_w := CASE WHEN v_i = 3 THEN 1 ELSE 2 END;
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

  -- ── Recomendación: recalculada en servidor desde los catálogos versionados ──
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

  -- ── Escrituras (todo o nada) ──
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

  v_goal := private.do_create_goal(v_uid, p_goal_id, p_goal_title, p_chosen_target_amount, p_chosen_horizon_months,
              'onboarding', true, p_occurred_at, p_timezone, v_local, NULL, NULL, NULL, NULL, NULL, NULL,
              'onboarding', p_session_id);

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
