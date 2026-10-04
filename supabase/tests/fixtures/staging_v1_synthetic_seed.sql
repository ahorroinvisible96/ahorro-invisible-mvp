-- SOLO STAGING. Datos V1 SINTÉTICOS (sin PII) con volumen y casos límite equivalentes a producción:
-- 25 perfiles (+3 usuarios auth sin perfil), 52 goals (3 archivados, 2 usuarios con 2 principales, uno completado),
-- 132 decisions, 24 hucha, 1 question_interaction.
DO $$
DECLARE u uuid; i int; g int := 0; d int := 0; users uuid[] := '{}';
BEGIN
  FOR i IN 1..28 LOOP
    u := gen_random_uuid(); users := users || u;
    INSERT INTO auth.users(id, email, aud, role) VALUES (u, 'synthetic_' || i || '@staging.test', 'authenticated', 'authenticated');
  END LOOP;
  FOR i IN 1..25 LOOP
    INSERT INTO public.user_profiles(id, name, total_saved) VALUES (users[i], 'Synthetic ' || i, i * 10);
  END LOOP;
  -- 52 goals: 2 por usuario en 1..24 (48) + 4 extra en usuarios 1..4
  FOR i IN 1..24 LOOP
    g := g + 1;
    INSERT INTO public.goals(id, user_id, title, target_amount, current_amount, horizon_months, is_primary, archived, created_at, updated_at, source)
    VALUES ('syn_goal_' || g, users[i], 'G' || g, 500 + i, 100 + i * 7.25, 6, true, false, now() - interval '30 days', now() - interval '1 day', 'onboarding');
    g := g + 1;
    INSERT INTO public.goals(id, user_id, title, target_amount, current_amount, horizon_months, is_primary, archived, created_at, updated_at, source)
    VALUES ('syn_goal_' || g, users[i], 'G' || g, 1000, i * 3.5,
            12, (i IN (1, 2)), (i IN (5, 6, 7)), now() - interval '20 days', now() - interval '2 days', 'dashboard');
  END LOOP;
  FOR i IN 1..4 LOOP
    g := g + 1;
    INSERT INTO public.goals(id, user_id, title, target_amount, current_amount, is_primary, archived, created_at, updated_at, completed_at)
    VALUES ('syn_goal_' || g, users[i], 'G' || g, 100, CASE WHEN i = 1 THEN 105 ELSE 10 END, false, false, now() - interval '10 days', now(),
            CASE WHEN i = 1 THEN now() END);
  END LOOP;
  FOR i IN 1..132 LOOP
    d := d + 1;
    INSERT INTO public.decisions(id, user_id, date, question_id, answer_key, goal_id, delta_amount, created_at)
    VALUES ('syn_dec_' || d, users[1 + (i % 25)], current_date - (i % 40), 'q' || (i % 30), 'a', 'syn_goal_' || (1 + (i % 48)), (i % 17) * 1.15, now() - (i || ' hours')::interval);
  END LOOP;
  FOR i IN 1..24 LOOP
    INSERT INTO public.hucha(user_id, balance) VALUES (users[i], i * 9.5);
  END LOOP;
  INSERT INTO public.question_interactions(user_id, question_id, local_date, time_slot) VALUES (users[1], 'q1', current_date, 'Tarde');
END $$;
