-- ============================================================
-- Ahorro Invisible — Data Model V2 — 5B.1 — 009 Impresiones, decisiones, ledger, texto libre
-- Spec §4.7–§4.10, §6, §8. ADITIVA. NO migra movimientos V1.
-- Grafo de FKs (hijo → padre), sin ciclos:
--   savings_transactions → daily_decisions → daily_prompt_impressions → cat_daily_questions
--   daily_decisions → goals ; savings_transactions → goals ; user_free_text → decisions|transactions
-- ============================================================

-- ─── 8. daily_prompt_impressions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_prompt_impressions (
  impression_id          uuid        PRIMARY KEY,
  user_id                uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_date             date        NOT NULL,
  shown_at               timestamptz NOT NULL,
  timezone               text        NOT NULL,
  recorded_at            timestamptz NOT NULL DEFAULT now(),
  question_bank_version  text        NOT NULL,
  question_id            text        NOT NULL,
  avatar_used            text        NOT NULL,
  time_slot              text        NOT NULL,
  selection_reason       text        NOT NULL,
  replaces_impression_id uuid,
  first_surface          text        NOT NULL,
  data_origin            text        NOT NULL DEFAULT 'v2_live',
  CONSTRAINT dpi_id_user_uq UNIQUE (impression_id, user_id),
  -- 1 fila por (usuario, día local, pregunta) la primera vez que se muestra
  CONSTRAINT dpi_user_day_question_uq UNIQUE (user_id, local_date, question_bank_version, question_id),
  CONSTRAINT dpi_question_fk FOREIGN KEY (question_bank_version, question_id)
    REFERENCES public.cat_daily_questions (question_bank_version, question_id),
  CONSTRAINT dpi_replaces_fk FOREIGN KEY (replaces_impression_id, user_id)
    REFERENCES public.daily_prompt_impressions (impression_id, user_id),
  CONSTRAINT dpi_avatar_chk CHECK (avatar_used IN ('comodo','social','impulsivo')),
  CONSTRAINT dpi_slot_chk CHECK (time_slot IN ('manana','tarde','noche')),
  CONSTRAINT dpi_reason_chk CHECK (selection_reason IN ('initial','slot_change','shuffle','answered_fallback')),
  CONSTRAINT dpi_surface_chk CHECK (first_surface IN ('dashboard_widget','daily_page')),
  CONSTRAINT dpi_origin_chk CHECK (data_origin = 'v2_live'),
  CONSTRAINT dpi_replaces_chk CHECK (replaces_impression_id IS NULL OR replaces_impression_id <> impression_id),
  CONSTRAINT dpi_initial_chk CHECK (selection_reason <> 'initial' OR replaces_impression_id IS NULL)
);
CREATE INDEX IF NOT EXISTS dpi_user_date_idx ON public.daily_prompt_impressions (user_id, local_date);

