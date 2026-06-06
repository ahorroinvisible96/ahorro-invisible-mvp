import fs from 'fs';
import path from 'path';
import { DAILY_QUESTIONS_BANK } from '../src/services/dailyQuestionsBank';

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val);
  // Reemplazar saltos de línea por espacios
  str = str.replace(/\r?\n|\r/g, ' ');
  // Si contiene comillas, comas o punto y coma, envolver en comillas y escapar comillas dobles
  if (str.includes('"') || str.includes(',') || str.includes(';') || str.includes('\t')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCSV() {
  const headers = [
    'ID',
    'Pregunta',
    'Importe Sugerido (€)',
    'Categoría de Gasto',
    'Días Óptimos',
    'Franja Horaria',
    'Fase del Mes',
    'Avatar Principal',
    'Avatar Secundario',
    'Peso Escenario (1-3)',
    'Prioridad Base (1-10)',
    'Días Enfriamiento',
    'Ahorro Mensual Est. (€)',
    'Ahorro Anual Est. (€)',
    'Impacto Estimado',
    'Intención Conductual',
    'Principio de Hábito',
    'Tono',
    'Dificultad'
  ];

  const rows = DAILY_QUESTIONS_BANK.map(q => [
    q.id,
    q.text,
    q.suggestedAmount,
    q.habitCategory,
    q.bestDays,
    q.bestTimeWindow,
    q.monthPhase,
    q.targetAvatarPrimary,
    q.targetAvatarSecondary,
    q.scenarioWeight,
    q.priorityBase,
    q.cooldownDays,
    q.monthlyDelta,
    q.yearlyDelta,
    q.labelImpact,
    q.intent,
    q.habit_principle,
    q.tone,
    q.difficulty
  ]);

  // Usar coma (,) como delimitador estándar
  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  // Agregar UTF-8 BOM para que Excel en Windows abra el archivo con la codificación y caracteres correctos (acentos, signos de interrogación invertidos)
  const bom = '\uFEFF';
  const finalContent = bom + csvContent;

  // Guardar en la raíz del proyecto web
  const outputPathWeb = path.join(__dirname, '../banco_de_preguntas_ahorro_invisible.csv');
  fs.writeFileSync(outputPathWeb, finalContent, 'utf8');
  console.log(`CSV generado exitosamente en: ${outputPathWeb}`);

  // Guardar también en la raíz del espacio de trabajo de nivel superior para mayor comodidad
  const outputPathRoot = path.join(__dirname, '../../banco_de_preguntas_ahorro_invisible.csv');
  try {
    fs.writeFileSync(outputPathRoot, finalContent, 'utf8');
    console.log(`CSV generado exitosamente en la raíz del espacio de trabajo: ${outputPathRoot}`);
  } catch (err) {
    console.warn(`No se pudo escribir en la raíz del espacio de trabajo: ${err}`);
  }
}

generateCSV();
