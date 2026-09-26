-- ============================================================
-- Ahorro Invisible — Migration 004: Temporal traceability for BigQuery
-- Adds updated_at triggers to goals & decisions,
-- and created_at / updated_at to hucha.
-- Enables correct onboarding_completed_at sync via pushLocalDataToSupabase.
-- ============================================================
-- IDEMPOTENT: each section is safe to run multiple times.
--   - Triggers are created only if they do not exist.
--   - Columns are added only if they do not exist.
--   - Backfills run only at column creation time (inside the same DO block).
-- SAFE FOR EXISTING DATA:
--   - decisions.updated_at  → backfilled to created_at (first-write semantics)
--   - hucha.created_at/updated_at → initialised to now() (no historical ts available)
--   - goals.updated_at already existed; only the trigger is new.
-- ============================================================


-- ─── 1. GOALS: trigger automático updated_at ──────────────────────────────────
-- La columna updated_at ya existe desde migration 001.
-- La función public.handle_updated_at() ya existe desde migration 001.
-- Solo añadimos el trigger si aún no existe.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname  = 'goals_updated_at'
      AND tgrelid = 'public.goals'::regclass
  ) THEN
    CREATE TRIGGER goals_updated_at
      BEFORE UPDATE ON public.goals
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

COMMENT ON TRIGGER goals_updated_at ON public.goals IS
  'Actualiza updated_at automáticamente en cada UPDATE. Reutiliza handle_updated_at().';


-- ─── 2. DECISIONS: columna updated_at + backfill seguro + trigger ─────────────
--
-- GARANTÍA DE IDEMPOTENCIA:
--   El bloque DO detecta si la columna ya existe ANTES de añadirla.
--   Si no existe → la crea como nullable, hace el backfill con created_at,
--     y después convierte la columna a NOT NULL con DEFAULT now().
--   Si ya existe → no toca ningún valor existente.
--     Un updated_at legítimamente posterior a created_at se preserva intacto.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'decisions'
      AND column_name  = 'updated_at'
  ) THEN
    -- 1. Añadir como nullable para poder hacer el backfill antes de aplicar NOT NULL
    ALTER TABLE public.decisions
      ADD COLUMN updated_at timestamptz;

    -- 2. Backfill: para registros existentes, updated_at = created_at
    --    (la última modificación conocida es la propia creación del registro)
    UPDATE public.decisions
      SET updated_at = created_at;

    -- 3. Ahora que toda la columna tiene valor, aplicar NOT NULL + DEFAULT
    ALTER TABLE public.decisions
      ALTER COLUMN updated_at SET NOT NULL,
      ALTER COLUMN updated_at SET DEFAULT now();

  END IF;
END;
$$;

-- Trigger idempotente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname  = 'decisions_updated_at'
      AND tgrelid = 'public.decisions'::regclass
  ) THEN
    CREATE TRIGGER decisions_updated_at
      BEFORE UPDATE ON public.decisions
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

COMMENT ON COLUMN public.decisions.updated_at IS
  'Timestamp de última modificación de la fila. '
  'Igual a created_at para inserciones originales (backfill); '
  'actualizado automáticamente por trigger en cada UPDATE posterior.';
COMMENT ON TRIGGER decisions_updated_at ON public.decisions IS
  'Actualiza updated_at automáticamente en cada UPDATE. Reutiliza handle_updated_at().';


-- ─── 3. HUCHA: columnas created_at + updated_at + trigger ─────────────────────
--
-- La tabla hucha tiene user_id como PK (una fila por usuario).
-- No existe ningún timestamp histórico recuperable para registros existentes;
-- ambas columnas se inicializan con now() (momento de la migración).
--
-- GARANTÍA DE IDEMPOTENCIA:
--   Cada columna se añade solo si no existe.
--   Si ya existen, los valores actuales NO se modifican.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'hucha'
      AND column_name  = 'created_at'
  ) THEN
    -- Añadir como nullable, rellenar con now(), luego NOT NULL + DEFAULT
    ALTER TABLE public.hucha
      ADD COLUMN created_at timestamptz;

    UPDATE public.hucha
      SET created_at = now();

    ALTER TABLE public.hucha
      ALTER COLUMN created_at SET NOT NULL,
      ALTER COLUMN created_at SET DEFAULT now();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'hucha'
      AND column_name  = 'updated_at'
  ) THEN
    ALTER TABLE public.hucha
      ADD COLUMN updated_at timestamptz;

    UPDATE public.hucha
      SET updated_at = now();

    ALTER TABLE public.hucha
      ALTER COLUMN updated_at SET NOT NULL,
      ALTER COLUMN updated_at SET DEFAULT now();
  END IF;
END;
$$;

-- Trigger idempotente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname  = 'hucha_updated_at'
      AND tgrelid = 'public.hucha'::regclass
  ) THEN
    CREATE TRIGGER hucha_updated_at
      BEFORE UPDATE ON public.hucha
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

COMMENT ON COLUMN public.hucha.created_at IS
  'Timestamp de creación del registro de hucha del usuario. '
  'Inicializado con now() en migration 004 para registros existentes.';
COMMENT ON COLUMN public.hucha.updated_at IS
  'Timestamp de última actualización del balance o entradas. '
  'Gestionado por trigger; permite resolver conflictos multi-dispositivo '
  'con semántica "la versión más reciente gana".';
COMMENT ON TRIGGER hucha_updated_at ON public.hucha IS
  'Actualiza updated_at automáticamente en cada UPDATE. Reutiliza handle_updated_at().';


-- ─── Verificación post-migración (ejecutar manualmente si se desea) ────────────
-- SELECT tgname, tgrelid::regclass
--   FROM pg_trigger
--   WHERE tgname IN ('goals_updated_at','decisions_updated_at','hucha_updated_at');
--
-- SELECT table_name, column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND table_name   IN ('decisions','hucha')
--     AND column_name  IN ('created_at','updated_at')
--   ORDER BY table_name, column_name;


-- ─── Rollback (ejecutar en SQL Editor si algo falla) ──────────────────────────
-- DROP TRIGGER IF EXISTS goals_updated_at     ON public.goals;
-- DROP TRIGGER IF EXISTS decisions_updated_at ON public.decisions;
-- DROP TRIGGER IF EXISTS hucha_updated_at     ON public.hucha;
-- ALTER TABLE public.decisions DROP COLUMN IF EXISTS updated_at;
-- ALTER TABLE public.hucha     DROP COLUMN IF EXISTS created_at;
-- ALTER TABLE public.hucha     DROP COLUMN IF EXISTS updated_at;
-- NOTE: handle_updated_at() is NOT dropped (shared, existed since migration 001).
-- NOTE: goals.updated_at    is NOT dropped (existed since migration 001).
-- NOTE: decisions.created_at is NOT dropped (existed since migration 001).