-- ─── 6.2 daily_decisions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_decisions (
  decision_id           uuid          PRIMARY KEY,
  legacy_id             text,
  user_id               uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_date            date          NOT NULL,
  occurred_at           timestamptz   NOT NULL,
  timezone              text          NOT NULL,
  recorded_at           timestamptz   NOT NULL DEFAULT now(),
  outcome               text          NOT NULL,
  question_bank_version text,
  question_id           text,
  selected_option_key   text,
  has_custom_text       boolean       NOT NULL DEFAULT false,
  declared_amount       numeric(12,2),
  credit_rule_version   text          NOT NULL DEFAULT 'identity_v1',
  goal_id               text,
  impression_id         uuid,
  surface               text          NOT NULL,
  status                text          NOT NULL DEFAULT 'active',
  voided_at             timestamptz,
  void_reason           text,
  data_origin           text          NOT NULL DEFAULT 'v2_live',
  CONSTRAINT dd_id_user_uq UNIQUE (decision_id, user_id),
  CONSTRAINT dd_goal_fk FOREIGN KEY (goal_id, user_id) REFERENCES public.goals (id, user_id),
  CONSTRAINT dd_impression_fk FOREIGN KEY (impression_id, user_id)
    REFERENCES public.daily_prompt_impressions (impression_id, user_id),
  CONSTRAINT dd_question_fk FOREIGN KEY (question_bank_version, question_id)
    REFERENCES public.cat_daily_questions (question_bank_version, question_id),
  CONSTRAINT dd_outcome_chk CHECK (outcome IN ('saved','zero','grace')),
  CONSTRAINT dd_status_chk CHECK (status IN ('active','voided')),
  CONSTRAINT dd_void_chk CHECK ((status = 'voided') = (voided_at IS NOT NULL AND void_reason IS NOT NULL)),
  CONSTRAINT dd_void_reason_chk CHECK (void_reason IS NULL OR void_reason IN ('user_reset_today','user_deleted_in_history')),
  CONSTRAINT dd_credit_rule_chk CHECK (credit_rule_version IN ('identity_v1','legacy_v1_income_multiplier')),
  CONSTRAINT dd_origin_chk CHECK (data_origin IN ('v2_live','v1_reconstructed','v1_local_import','v1_posthog_reconstructed')),
  CONSTRAINT dd_surface_chk CHECK (surface IN ('onboarding','dashboard_widget','daily_page','goals_page','goal_detail','extra_saving_page','extra_saving_modal','history','profile','settings')),
  CONSTRAINT dd_amount_scale_chk CHECK (declared_amount IS NULL OR (declared_amount >= 0 AND declared_amount <= 100000)),
  CONSTRAINT dd_custom_chk CHECK (has_custom_text = (selected_option_key = '__custom__')),
  -- D1: toda fila V2 usa identity_v1 y respeta outcome ↔ importe/pregunta
  CONSTRAINT dd_v2_shape_chk CHECK (
    data_origin <> 'v2_live' OR (
      credit_rule_version = 'identity_v1' AND
      ((outcome = 'saved' AND declared_amount > 0 AND question_id IS NOT NULL AND selected_option_key IS NOT NULL) OR
       (outcome = 'zero'  AND declared_amount = 0 AND question_id IS NOT NULL AND selected_option_key IS NOT NULL) OR
       (outcome = 'grace' AND declared_amount IS NULL AND question_id IS NULL AND question_bank_version IS NULL
                          AND selected_option_key IS NULL AND goal_id IS NULL AND impression_id IS NULL
                          AND has_custom_text = false)))),
  CONSTRAINT dd_question_pair_chk CHECK ((question_bank_version IS NULL) = (question_id IS NULL))
);
-- 1 fila ACTIVA por usuario y día local
CREATE UNIQUE INDEX IF NOT EXISTS dd_one_active_per_day_uq
  ON public.daily_decisions (user_id, local_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS dd_user_date_idx ON public.daily_decisions (user_id, local_date DESC);
CREATE INDEX IF NOT EXISTS dd_goal_idx ON public.daily_decisions (goal_id, user_id) WHERE goal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS dd_impression_idx ON public.daily_decisions (impression_id) WHERE impression_id IS NOT NULL;

-- ─── 6.3 savings_transactions (LEDGER) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.savings_transactions (
  transaction_id          uuid          PRIMARY KEY,
  user_id                 uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type        text          NOT NULL,
  bucket_type             text          NOT NULL,
  goal_id                 text,
  amount                  numeric(12,2) NOT NULL,
  currency                char(3)       NOT NULL DEFAULT 'EUR',
  decision_id             uuid,
  transfer_group_id       uuid,
  reverses_transaction_id uuid,
  reason                  text          NOT NULL,
  occurred_at             timestamptz   NOT NULL,
  timezone                text          NOT NULL,
  local_date              date          NOT NULL,
  recorded_at             timestamptz   NOT NULL DEFAULT now(),
  surface                 text,
  actor                   text          NOT NULL DEFAULT 'user',
  data_origin             text          NOT NULL DEFAULT 'v2_live',
  legacy_id               text,
  CONSTRAINT st_id_user_uq UNIQUE (transaction_id, user_id),
  CONSTRAINT st_id_user_type_uq UNIQUE (transaction_id, user_id, transaction_type),
  CONSTRAINT st_goal_fk FOREIGN KEY (goal_id, user_id) REFERENCES public.goals (id, user_id),
  CONSTRAINT st_decision_fk FOREIGN KEY (decision_id, user_id) REFERENCES public.daily_decisions (decision_id, user_id),
  CONSTRAINT st_reverses_fk FOREIGN KEY (reverses_transaction_id, user_id)
    REFERENCES public.savings_transactions (transaction_id, user_id),
  CONSTRAINT st_reverses_once_uq UNIQUE (reverses_transaction_id),
  CONSTRAINT st_type_chk CHECK (transaction_type IN ('daily_saving','extra_saving','amendment','reversal','transfer_out','transfer_in','migration_opening_balance')),
  CONSTRAINT st_bucket_chk CHECK (bucket_type IN ('goal','hucha')),
  CONSTRAINT st_bucket_goal_chk CHECK ((bucket_type = 'goal') = (goal_id IS NOT NULL)),
  CONSTRAINT st_amount_nonzero_chk CHECK (amount <> 0 AND abs(amount) <= 100000),
  CONSTRAINT st_sign_chk CHECK (
    (transaction_type IN ('daily_saving','extra_saving','transfer_in','migration_opening_balance') AND amount > 0) OR
    (transaction_type = 'transfer_out' AND amount < 0) OR
    transaction_type IN ('amendment','reversal')),
  CONSTRAINT st_currency_chk CHECK (currency = 'EUR'),
  CONSTRAINT st_decision_rule_chk CHECK (
    (transaction_type <> 'daily_saving' OR decision_id IS NOT NULL) AND
    (transaction_type NOT IN ('extra_saving','transfer_out','transfer_in','migration_opening_balance') OR decision_id IS NULL)),
  CONSTRAINT st_transfer_group_chk CHECK ((transaction_type IN ('transfer_out','transfer_in')) = (transfer_group_id IS NOT NULL)),
  CONSTRAINT st_reversal_ref_chk CHECK ((transaction_type = 'reversal') = (reverses_transaction_id IS NOT NULL)),
  CONSTRAINT st_reason_chk CHECK (reason IN ('user_saving','goal_archived','goal_deleted','manual_hucha_transfer','user_amend','user_void','migration_reconciliation')),
  CONSTRAINT st_reason_type_chk CHECK (
    (transaction_type IN ('daily_saving','extra_saving') AND reason = 'user_saving') OR
    (transaction_type = 'amendment' AND reason = 'user_amend') OR
    (transaction_type = 'reversal' AND reason = 'user_void') OR
    (transaction_type IN ('transfer_out','transfer_in') AND reason IN ('goal_archived','goal_deleted','manual_hucha_transfer')) OR
    (transaction_type = 'migration_opening_balance' AND reason = 'migration_reconciliation')),
  CONSTRAINT st_surface_chk CHECK (surface IS NULL OR surface IN ('onboarding','dashboard_widget','daily_page','goals_page','goal_detail','extra_saving_page','extra_saving_modal','history','profile','settings')),
  CONSTRAINT st_actor_chk CHECK (actor IN ('user','system','migration')),
  CONSTRAINT st_origin_chk CHECK (data_origin IN ('v2_live','v1_reconstructed','v1_local_import','v1_posthog_reconstructed','migration_adjustment')),
  -- CHECK bidireccional (§4.0.1): migration_adjustment ⇔ migration_opening_balance
  CONSTRAINT st_migration_chk CHECK ((data_origin = 'migration_adjustment') = (transaction_type = 'migration_opening_balance')),
  CONSTRAINT st_migration_actor_chk CHECK ((transaction_type = 'migration_opening_balance') = (actor = 'migration'))
);
CREATE INDEX IF NOT EXISTS st_bucket_idx ON public.savings_transactions (user_id, bucket_type, goal_id);
CREATE INDEX IF NOT EXISTS st_user_date_idx ON public.savings_transactions (user_id, local_date DESC);
CREATE INDEX IF NOT EXISTS st_decision_idx ON public.savings_transactions (decision_id, user_id) WHERE decision_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS st_transfer_idx ON public.savings_transactions (transfer_group_id) WHERE transfer_group_id IS NOT NULL;

-- (1) Serialización por usuario + coherencia de reversals — BEFORE INSERT
CREATE OR REPLACE FUNCTION private.st_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE o public.savings_transactions%ROWTYPE;
BEGIN
  PERFORM private.lock_user_ledger(NEW.user_id);   -- idempotente dentro de la transacción (§6.6)
  IF NEW.transaction_type = 'reversal' THEN
    SELECT * INTO o FROM public.savings_transactions
      WHERE transaction_id = NEW.reverses_transaction_id AND user_id = NEW.user_id;
    IF NOT FOUND
       OR o.transaction_type NOT IN ('daily_saving','extra_saving','amendment')
       OR o.bucket_type <> NEW.bucket_type
       OR o.goal_id IS DISTINCT FROM NEW.goal_id
       OR o.amount <> -NEW.amount THEN
      RAISE EXCEPTION 'invalid_reversal' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS st_before_insert_trg ON public.savings_transactions;
CREATE TRIGGER st_before_insert_trg BEFORE INSERT ON public.savings_transactions
  FOR EACH ROW EXECUTE FUNCTION private.st_before_insert();

-- (2) Append-only: sin UPDATE ni DELETE (salvo cascada por baja de cuenta) ni TRUNCATE
DROP TRIGGER IF EXISTS st_immutable_trg ON public.savings_transactions;
CREATE TRIGGER st_immutable_trg BEFORE UPDATE OR DELETE ON public.savings_transactions
  FOR EACH ROW EXECUTE FUNCTION private.forbid_mutation();
CREATE OR REPLACE FUNCTION private.forbid_truncate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$ BEGIN RAISE EXCEPTION 'immutable_table: % no admite TRUNCATE', TG_TABLE_NAME USING ERRCODE = 'P0001'; END $$;
DROP TRIGGER IF EXISTS st_no_truncate_trg ON public.savings_transactions;
CREATE TRIGGER st_no_truncate_trg BEFORE TRUNCATE ON public.savings_transactions
  FOR EACH STATEMENT EXECUTE FUNCTION private.forbid_truncate();

-- (3) Red de seguridad: saldo de cada bucket afectado >= 0 en el COMMIT (§6.6 punto 4)
CREATE OR REPLACE FUNCTION private.st_check_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_bal numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_bal FROM public.savings_transactions
   WHERE user_id = NEW.user_id AND bucket_type = NEW.bucket_type
     AND goal_id IS NOT DISTINCT FROM NEW.goal_id;
  IF v_bal < 0 THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001',
      DETAIL = pg_catalog.format('bucket=%s goal=%s balance=%s', NEW.bucket_type, COALESCE(NEW.goal_id, '-'), v_bal);
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS st_balance_ctrg ON public.savings_transactions;
CREATE CONSTRAINT TRIGGER st_balance_ctrg AFTER INSERT ON public.savings_transactions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.st_check_balance();

-- (4) Transferencias de dos asientos que suman 0 (diferido al COMMIT)
CREATE OR REPLACE FUNCTION private.st_check_transfer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_n int; v_sum numeric; v_out int; v_in int;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(amount), 0),
         COUNT(*) FILTER (WHERE transaction_type = 'transfer_out'),
         COUNT(*) FILTER (WHERE transaction_type = 'transfer_in')
    INTO v_n, v_sum, v_out, v_in
    FROM public.savings_transactions
   WHERE transfer_group_id = NEW.transfer_group_id AND user_id = NEW.user_id;
  IF v_n <> 2 OR v_sum <> 0 OR v_out <> 1 OR v_in <> 1 THEN
    RAISE EXCEPTION 'invalid_transfer: el grupo % debe tener 2 asientos (out+in) que sumen 0', NEW.transfer_group_id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS st_transfer_ctrg ON public.savings_transactions;
