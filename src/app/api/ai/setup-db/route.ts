/**
 * POST /api/ai/setup-db
 *
 * RETIRADO (Data Model V2, Fase 5B.7).
 * Antes creaba la tabla V1 `question_interactions` vía exec_sql sin
 * autenticación de llamante. El schema se gestiona exclusivamente con
 * migraciones versionadas (supabase/migrations) y la tabla V1 está congelada.
 */

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'gone', message: 'Endpoint retirado: el schema se gestiona con migraciones (Data Model V2).' },
    { status: 410 },
  );
}
