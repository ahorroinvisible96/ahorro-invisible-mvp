import fs from 'fs';
import path from 'path';

// Parse CSV line handling quotes
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i+1] === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function csvEscape(v) {
  if (v === undefined || v === null) return '';
  const s = String(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// 1. Leer las preguntas piloto generadas anteriormente
const pilotPath = path.join(process.cwd(), 'Plantilla_Banco_Preguntas_AhorroInvisible.csv');
const pilotRaw = fs.readFileSync(pilotPath, 'utf8').replace(/^\uFEFF/, '');
const pilotLines = pilotRaw.split(/\r?\n/).filter(l => l.trim() !== '');
const NEW_HEADERS = parseCSVLine(pilotLines[0]);

const newRows = [];

// Añadir las 18 preguntas piloto
for (let i = 1; i < pilotLines.length; i++) {
  newRows.push(parseCSVLine(pilotLines[i]));
}

// 2. Leer y migrar las preguntas legacy
const legacyPath = path.join(process.cwd(), 'banco_de_preguntas_ahorro_invisible.csv');
const legacyRaw = fs.readFileSync(legacyPath, 'utf8').replace(/^\uFEFF/, '');
const legacyLines = legacyRaw.split(/\r?\n/).filter(l => l.trim() !== '');

for (let i = 1; i < legacyLines.length; i++) {
  const row = parseCSVLine(legacyLines[i]);
  if (row.length < 2) continue;
  
  const id = row[0];
  const pregunta = row[1];
  const importe = row[2];
  const categoria = row[3];
  const dias = row[4];
  const franja = row[5];
  const fase = row[6];
  const avatar_pri = row[7];
  const avatar_sec = row[8];
  // Subavatars ignorados (row 9, 10)
  const peso = row[11];
  const prio = row[12];
  const cooldown = row[13];
  const d_mensual = row[14];
  const d_anual = row[15];
  const impacto = row[16];
  const intent = row[17];
  const principle = row[18];
  const tono = row[19];
  const dificultad = row[20];

  // Reglas de la Fase 1
  let estado = 'ACTIVO';
  if (id.startsWith('Q_CT') || avatar_pri === 'constructor') {
    estado = 'INACTIVO'; // Constructor eliminado
  }

  // Por defecto, legacy asume "amount" pero el usuario podrá cambiarlas
  const formato = 'amount';
  const permite_otro = 'No';
  const umbral_ia = '';
  const opciones = '';

  const newRow = [
    id, formato, estado, pregunta, categoria,
    avatar_pri, avatar_sec, opciones,
    permite_otro, umbral_ia, importe, d_mensual,
    d_anual, impacto, dias, franja, fase,
    cooldown, prio, peso, intent,
    principle, tono, dificultad
  ];
  
  newRows.push(newRow);
}

const BOM = '\uFEFF';
const csvContent = [NEW_HEADERS.map(csvEscape).join(','), ...newRows.map(r => r.map(csvEscape).join(','))].join('\r\n');

const outPath = path.join(process.cwd(), 'definitivoPlantilla_Banco_Preguntas_AhorroInvisible.csv');
fs.writeFileSync(outPath, BOM + csvContent, 'utf8');

console.log('✅ Archivo definitivo generado con preguntas piloto + legacy migradas.');