CREATE CONSTRAINT TRIGGER st_transfer_ctrg AFTER INSERT ON public.savings_transactions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  WHEN (NEW.transaction_type IN ('transfer_out','transfer_in'))
  EXECUTE FUNCTION private.st_check_transfer();

-- ─── daily_decisions: inmutable salvo la transición active → voided ───────────
CREATE OR REPLACE FUNCTION private.dd_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.pg_trigger_depth() > 1 THEN
      RETURN OLD; -- cascada RI por baja de cuenta
    END IF;
    RAISE EXCEPTION 'immutable_table: daily_decisions no admite DELETE' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.status = 'voided' THEN
    RAISE EXCEPTION 'immutable_table: decisión ya anulada' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.status <> 'voided'
     OR (to_jsonb(NEW) - 'status' - 'voided_at' - 'void_reason')
        IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'voided_at' - 'void_reason') THEN
    RAISE EXCEPTION 'immutable_table: daily_decisions solo admite la transición active→voided' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS dd_guard_trg ON public.daily_decisions;
CREATE TRIGGER dd_guard_trg BEFORE UPDATE OR DELETE ON public.daily_decisions
  FOR EACH ROW EXECUTE FUNCTION private.dd_guard();

DROP TRIGGER IF EXISTS dpi_immutable_trg ON public.daily_prompt_impressions;
CREATE TRIGGER dpi_immutable_trg BEFORE UPDATE OR DELETE ON public.daily_prompt_impressions
  FOR EACH ROW EXECUTE FUNCTION private.forbid_mutation();

