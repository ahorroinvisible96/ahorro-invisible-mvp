-- ============================================================================
-- 019_v1_retirement_rollback.sql — revierte 019 (solo emergencia).
-- Restaura los grants V1 previos. Ejecutar manualmente; no es una migración
-- de avance (no se aplica en la cadena normal).
-- ============================================================================
BEGIN;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.decisions, public.hucha, public.question_interactions, public.goals
  TO anon, authenticated, service_role;
GRANT SELECT ON public.decisions, public.hucha, public.question_interactions TO anon;
COMMENT ON TABLE public.decisions IS NULL;
COMMENT ON TABLE public.hucha IS NULL;
COMMENT ON TABLE public.question_interactions IS NULL;
COMMENT ON TABLE public.goals IS NULL;
COMMIT;
