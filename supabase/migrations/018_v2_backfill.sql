-- ============================================================
-- Ahorro Invisible — Data Model V2 — 5B.4 — 018 Backfill V1 → V2 + conciliación
-- ADITIVA. Idempotente / re-ejecutable. NO modifica ninguna fila V1.
--
-- private.v2_backfill(p_cutoff, p_user)
--   Reconstruye en V2 el histórico V1 que exista en Supabase y cuadra cada saldo con la foto V1:
--   1. Objetivos V1 sin pareja → goals (ledger_managed, data_origin='v1_reconstructed', legacy_id)
--      + goal_events (created/archived/completed[/completion_reverted]) cause='migration'.
--      Objetivo principal: activo → no completado → updated_at desc → created_at desc → id desc;
--      los demás principales V1 → primary_unset (cause=migration) + nota duplicate_primary_resolved.
--   2. Decisiones diarias V1 → daily_decisions (credit_rule_version='legacy_v1_income_multiplier',
--      declared_amount NULL, timezone 'UTC', surface NULL). Ahorros extra → asiento extra_saving.
--      Importes TAL CUAL (nunca se reinterpreta el multiplicador por ingresos).
--   3. Entradas de la hucha V1 → transferencias objetivo→hucha. Nunca se inventan salidas.
--   4. Cuadre por bucket contra la foto V1 (goals.current_amount / hucha.balance):
--        · si el histórico explica más saldo del que hay → se excluyen los movimientos más recientes
--          (nota bucket_not_reconstructible / hucha_outflow_unrecorded)
--        · si explica menos → UN asiento migration_opening_balance (actor='migration',
--          data_origin='migration_adjustment', reason='migration_reconciliation') por la diferencia
--          (nota v1_balance_without_history).  Los ajustes NUNCA cuentan como ahorro.
--   5. income_range → income_declarations (source='migration_v1').  question_interactions → nota.
--   No crea sesiones de onboarding, ni perfiles, ni usuarios.
--
-- Identidad determinista private.v1_uuid(usuario, tipo, legacy) = la misma que usa el cliente
-- (dual-write) → nunca hay doble conteo entre backfill y dual-write.
--
-- Ejecución: SOLO el operador (postgres) vía consola/Management API, en una transacción:
--   SELECT * FROM private.v2_backfill('infinity');       -- primer pase (todo lo existente)
--   SELECT * FROM private.v2_backfill(<T0>);             -- re-ejecuciones (solo lo anterior a T0)
-- ============================================================

-- La comparación debe ejecutarse con los privilegios del llamante: desde shadow_check (definer
-- app_rpc_owner + JWT del usuario → RLS V1 del propio usuario) y desde la consola del operador
-- (postgres, BYPASSRLS → conciliación global).
ALTER FUNCTION private.v1_v2_compare(uuid) SECURITY INVOKER;

ALTER TABLE private.migration_row_notes DROP CONSTRAINT IF EXISTS mrn_reason_chk;
ALTER TABLE private.migration_row_notes ADD CONSTRAINT mrn_reason_chk CHECK (reason IN (
  'unbucketed_goal_missing','bucket_not_reconstructible','zero_amount','question_not_in_catalog',
  'duplicate_primary_resolved','impressions_v2_only','income_unmappable','hucha_entry_goal_missing',
  'local_only_history','hucha_outflow_unrecorded','v1_balance_without_history','duplicate_day_skipped'));

