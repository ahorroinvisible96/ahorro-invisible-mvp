-- ============================================================
-- Ahorro Invisible — Migration 005: question_interactions
-- Versiona la tabla question_interactions que hasta ahora se
-- creaba en runtime a través de POST /api/ai/setup-db.
-- ============================================================
-- IDEMPOTENT: usa CREATE TABLE IF NOT EXISTS y CREATE INDEX IF NOT EXISTS.
-- SAFE: no borra datos, no hace DROP TABLE, no modifica filas existentes.
-- SOURCE: esquema extraído de src/app/api/ai/setup-db/route.ts (SQL_CREATE_TABLE).
-- ============================================================

-- ─── 1. Tabla principal ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.question_interactions (
  id                     UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id            TEXT        NOT NULL,
  local_date             DATE        NOT NULL,
  time_slot              TEXT        NOT NULL CHECK (time_slot IN ('Mañana', 'Tarde', 'Noche')),
  attempt_number         SMALLINT    NOT NULL DEFAULT 1 CHECK (attempt_number BETWEEN 1 AND 3),
  responded              BOOLEAN     NOT NULL DEFAULT FALSE,
  answer_key             TEXT,                               -- NULL si no respondió
  saved_amount           NUMERIC(10,2) NOT NULL DEFAULT 0,
  avatar_dominant        TEXT,                               -- avatar principal inferido
  avatar_secondary       TEXT,                               -- avatar secundario (no usado aún)
  avatar_confidence      NUMERIC(3,2) NOT NULL DEFAULT 0.5,
  ai_decision_type       TEXT        NOT NULL DEFAULT 'select_question',
  ai_decision_reason     TEXT,
  ai_from_model          BOOLEAN     NOT NULL DEFAULT FALSE,  -- TRUE = Gemini respondió
  should_change_question BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.question_interactions IS
  'Registro de impresiones y respuestas a las preguntas diarias del motor contextual. '
  'Una fila por impresión; se actualiza (responded=true) cuando el usuario responde. '
  'Fuente analítica para BigQuery — incremental por created_at.';

COMMENT ON COLUMN public.question_interactions.id IS 'PK UUID generada automáticamente.';
COMMENT ON COLUMN public.question_interactions.user_id IS 'FK → auth.users.id (UUID de Supabase Auth). Nunca email.';
COMMENT ON COLUMN public.question_interactions.local_date IS 'Fecha en zona Europe/Madrid (YYYY-MM-DD).';
COMMENT ON COLUMN public.question_interactions.time_slot IS 'Franja horaria: Mañana | Tarde | Noche.';
COMMENT ON COLUMN public.question_interactions.attempt_number IS 'Número de intento del día (1, 2 ó 3).';
COMMENT ON COLUMN public.question_interactions.responded IS 'FALSE = solo impresión; TRUE = usuario respondió.';
COMMENT ON COLUMN public.question_interactions.answer_key IS 'Clave de respuesta seleccionada. NULL si no respondió.';
COMMENT ON COLUMN public.question_interactions.saved_amount IS 'Euros ahorrados en esta interacción. 0 si no ahorró.';
COMMENT ON COLUMN public.question_interactions.avatar_dominant IS 'Avatar dominante del usuario en el momento de la impresión.';
COMMENT ON COLUMN public.question_interactions.avatar_confidence IS 'Confianza [0,1] en la asignación de avatar.';
COMMENT ON COLUMN public.question_interactions.ai_decision_type IS 'Tipo de decisión del motor de selección.';
COMMENT ON COLUMN public.question_interactions.ai_from_model IS 'TRUE = decisión por Gemini; FALSE = fallback determinista.';
COMMENT ON COLUMN public.question_interactions.created_at IS 'Timestamp de creación. Clave para sincronización incremental con BigQuery.';


-- ─── 2. Índices ────────────────────────────────────────────────────────────────

-- Consulta más frecuente: interacciones del usuario en una fecha dada
CREATE INDEX IF NOT EXISTS idx_qi_user_date
  ON public.question_interactions (user_id, local_date);

-- Consulta de respuestas del usuario
CREATE INDEX IF NOT EXISTS idx_qi_user_responded
  ON public.question_interactions (user_id, responded);

-- Consulta por pregunta (para análisis de rendimiento de preguntas)
CREATE INDEX IF NOT EXISTS idx_qi_question_id
  ON public.question_interactions (question_id);

-- Índice para sincronización incremental BigQuery (por timestamp de creación)
CREATE INDEX IF NOT EXISTS idx_qi_created_at
  ON public.question_interactions (created_at);


-- ─── 3. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.question_interactions ENABLE ROW LEVEL SECURITY;

-- Política: usuarios leen solo sus propias interacciones
DROP POLICY IF EXISTS "Users can read own interactions" ON public.question_interactions;
CREATE POLICY "Users can read own interactions"
  ON public.question_interactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: usuarios insertan solo en su propio user_id
DROP POLICY IF EXISTS "Users can insert own interactions" ON public.question_interactions;
CREATE POLICY "Users can insert own interactions"
  ON public.question_interactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: usuarios actualizan solo sus propias filas
DROP POLICY IF EXISTS "Users can update own interactions" ON public.question_interactions;
CREATE POLICY "Users can update own interactions"
  ON public.question_interactions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Política: service role tiene acceso total (necesario para sincronización BigQuery)
DROP POLICY IF EXISTS "Service role full access" ON public.question_interactions;
CREATE POLICY "Service role full access"
  ON public.question_interactions
  FOR ALL
  USING (true)
  WITH CHECK (true);


-- ─── Verificación post-migración ───────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'question_interactions'
--   ORDER BY ordinal_position;
--
-- SELECT indexname, indexdef
--   FROM pg_indexes
--   WHERE tablename = 'question_interactions';
--
-- SELECT policyname, cmd, qual
--   FROM pg_policies
--   WHERE tablename = 'question_interactions';


-- ─── Rollback ──────────────────────────────────────────────────────────────────
-- ⚠️  CUIDADO: esto elimina todos los datos de question_interactions.
-- Solo ejecutar en entorno de desarrollo o si se ha confirmado backup previo.
--
-- DROP TABLE IF EXISTS public.question_interactions CASCADE;
