-- ============================================================
-- Ahorro Invisible — Migration 005: question_interactions
-- Versiona la tabla question_interactions que hasta ahora se
-- creaba en runtime a través de POST /api/ai/setup-db.
-- ============================================================
-- IDEMPOTENT: seguro para instalaciones nuevas Y existentes.
--   - CREATE TABLE IF NOT EXISTS → no destruye datos existentes.
--   - updated_at se añade solo si no existe (bloque DO).
--   - Backfill updated_at = created_at solo en la primera ejecución.
--   - Trigger se crea solo si no existe.
--   - Políticas RLS: DROP IF EXISTS + CREATE (idempotentes).
-- SAFE: sin DROP TABLE, sin borrar filas, sin modificar valores funcionales.
-- SOURCE: src/app/api/ai/setup-db/route.ts (SQL_CREATE_TABLE).
-- ============================================================
-- NOTA SOBRE TIPOS DE IDs:
--   question_interactions.id = UUID (gen_random_uuid())
--   A diferencia de goals.id y decisions.id, que son TEXT
--   (generados en cliente como "goal_${Date.now()}" / "dec_${Date.now()}").
--   No hay FK de question_interactions hacia goals o decisions.
-- ============================================================


-- ─── 1. Tabla principal ────────────────────────────────────────────────────────
-- Crea la tabla solo si no existe.
-- Si ya existe (producción), el bloque DO siguiente añade updated_at de forma segura.

CREATE TABLE IF NOT EXISTS public.question_interactions (
  id                     UUID           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                UUID           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id            TEXT           NOT NULL,
  local_date             DATE           NOT NULL,
  time_slot              TEXT           NOT NULL CHECK (time_slot IN ('Mañana', 'Tarde', 'Noche')),
  attempt_number         SMALLINT       NOT NULL DEFAULT 1 CHECK (attempt_number BETWEEN 1 AND 3),
  responded              BOOLEAN        NOT NULL DEFAULT FALSE,
  answer_key             TEXT,                                    -- NULL si no respondió
  saved_amount           NUMERIC(10,2)  NOT NULL DEFAULT 0,
  avatar_dominant        TEXT,                                    -- avatar principal inferido
  avatar_secondary       TEXT,                                    -- avatar secundario (no usado aún)
  avatar_confidence      NUMERIC(3,2)   NOT NULL DEFAULT 0.5,
  ai_decision_type       TEXT           NOT NULL DEFAULT 'select_question',
  ai_decision_reason     TEXT,
  ai_from_model          BOOLEAN        NOT NULL DEFAULT FALSE,   -- TRUE = Gemini respondió
  should_change_question BOOLEAN        NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW()    -- Watermark para BigQuery UPSERT incremental
);

COMMENT ON TABLE public.question_interactions IS
  'Registro de impresiones y respuestas a las preguntas diarias del motor contextual. '
  'Una fila por impresión; se actualiza (responded=true) cuando el usuario responde. '
  'Fuente analítica para BigQuery — incremental UPSERT por id usando updated_at como watermark.';

COMMENT ON COLUMN public.question_interactions.id IS
  'PK UUID generada automáticamente (gen_random_uuid()). '
  'Tipo: UUID — distinto de goals.id y decisions.id que son TEXT generados en cliente.';
COMMENT ON COLUMN public.question_interactions.user_id IS
  'FK → auth.users.id (UUID de Supabase Auth). Nunca email.';
COMMENT ON COLUMN public.question_interactions.local_date IS
  'Fecha en zona Europe/Madrid (YYYY-MM-DD).';
COMMENT ON COLUMN public.question_interactions.time_slot IS
  'Franja horaria: Mañana | Tarde | Noche.';
COMMENT ON COLUMN public.question_interactions.attempt_number IS
  'Número de intento del día (1, 2 ó 3).';
COMMENT ON COLUMN public.question_interactions.responded IS
  'FALSE = solo impresión; TRUE = usuario respondió.';
COMMENT ON COLUMN public.question_interactions.answer_key IS
  'Clave de respuesta seleccionada. NULL si no respondió.';
