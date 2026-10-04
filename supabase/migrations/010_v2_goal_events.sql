-- ============================================================
-- Ahorro Invisible — Data Model V2 — 5B.1 — 010 goal_events + guardia anti-bypass
-- Spec §7.2–§7.4. ADITIVA.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.goal_events (
  goal_event_id            uuid          PRIMARY KEY,
  user_id                  uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id                  text          NOT NULL,
  event_type               text          NOT NULL,
  cause                    text          NOT NULL,
  completion_sequence      int,
  target_amount_before     numeric(12,2),
  target_amount_after      numeric(12,2),
  horizon_months_before    int,
  horizon_months_after     int,
  title_changed            boolean       NOT NULL DEFAULT false,
  balance_destination_type text,
  destination_goal_id      text,
  balance_moved_amount     numeric(12,2),
  realism_is_unrealistic   boolean,
  realism_suggested_target numeric(12,2),
  realism_suggested_horizon int,
  accepted_step            boolean,
  related_transaction_id   uuid,
  balance_at_event         numeric(12,2),
  private_changes          jsonb,                       -- texto libre: NUNCA exportable
  occurred_at              timestamptz   NOT NULL,
  timezone                 text          NOT NULL,
  local_date               date          NOT NULL,
  recorded_at              timestamptz   NOT NULL DEFAULT now(),
  surface                  text,
  tx_id                    bigint        NOT NULL DEFAULT txid_current(),
  data_origin              text          NOT NULL DEFAULT 'v2_live',
  CONSTRAINT ge_goal_fk FOREIGN KEY (goal_id, user_id) REFERENCES public.goals (id, user_id),
  CONSTRAINT ge_dest_goal_fk FOREIGN KEY (destination_goal_id, user_id) REFERENCES public.goals (id, user_id),
  CONSTRAINT ge_txn_fk FOREIGN KEY (related_transaction_id, user_id)
    REFERENCES public.savings_transactions (transaction_id, user_id),
  CONSTRAINT ge_type_chk CHECK (event_type IN ('created','updated','primary_set','primary_unset','archived','reactivated','completed','completion_reverted','deleted')),
  CONSTRAINT ge_cause_chk CHECK (cause IN ('user_action','auto_primary_reassignment','ledger_threshold','target_changed','reactivated_state','migration')),
  CONSTRAINT ge_sequence_chk CHECK (
    (event_type IN ('completed','completion_reverted')) = (completion_sequence IS NOT NULL)
    AND (completion_sequence IS NULL OR completion_sequence >= 1)),
  CONSTRAINT ge_dest_type_chk CHECK (balance_destination_type IS NULL OR balance_destination_type IN ('hucha','goal','none')),
  CONSTRAINT ge_dest_consistency_chk CHECK (
    (balance_destination_type = 'goal') = (destination_goal_id IS NOT NULL)
    AND (destination_goal_id IS NULL OR balance_destination_type IS NOT NULL)),
  CONSTRAINT ge_dest_event_chk CHECK (balance_destination_type IS NULL OR event_type IN ('archived','deleted')),
  CONSTRAINT ge_moved_chk CHECK (balance_moved_amount IS NULL OR balance_moved_amount >= 0),
  CONSTRAINT ge_horizon_chk CHECK (
    (horizon_months_before IS NULL OR horizon_months_before IN (1,2,3,6,12)) AND
    (horizon_months_after  IS NULL OR horizon_months_after  IN (1,2,3,6,12))),
  CONSTRAINT ge_surface_chk CHECK (surface IS NULL OR surface IN ('onboarding','dashboard_widget','daily_page','goals_page','goal_detail','extra_saving_page','extra_saving_modal','history','profile','settings')),
  CONSTRAINT ge_origin_chk CHECK (data_origin IN ('v2_live','v1_reconstructed','v1_local_import','v1_posthog_reconstructed')),
  CONSTRAINT ge_private_chk CHECK (private_changes IS NULL OR jsonb_typeof(private_changes) = 'object')
);
CREATE INDEX IF NOT EXISTS ge_goal_idx ON public.goal_events (goal_id, user_id, occurred_at);
CREATE INDEX IF NOT EXISTS ge_user_idx ON public.goal_events (user_id, local_date DESC);
CREATE INDEX IF NOT EXISTS ge_tx_idx ON public.goal_events (goal_id, tx_id);
-- Un completado/reversión por número de ciclo (idempotencia estructural del histórico)
CREATE UNIQUE INDEX IF NOT EXISTS ge_completion_seq_uq
  ON public.goal_events (goal_id, user_id, event_type, completion_sequence)
  WHERE completion_sequence IS NOT NULL;

DROP TRIGGER IF EXISTS ge_immutable_trg ON public.goal_events;
CREATE TRIGGER ge_immutable_trg BEFORE UPDATE OR DELETE ON public.goal_events
  FOR EACH ROW EXECUTE FUNCTION private.forbid_mutation();

-- ─── 7.4 Guardia anti-bypass (H14) ────────────────────────────────────────────
-- Un INSERT/UPDATE de una fila goals gestionada por el ledger sin su goal_events en la MISMA transacción
-- aborta en el COMMIT. Solo filas v2_live: la app V1 sigue escribiendo goals sin eventos
-- hasta que 5B.4/5B.7 retiren su escritura directa.
CREATE OR REPLACE FUNCTION private.goals_require_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.goal_events
                    WHERE goal_id = NEW.id AND user_id = NEW.user_id
                      AND tx_id = pg_catalog.txid_current() AND event_type = 'created') THEN
      RAISE EXCEPTION 'goals_require_event: INSERT de goal sin goal_events(created) en la misma transacción'
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.goal_events
                    WHERE goal_id = NEW.id AND user_id = NEW.user_id
                      AND tx_id = pg_catalog.txid_current()) THEN
      RAISE EXCEPTION 'goals_require_event: UPDATE de goal sin goal_events en la misma transacción'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS goals_require_event_ctrg ON public.goals;
CREATE CONSTRAINT TRIGGER goals_require_event_ctrg AFTER INSERT OR UPDATE ON public.goals
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  WHEN (NEW.ledger_managed)
  EXECUTE FUNCTION private.goals_require_event();
