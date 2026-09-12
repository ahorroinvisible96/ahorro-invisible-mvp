/**
 * update_csv.mjs
 *
 * Transforms the CSV bank file with the new column structure:
 *   - Renames obsolete columns
 *   - Adds "Scoring por opción (JSON)" column with option-level scores for pilot questions
 *   - Adds "IA requerida para Otro" column
 *   - Normalizes "Permite Otro" to true/false
 *   - Keeps monthly/yearly deltas as internal-only (renamed)
 *
 * Usage: node update_csv.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Scoring por opción para las 18 preguntas piloto ───────────────────────────
// Extraído directamente de questionsBankPilot.ts
const PILOT_SCORING = {
  // FILL_BLANK
  Q_P_01: [
    { label: 'me apetece en el momento',      value: 'apetece_momento',  scores: { impulsivo: 2 } },
    { label: 'no quiero perderme el plan',     value: 'fomo_plan',        scores: { social: 2 } },
    { label: 'me resulta más cómodo',          value: 'comodidad',        scores: { comodo: 2 } },
    { label: 'Otro',                           value: 'otro',             scores: null, freeText: true },
  ],
  Q_P_04: [
    { label: 'satisfecho/a, me lo merezco',   value: 'satisfecho',       scores: { impulsivo: 2 } },
    { label: 'culpable o arrepentido/a',       value: 'culpable',         scores: { impulsivo: 3, desordenado: 1 } },
    { label: 'indiferente, ya está hecho',     value: 'indiferente',      scores: { desordenado: 2 } },
    { label: 'Otro',                           value: 'otro',             scores: null, freeText: true },
  ],
  Q_P_07: [
    { label: 'cuánto gasto en comodidad y conveniencia', value: 'comodidad_conveniencia', scores: { comodo: 2 } },
    { label: 'lo que me he gastado saliendo con gente',  value: 'gasto_social',           scores: { social: 2 } },
    { label: 'los gastos pequeños que ni recuerdo',      value: 'gastos_invisibles',      scores: { desordenado: 3 } },
    { label: 'Otro',                                     value: 'otro',                   scores: null, freeText: true },
  ],
  Q_P_10: [
    { label: 'decir que no a más consumiciones o rondas', value: 'no_rondas',    scores: { social: 2 } },
    { label: 'seguir el plan que tenía pensado',          value: 'plan_previo',   scores: { desordenado: 2 } },
    { label: 'no gastar en lo primero que me apetece',   value: 'impulso_social', scores: { impulsivo: 2, social: 1 } },
    { label: 'Otro',                                      value: 'otro',          scores: null, freeText: true },
  ],
  Q_P_13: [
    { label: 'pedir menos delivery y cocinar más',       value: 'menos_delivery',    scores: { comodo: 2 } },
    { label: 'controlar mejor lo que gasto saliendo',   value: 'control_social',    scores: { social: 2 } },
    { label: 'resistir los impulsos de comprar cosas',  value: 'resistir_impulsos', scores: { impulsivo: 2 } },
    { label: 'Otro',                                     value: 'otro',             scores: null, freeText: true },
  ],
  Q_P_16: [
    { label: 'buscar algo cómodo que me relaje',        value: 'buscar_comodidad',  scores: { comodo: 2 } },
    { label: 'quedar con alguien o salir',              value: 'salir_social',      scores: { social: 2 } },
    { label: 'comprarme algo para sentirme mejor',      value: 'compra_emocional',  scores: { impulsivo: 3 } },
    { label: 'Otro',                                    value: 'otro',             scores: null, freeText: true },
  ],
  // CHOICE
  Q_P_02: [
    { label: 'El miedo a perderme algo bueno',           value: 'fomo',          scores: { social: 2 } },
    { label: 'La comodidad de decir que sí sin pensar',  value: 'comodidad_si',  scores: { comodo: 2 } },
    { label: 'El momento me pide celebrar o gastar',     value: 'impulso_momento', scores: { impulsivo: 2 } },
    { label: 'Otro',                                     value: 'otro',          scores: null, freeText: true },
  ],
  Q_P_05: [
    { label: 'La pereza y las ganas de comodidad',       value: 'pereza_comodidad', scores: { comodo: 2 } },
    { label: 'Que no tengo nada planificado',            value: 'sin_plan',        scores: { desordenado: 2 } },
    { label: 'Me apetece ese momento y ya',              value: 'apetece_ahora',   scores: { impulsivo: 2 } },
    { label: 'Otro',                                     value: 'otro',            scores: null, freeText: true },
  ],
  Q_P_08: [
    { label: 'Lo compro si el precio me parece razonable',         value: 'compra_precio',    scores: { impulsivo: 2 } },
    { label: 'Lo apunto y espero unos días antes de decidir',      value: 'esperar_dias',     scores: { desordenado: 1, comodo: 1 } },
    { label: 'Lo compro si estoy con alguien que también lo haría', value: 'influencia_social', scores: { social: 2, impulsivo: 1 } },
    { label: 'Otro',                                               value: 'otro',             scores: null, freeText: true },
  ],
  Q_P_11: [
    { label: 'Gasto y ya veré cómo va el mes',                         value: 'sin_control',        scores: { desordenado: 2 } },
    { label: 'Gasto en lo que me resulta fácil y cómodo, sin pensar', value: 'comodidad_automatica', scores: { comodo: 2 } },
    { label: 'Gasto según lo que me pide el momento',                 value: 'gasto_momento',       scores: { impulsivo: 2 } },
    { label: 'Otro',                                                  value: 'otro',                scores: null, freeText: true },
  ],
  Q_P_14: [
    { label: 'Digo que sí aunque me pase del presupuesto',         value: 'si_sin_limite',  scores: { social: 3 } },
    { label: 'Me apunto porque en ese momento me parece buena idea', value: 'impulso_grupo', scores: { impulsivo: 2, social: 1 } },
    { label: 'Propongo algo más barato o ajustado',                 value: 'propongo_barato', scores: { comodo: 2 } },
    { label: 'Otro',                                               value: 'otro',            scores: null, freeText: true },
  ],
  Q_P_17: [
    { label: 'Algo tranquilo, sin sorpresas y a mi ritmo',           value: 'plan_tranquilo', scores: { comodo: 2 } },
    { label: 'Un plan con gente, aunque cueste más de lo esperado',  value: 'plan_gente',     scores: { social: 2 } },
    { label: 'Lo que surja, improvisando sobre la marcha',           value: 'plan_impro',     scores: { desordenado: 2 } },
    { label: 'Otro',                                                 value: 'otro',           scores: null, freeText: true },
  ],
  // AMOUNT — sin scoring por opción (importe libre)
  Q_P_03: null,
  Q_P_06: null,
  Q_P_09: null,
  Q_P_12: null,
  Q_P_15: null,
  Q_P_18: null,
};

// ── CSV helpers ───────────────────────────────────────────────────────────────

/**
 * Minimal CSV parser that handles quoted fields (including escaped quotes "").
 */