COMMENT ON COLUMN public.question_interactions.saved_amount IS
  'Euros ahorrados en esta interacción. 0 si no ahorró.';
COMMENT ON COLUMN public.question_interactions.avatar_dominant IS
  'Avatar dominante del usuario en el momento de la impresión.';
COMMENT ON COLUMN public.question_interactions.avatar_confidence IS
  'Confianza [0,1] en la asignación de avatar.';
COMMENT ON COLUMN public.question_interactions.ai_decision_type IS
  'Tipo de decisión del motor de selección.';
COMMENT ON COLUMN public.question_interactions.ai_from_model IS
  'TRUE = decisión por Gemini; FALSE = fallback determinista.';
COMMENT ON COLUMN public.question_interactions.created_at IS
  'Timestamp de creación. Inmutable tras el INSERT.';
COMMENT ON COLUMN public.question_interactions.updated_at IS
  'Timestamp de última modificación. Watermark principal para sincronización '
  'incremental UPSERT con BigQuery (por id). '
  'Actualizado automáticamente por trigger en cada UPDATE.';


-- ─── 2. Añadir updated_at si la tabla YA existe y no tiene la columna ──────────
-- GARANTÍA DE IDEMPOTENCIA:
--   Si la tabla fue creada por migration 005 (primera instalación), la columna
--   ya existe gracias al CREATE TABLE de arriba → este bloque no hace nada.
--   Si la tabla existía previamente (producción via setup-db), la columna no
--   existe → se añade como nullable, se hace backfill con created_at y se
--   convierte a NOT NULL con DEFAULT now(). Los valores existentes se preservan.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'question_interactions'
      AND column_name  = 'updated_at'
  ) THEN
    -- 1. Añadir nullable para poder hacer el backfill sin violar NOT NULL
    ALTER TABLE public.question_interactions
      ADD COLUMN updated_at TIMESTAMPTZ;

    -- 2. Backfill: para registros existentes, updated_at = created_at
    --    (el último cambio conocido es la creación del registro)
    UPDATE public.question_interactions
      SET updated_at = created_at;

    -- 3. Aplicar NOT NULL + DEFAULT ahora que toda la columna tiene valor
    ALTER TABLE public.question_interactions
      ALTER COLUMN updated_at SET NOT NULL,
      ALTER COLUMN updated_at SET DEFAULT NOW();

  END IF;
END;
$$;


-- ─── 3. Trigger automático updated_at ─────────────────────────────────────────
-- Reutiliza public.handle_updated_at() creada en migration 001.
-- Se crea SOLO si no existe (idempotente).
-- Garantiza que PostgreSQL actualiza updated_at en CUALQUIER UPDATE,
-- sin depender de que el cliente lo envíe.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname  = 'question_interactions_updated_at'
      AND tgrelid = 'public.question_interactions'::regclass
  ) THEN
    CREATE TRIGGER question_interactions_updated_at
      BEFORE UPDATE ON public.question_interactions
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

COMMENT ON TRIGGER question_interactions_updated_at ON public.question_interactions IS
  'Actualiza updated_at automáticamente en cada UPDATE. Reutiliza handle_updated_at(). '
  'Garantiza watermark correcto para BigQuery sin depender del cliente.';


-- ─── 4. Índices ────────────────────────────────────────────────────────────────
-- Solo índices justificados por consultas reales del código.

-- getTodayInteractions(): SELECT ... WHERE user_id=? AND local_date=?
CREATE INDEX IF NOT EXISTS idx_qi_user_date
  ON public.question_interactions (user_id, local_date);

-- Consultas de estado: ¿ha respondido el usuario hoy?
CREATE INDEX IF NOT EXISTS idx_qi_user_responded
  ON public.question_interactions (user_id, responded);

-- Análisis de rendimiento por pregunta (analytics, admin)
CREATE INDEX IF NOT EXISTS idx_qi_question_id
  ON public.question_interactions (question_id);

-- Sincronización incremental BigQuery: extraer filas modificadas desde T0
-- Permite: SELECT * FROM question_interactions WHERE updated_at > :last_watermark
CREATE INDEX IF NOT EXISTS idx_qi_updated_at
  ON public.question_interactions (updated_at);

