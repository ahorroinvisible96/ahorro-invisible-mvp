-- ============================================================
-- Ahorro Invisible — Data Model V2 — 5B.1 — 006 Fundamentos
-- Spec: data_model_v2_design.md v1.0 (congelada) §4.0.1, §6.7, §9
-- ADITIVA y NO destructiva respecto a V1. Idempotente.
-- Contenido: rol propietario de RPCs, schema private, helpers de
-- tiempo/zona, trigger de inmutabilidad y catálogos cat_*.
-- ============================================================

-- ─── Rol propietario de las funciones SECURITY DEFINER (R8) ───────────────────
-- Sin login, sin superusuario. Propietario de las tablas V2 y de las RPC.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rpc_owner') THEN
    CREATE ROLE app_rpc_owner NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END $$;

-- Quien aplica la migración debe poder asignar propietario (ALTER ... OWNER TO).
DO $$
BEGIN
  EXECUTE format('GRANT app_rpc_owner TO %I', current_user);
EXCEPTION WHEN OTHERS THEN
  NULL; -- ya miembro / superusuario
END $$;

GRANT USAGE ON SCHEMA public TO app_rpc_owner;
GRANT USAGE ON SCHEMA auth   TO app_rpc_owner;
GRANT EXECUTE ON FUNCTION auth.uid() TO app_rpc_owner;
-- Las FKs a auth.users se crean con el rol que aplica la migración; el propietario
-- solo necesita poder leer para validar referencias en tiempo de ejecución.
GRANT REFERENCES, SELECT ON auth.users TO app_rpc_owner;

-- ─── Schema private: helpers NO expuestos por PostgREST (R9) ──────────────────
CREATE SCHEMA IF NOT EXISTS private;
ALTER SCHEMA private OWNER TO app_rpc_owner;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO app_rpc_owner;

-- ─── Helpers ──────────────────────────────────────────────────────────────────

-- R1: usuario autenticado o error estable.
CREATE OR REPLACE FUNCTION private.current_uid()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v uuid := auth.uid();
BEGIN
  IF v IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;
  RETURN v;
END $$;

-- Zona horaria válida (nombres de pg_timezone_names).
CREATE OR REPLACE FUNCTION private.validate_timezone(p_tz text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_tz IS NULL OR pg_catalog.length(p_tz) = 0 OR pg_catalog.length(p_tz) > 64
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_tz) THEN
    RAISE EXCEPTION 'invalid_timezone' USING ERRCODE = 'P0001';
  END IF;
END $$;

-- Día local (§9): (occurred_at AT TIME ZONE tz)::date. Pura e inmutable por zona.
CREATE OR REPLACE FUNCTION private.compute_local_date(p_occurred_at timestamptz, p_tz text)
RETURNS date LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT (p_occurred_at AT TIME ZONE p_tz)::date $$;

-- R7: valida ventana (-72 h / +5 min) y zona; devuelve local_date calculado en servidor.
CREATE OR REPLACE FUNCTION private.resolve_local_date(p_occurred_at timestamptz, p_tz text)
RETURNS date LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_occurred_at IS NULL THEN
    RAISE EXCEPTION 'invalid_argument: occurred_at' USING ERRCODE = 'P0001';
  END IF;
  PERFORM private.validate_timezone(p_tz);
  IF p_occurred_at > pg_catalog.now() + interval '5 minutes'
     OR p_occurred_at < pg_catalog.now() - interval '72 hours' THEN
    RAISE EXCEPTION 'out_of_time_window' USING ERRCODE = 'P0001';
  END IF;
  RETURN private.compute_local_date(p_occurred_at, p_tz);
END $$;

