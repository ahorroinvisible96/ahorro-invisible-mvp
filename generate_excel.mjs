/**
 * generate_excel.mjs
 *
 * Genera ExcellPlantilla_Banco_Preguntas_AhorroInvisible.xlsx
 * desde el CSV definitivo con la nueva estructura de columnas.
 *
 * Hojas:
 *   1. "Banco Piloto"        — Q_P_01 … Q_P_18 (18 preguntas activas para test)
 *   2. "Banco Completo"      — Todas las preguntas ACTIVO (excepto Q_P y Q_CT)
 *   3. "Constructor (Inactivo)" — Q_CT_01 … Q_CT_15 (inactivas, solo historial)
 *
 * Ejecutar: node generate_excel.mjs
 * Requiere: npm install exceljs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CSV parser ────────────────────────────────────────────────────────────────
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

// ── Leer CSV fuente ───────────────────────────────────────────────────────────
const csvPath = join(__dirname, 'definitivoPlantilla_Banco_Preguntas_AhorroInvisible.csv');
let rawCSV = readFileSync(csvPath, 'utf8');
// Quitar BOM si existe
if (rawCSV.charCodeAt(0) === 0xFEFF) rawCSV = rawCSV.slice(1);

const rows = parseCSV(rawCSV);
const headers = rows[0];
const dataRows = rows.slice(1);

// Crear objetos con cada fila
const allQuestions = dataRows.map(row => {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
  return obj;
});

// ── Clasificar preguntas ──────────────────────────────────────────────────────
const pilotQuestions    = allQuestions.filter(q => q['ID'].startsWith('Q_P_'));
const constructorQs     = allQuestions.filter(q => q['ID'].startsWith('Q_CT_'));
const fullBankQuestions = allQuestions.filter(q =>
  !q['ID'].startsWith('Q_P_') && !q['ID'].startsWith('Q_CT_')
);

console.log(`📊 Preguntas cargadas:`);
console.log(`   Banco piloto:         ${pilotQuestions.length}`);
console.log(`   Banco completo:       ${fullBankQuestions.length}`);
console.log(`   Constructor (inact.): ${constructorQs.length}`);

// ── Colores por formato ───────────────────────────────────────────────────────
const FORMAT_COLORS = {
  fill_blank: { bg: 'FFE8F4FD', font: 'FF1E6B99' },  // Azul suave
  choice:     { bg: 'FFF0F9F0', font: 'FF1A7A1A' },  // Verde suave
  amount:     { bg: 'FFFEF9E7', font: 'FF8A6A00' },  // Amarillo suave
};

const ESTADO_COLORS = {
  ACTIVO:   'FF27AE60',
  INACTIVO: 'FFBDC3C7',
};

// ── Estilo de cabecera ────────────────────────────────────────────────────────
function applyHeaderStyle(row) {
  row.height = 36;
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF3949AB' } },
    };
  });
}

// ── Aplicar estilo a fila de dato ─────────────────────────────────────────────
function applyDataStyle(row, formato, isEven) {
  const colors = FORMAT_COLORS[formato] || { bg: isEven ? 'FFF5F5F5' : 'FFFFFFFF', font: 'FF333333' };
  const bgColor = isEven
    ? (formato ? adjustAlpha(colors.bg, 'E8') : 'FFF5F5F5')
    : (formato ? colors.bg : 'FFFFFFFF');

  row.height = 28;
  row.eachCell((cell, colNumber) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.font = { size: 9, name: 'Calibri', color: { argb: 'FF222222' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
    };
  });
}

function adjustAlpha(hex, alpha) {
  return alpha + hex.slice(2);
}

// ── Columnas de la hoja (con anchos optimizados) ──────────────────────────────
const COLUMNS = [
  { key: 'ID',                          header: 'ID',                         width: 10  },
  { key: 'Formato',                     header: 'Formato',                    width: 12  },
  { key: 'Estado',                      header: 'Estado',                     width: 10  },
  { key: 'Texto de la pregunta',        header: 'Texto de la pregunta',       width: 55  },
  { key: 'Categoría de hábito',         header: 'Categoría de hábito',        width: 22  },
  { key: 'Avatar primario',             header: 'Avatar primario',            width: 14  },
  { key: 'Avatar secundario',           header: 'Avatar secundario',          width: 14  },
  { key: 'Opciones (opción [avatar+pts])', header: 'Opciones',               width: 55  },
  { key: 'Scoring por opción (JSON)',   header: 'Scoring JSON (interno)',      width: 40  },
  { key: 'Permite Otro',               header: 'Permite Otro',               width: 12  },
  { key: 'IA requerida para Otro',     header: 'IA Otro',                    width: 10  },
  { key: 'Umbral confianza IA',        header: 'Umbral IA',                  width: 10  },
  { key: 'Placeholder Importe (€)',    header: 'Ref. Importe (€)',           width: 14  },
  { key: 'Ahorro mensual interno (€)', header: 'Ahorro/mes interno (€)',     width: 16  },
  { key: 'Ahorro anual interno (€)',   header: 'Ahorro/año interno (€)',     width: 16  },
  { key: 'Impacto interno (no visible)', header: 'Impacto interno',          width: 40  },
  { key: 'Mejor día',                  header: 'Mejor día',                  width: 28  },
  { key: 'Mejor franja',               header: 'Mejor franja',               width: 12  },
  { key: 'Fase del mes',               header: 'Fase del mes',               width: 12  },
  { key: 'Cooldown (días)',             header: 'Cooldown',                   width: 10  },
  { key: 'Priority base',              header: 'Priority',                   width: 10  },
  { key: 'Scenario weight',            header: 'Scenario W',                 width: 10  },
  { key: 'Intent (técnico)',           header: 'Intent',                     width: 22  },
  { key: 'Habit principle',            header: 'Habit P',                    width: 12  },
  { key: 'Tono',                       header: 'Tono',                       width: 14  },
  { key: 'Dificultad',                 header: 'Dificultad',                 width: 12  },
];

// ── Crear hoja ────────────────────────────────────────────────────────────────
function buildSheet(workbook, sheetName, questions, sheetColor) {
  const sheet = workbook.addWorksheet(sheetName, {
    properties: { tabColor: { argb: sheetColor } },
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  // ── Fila título ──────────────────────────────────────────────────────────
  sheet.mergeCells(1, 1, 1, COLUMNS.length);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `AhorroInvisible — ${sheetName} · ${questions.length} preguntas`;
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sheetColor } };
  titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 30;

  // ── Columnas ─────────────────────────────────────────────────────────────
  sheet.columns = COLUMNS.map(c => ({ ...c, header: '' }));

  // ── Cabeceras ─────────────────────────────────────────────────────────────
  const headerRow = sheet.getRow(2);
  COLUMNS.forEach((c, i) => { headerRow.getCell(i + 1).value = c.header; });
  applyHeaderStyle(headerRow);

  // ── Datos ─────────────────────────────────────────────────────────────────
  questions.forEach((q, rowIdx) => {
    const excelRow = sheet.addRow(COLUMNS.map(c => q[c.key] ?? ''));
    applyDataStyle(excelRow, q['Formato'], rowIdx % 2 === 0);

    // Colorear celda "Estado"
    const estadoCell = excelRow.getCell(3); // columna Estado
    const estadoColor = ESTADO_COLORS[q['Estado']] || 'FF888888';
    estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: estadoColor + '33' } };
    estadoCell.font = { bold: true, size: 9, color: { argb: estadoColor }, name: 'Calibri' };
    estadoCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Colorear celda "Formato"
    const formatoCell = excelRow.getCell(2);
    const fmtColors = FORMAT_COLORS[q['Formato']];
    if (fmtColors) {
      formatoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fmtColors.bg } };
      formatoCell.font = { bold: true, size: 9, color: { argb: fmtColors.font }, name: 'Calibri' };
      formatoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // Colorear avatar primario
    const avatarCell = excelRow.getCell(6);
    const AVATAR_COLORS = {
      comodo:      { bg: 'FFFFF3CD', font: 'FF856404' },
      social:      { bg: 'FFD1ECF1', font: 'FF0C5460' },
      impulsivo:   { bg: 'FFF8D7DA', font: 'FF721C24' },
      desordenado: { bg: 'FFE2D9F3', font: 'FF4A1E6E' },
    };
    const aColors = AVATAR_COLORS[q['Avatar primario']];
    if (aColors) {
      avatarCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: aColors.bg } };
      avatarCell.font = { bold: true, size: 9, color: { argb: aColors.font }, name: 'Calibri' };
      avatarCell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  // ── Auto filter en fila de cabeceras ──────────────────────────────────────
  sheet.autoFilter = {
    from: { row: 2, column: 1 },
    to:   { row: 2 + questions.length, column: COLUMNS.length },
  };

  // ── Notas de cabeceras clave ──────────────────────────────────────────────
  const internalCols = [9, 14, 15, 16]; // Scoring JSON, ahorro mensual, anual, impacto
  internalCols.forEach(col => {
    const cell = sheet.getRow(2).getCell(col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF37474F' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9, name: 'Calibri' };
    cell.note = { texts: [{ text: '⚠️ DATO INTERNO — nunca visible al usuario' }] };
  });

  return sheet;
}

// ── Hoja de leyenda ───────────────────────────────────────────────────────────
function buildLegendSheet(workbook) {
  const sheet = workbook.addWorksheet('📖 Leyenda', {
    properties: { tabColor: { argb: 'FF607D8B' } },
  });

  sheet.mergeCells('A1:F1');
  const title = sheet.getCell('A1');
  title.value = 'AhorroInvisible — Leyenda del banco de preguntas';
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF263238' } };
  title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 32;

  const items = [
    ['', '', '', '', '', ''],
    ['FORMATOS DE PREGUNTA', '', '', '', '', ''],
    ['fill_blank', 'Frase incompleta con hueco ____', 'El usuario elige del desplegable', 'Permite Otro: text libre', 'IA analiza respuesta libre', ''],
    ['choice',     'Pregunta completa con opciones A/B/C', 'El usuario elige una opción', 'Permite Otro: text libre', 'IA analiza respuesta libre', ''],
    ['amount',     'Escenario de ahorro', 'El usuario introduce importe manual', 'Sin opciones de respuesta', 'Importe siempre obligatorio', ''],
    ['', '', '', '', '', ''],
    ['AVATARES', '', '', '', '', ''],
    ['comodo',      '🛋️  Cómodo',      'Gasta por comodidad y conveniencia', '', '', ''],
    ['social',      '🧑‍🤝‍🧑  Social',     'Gasta por FOMO y presión social', '', '', ''],
    ['impulsivo',   '⚡  Impulsivo',    'Compra por impulso y emoción', '', '', ''],
    ['desordenado', '🌀  Desordenado',  'Sin control ni sistema de seguimiento', '', '', ''],
    ['', '', '', '', '', ''],
    ['SCORING INTERNO (nunca visible al usuario)', '', '', '', '', ''],
    ['Scoring por opción (JSON)', 'Cada opción suma puntos al avatar correspondiente', '', '', '', ''],
    ['Permite Otro',              'true = el usuario puede escribir respuesta libre', '', '', '', ''],
    ['IA requerida para Otro',    'true = la IA analiza el texto libre antes de sumar puntos', '', '', '', ''],
    ['Umbral confianza IA',       '0.70 = mínimo 70% de confianza para sumar puntos', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['COLUMNAS INTERNAS (no se muestran al usuario)', '', '', '', '', ''],
    ['Scoring JSON (interno)',     'JSON con scoring por opción — nunca visible', '', '', '', ''],
    ['Ahorro/mes interno (€)',     'Dato analítico interno — nunca se muestra como proyección', '', '', '', ''],
    ['Ahorro/año interno (€)',     'Dato analítico interno — nunca se muestra como proyección', '', '', '', ''],
    ['Impacto interno',           'Descripción interna — no texto de usuario', '', '', '', ''],
    ['Ref. Importe (€)',          'Solo referencia visual en el UI — el dato real lo introduce el usuario manualmente', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['REGLAS DE SELECCIÓN INTERNA (nunca visibles al usuario)', '', '', '', '', ''],
    ['50/50',  'Si dos avatares empatan → preguntas repartidas al 50%', '', '', '', ''],
    ['70/30',  'Si ratio 0.55–0.65 → 70% al avatar dominante', '', '', '', ''],
    ['100%',   'Si ratio > 0.65 → 100% al avatar dominante', '', '', '', ''],
    ['constructor ELIMINADO', 'No existe como avatar, target, ni destino de scoring', '', '', '', ''],
  ];

  const sectionRows = [2, 7, 13, 19, 26];

  items.forEach((item, i) => {
    const row = sheet.addRow(item);
    row.height = 22;
    const isSection = sectionRows.includes(i);
    if (isSection) {
      sheet.mergeCells(row.number, 1, row.number, 6);
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF37474F' } };
      row.getCell(1).font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
      row.height = 26;
    } else if (item[0]) {
      row.getCell(1).font = { bold: true, size: 9, name: 'Calibri', color: { argb: 'FF1A237E' } };
      row.getCell(2).font = { size: 9, name: 'Calibri' };
    }
  });

  sheet.getColumn(1).width = 34;
  sheet.getColumn(2).width = 58;
  sheet.getColumn(3).width = 36;
  sheet.getColumn(4).width = 28;
  sheet.getColumn(5).width = 28;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AhorroInvisible';
  workbook.lastModifiedBy = 'generate_excel.mjs';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.properties.date1904 = false;

  // Hoja 1: Banco Piloto
  buildSheet(workbook, '🧪 Banco Piloto', pilotQuestions, 'FF1565C0');

  // Hoja 2: Banco Completo
  buildSheet(workbook, '📚 Banco Completo', fullBankQuestions, 'FF2E7D32');

  // Hoja 3: Constructor (Inactivo)
  buildSheet(workbook, '🚫 Constructor (Inactivo)', constructorQs, 'FF616161');

  // Hoja 4: Leyenda
  buildLegendSheet(workbook);

  const outPath = join(__dirname, 'ExcellPlantilla_Banco_Preguntas_AhorroInvisible.xlsx');
  await workbook.xlsx.writeFile(outPath);

  console.log(`\n✅ Excel generado: ${outPath}`);
  console.log(`   📄 Hoja 1: 🧪 Banco Piloto        → ${pilotQuestions.length} preguntas`);
  console.log(`   📄 Hoja 2: 📚 Banco Completo       → ${fullBankQuestions.length} preguntas`);
  console.log(`   📄 Hoja 3: 🚫 Constructor (Inact.) → ${constructorQs.length} preguntas`);
  console.log(`   📄 Hoja 4: 📖 Leyenda`);
}

main().catch(err => {
  console.error('❌ Error al generar Excel:', err.message);
  process.exit(1);
});