CREATE OR REPLACE FUNCTION private.v1_slug(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT NULLIF(pg_catalog.btrim(pg_catalog.regexp_replace(
           pg_catalog.translate(pg_catalog.lower(p), 'áéíóúüñàèìòùâêîôûäëïöç', 'aeiouunaeiouaeiouaeioc'),
           '[^a-z0-9]+', '_', 'g'), '_'), '')
$$;

CREATE OR REPLACE FUNCTION private.v2_backfill(p_cutoff timestamptz DEFAULT 'infinity', p_user uuid DEFAULT NULL)
RETURNS TABLE (user_id uuid, goals_created int, daily_rows int, extra_rows int, credits int, transfers int,
               openings int, opening_amount numeric, excluded int, notes int)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  u uuid; g record; d record; e record; c record; v_has_h boolean; v_hbal numeric; v_hentries jsonb; v_hupd timestamptz;
  v_id text; v_dec uuid; v_txn uuid; v_goal text; v_qid text; v_opt text; v_note text; v_n int;
  v_prim text; v_has_primary boolean; v_target numeric; v_f numeric; v_amt numeric; v_grp uuid;
  v_goals int; v_daily int; v_extra int; v_credits int; v_tr int; v_open int; v_open_amt numeric;
  v_excl int; v_notes int; v_band text; v_min numeric; v_k int;
BEGIN
  -- Congela V1 durante el pase (segundos): ninguna escritura V1 puede colarse entre lecturas.
  LOCK TABLE public.goals, public.decisions, public.hucha, public.user_profiles IN SHARE MODE;

  CREATE TEMP TABLE IF NOT EXISTS _bf_cand (kind text, legacy_id text, dec uuid, txn uuid, goal text, amount numeric,
    ts timestamptz, d date, note text, inc boolean DEFAULT true) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _bf_tr (idx int, grp uuid, from_goal text, amount numeric, ts timestamptz, d date,
    archived boolean, inc boolean DEFAULT true) ON COMMIT DROP;

  FOR u IN
    SELECT x.u FROM (
      SELECT gg.user_id AS u FROM public.goals gg WHERE NOT gg.ledger_managed AND gg.created_at < p_cutoff
      UNION SELECT dd.user_id FROM public.decisions dd WHERE dd.created_at < p_cutoff
      UNION SELECT hh.user_id FROM public.hucha hh WHERE hh.created_at < p_cutoff) x
     WHERE (p_user IS NULL OR x.u = p_user)
       AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id = x.u)
     ORDER BY x.u
  LOOP
    TRUNCATE _bf_cand; TRUNCATE _bf_tr;
    v_goals := 0; v_daily := 0; v_extra := 0; v_credits := 0; v_tr := 0; v_open := 0; v_open_amt := 0;
    v_excl := 0; v_notes := 0;

    -- ── 1. Objetivos ───────────────────────────────────────────────────────
    v_has_primary := EXISTS (SELECT 1 FROM public.goals x WHERE x.user_id = u AND x.ledger_managed
                               AND x.is_primary AND x.status = 'active');
    v_prim := NULL;
    IF NOT v_has_primary THEN
      SELECT gg.id INTO v_prim FROM public.goals gg
       WHERE gg.user_id = u AND NOT gg.ledger_managed AND NOT gg.archived AND gg.is_primary AND gg.created_at < p_cutoff
         AND NOT EXISTS (SELECT 1 FROM public.goals x WHERE x.user_id = u AND x.ledger_managed AND x.legacy_id = gg.id)
       ORDER BY (gg.current_amount >= gg.target_amount) ASC, gg.updated_at DESC, gg.created_at DESC, gg.id DESC
       LIMIT 1;
    END IF;

    FOR g IN
      SELECT gg.* FROM public.goals gg
       WHERE gg.user_id = u AND NOT gg.ledger_managed AND gg.created_at < p_cutoff
         AND NOT EXISTS (SELECT 1 FROM public.goals x WHERE x.user_id = u AND x.ledger_managed AND x.legacy_id = gg.id)
       ORDER BY gg.created_at, gg.id
    LOOP
      v_id := private.v1_uuid(u, 'goal', g.id)::text;
      INSERT INTO public.goals (id, user_id, title, target_amount, current_amount, horizon_months, is_primary, archived,
        created_at, updated_at, source, status, start_date, first_completed_at, archived_at, data_origin, legacy_id, ledger_managed)
      VALUES (v_id, u, pg_catalog.left(COALESCE(NULLIF(pg_catalog.btrim(g.title), ''), 'Objetivo'), 80),
        LEAST(GREATEST(pg_catalog.round(g.target_amount, 2), 0.01), 100000), 0,
        LEAST(GREATEST(COALESCE(g.horizon_months, 12), 1), 120),
        COALESCE(g.id = v_prim, false), g.archived, g.created_at, g.updated_at,
        CASE WHEN g.source IN ('onboarding','dashboard','goals_page') THEN g.source ELSE 'dashboard' END,
        CASE WHEN g.archived THEN 'archived' ELSE 'active' END,
        (g.created_at AT TIME ZONE 'UTC')::date, g.completed_at,
        CASE WHEN g.archived THEN g.updated_at END, 'v1_reconstructed', g.id, true);
      INSERT INTO public.goal_events (goal_event_id, user_id, goal_id, event_type, cause, target_amount_after,
        horizon_months_after, occurred_at, timezone, local_date, data_origin)
      VALUES (private.v1_uuid(u, 'goal_event', g.id || ':created'), u, v_id, 'created', 'migration',
        LEAST(GREATEST(pg_catalog.round(g.target_amount, 2), 0.01), 100000), LEAST(GREATEST(COALESCE(g.horizon_months, 12), 1), 120),
        g.created_at, 'UTC', (g.created_at AT TIME ZONE 'UTC')::date, 'v1_reconstructed');
      IF g.id = v_prim THEN
        INSERT INTO public.goal_events (goal_event_id, user_id, goal_id, event_type, cause, occurred_at, timezone, local_date, data_origin)
        VALUES (private.v1_uuid(u, 'goal_event', g.id || ':primary_set'), u, v_id, 'primary_set', 'migration',
          g.created_at, 'UTC', (g.created_at AT TIME ZONE 'UTC')::date, 'v1_reconstructed');
      ELSIF g.is_primary AND NOT g.archived THEN
        INSERT INTO public.goal_events (goal_event_id, user_id, goal_id, event_type, cause, occurred_at, timezone, local_date, data_origin)
        VALUES (private.v1_uuid(u, 'goal_event', g.id || ':primary_unset'), u, v_id, 'primary_unset', 'migration',
          g.updated_at, 'UTC', (g.updated_at AT TIME ZONE 'UTC')::date, 'v1_reconstructed');
        INSERT INTO private.migration_row_notes (user_id, legacy_table, legacy_id, reason)
        VALUES (u, 'goals', g.id, 'duplicate_primary_resolved') ON CONFLICT DO NOTHING;
        v_notes := v_notes + 1;
      END IF;
      IF g.completed_at IS NOT NULL THEN
        INSERT INTO public.goal_events (goal_event_id, user_id, goal_id, event_type, cause, completion_sequence,
          occurred_at, timezone, local_date, data_origin)
        VALUES (private.v1_uuid(u, 'goal_event', g.id || ':completed'), u, v_id, 'completed', 'migration', 1,
          g.completed_at, 'UTC', (g.completed_at AT TIME ZONE 'UTC')::date, 'v1_reconstructed');
        IF g.current_amount < g.target_amount THEN
          INSERT INTO public.goal_events (goal_event_id, user_id, goal_id, event_type, cause, completion_sequence,
            occurred_at, timezone, local_date, data_origin)
          VALUES (private.v1_uuid(u, 'goal_event', g.id || ':completion_reverted'), u, v_id, 'completion_reverted', 'migration', 1,
            GREATEST(g.updated_at, g.completed_at), 'UTC', (GREATEST(g.updated_at, g.completed_at) AT TIME ZONE 'UTC')::date, 'v1_reconstructed');
        END IF;
      END IF;
      IF g.archived THEN
        INSERT INTO public.goal_events (goal_event_id, user_id, goal_id, event_type, cause, occurred_at, timezone, local_date, data_origin)
        VALUES (private.v1_uuid(u, 'goal_event', g.id || ':archived'), u, v_id, 'archived', 'migration',
          GREATEST(g.updated_at, COALESCE(g.completed_at, g.updated_at)), 'UTC',
          (GREATEST(g.updated_at, COALESCE(g.completed_at, g.updated_at)) AT TIME ZONE 'UTC')::date, 'v1_reconstructed');
      END IF;
      v_goals := v_goals + 1;
    END LOOP;

    -- ── 2. Decisiones y ahorros extra ─────────────────────────────────────
    FOR d IN
      SELECT dd.* FROM public.decisions dd WHERE dd.user_id = u AND dd.created_at < p_cutoff ORDER BY dd.created_at, dd.id
    LOOP
      v_goal := NULL;
      IF d.goal_id IS NOT NULL THEN
        SELECT x.id INTO v_goal FROM public.goals x WHERE x.user_id = u AND x.ledger_managed AND x.legacy_id = d.goal_id;
      END IF;
      v_amt := pg_catalog.round(COALESCE(d.delta_amount, 0), 2);

      IF d.question_id = 'extra_saving' THEN
        v_txn := private.v1_uuid(u, 'extra', d.id);
        CONTINUE WHEN EXISTS (SELECT 1 FROM public.savings_transactions s WHERE s.transaction_id = v_txn)
                   OR EXISTS (SELECT 1 FROM public.savings_transactions s WHERE s.user_id = u AND s.legacy_id = d.id)
                   OR EXISTS (SELECT 1 FROM private.migration_row_notes n WHERE n.user_id = u AND n.legacy_table = 'decisions' AND n.legacy_id = d.id);
        IF v_amt <= 0 THEN
          INSERT INTO private.migration_row_notes (user_id, legacy_table, legacy_id, reason, amount)
          VALUES (u, 'decisions', d.id, 'zero_amount', v_amt) ON CONFLICT DO NOTHING;
          v_notes := v_notes + 1; CONTINUE;
        END IF;
        IF v_goal IS NULL THEN
          INSERT INTO private.migration_row_notes (user_id, legacy_table, legacy_id, reason, amount)
          VALUES (u, 'decisions', d.id, 'unbucketed_goal_missing', v_amt) ON CONFLICT DO NOTHING;
          v_notes := v_notes + 1; CONTINUE;
        END IF;
        v_note := CASE WHEN d.answer_key IS NOT NULL AND d.answer_key !~ '^\s*[0-9]+([.,][0-9]+)?\s*$'
                         AND pg_catalog.lower(pg_catalog.btrim(d.answer_key)) NOT IN ('extra','saved','extra_saving','zero')
                         AND pg_catalog.char_length(pg_catalog.btrim(d.answer_key)) BETWEEN 1 AND 200
                       THEN pg_catalog.btrim(d.answer_key) END;
        INSERT INTO _bf_cand (kind, legacy_id, dec, txn, goal, amount, ts, d, note)
        VALUES ('extra', d.id, NULL, v_txn, v_goal, v_amt, d.created_at, d.date, v_note);
      ELSE
        v_dec := private.v1_uuid(u, 'dec', d.id);
        CONTINUE WHEN EXISTS (SELECT 1 FROM public.daily_decisions x WHERE x.decision_id = v_dec)
                   OR EXISTS (SELECT 1 FROM public.daily_decisions x WHERE x.user_id = u AND x.legacy_id = d.id);
        v_qid := NULL; v_opt := NULL;
        IF EXISTS (SELECT 1 FROM public.cat_daily_questions q WHERE q.question_bank_version = 'qb_v1' AND q.question_id = d.question_id) THEN
          v_qid := d.question_id;
          IF pg_catalog.strpos(d.answer_key, '|') > 0 THEN
            v_opt := private.v1_slug(pg_catalog.substr(d.answer_key, pg_catalog.strpos(d.answer_key, '|') + 1));
            IF v_opt IS NULL OR NOT EXISTS (SELECT 1 FROM public.cat_daily_questions q, jsonb_array_elements(q.options) o
                                             WHERE q.question_bank_version = 'qb_v1' AND q.question_id = v_qid
                                               AND o->>'option_key' = v_opt) THEN
              v_opt := NULL;
            END IF;
          END IF;
        END IF;
        INSERT INTO public.daily_decisions (decision_id, legacy_id, user_id, local_date, occurred_at, timezone, outcome,
          question_bank_version, question_id, selected_option_key, has_custom_text, declared_amount, credit_rule_version,
          goal_id, surface, status, data_origin)
        VALUES (v_dec, d.id, u, d.date, d.created_at, 'UTC', CASE WHEN v_amt > 0 THEN 'saved' ELSE 'zero' END,
          CASE WHEN v_qid IS NOT NULL THEN 'qb_v1' END, v_qid, v_opt, false, NULL, 'legacy_v1_income_multiplier',
          v_goal, NULL, 'active', 'v1_reconstructed')
        ON CONFLICT DO NOTHING;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        IF v_n = 0 THEN
          INSERT INTO private.migration_row_notes (user_id, legacy_table, legacy_id, reason, amount)
          VALUES (u, 'decisions', d.id, 'duplicate_day_skipped', v_amt) ON CONFLICT DO NOTHING;
          v_notes := v_notes + 1; CONTINUE;
        END IF;
        v_daily := v_daily + 1;
        IF v_qid IS NULL THEN
          INSERT INTO private.migration_row_notes (user_id, legacy_table, legacy_id, reason)
          VALUES (u, 'decisions', d.id, 'question_not_in_catalog') ON CONFLICT DO NOTHING;
        END IF;
        IF v_amt > 0 THEN
          IF v_goal IS NULL THEN
            INSERT INTO private.migration_row_notes (user_id, legacy_table, legacy_id, reason, amount)
            VALUES (u, 'decisions', d.id, 'unbucketed_goal_missing', v_amt)
            ON CONFLICT (user_id, legacy_table, legacy_id) DO UPDATE SET reason = EXCLUDED.reason, amount = EXCLUDED.amount;
            v_notes := v_notes + 1;
          ELSE
            INSERT INTO _bf_cand (kind, legacy_id, dec, txn, goal, amount, ts, d)
            VALUES ('daily', d.id, v_dec, private.v1_uuid(u, 'dec_txn', d.id), v_goal, v_amt, d.created_at, d.date);
          END IF;
        END IF;
      END IF;
    END LOOP;

    -- ── 3. Entradas de la hucha (solo desde objetivos reconstruidos) ──────
    v_has_h := false;
    SELECT true, hh.balance, hh.entries, hh.updated_at INTO v_has_h, v_hbal, v_hentries, v_hupd
      FROM public.hucha hh WHERE hh.user_id = u;
    v_has_h := COALESCE(v_has_h, false);
    IF v_has_h THEN
      FOR e IN SELECT x.e, x.ord FROM jsonb_array_elements(COALESCE(v_hentries, '[]'::jsonb)) WITH ORDINALITY AS x(e, ord) LOOP
        v_grp := private.v1_uuid(u, 'hucha_entry', e.ord::text);
        CONTINUE WHEN EXISTS (SELECT 1 FROM public.savings_transactions s WHERE s.transfer_group_id = v_grp)
                   OR EXISTS (SELECT 1 FROM private.migration_row_notes n WHERE n.user_id = u AND n.legacy_table = 'hucha_entries' AND n.legacy_id = 'e' || e.ord);
        v_amt := pg_catalog.round(COALESCE(NULLIF(e.e->>'amount', '')::numeric, 0), 2);
        CONTINUE WHEN v_amt <= 0;
        SELECT x.id INTO v_goal FROM public.goals x
         WHERE x.user_id = u AND x.ledger_managed AND x.data_origin = 'v1_reconstructed' AND x.legacy_id = e.e->>'fromGoalId';
        IF v_goal IS NULL THEN
          INSERT INTO private.migration_row_notes (user_id, legacy_table, legacy_id, reason, amount)
          VALUES (u, 'hucha_entries', 'e' || e.ord, 'hucha_entry_goal_missing', v_amt) ON CONFLICT DO NOTHING;
          v_notes := v_notes + 1; CONTINUE;
        END IF;
        INSERT INTO _bf_tr (idx, grp, from_goal, amount, ts, d, archived)
        SELECT e.ord, v_grp, v_goal, v_amt,
               COALESCE((e.e->>'date')::date::timestamp AT TIME ZONE 'UTC', v_hupd),
               COALESCE((e.e->>'date')::date, (v_hupd AT TIME ZONE 'UTC')::date),
               (SELECT x.status <> 'active' FROM public.goals x WHERE x.id = v_goal);
      END LOOP;

      -- Nunca más entradas que el saldo V1 de la hucha (las salidas V1 no existen): fuera las más recientes.
      v_target := COALESCE(v_hbal, 0) - COALESCE((SELECT SUM(s.amount) FROM public.savings_transactions s
                                                        WHERE s.user_id = u AND s.bucket_type = 'hucha'), 0);
      v_f := COALESCE((SELECT SUM(t.amount) FROM _bf_tr t), 0);
      FOR c IN SELECT t.idx, t.amount FROM _bf_tr t ORDER BY t.ts DESC, t.idx DESC LOOP
        EXIT WHEN v_f <= v_target;
        UPDATE _bf_tr SET inc = false WHERE idx = c.idx;
        v_f := v_f - c.amount; v_excl := v_excl + 1;
        INSERT INTO private.migration_row_notes (user_id, legacy_table, legacy_id, reason, amount)
        VALUES (u, 'hucha_entries', 'e' || c.idx, 'hucha_outflow_unrecorded', c.amount) ON CONFLICT DO NOTHING;
        v_notes := v_notes + 1;
      END LOOP;
    END IF;

    -- ── 4. Cuadre por objetivo reconstruido ────────────────────────────────
    FOR g IN
      SELECT x.id, x.legacy_id, v1.current_amount AS v1_bal
        FROM public.goals x JOIN public.goals v1 ON v1.id = x.legacy_id AND v1.user_id = u AND NOT v1.ledger_managed
       WHERE x.user_id = u AND x.ledger_managed AND x.data_origin = 'v1_reconstructed'
       ORDER BY x.created_at, x.id
    LOOP
      v_target := g.v1_bal - COALESCE((SELECT SUM(s.amount) FROM public.savings_transactions s
                                        WHERE s.user_id = u AND s.bucket_type = 'goal' AND s.goal_id = g.id), 0);
      v_f := COALESCE((SELECT SUM(cc.amount) FROM _bf_cand cc WHERE cc.goal = g.id AND cc.inc), 0)
           - COALESCE((SELECT SUM(t.amount) FROM _bf_tr t WHERE t.from_goal = g.id AND t.inc), 0);
      FOR c IN SELECT cc.legacy_id, cc.amount FROM _bf_cand cc WHERE cc.goal = g.id AND cc.inc ORDER BY cc.ts DESC, cc.legacy_id DESC LOOP
        EXIT WHEN v_f <= v_target;
        UPDATE _bf_cand SET inc = false WHERE legacy_id = c.legacy_id;
        v_f := v_f - c.amount; v_excl := v_excl + 1;
        INSERT INTO private.migration_row_notes (user_id, legacy_table, legacy_id, reason, amount)
        VALUES (u, 'decisions', c.legacy_id, 'bucket_not_reconstructible', c.amount)
        ON CONFLICT (user_id, legacy_table, legacy_id) DO UPDATE SET reason = EXCLUDED.reason, amount = EXCLUDED.amount;
        v_notes := v_notes + 1;
      END LOOP;
      IF v_f < 0 THEN
        -- Salidas a la hucha sin ingresos que las expliquen: se excluyen (la hucha recibe apertura).
        FOR c IN SELECT t.idx, t.amount FROM _bf_tr t WHERE t.from_goal = g.id AND t.inc ORDER BY t.ts DESC, t.idx DESC LOOP
          EXIT WHEN v_f >= 0;
          UPDATE _bf_tr SET inc = false WHERE idx = c.idx;
          v_f := v_f + c.amount; v_excl := v_excl + 1;
          INSERT INTO private.migration_row_notes (user_id, legacy_table, legacy_id, reason, amount)
          VALUES (u, 'hucha_entries', 'e' || c.idx, 'bucket_not_reconstructible', c.amount)
          ON CONFLICT (user_id, legacy_table, legacy_id) DO UPDATE SET reason = EXCLUDED.reason, amount = EXCLUDED.amount;
          v_notes := v_notes + 1;
        END LOOP;
      END IF;
      -- Asientos reconstruidos (créditos)
      FOR c IN SELECT * FROM _bf_cand cc WHERE cc.goal = g.id AND cc.inc ORDER BY cc.ts, cc.legacy_id LOOP
        IF c.kind = 'daily' THEN
          INSERT INTO public.savings_transactions (transaction_id, user_id, transaction_type, bucket_type, goal_id, amount,
            decision_id, reason, occurred_at, timezone, local_date, surface, actor, data_origin, legacy_id)
          VALUES (c.txn, u, 'daily_saving', 'goal', g.id, c.amount, c.dec, 'user_saving', c.ts, 'UTC', c.d, NULL,
                  'user', 'v1_reconstructed', c.legacy_id);
        ELSE
          INSERT INTO public.savings_transactions (transaction_id, user_id, transaction_type, bucket_type, goal_id, amount,
            reason, occurred_at, timezone, local_date, surface, actor, data_origin, legacy_id)
          VALUES (c.txn, u, 'extra_saving', 'goal', g.id, c.amount, 'user_saving', c.ts, 'UTC', c.d, NULL,
                  'user', 'v1_reconstructed', c.legacy_id);
          IF c.note IS NOT NULL THEN
            INSERT INTO public.user_free_text (free_text_id, user_id, kind, transaction_id, text)
            VALUES (private.v1_uuid(u, 'extra_note', c.legacy_id), u, 'extra_saving_note', c.txn, c.note);
          END IF;
          v_extra := v_extra + 1;
        END IF;
        v_credits := v_credits + 1;
      END LOOP;
      -- Transferencias objetivo → hucha incluidas
      FOR c IN SELECT * FROM _bf_tr t WHERE t.from_goal = g.id AND t.inc ORDER BY t.ts, t.idx LOOP
        INSERT INTO public.savings_transactions (transaction_id, user_id, transaction_type, bucket_type, goal_id, amount,
          transfer_group_id, reason, occurred_at, timezone, local_date, surface, actor, data_origin)
        VALUES (private.v1_uuid(u, 'hucha_out', c.idx::text), u, 'transfer_out', 'goal', g.id, -c.amount, c.grp,
                CASE WHEN c.archived THEN 'goal_archived' ELSE 'manual_hucha_transfer' END, c.ts, 'UTC', c.d, NULL, 'user', 'v1_reconstructed'),
               (private.v1_uuid(u, 'hucha_in', c.idx::text), u, 'transfer_in', 'hucha', NULL, c.amount, c.grp,
                CASE WHEN c.archived THEN 'goal_archived' ELSE 'manual_hucha_transfer' END, c.ts, 'UTC', c.d, NULL, 'user', 'v1_reconstructed');
        v_tr := v_tr + 1;
      END LOOP;
      -- Apertura por la diferencia no reconstruible
      IF v_target - v_f > 0 THEN
        SELECT COUNT(*) INTO v_k FROM public.savings_transactions s
         WHERE s.user_id = u AND s.goal_id = g.id AND s.transaction_type = 'migration_opening_balance';
        INSERT INTO public.savings_transactions (transaction_id, user_id, transaction_type, bucket_type, goal_id, amount,
          reason, occurred_at, timezone, local_date, surface, actor, data_origin)
        VALUES (private.v1_uuid(u, 'opening', g.legacy_id || ':' || v_k), u, 'migration_opening_balance', 'goal', g.id,
                v_target - v_f, 'migration_reconciliation', LEAST(pg_catalog.now(), p_cutoff), 'UTC',
                (LEAST(pg_catalog.now(), p_cutoff) AT TIME ZONE 'UTC')::date, NULL, 'migration', 'migration_adjustment');
        INSERT INTO private.migration_row_notes (user_id, legacy_table, legacy_id, reason, amount)
        VALUES (u, 'goals', g.legacy_id, 'v1_balance_without_history', v_target - v_f)
        ON CONFLICT (user_id, legacy_table, legacy_id) DO UPDATE SET amount = COALESCE(private.migration_row_notes.amount, 0) + EXCLUDED.amount;
        v_open := v_open + 1; v_open_amt := v_open_amt + (v_target - v_f); v_notes := v_notes + 1;
      END IF;
    END LOOP;

    -- ── 5. Hucha: apertura por lo que las entradas reconstruidas no explican ─
    IF v_has_h THEN
      v_target := COALESCE(v_hbal, 0) - COALESCE((SELECT SUM(s.amount) FROM public.savings_transactions s
                                                        WHERE s.user_id = u AND s.bucket_type = 'hucha'), 0);
      IF v_target > 0 THEN
        SELECT COUNT(*) INTO v_k FROM public.savings_transactions s
         WHERE s.user_id = u AND s.bucket_type = 'hucha' AND s.transaction_type = 'migration_opening_balance';
        INSERT INTO public.savings_transactions (transaction_id, user_id, transaction_type, bucket_type, goal_id, amount,
          reason, occurred_at, timezone, local_date, surface, actor, data_origin)
        VALUES (private.v1_uuid(u, 'opening', 'hucha:' || v_k), u, 'migration_opening_balance', 'hucha', NULL, v_target,
                'migration_reconciliation', LEAST(pg_catalog.now(), p_cutoff), 'UTC',
                (LEAST(pg_catalog.now(), p_cutoff) AT TIME ZONE 'UTC')::date, NULL, 'migration', 'migration_adjustment');
        INSERT INTO private.migration_row_notes (user_id, legacy_table, legacy_id, reason, amount)
        VALUES (u, 'hucha_entries', 'balance', 'v1_balance_without_history', v_target)
        ON CONFLICT (user_id, legacy_table, legacy_id) DO UPDATE SET amount = COALESCE(private.migration_row_notes.amount, 0) + EXCLUDED.amount;
        v_open := v_open + 1; v_open_amt := v_open_amt + v_target; v_notes := v_notes + 1;
      END IF;
    END IF;

    -- ── 6. Ingresos declarados (tramo vigente) ─────────────────────────────
    IF NOT EXISTS (SELECT 1 FROM public.income_declarations i WHERE i.user_id = u) THEN
      SELECT CASE WHEN jsonb_typeof(p.income_range) = 'object' AND p.income_range->>'min' ~ '^[0-9]+(\.[0-9]+)?$'
                  THEN (p.income_range->>'min')::numeric END
        INTO v_min FROM public.user_profiles p WHERE p.id = u;
      IF v_min IS NOT NULL THEN
        v_band := CASE WHEN v_min < 1000 THEN 'lt_1000' WHEN v_min < 1500 THEN '1000_1500' WHEN v_min < 2000 THEN '1500_2000'
                       WHEN v_min < 2500 THEN '2000_2500' WHEN v_min < 3000 THEN '2500_3000' ELSE 'gt_3000' END;
        INSERT INTO public.income_declarations (income_declaration_id, user_id, band_catalog_version, income_band_code,
          source, declared_at, timezone, local_date, data_origin, legacy_id)
        SELECT private.v1_uuid(u, 'income', 'profile'), u, 'income_ref_v1', v_band, 'migration_v1', p.updated_at, 'UTC',
               (p.updated_at AT TIME ZONE 'UTC')::date, 'v1_reconstructed', 'user_profiles.income_range'
          FROM public.user_profiles p WHERE p.id = u;
      END IF;
    END IF;

    -- ── 7. Impresiones V1: no se reconstruyen (solo V2) ────────────────────
    INSERT INTO private.migration_row_notes (user_id, legacy_table, legacy_id, reason)
    SELECT u, 'question_interactions', q.id::text, 'impressions_v2_only' FROM public.question_interactions q WHERE q.user_id = u
    ON CONFLICT DO NOTHING;

    user_id := u; goals_created := v_goals; daily_rows := v_daily; extra_rows := v_extra; credits := v_credits;
    transfers := v_tr; openings := v_open; opening_amount := v_open_amt; excluded := v_excl; notes := v_notes;
    RETURN NEXT;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION private.v2_backfill(timestamptz, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.v1_slug(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.v1_slug(text) TO app_rpc_owner;
REVOKE ALL ON FUNCTION private.v1_v2_compare(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.v1_v2_compare(uuid) TO app_rpc_owner;