-- ─── 4.10 user_free_text (texto libre aislado) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_free_text (
  free_text_id      uuid        PRIMARY KEY,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind              text        NOT NULL,
  decision_id       uuid,
  transaction_id    uuid,
  required_txn_type text GENERATED ALWAYS AS (CASE WHEN transaction_id IS NOT NULL THEN 'extra_saving' END) STORED,
  text              text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uft_kind_chk CHECK (kind IN ('decision_custom_option','extra_saving_note')),
  CONSTRAINT uft_text_len_chk CHECK (char_length(text) BETWEEN 1 AND 200),
  CONSTRAINT uft_decision_fk FOREIGN KEY (decision_id, user_id)
    REFERENCES public.daily_decisions (decision_id, user_id),
  CONSTRAINT uft_transaction_fk FOREIGN KEY (transaction_id, user_id, required_txn_type)
    REFERENCES public.savings_transactions (transaction_id, user_id, transaction_type),
  CONSTRAINT uft_one_ref_chk CHECK (
    (kind = 'decision_custom_option' AND decision_id IS NOT NULL AND transaction_id IS NULL) OR
    (kind = 'extra_saving_note'      AND transaction_id IS NOT NULL AND decision_id IS NULL)),
  CONSTRAINT uft_decision_uq UNIQUE (decision_id),
  CONSTRAINT uft_transaction_uq UNIQUE (transaction_id)
);
DROP TRIGGER IF EXISTS uft_immutable_trg ON public.user_free_text;
CREATE TRIGGER uft_immutable_trg BEFORE UPDATE OR DELETE ON public.user_free_text
  FOR EACH ROW EXECUTE FUNCTION private.forbid_mutation();