-- R3: importe positivo, <= 100.000 y máximo 2 decimales.
CREATE OR REPLACE FUNCTION private.validate_amount(p_amount numeric, p_allow_zero boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
BEGIN
  IF p_amount IS NULL
     OR p_amount > 100000
     OR p_amount <> pg_catalog.round(p_amount, 2)
     OR (p_allow_zero AND p_amount < 0)
     OR (NOT p_allow_zero AND p_amount <= 0) THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = 'P0001';
  END IF;
END $$;

-- Lock transaccional por usuario (§6.6): punto único de serialización del ledger.
CREATE OR REPLACE FUNCTION private.lock_user_ledger(p_user_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$ SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ledger:' || p_user_id::text, 0)) $$;

-- R11: inmutabilidad (BEFORE UPDATE OR DELETE → error).
CREATE OR REPLACE FUNCTION private.forbid_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid;
BEGIN
  -- Excepción única: borrado en cascada por eliminación de la cuenta (supresión de datos).
  IF TG_OP = 'DELETE' THEN
    v_uid := (pg_catalog.to_jsonb(OLD) ->> 'user_id')::uuid;
    IF v_uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid) THEN
      RETURN OLD;
    END IF;
  END IF;
  RAISE EXCEPTION 'immutable_table: % no admite % (append-only)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'P0001';
END $$;

-- Idempotencia uniforme (R4): clave de mutación del cliente por (usuario, RPC).
-- start_onboarding y complete_onboarding comparten el id de sesión, de ahí rpc_name en la PK.
CREATE TABLE IF NOT EXISTS private.idempotency_keys (
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key          uuid        NOT NULL,
  rpc_name     text        NOT NULL,
  payload_hash text        NOT NULL,
  result       jsonb       NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key, rpc_name)
);
ALTER TABLE private.idempotency_keys OWNER TO app_rpc_owner;
REVOKE ALL ON private.idempotency_keys FROM PUBLIC, anon, authenticated;

-- Devuelve el resultado almacenado (replay), NULL si es nueva, o lanza idempotency_conflict.
CREATE OR REPLACE FUNCTION private.idem_check(p_user_id uuid, p_key uuid, p_rpc text, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE r private.idempotency_keys%ROWTYPE;
BEGIN
  IF p_key IS NULL THEN
    RAISE EXCEPTION 'invalid_argument: idempotency key' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO r FROM private.idempotency_keys WHERE user_id = p_user_id AND key = p_key AND rpc_name = p_rpc;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF r.payload_hash <> pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_payload::text, 'UTF8')), 'hex') THEN
    RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = 'P0001';
  END IF;
  RETURN r.result || jsonb_build_object('idempotent_replay', true);
END $$;

CREATE OR REPLACE FUNCTION private.idem_store(p_user_id uuid, p_key uuid, p_rpc text, p_payload jsonb, p_result jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO private.idempotency_keys(user_id, key, rpc_name, payload_hash, result)
  VALUES (p_user_id, p_key, p_rpc,
          pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_payload::text, 'UTF8')), 'hex'),
          p_result);
  RETURN p_result;
END $$;

-- ─── Catálogos (solo lectura para la app; se escriben por migración) ──────────

CREATE TABLE IF NOT EXISTS public.cat_income_bands (
  catalog_version         text          NOT NULL,
  band_code               text          NOT NULL,
  lower_bound             numeric(12,2) NOT NULL,
  upper_bound             numeric(12,2),
  reference_income_amount numeric(12,2) NOT NULL,
  reference_method        text          NOT NULL,
  PRIMARY KEY (catalog_version, band_code),
  CONSTRAINT cat_income_bands_code_chk CHECK (band_code IN ('lt_1000','1000_1500','1500_2000','2000_2500','2500_3000','gt_3000')),
  CONSTRAINT cat_income_bands_method_chk CHECK (reference_method IN ('midpoint','open_band_lower_bound')),
  CONSTRAINT cat_income_bands_bounds_chk CHECK (upper_bound IS NULL OR upper_bound > lower_bound),
  CONSTRAINT cat_income_bands_ref_chk CHECK (reference_income_amount > 0)
);

CREATE TABLE IF NOT EXISTS public.cat_recommendation_rules (
  rule_version                text          NOT NULL,
  savings_habit               text          NOT NULL,
  savings_rate_pct            numeric(5,2)  NOT NULL,
  monthly_floor_amount        numeric(12,2) NOT NULL,
  income_band_catalog_version text          NOT NULL,
  formula                     text          NOT NULL,
  published_at                timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (rule_version, savings_habit),
  CONSTRAINT cat_rec_rules_habit_chk CHECK (savings_habit IN ('nunca','algo','suelo','bastante')),
  CONSTRAINT cat_rec_rules_rate_chk CHECK (savings_rate_pct > 0 AND savings_rate_pct <= 100),
  CONSTRAINT cat_rec_rules_floor_chk CHECK (monthly_floor_amount > 0)
);
-- Las reglas referencian el catálogo de tramos por versión (no hay FK compuesta posible
-- porque la versión es un atributo del catálogo, no una fila): se valida por trigger.
CREATE OR REPLACE FUNCTION private.cat_rec_rules_check_catalog()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cat_income_bands WHERE catalog_version = NEW.income_band_catalog_version) THEN
    RAISE EXCEPTION 'unknown income_band_catalog_version %', NEW.income_band_catalog_version USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cat_rec_rules_catalog_trg ON public.cat_recommendation_rules;
