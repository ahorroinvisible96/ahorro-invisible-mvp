-- ============================================================
-- Ahorro Invisible — Data Model V2 — 5B.1 — 007 Perfil, onboarding, ingresos
-- Spec §4.1–§4.4, §5. ADITIVA. Idempotente.
-- ============================================================

-- ─── 4.1 user_profiles (ALTER) ────────────────────────────────────────────────
-- Las columnas legacy (income_range, money_feeling, onboarding_completed_at, streak_*,
-- *_saved, *_count, last_active_at) se MANTIENEN: la app V1 las usa. DEPRECATE → DROP LATER.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS locale   text,
  ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'EUR';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_currency_chk') THEN
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_currency_chk CHECK (currency = 'EUR');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_timezone_len_chk') THEN
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_timezone_len_chk
      CHECK (timezone IS NULL OR (length(timezone) BETWEEN 1 AND 64));
  END IF;
END $$;

-- ─── 4.2 onboarding_sessions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_sessions (
  onboarding_session_id        uuid          PRIMARY KEY,
  user_id                      uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_number               int           NOT NULL,
  flow_version                 text          NOT NULL,
  started_at                   timestamptz   NOT NULL,
  started_timezone             text          NOT NULL,
  started_local_date           date          NOT NULL,
  completed_at                 timestamptz,
  completed_timezone           text,
  completed_local_date         date,
  savings_habit                text,
  recommendation_rule_version  text,
  income_band_catalog_version  text,
  rec_reference_income_amount  numeric(12,2),
  rec_savings_rate_pct         numeric(5,2),
  rec_monthly_floor_amount     numeric(12,2),
  rec_horizon_months           int,
  recommended_monthly_amount   numeric(12,2),
  recommended_target_amount    numeric(12,2),
  chosen_target_amount         numeric(12,2),
  chosen_horizon_months        int,
  warning_shown                text,
  client_app_version           text,
  data_origin                  text          NOT NULL DEFAULT 'v2_live',
  legacy_id                    text,
  recorded_at                  timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_sessions_id_user_uq UNIQUE (onboarding_session_id, user_id),
  CONSTRAINT onboarding_sessions_attempt_uq UNIQUE (user_id, attempt_number),
  CONSTRAINT onboarding_sessions_attempt_chk CHECK (attempt_number >= 1),
  CONSTRAINT onboarding_sessions_flow_chk CHECK (flow_version = 'onb_5steps_v1'),
  CONSTRAINT onboarding_sessions_habit_chk CHECK (savings_habit IS NULL OR savings_habit IN ('nunca','algo','suelo','bastante')),
  CONSTRAINT onboarding_sessions_horizon_chk CHECK (
    (rec_horizon_months IS NULL OR rec_horizon_months IN (1,2,3,6,12)) AND
    (chosen_horizon_months IS NULL OR chosen_horizon_months IN (1,2,3,6,12))),
  CONSTRAINT onboarding_sessions_warning_chk CHECK (warning_shown IS NULL OR warning_shown IN ('none','over_recommendation','over_30pct_reference_income')),
  CONSTRAINT onboarding_sessions_amounts_chk CHECK (
    (chosen_target_amount IS NULL OR (chosen_target_amount > 0 AND chosen_target_amount <= 100000)) AND
    (recommended_target_amount IS NULL OR recommended_target_amount > 0) AND
    (recommended_monthly_amount IS NULL OR recommended_monthly_amount > 0)),
  CONSTRAINT onboarding_sessions_origin_chk CHECK (data_origin IN ('v2_live','v1_reconstructed','v1_local_import','v1_posthog_reconstructed','migration_adjustment') AND data_origin <> 'migration_adjustment'),
  CONSTRAINT onboarding_sessions_complete_chk CHECK (
    completed_at IS NULL OR (
      completed_timezone IS NOT NULL AND completed_local_date IS NOT NULL AND
      savings_habit IS NOT NULL AND recommendation_rule_version IS NOT NULL AND
      income_band_catalog_version IS NOT NULL AND rec_reference_income_amount IS NOT NULL AND
      rec_savings_rate_pct IS NOT NULL AND rec_monthly_floor_amount IS NOT NULL AND
      rec_horizon_months IS NOT NULL AND recommended_monthly_amount IS NOT NULL AND
      recommended_target_amount IS NOT NULL AND chosen_target_amount IS NOT NULL AND
      chosen_horizon_months IS NOT NULL AND warning_shown IS NOT NULL)),
  CONSTRAINT onboarding_sessions_rule_fk FOREIGN KEY (recommendation_rule_version, savings_habit)
    REFERENCES public.cat_recommendation_rules (rule_version, savings_habit)
);
CREATE INDEX IF NOT EXISTS onboarding_sessions_user_idx ON public.onboarding_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS onboarding_sessions_completed_idx ON public.onboarding_sessions (user_id) WHERE completed_at IS NOT NULL;

-- INSERT al iniciar; un único UPDATE atómico al completar; una sesión completada es inmutable.
CREATE OR REPLACE FUNCTION private.onboarding_sessions_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
      RETURN OLD; -- cascada por eliminación de la cuenta
    END IF;
    RAISE EXCEPTION 'immutable_table: onboarding_sessions no admite DELETE' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'immutable_table: sesión de onboarding completada' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.onboarding_session_id <> OLD.onboarding_session_id OR NEW.user_id <> OLD.user_id
     OR NEW.attempt_number <> OLD.attempt_number OR NEW.flow_version <> OLD.flow_version
     OR NEW.started_at <> OLD.started_at OR NEW.started_timezone <> OLD.started_timezone
     OR NEW.started_local_date <> OLD.started_local_date OR NEW.data_origin <> OLD.data_origin THEN
    RAISE EXCEPTION 'immutable_column en onboarding_sessions' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS onboarding_sessions_guard_trg ON public.onboarding_sessions;
