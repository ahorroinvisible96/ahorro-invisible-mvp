-- Smoke reversible del camino de escritura V1 (la app actual) en PRODUCCIÓN tras el schema V2.
-- Usuario sintético dentro de un bloque que termina en RAISE: nada persiste.
DO $$
DECLARE u uuid := gen_random_uuid(); gid text := 'smoke_goal_' || gen_random_uuid(); r jsonb := '{}'; n int; st text;
BEGIN
  INSERT INTO auth.users(id, email, aud, role) VALUES (u, 'smoke_' || u || '@rollback.invalid', 'authenticated', 'authenticated');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.user_profiles(id, name) VALUES (u, 'smoke') ON CONFLICT (id) DO UPDATE SET name = 'smoke';
  INSERT INTO public.goals(id, user_id, title, target_amount, current_amount, horizon_months, is_primary, archived, created_at, updated_at, source)
    VALUES (gid, u, 'smoke', 100, 0, 3, true, false, now(), now(), 'onboarding');
  UPDATE public.goals SET current_amount = 25, updated_at = now() WHERE id = gid; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('goal_update', n);
  INSERT INTO public.decisions(id, user_id, date, question_id, answer_key, goal_id, delta_amount, created_at)
    VALUES ('smoke_dec_' || u, u, current_date, 'Q1', 'a', gid, 5, now());
  INSERT INTO public.hucha(user_id, balance, entries) VALUES (u, 5, '[]') ON CONFLICT (user_id) DO UPDATE SET balance = 5;
  INSERT INTO public.question_interactions(user_id, question_id, local_date, time_slot) VALUES (u, 'Q1', current_date, 'Tarde');
  UPDATE public.user_profiles SET total_saved = 30 WHERE id = u; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('profile_update', n);
  UPDATE public.goals SET archived = true, updated_at = now() WHERE id = gid;
  SELECT status INTO st FROM public.goals WHERE id = gid; r := r || jsonb_build_object('archived_status_derived', st);
  DELETE FROM public.goals WHERE id = gid; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('goal_delete', n);
  SELECT count(*) INTO n FROM public.goals WHERE user_id <> u; r := r || jsonb_build_object('sees_other_users_goals', n);
  RAISE EXCEPTION 'SMOKE_V1_RESULT:%', r::text;
END $$;