CREATE TRIGGER cat_rec_rules_catalog_trg BEFORE INSERT OR UPDATE ON public.cat_recommendation_rules
  FOR EACH ROW EXECUTE FUNCTION private.cat_rec_rules_check_catalog();

CREATE TABLE IF NOT EXISTS public.cat_daily_questions (
  question_bank_version text  NOT NULL,
  question_id           text  NOT NULL,
  avatar                text  NOT NULL,
  time_slot             text  NOT NULL,
  text_template         text  NOT NULL,
  options               jsonb NOT NULL,
  PRIMARY KEY (question_bank_version, question_id),
  CONSTRAINT cat_daily_questions_avatar_chk CHECK (avatar IN ('comodo','social','impulsivo')),
  CONSTRAINT cat_daily_questions_slot_chk CHECK (time_slot IN ('manana','tarde','noche')),
  CONSTRAINT cat_daily_questions_options_chk CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) >= 1)
);

-- Catálogo de tramos income_ref_v1 (§4.4)
INSERT INTO public.cat_income_bands
  (catalog_version, band_code, lower_bound, upper_bound, reference_income_amount, reference_method)
VALUES
  ('income_ref_v1','lt_1000',        0, 1000,  500, 'midpoint'),
  ('income_ref_v1','1000_1500',   1000, 1500, 1250, 'midpoint'),
  ('income_ref_v1','1500_2000',   1500, 2000, 1750, 'midpoint'),
  ('income_ref_v1','2000_2500',   2000, 2500, 2250, 'midpoint'),
  ('income_ref_v1','2500_3000',   2500, 3000, 2750, 'midpoint'),
  ('income_ref_v1','gt_3000',     3000, NULL, 3000, 'open_band_lower_bound')
ON CONFLICT (catalog_version, band_code) DO NOTHING;

-- Reglas de recomendación rec_v1 (§4.4.1)
INSERT INTO public.cat_recommendation_rules
  (rule_version, savings_habit, savings_rate_pct, monthly_floor_amount, income_band_catalog_version, formula)
VALUES
  ('rec_v1','nunca',    5, 50, 'income_ref_v1', 'max(floor, round(reference_income x pct/100)) x horizon'),
  ('rec_v1','algo',    10, 50, 'income_ref_v1', 'max(floor, round(reference_income x pct/100)) x horizon'),
  ('rec_v1','suelo',   15, 50, 'income_ref_v1', 'max(floor, round(reference_income x pct/100)) x horizon'),
  ('rec_v1','bastante',20, 50, 'income_ref_v1', 'max(floor, round(reference_income x pct/100)) x horizon')
ON CONFLICT (rule_version, savings_habit) DO NOTHING;

-- Catálogos inmutables ("una versión publicada no se modifica")
DROP TRIGGER IF EXISTS cat_income_bands_immutable ON public.cat_income_bands;
CREATE TRIGGER cat_income_bands_immutable BEFORE UPDATE OR DELETE ON public.cat_income_bands
  FOR EACH ROW EXECUTE FUNCTION private.forbid_mutation();
DROP TRIGGER IF EXISTS cat_rec_rules_immutable ON public.cat_recommendation_rules;
CREATE TRIGGER cat_rec_rules_immutable BEFORE UPDATE OR DELETE ON public.cat_recommendation_rules
  FOR EACH ROW EXECUTE FUNCTION private.forbid_mutation();
DROP TRIGGER IF EXISTS cat_daily_questions_immutable ON public.cat_daily_questions;
CREATE TRIGGER cat_daily_questions_immutable BEFORE UPDATE OR DELETE ON public.cat_daily_questions
  FOR EACH ROW EXECUTE FUNCTION private.forbid_mutation();

-- Propietario y permisos de catálogos: lectura para authenticated; escritura solo por migración.
ALTER TABLE public.cat_income_bands         OWNER TO app_rpc_owner;
ALTER TABLE public.cat_recommendation_rules OWNER TO app_rpc_owner;
ALTER TABLE public.cat_daily_questions      OWNER TO app_rpc_owner;
REVOKE ALL ON public.cat_income_bands, public.cat_recommendation_rules, public.cat_daily_questions
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cat_income_bands, public.cat_recommendation_rules, public.cat_daily_questions
  TO authenticated;