CREATE TRIGGER onboarding_sessions_guard_trg BEFORE UPDATE OR DELETE ON public.onboarding_sessions
  FOR EACH ROW EXECUTE FUNCTION private.onboarding_sessions_guard();

-- ─── 4.3 avatar_assessments + answers ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.avatar_assessments (
  assessment_id          uuid        PRIMARY KEY,
  user_id                uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  questionnaire_key      text        NOT NULL,
  questionnaire_version  text        NOT NULL,
  scoring_version        text        NOT NULL,
  onboarding_session_id  uuid,
  result_avatar          text        NOT NULL,
  scores                 jsonb       NOT NULL,
  completed_at           timestamptz NOT NULL,
  timezone               text        NOT NULL,
  local_date             date        NOT NULL,
  recorded_at            timestamptz NOT NULL DEFAULT now(),
  data_origin            text        NOT NULL DEFAULT 'v2_live',
  CONSTRAINT avatar_assessments_id_user_uq UNIQUE (assessment_id, user_id),
  CONSTRAINT avatar_assessments_session_fk FOREIGN KEY (onboarding_session_id, user_id)
    REFERENCES public.onboarding_sessions (onboarding_session_id, user_id),
  CONSTRAINT avatar_assessments_key_chk CHECK (questionnaire_key IN ('onboarding_avatar','profile_profiling')),
  CONSTRAINT avatar_assessments_avatar_chk CHECK (result_avatar IN ('comodo','social','impulsivo')),
  CONSTRAINT avatar_assessments_scores_chk CHECK (
    jsonb_typeof(scores) = 'object' AND scores ?& ARRAY['comodo','social','impulsivo']
    AND (scores - 'comodo' - 'social' - 'impulsivo') = '{}'::jsonb),
  CONSTRAINT avatar_assessments_session_link_chk CHECK ((questionnaire_key = 'onboarding_avatar') = (onboarding_session_id IS NOT NULL)),
  CONSTRAINT avatar_assessments_origin_chk CHECK (data_origin IN ('v2_live','v1_reconstructed','v1_local_import','v1_posthog_reconstructed') )
);
CREATE INDEX IF NOT EXISTS avatar_assessments_user_idx ON public.avatar_assessments (user_id, questionnaire_key, completed_at DESC);

CREATE TABLE IF NOT EXISTS public.avatar_assessment_answers (
  assessment_id uuid        NOT NULL,
  user_id       uuid        NOT NULL,
  question_key  text        NOT NULL,
  option_key    text        NOT NULL,
  answered_at   timestamptz NOT NULL,
  PRIMARY KEY (assessment_id, question_key),
  CONSTRAINT avatar_answers_assessment_fk FOREIGN KEY (assessment_id, user_id)
    REFERENCES public.avatar_assessments (assessment_id, user_id),
  CONSTRAINT avatar_answers_question_chk CHECK (question_key IN ('onb_q1','onb_q2','onb_q3','P1','P2','P3')),
  CONSTRAINT avatar_answers_option_chk CHECK (option_key IN ('a','b','c'))
);

-- ─── 4.4 income_declarations ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.income_declarations (
  income_declaration_id  uuid        PRIMARY KEY,
  user_id                uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  band_catalog_version   text        NOT NULL,
  income_band_code       text        NOT NULL,
  source                 text        NOT NULL,
  onboarding_session_id  uuid,
  declared_at            timestamptz NOT NULL,
  timezone               text        NOT NULL,
  local_date             date        NOT NULL,
  recorded_at            timestamptz NOT NULL DEFAULT now(),
  data_origin            text        NOT NULL DEFAULT 'v2_live',
  legacy_id              text,
  CONSTRAINT income_declarations_id_user_uq UNIQUE (income_declaration_id, user_id),
  CONSTRAINT income_declarations_band_fk FOREIGN KEY (band_catalog_version, income_band_code)
    REFERENCES public.cat_income_bands (catalog_version, band_code),
  CONSTRAINT income_declarations_session_fk FOREIGN KEY (onboarding_session_id, user_id)
    REFERENCES public.onboarding_sessions (onboarding_session_id, user_id),
  CONSTRAINT income_declarations_source_chk CHECK (source IN ('onboarding','dashboard_widget','profile','migration_v1')),
  CONSTRAINT income_declarations_session_link_chk CHECK ((source = 'onboarding') = (onboarding_session_id IS NOT NULL)),
  CONSTRAINT income_declarations_origin_chk CHECK (data_origin IN ('v2_live','v1_reconstructed','v1_local_import','v1_posthog_reconstructed'))
);
CREATE INDEX IF NOT EXISTS income_declarations_user_idx ON public.income_declarations (user_id, declared_at DESC);

-- Inmutabilidad (append-only) — R11
DROP TRIGGER IF EXISTS avatar_assessments_immutable ON public.avatar_assessments;
CREATE TRIGGER avatar_assessments_immutable BEFORE UPDATE OR DELETE ON public.avatar_assessments
  FOR EACH ROW EXECUTE FUNCTION private.forbid_mutation();
DROP TRIGGER IF EXISTS avatar_answers_immutable ON public.avatar_assessment_answers;
CREATE TRIGGER avatar_answers_immutable BEFORE UPDATE OR DELETE ON public.avatar_assessment_answers
  FOR EACH ROW EXECUTE FUNCTION private.forbid_mutation();
DROP TRIGGER IF EXISTS income_declarations_immutable ON public.income_declarations;
CREATE TRIGGER income_declarations_immutable BEFORE UPDATE OR DELETE ON public.income_declarations
  FOR EACH ROW EXECUTE FUNCTION private.forbid_mutation();
