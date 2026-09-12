import fs from 'fs';
import path from 'path';
import { QUESTIONS_BANK } from '../src/services/dailyQuestionsBank';

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str = String(val);
  str = str.replace(/\r?\n|\r/g, ' ');
  if (str.includes('"') || str.includes(',') || str.includes(';') || str.includes('\t')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCSV() {
  const headers = ['ID', 'Texto', 'Avatar', 'Franja Horaria', 'Opción 1', 'Opción 2', 'Opción 3'];

  const rows = QUESTIONS_BANK.map(q => [
    q.id,
    q.text,
    q.avatar,
    q.timeSlot,
    q.options[0] ?? '',
    q.options[1] ?? '',
    q.options[2] ?? '',
  ]);

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map((row: unknown[]) => row.map(escapeCSV).join(','))
  ].join('\n');

  const bom = '\uFEFF';
  const finalContent = bom + csvContent;

  const outputPathWeb = path.join(__dirname, '../banco_de_preguntas_ahorro_invisible.csv');
  fs.writeFileSync(outputPathWeb, finalContent, 'utf8');
  console.log(`CSV generado en: ${outputPathWeb}`);
}

generateCSV();