function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
  return lines.map(line => {
    const fields = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuote) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') { inQuote = false; }
        else { cur += c; }
      } else {
        if (c === '"') { inQuote = true; }
        else if (c === ',') { fields.push(cur); cur = ''; }
        else { cur += c; }
      }
    }
    fields.push(cur);
    return fields;
  });
}

/**
 * Escapes a field for CSV output.
 * Wraps in quotes if it contains comma, newline or double-quote.
 */
function escapeField(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function rowToCSV(fields) {
  return fields.map(escapeField).join(',');
}

// ── Transformación ────────────────────────────────────────────────────────────

const INPUT_FILE  = join(__dirname, 'definitivoPlantilla_Banco_Preguntas_AhorroInvisible.csv');
const OUTPUT_FILE = join(__dirname, 'definitivoPlantilla_Banco_Preguntas_AhorroInvisible.csv');

const raw = readFileSync(INPUT_FILE, 'utf8');
const rows = parseCSV(raw);

if (rows.length < 2) {
  console.error('CSV vacío o sin datos. Abortando.');
  process.exit(1);
}

const oldHeaders = rows[0];
console.log('Columnas originales:', oldHeaders.join(' | '));

// ── Mapa de columnas antiguas → índices ─────────────────────────────────────
function colIdx(name) {
  const i = oldHeaders.findIndex(h => h.trim() === name.trim());
  if (i === -1) console.warn(`  ⚠ Columna no encontrada: "${name}"`);
  return i;
}

const COL = {
  ID:          colIdx('ID'),
  Formato:     colIdx('Formato'),
  Estado:      colIdx('Estado'),
  Texto:       colIdx('Texto de la pregunta'),
  Categoria:   colIdx('Categoría de hábito'),
  AvatarPrim:  colIdx('Avatar primario'),
  AvatarSec:   colIdx('Avatar secundario'),
  Opciones:    colIdx('Opciones (opción [avatar+pts])'),
  PermiteOtro: colIdx('Permite "Otro"'),
  UmbralIA:    colIdx('Umbral IA'),
  Importe:     colIdx('Importe sugerido (€)'),
  Mensual:     colIdx('∆ Mensual (€)'),
  Anual:       colIdx('∆ Anual (€)'),
  Impacto:     colIdx('Impacto visible'),
  MejorDia:    colIdx('Mejor día'),
  MejorFranja: colIdx('Mejor franja'),
  FaseMes:     colIdx('Fase del mes'),
  Cooldown:    colIdx('Cooldown (días)'),
  Priority:    colIdx('Priority base'),
  Scenario:    colIdx('Scenario weight'),
  Intent:      colIdx('Intent (técnico)'),
  Habit:       colIdx('Habit principle'),
  Tono:        colIdx('Tono'),
  Dificultad:  colIdx('Dificultad'),
};

// ── Nuevas cabeceras ─────────────────────────────────────────────────────────
const NEW_HEADERS = [
  'ID',
  'Formato',
  'Estado',
  'Texto de la pregunta',
  'Categoría de hábito',
  'Avatar primario',
  'Avatar secundario',
  'Opciones (opción [avatar+pts])',
  'Scoring por opción (JSON)',     // NUEVO
  'Permite Otro',                  // Normalizado
  'IA requerida para Otro',        // NUEVO
  'Umbral confianza IA',           // Renombrado
  'Placeholder Importe (€)',       // Renombrado
  'Ahorro mensual interno (€)',    // Renombrado (interno)
  'Ahorro anual interno (€)',      // Renombrado (interno)
  'Impacto interno (no visible)',  // Renombrado
  'Mejor día',
  'Mejor franja',
  'Fase del mes',
  'Cooldown (días)',
  'Priority base',
  'Scenario weight',
  'Intent (técnico)',
  'Habit principle',
  'Tono',
  'Dificultad',
];

// ── Normalizar "Permite Otro" ────────────────────────────────────────────────
function normalizePermiteOtro(raw) {
  const v = (raw || '').toLowerCase().trim();
  if (v.startsWith('sí') || v.startsWith('si') || v === 'true') return 'true';
  return 'false';
}

function normalizeIARequerida(rawPermite) {
  // Si el campo original era "Sí (IA)", entonces IA requerida = true
  const v = (rawPermite || '').toLowerCase().trim();
  return v.includes('ia') ? 'true' : 'false';
}

// ── Formatear scoring JSON ───────────────────────────────────────────────────
function formatScoring(id) {
  const scoring = PILOT_SCORING[id];
  if (!scoring) return '';
  return JSON.stringify(scoring.map(opt => ({
    label:    opt.label,
    value:    opt.value,
    scores:   opt.scores,
    ...(opt.freeText ? { freeText: true } : {}),
  })));
}

// ── Transformar filas ────────────────────────────────────────────────────────
const dataRows = rows.slice(1);
const outputRows = [NEW_HEADERS];

let transformed = 0;
for (const row of dataRows) {
  function get(idx) { return idx !== -1 ? (row[idx] ?? '') : ''; }

  const id = get(COL.ID);
  const formato = get(COL.Formato);
  const rawPermiteOtro = get(COL.PermiteOtro);

  const newRow = [
    id,
    formato,
    get(COL.Estado),
    get(COL.Texto),
    get(COL.Categoria),
    get(COL.AvatarPrim),
    get(COL.AvatarSec),
    get(COL.Opciones),
    formatScoring(id),                        // Scoring por opción (JSON)
    normalizePermiteOtro(rawPermiteOtro),     // Permite Otro
    normalizeIARequerida(rawPermiteOtro),     // IA requerida para Otro
    get(COL.UmbralIA),                         // Umbral confianza IA
    get(COL.Importe),                          // Placeholder Importe (€)
    get(COL.Mensual),                          // Ahorro mensual interno
    get(COL.Anual),                            // Ahorro anual interno
    get(COL.Impacto),                          // Impacto interno
    get(COL.MejorDia),
    get(COL.MejorFranja),
    get(COL.FaseMes),
    get(COL.Cooldown),
    get(COL.Priority),
    get(COL.Scenario),
    get(COL.Intent),
    get(COL.Habit),
    get(COL.Tono),
    get(COL.Dificultad),
  ];

  outputRows.push(newRow);
  if (PILOT_SCORING[id] !== undefined) {
    transformed++;
    console.log(`  ✓ Scoring añadido para ${id}`);
  }
}

// ── Escribir CSV ─────────────────────────────────────────────────────────────
const csvContent = outputRows.map(rowToCSV).join('\r\n');
writeFileSync(OUTPUT_FILE, '\uFEFF' + csvContent, 'utf8'); // BOM para Excel español

console.log(`\n✅ CSV actualizado: ${OUTPUT_FILE}`);
console.log(`   Filas procesadas: ${dataRows.length}`);
console.log(`   Preguntas con scoring: ${transformed}`);
console.log(`   Columnas nuevas: ${NEW_HEADERS.length} (antes: ${oldHeaders.length})`);
