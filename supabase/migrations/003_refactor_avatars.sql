-- ─── Migration 003: Refactoring avatares v2 (sept 2026) ──────────────────────
-- Elimina el avatar 'desordenado' de la base de datos.
-- Los usuarios con ese avatar se reasignan a 'impulsivo' (más próximo comportamentalmente).
-- El valor original se conserva en avatar_legacy para referencia histórica.
--
-- EJECUTAR EN: Supabase SQL Editor (Dashboard > SQL)
-- SEGURO: No elimina ningún dato de usuario, solo remapea el campo avatar.

-- 1. Añadir columna avatar al perfil (si no existe — para nuevos esquemas)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar text;

-- 2. Si el avatar no tiene columna propia, rellenamos desde money_feeling como fallback
--    (por si la columna avatar se guardaba solo en localStorage)
-- NOTA: Si tu esquema ya tiene 'avatar', este UPDATE solo afecta a desordenado.

-- 3. Guardar el avatar original antes de migrar
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_legacy text;

UPDATE public.user_profiles
  SET avatar_legacy = avatar
  WHERE avatar = 'desordenado';

-- 4. Reasignar 'desordenado' → 'impulsivo'
UPDATE public.user_profiles
  SET avatar = 'impulsivo'
  WHERE avatar = 'desordenado';

-- 5. Verificar resultado
SELECT
  avatar,
  avatar_legacy,
  count(*) as total
FROM public.user_profiles
GROUP BY avatar, avatar_legacy
ORDER BY avatar;

-- ─── Comentarios de documentación ─────────────────────────────────────────────
COMMENT ON COLUMN public.user_profiles.avatar IS
  'Avatar de comportamiento del usuario: comodo | social | impulsivo';

COMMENT ON COLUMN public.user_profiles.avatar_legacy IS
  'Avatar original antes de la migración v2 (sept 2026). Conservado para referencia histórica.';
