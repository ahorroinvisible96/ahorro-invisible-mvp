-- ============================================================
-- Ahorro Invisible — Data Model V2 — 5B.1 — 008 goals (ALTER)
-- Spec §7.1. ADITIVA: V1 sigue escribiendo goals sin cambios.
-- Se mantienen current_amount / archived / completed_at (legacy) mientras V1 viva.
--
-- Coexistencia V1/V2 (desviación técnica mínima respecto al diseño, documentada):
--   · data_origin  = PROCEDENCIA (v2_live | v1_reconstructed | ...), inmutable.
--   · ledger_managed = el saldo de este objetivo vive en el ledger V2 y solo se
--     modifica por RPC. DEFAULT false (filas escritas por V1). Las reglas V2
--     (forma, evento obligatorio, escritura solo por RPC) aplican a las filas con
--     ledger_managed = true. 5B.3 lo activará (false → true, una sola vez) al
--     migrar cada objetivo V1 con su opening balance. No hay vuelta atrás.
--   Así las filas V1 existentes no se tocan y los objetivos migrados quedarán
--   igualmente protegidos.
-- ============================================================

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS status                text    NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS final_target_amount   numeric(12,2),
  ADD COLUMN IF NOT EXISTS step_index            int,
  ADD COLUMN IF NOT EXISTS start_date            date,
  ADD COLUMN IF NOT EXISTS first_completed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at           timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at            timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_session_id uuid,
  ADD COLUMN IF NOT EXISTS data_origin           text    NOT NULL DEFAULT 'v1_reconstructed',
  ADD COLUMN IF NOT EXISTS legacy_id             text,
  ADD COLUMN IF NOT EXISTS ledger_managed        boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_id_user_uq') THEN
    ALTER TABLE public.goals ADD CONSTRAINT goals_id_user_uq UNIQUE (id, user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_onboarding_session_fk') THEN
    ALTER TABLE public.goals ADD CONSTRAINT goals_onboarding_session_fk
      FOREIGN KEY (onboarding_session_id, user_id)
      REFERENCES public.onboarding_sessions (onboarding_session_id, user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_status_chk') THEN
    ALTER TABLE public.goals ADD CONSTRAINT goals_status_chk CHECK (status IN ('active','archived','deleted'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_origin_chk') THEN
    ALTER TABLE public.goals ADD CONSTRAINT goals_origin_chk
      CHECK (data_origin IN ('v2_live','v1_reconstructed','v1_local_import','v1_posthog_reconstructed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_v2_live_managed_chk') THEN
    ALTER TABLE public.goals ADD CONSTRAINT goals_v2_live_managed_chk
      CHECK (data_origin <> 'v2_live' OR ledger_managed);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_step_chk') THEN
    ALTER TABLE public.goals ADD CONSTRAINT goals_step_chk CHECK (step_index IS NULL OR step_index >= 0);
  END IF;
  -- Estructura V2 (solo filas ledger_managed)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_v2_shape_chk') THEN
    ALTER TABLE public.goals ADD CONSTRAINT goals_v2_shape_chk CHECK (
      NOT ledger_managed OR (
        target_amount > 0 AND target_amount <= 100000 AND target_amount = round(target_amount, 2)
        AND horizon_months IN (1,2,3,6,12)
        AND start_date IS NOT NULL
        AND source IN ('onboarding','dashboard','goals_page')
        AND (final_target_amount IS NULL OR final_target_amount >= target_amount)
        AND current_amount = 0            -- el saldo vive SOLO en el ledger (sin balances editables)
        AND completed_at IS NULL          -- legacy: la verdad es first_completed_at
        AND (status <> 'archived' OR archived_at IS NOT NULL)
        AND (status <> 'deleted'  OR deleted_at  IS NOT NULL)
        AND (NOT is_primary OR status = 'active')
      ));
  END IF;
END $$;

-- Un único objetivo principal activo por usuario entre los gestionados por el ledger
-- (las 2 cuentas V1 con varios principales se sanearán en 5B.3 antes de ampliarlo).
CREATE UNIQUE INDEX IF NOT EXISTS goals_one_primary_v2_uq
  ON public.goals (user_id) WHERE is_primary AND status = 'active' AND ledger_managed;
CREATE INDEX IF NOT EXISTS goals_user_status_idx ON public.goals (user_id, status);

-- Guardia de filas: compatibilidad V1 (status derivado de archived), write-once e
-- inmutabilidad de columnas estructurales en filas gestionadas.
CREATE OR REPLACE FUNCTION private.goals_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.first_completed_at IS NOT NULL AND NEW.first_completed_at IS DISTINCT FROM OLD.first_completed_at THEN
      RAISE EXCEPTION 'write_once: goals.first_completed_at' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.data_origin <> OLD.data_origin OR NEW.user_id <> OLD.user_id OR NEW.id <> OLD.id THEN
      RAISE EXCEPTION 'immutable_column en goals (id, user_id, data_origin)' USING ERRCODE = 'P0001';
    END IF;
    IF OLD.ledger_managed AND NOT NEW.ledger_managed THEN
      RAISE EXCEPTION 'immutable_column: goals.ledger_managed no puede volver a false' USING ERRCODE = 'P0001';
    END IF;
    IF OLD.ledger_managed AND (
         NEW.source IS DISTINCT FROM OLD.source OR NEW.start_date IS DISTINCT FROM OLD.start_date
         OR NEW.onboarding_session_id IS DISTINCT FROM OLD.onboarding_session_id) THEN
      RAISE EXCEPTION 'immutable_column en goals gestionados (source, start_date, onboarding_session_id)' USING ERRCODE = 'P0001';
    END IF;
    IF OLD.status = 'deleted' AND NEW.status <> 'deleted' THEN
      RAISE EXCEPTION 'goal_not_active: un objetivo borrado no se reactiva' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.ledger_managed THEN
    NEW.archived := (NEW.status <> 'active');          -- compatibilidad con lecturas V1
  ELSE
    -- Filas escritas por V1: status se deriva de archived (una sola verdad: archived)
    NEW.status := CASE WHEN NEW.archived THEN 'archived' ELSE 'active' END;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS goals_guard_trg ON public.goals;
CREATE TRIGGER goals_guard_trg BEFORE INSERT OR UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION private.goals_guard();
