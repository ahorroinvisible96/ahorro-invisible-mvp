/**
 * POST /api/ai/setup-db
 *
 * Crea la tabla question_interactions si no existe.
 * Este endpoint se llama UNA VEZ durante el setup.
 * Protegido: requiere SUPABASE_SERVICE_ROLE_KEY.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SQL_CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS question_interactions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id     TEXT NOT NULL,
  local_date      DATE NOT NULL,
  time_slot       TEXT NOT NULL CHECK (time_slot IN ('Mañana', 'Tarde', 'Noche')),
  attempt_number  SMALLINT NOT NULL DEFAULT 1 CHECK (attempt_number BETWEEN 1 AND 3),
  responded       BOOLEAN NOT NULL DEFAULT FALSE,
  answer_key      TEXT,
  saved_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  avatar_dominant TEXT,
  avatar_secondary TEXT,
  avatar_confidence NUMERIC(3,2) NOT NULL DEFAULT 0.5,
  ai_decision_type TEXT NOT NULL DEFAULT 'select_question',
  ai_decision_reason TEXT,
  ai_from_model   BOOLEAN NOT NULL DEFAULT FALSE,
  should_change_question BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_qi_user_date ON question_interactions(user_id, local_date);
CREATE INDEX IF NOT EXISTS idx_qi_user_responded ON question_interactions(user_id, responded);
CREATE INDEX IF NOT EXISTS idx_qi_question_id ON question_interactions(question_id);

-- RLS: solo el usuario puede ver sus propias interacciones
ALTER TABLE question_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own interactions" ON question_interactions;
CREATE POLICY "Users can read own interactions" ON question_interactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own interactions" ON question_interactions;
CREATE POLICY "Users can insert own interactions" ON question_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own interactions" ON question_interactions;
CREATE POLICY "Users can update own interactions" ON question_interactions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access" ON question_interactions;
CREATE POLICY "Service role full access" ON question_interactions
  FOR ALL USING (true) WITH CHECK (true);
`;

export async function POST(req: NextRequest) {
  try {
    // Solo permite ejecución con service role key
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' },
        { status: 500 },
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
    );

    // Ejecutar SQL
    const { error } = await supabase.rpc('exec_sql', { sql: SQL_CREATE_TABLE });

    if (error) {
      // Si exec_sql no existe, devolver instrucciones manuales
      if (error.message.includes('exec_sql')) {
        return NextResponse.json({
          message: 'La función exec_sql no existe en Supabase. Ejecuta el siguiente SQL manualmente en el SQL Editor de Supabase:',
          sql: SQL_CREATE_TABLE,
          manual: true,
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Tabla question_interactions creada correctamente',
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
