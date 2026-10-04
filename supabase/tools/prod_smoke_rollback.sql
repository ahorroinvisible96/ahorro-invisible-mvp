-- Smoke test de PRODUCCIÓN 100 % reversible: todo ocurre dentro de un bloque que termina en RAISE,
-- así que la transacción aborta y NO persiste nada (ni el usuario sintético ni sus filas).
-- No usa usuarios reales. Devuelve el resultado en el mensaje de error 'SMOKE_RESULT:{...}'.
DO $$
DECLARE
  u uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); g uuid := gen_random_uuid();
  r jsonb := '{}'::jsonb; x jsonb; n int; err text;
BEGIN
  INSERT INTO auth.users(id, email, aud, role) VALUES (u, 'smoke_' || u || '@rollback.invalid', 'authenticated', 'authenticated'),
                                                      (u2, 'smoke_' || u2 || '@rollback.invalid', 'authenticated', 'authenticated');
  -- Como usuario autenticado (mismo mecanismo que PostgREST: rol + claims del JWT)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := r || jsonb_build_object('auth_uid', auth.uid() = u);
  x := public.create_goal(p_goal_id => g, p_title => 'smoke', p_target_amount => 100, p_horizon_months => 3, p_source => 'goals_page',
                          p_set_primary => true, p_occurred_at => now() - interval '1 minute', p_timezone => 'Europe/Madrid');
  r := r || jsonb_build_object('create_goal', x IS NOT NULL);
  x := public.record_extra_saving(p_transaction_id => gen_random_uuid(), p_occurred_at => now() - interval '1 minute',
                                  p_timezone => 'Europe/Madrid', p_amount => 10, p_goal_id => NULL, p_note => NULL);
  SELECT count(*), coalesce(sum(amount),0)::int INTO n, err FROM public.savings_transactions WHERE user_id = u;
  r := r || jsonb_build_object('ledger_rows', n, 'ledger_sum', err);
  BEGIN UPDATE public.savings_transactions SET amount = 1 WHERE user_id = u; GET DIAGNOSTICS n = ROW_COUNT;
        r := r || jsonb_build_object('authenticated_update_ledger_rows', n);
  EXCEPTION WHEN OTHERS THEN r := r || jsonb_build_object('authenticated_update_ledger', 'denied: ' || SQLERRM); END;
  -- Otro usuario no ve nada
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM public.savings_transactions; r := r || jsonb_build_object('other_user_sees_ledger', n);
  SELECT count(*) INTO n FROM public.goals WHERE id = g::text; r := r || jsonb_build_object('other_user_sees_goal', n);
  BEGIN x := public.record_extra_saving(p_transaction_id => gen_random_uuid(), p_occurred_at => now(), p_timezone => 'UTC',
                                        p_amount => 5, p_goal_id => g::text, p_note => NULL);
        r := r || jsonb_build_object('cross_user_goal', 'ALLOWED!');
  EXCEPTION WHEN OTHERS THEN r := r || jsonb_build_object('cross_user_goal', 'denied'); END;
  -- anon sin EXECUTE
  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN x := public.record_extra_saving(gen_random_uuid(), now(), 'UTC', 5, NULL, NULL); r := r || jsonb_build_object('anon_rpc', 'ALLOWED!');
  EXCEPTION WHEN insufficient_privilege THEN r := r || jsonb_build_object('anon_rpc', 'denied'); END;
  EXECUTE 'RESET ROLE';
  -- Inmutabilidad como propietario privilegiado
  BEGIN DELETE FROM public.savings_transactions WHERE user_id = u; r := r || jsonb_build_object('postgres_delete_ledger', 'ALLOWED!');
  EXCEPTION WHEN OTHERS THEN r := r || jsonb_build_object('postgres_delete_ledger', 'denied'); END;
  RAISE EXCEPTION 'SMOKE_RESULT:%', r::text;
END $$;
