-- SOLO STAGING / TESTS. Replica la deriva real de producción respecto a las migraciones V1 del repo
-- (detectada en 5B.2.5 comparando el catálogo de prod vs 001+002+004+005). NO se aplica en producción.
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
ALTER TABLE public.goals ALTER COLUMN source SET DEFAULT 'dashboard';
ALTER TABLE public.question_interactions DROP CONSTRAINT IF EXISTS question_interactions_attempt_number_check;
ALTER TABLE public.question_interactions DROP CONSTRAINT IF EXISTS question_interactions_time_slot_check;
ALTER TABLE public.question_interactions ADD CONSTRAINT question_interactions_time_slot_check
  CHECK (time_slot = ANY (ARRAY['Madrugada', 'Ma' || chr(241) || 'ana', 'Tarde', 'Noche']));
DROP POLICY IF EXISTS "Users insert own" ON public.question_interactions;
DROP POLICY IF EXISTS "Users read own" ON public.question_interactions;
DROP POLICY IF EXISTS "Users update own" ON public.question_interactions;
CREATE POLICY "Users insert own" ON public.question_interactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own" ON public.question_interactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own" ON public.question_interactions FOR UPDATE USING (auth.uid() = user_id);
