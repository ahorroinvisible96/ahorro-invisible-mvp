/**
 * POST /api/ai/analyze-signal
 *
 * Analiza una respuesta de texto libre ("Otro") para detectar señal de avatar.
 *
 * Input:  { text: string, questionContext: string }
 * Output: { avatar: AvatarKey | null, confidence: number, weight: number }
 *
 * Si el texto es ambiguo/sin sentido, devuelve avatar: null.
 * Toda la lógica es interna y nunca se muestra al usuario.
 */

import { NextResponse } from 'next/server';
import { getGemini, getModelName, isAIEnabled } from '@/services/geminiService';

const SYSTEM_PROMPT = `Eres un analizador de señales psicológicas para una app de ahorro.

Tu tarea es interpretar una respuesta de texto libre del usuario para detectar afinidad con uno de estos 4 perfiles de comportamiento financiero (avatares):

- "comodo": Busca comodidad, evita esfuerzo, prefiere lo seguro y rutinario.
- "social": Se mueve por relaciones, planes con gente, presión social.
- "impulsivo": Actúa rápido, busca novedad, se deja llevar por emociones.
- "desordenado": No planifica, le da igual, improvisa, pierde control de gastos.

REGLAS:
1. Si la respuesta es clara y encaja con un avatar → devuelve ese avatar con confianza alta.
2. Si la respuesta podría encajar con 2 avatares → devuelve el más probable con confianza media.
3. Si la respuesta es ambigua, genérica, sin sentido, aleatoria o no interpretable → devuelve null.
4. NUNCA fuerces una clasificación si no hay señal clara.
5. Responde SOLO con JSON válido, sin markdown ni texto extra.

Schema de respuesta:
{
  "avatar": "comodo" | "social" | "impulsivo" | "desordenado" | null,
  "confidence": number entre 0 y 1,
  "weight": number entre 1 y 3,
  "reasoning": "string breve con tu razonamiento (interno, no se muestra)"
}`;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { text?: string; questionContext?: string };
    const text = body.text?.trim();
    const questionContext = body.questionContext ?? '';

    if (!text || text.length < 2) {
      return NextResponse.json({ avatar: null, confidence: 0, weight: 0 });
    }

    // Si IA no está habilitada, devolver null
    if (!isAIEnabled()) {
      return NextResponse.json({ avatar: null, confidence: 0, weight: 0 });
    }

    const gemini = getGemini();
    const model = gemini.getGenerativeModel({ model: getModelName() });

    const userPrompt = `Pregunta que estaba respondiendo el usuario: "${questionContext}"

Respuesta libre del usuario: "${text}"

Analiza esta respuesta y determina si aporta una señal válida hacia algún avatar. Responde SOLO con JSON.`;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }] },
      ],
    });

    const responseText = result.response.text().trim();

    // Limpiar posible markdown wrapping
    const cleaned = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned) as {
      avatar: string | null;
      confidence: number;
      weight: number;
    };

    // Validar avatar
    const validAvatars = ['comodo', 'social', 'impulsivo', 'desordenado'];
    if (parsed.avatar && !validAvatars.includes(parsed.avatar)) {
      return NextResponse.json({ avatar: null, confidence: 0, weight: 0 });
    }

    // Validar confianza mínima
    if (parsed.confidence < 0.3) {
      return NextResponse.json({ avatar: null, confidence: 0, weight: 0 });
    }

    return NextResponse.json({
      avatar: parsed.avatar,
      confidence: Math.min(parsed.confidence, 1),
      weight: Math.min(Math.max(parsed.weight ?? 2, 1), 3),
    });
  } catch (err) {
    console.error('[api/ai/analyze-signal] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ avatar: null, confidence: 0, weight: 0 });
  }
}