-- NOTA: idx_qi_created_at eliminado — BigQuery usará updated_at como watermark principal.
-- Si se necesitara append-only histórico, agregar: CREATE INDEX IF NOT EXISTS idx_qi_created_at ON ... (created_at);


-- ─── 5. RLS ────────────────────────────────────────────────────────────────────
-- Comportamiento real requerido por el código:
--   - logQuestionImpression:   INSERT server-side vía getSupabase() con SERVICE_ROLE_KEY
--   - logQuestionAnswer:       SELECT + UPDATE server-side vía getSupabase() con SERVICE_ROLE_KEY
--   - getTodayInteractions:    SELECT server-side vía getSupabase() con SERVICE_ROLE_KEY
--
-- IMPORTANTE: getSupabase() usa SUPABASE_SERVICE_ROLE_KEY cuando está disponible.
-- service_role bypassa RLS por defecto en Supabase → las operaciones server-side
-- funcionan correctamente SIN necesitar ninguna policy adicional.
--
-- Las policies de usuario protegen el acceso client-side (anon key + sesión JWT):
--   - SELECT: el usuario solo ve sus propias interacciones.
--   - INSERT: el usuario solo puede insertar en su propio user_id.
--   - UPDATE: el usuario solo puede actualizar sus propias filas.
-- No existe DELETE en el código → no se crea policy DELETE.
-- Anónimos sin sesión: sin acceso (ninguna policy los cubre).
-- Cross-user: imposible (auth.uid() = user_id en cada policy).

ALTER TABLE public.question_interactions ENABLE ROW LEVEL SECURITY;

-- SELECT: usuario autenticado ve solo sus propias interacciones
DROP POLICY IF EXISTS "Users can read own interactions" ON public.question_interactions;
CREATE POLICY "Users can read own interactions"
  ON public.question_interactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT: usuario autenticado solo inserta en su propio user_id
DROP POLICY IF EXISTS "Users can insert own interactions" ON public.question_interactions;
CREATE POLICY "Users can insert own interactions"
  ON public.question_interactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: usuario autenticado solo actualiza sus propias filas
-- WITH CHECK garantiza que no puede cambiar user_id a otro valor
DROP POLICY IF EXISTS "Users can update own interactions" ON public.question_interactions;
CREATE POLICY "Users can update own interactions"
  ON public.question_interactions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy "Service role full access" eliminada intencionalmente:
-- service_role bypassa RLS por defecto → una policy ALL TRUE sería redundante
-- e innecesaria. Principio de mínimo privilegio aplicado.
DROP POLICY IF EXISTS "Service role full access" ON public.question_interactions;


-- ─── Verificación post-migración ───────────────────────────────────────────────
-- Ejecutar en SQL Editor para confirmar el resultado:
--
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'question_interactions'
--   ORDER BY ordinal_position;
--
-- SELECT tgname, tgrelid::regclass
--   FROM pg_trigger
--   WHERE tgname = 'question_interactions_updated_at';
--
-- SELECT indexname FROM pg_indexes WHERE tablename = 'question_interactions';
--
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'question_interactions';
--
-- SELECT COUNT(*) AS total,
--        COUNT(*) FILTER (WHERE updated_at IS NULL) AS updated_at_nulls,
--        COUNT(*) FILTER (WHERE created_at IS NULL) AS created_at_nulls
-- FROM public.question_interactions;


-- ─── Rollback ──────────────────────────────────────────────────────────────────
-- ⚠️  CUIDADO: esto elimina TODOS los datos de question_interactions.
-- Solo ejecutar en entorno de desarrollo o con backup confirmado.
--
-- DROP TRIGGER IF EXISTS question_interactions_updated_at ON public.question_interactions;
-- ALTER TABLE public.question_interactions DROP COLUMN IF EXISTS updated_at;
-- -- Si se quiere eliminar la tabla completa (IRREVERSIBLE):
-- -- DROP TABLE IF EXISTS public.question_interactions CASCADE;
