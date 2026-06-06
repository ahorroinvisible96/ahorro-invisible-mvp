const fs = require('fs');
const readline = require('readline');
const ExcelJS = require('exceljs');
const path = require('path');

async function parseMdToExcel(mdPath, excelPath, convExcelPath) {
  const fileStream = fs.createReadStream(mdPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Auditoría');
  sheet.views = [{ showGridLines: true }];

  // Configuración de columnas
  sheet.columns = [
    { key: 'A', width: 22 },
    { key: 'B', width: 25 },
    { key: 'C', width: 25 },
    { key: 'D', width: 25 },
    { key: 'E', width: 35 },
    { key: 'F', width: 25 }
  ];

  let rowIdx = 1;
  let inTable = false;
  let inCodeBlock = false;
  let codeBlockLines = [];

  const borderThin = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };

  for await (const line of rl) {
    const trimmed = line.trim();

    // 1. Manejo de bloques de código (```)
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        inCodeBlock = false;
        
        // Escribimos el bloque de código consolidado en una celda combinada
        sheet.mergeCells(`A${rowIdx}:F${rowIdx}`);
        const cell = sheet.getCell(`A${rowIdx}`);
        cell.value = codeBlockLines.join('\n');
        cell.font = { name: 'Consolas', size: 9.5, color: { argb: 'FFD4D4D4' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF110C24' } // Fondo oscuro a juego con el tema de la app
        };
        cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        cell.border = borderThin;
        
        // Ajustamos la altura de fila para que se lea completo
        sheet.getRow(rowIdx).height = Math.max(22, (codeBlockLines.length * 14.5) + 12);
        rowIdx++;
        codeBlockLines = [];
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // 2. Manejo de Tablas de Markdown (| Col | Col |)
    if (trimmed.startsWith('|')) {
      inTable = true;
      
      // Ignorar la fila de guiones divisores (e.g. |---|---|)
      if (trimmed.includes('---') || trimmed.match(/^[|\s-]+$/)) {
        continue;
      }

      // Separamos por '|' y limpiamos cada celda
      let parts = line.split('|').map(p => p.trim());
      if (parts[0] === '') parts.shift();
      if (parts[parts.length - 1] === '') parts.pop();

      // Determinar si es cabecera (por ejemplo, si no hay tabla previa o es la primera fila de tabla)
      const isHeader = !sheet.getRow(rowIdx - 1).getCell('A').border?.top && !sheet.getRow(rowIdx - 1).getCell('B').border?.top;

      parts.forEach((val, colIdx) => {
        const colLetter = String.fromCharCode(65 + colIdx);
        const cell = sheet.getCell(`${colLetter}${rowIdx}`);
        cell.value = val;
        cell.border = borderThin;

        if (isHeader) {
          // Estilo cabecera de tabla
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF391377' } }; // Morado
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else {
          // Estilo celdas de datos
          cell.font = { name: 'Segoe UI', size: 9.5 };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: rowIdx % 2 === 0 ? 'FFF5F3FF' : 'FFFFFFFF' } // Zebra
          };
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        }
      });

      sheet.getRow(rowIdx).height = 25;
      rowIdx++;
      continue;
    }

    // Si veníamos de una tabla y ya no empieza por '|', dejamos una fila en blanco pequeña
    if (inTable) {
      inTable = false;
      sheet.getRow(rowIdx).height = 8;
      rowIdx++;
    }

    // 3. Manejo de Títulos (#, ##, ###)
    if (trimmed.startsWith('#')) {
      const level = (trimmed.match(/#/g) || []).length;
      const text = trimmed.replace(/#/g, '').trim();

      sheet.mergeCells(`A${rowIdx}:F${rowIdx}`);
      const cell = sheet.getCell(`A${rowIdx}`);
      cell.value = text;

      if (level === 1) {
        // Título Principal
        cell.font = { name: 'Segoe UI', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF391377' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        sheet.getRow(rowIdx).height = 36;
      } else if (level === 2) {
        // Subtítulo Sección
        cell.font = { name: 'Segoe UI', size: 12.5, bold: true, color: { argb: 'FF391377' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = { bottom: { style: 'medium', color: { argb: 'FF391377' } } };
        sheet.getRow(rowIdx).height = 28;
      } else {
        // Subtítulo Menor
        cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF1A093E' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        sheet.getRow(rowIdx).height = 24;
      }
      rowIdx++;
      continue;
    }

    // 4. Separadores de sección (---)
    if (trimmed === '---') {
      sheet.mergeCells(`A${rowIdx}:F${rowIdx}`);
      const cell = sheet.getCell(`A${rowIdx}`);
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
      sheet.getRow(rowIdx).height = 8;
      rowIdx++;
      continue;
    }

    // 5. Filas Vacías
    if (trimmed === '') {
      sheet.getRow(rowIdx).height = 8;
      rowIdx++;
      continue;
    }

    // 6. Texto general
    sheet.mergeCells(`A${rowIdx}:F${rowIdx}`);
    const cell = sheet.getCell(`A${rowIdx}`);
    cell.value = trimmed;
    cell.font = { name: 'Segoe UI', size: 10 };
    cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };

    // Si es un bullet point de lista
    if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•')) {
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 };
    }

    // Detectar alertas de Markdown y destacarlas
    if (trimmed.includes('⚠️') || trimmed.includes('🚨') || trimmed.includes('❌') || trimmed.includes('CRÍTICO')) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFECEF' } }; // Fondo rosa/rojo suave
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF991B1B' } }; // Texto rojo oscuro
    } else if (trimmed.includes('✅')) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F9EE' } }; // Fondo verde suave
    }

    // Estimar altura por texto
    const lineChars = 110;
    const linesCount = Math.ceil(trimmed.length / lineChars);
    sheet.getRow(rowIdx).height = Math.max(18, (linesCount * 15.5) + 5);
    rowIdx++;
  }

  // Guardar archivo en el proyecto
  await workbook.xlsx.writeFile(excelPath);
  console.log(`Excel generado con éxito en: ${excelPath}`);

  // Guardar copia en el directorio de la conversación
  await workbook.xlsx.writeFile(convExcelPath);
  console.log(`Copia del Excel generada en: ${convExcelPath}`);
}

const mdFile = 'C:\\Users\\jvnim\\.gemini\\antigravity\\brain\\c33da8e7-8764-42e1-b958-2e6cc03ac577\\auditoria_sistema_preguntas.md';
const excelFile = 'd:\\Javier\\AhorroInvisible\\mvp Ahorro invisible\\auditoria_sistema_preguntas_completa.xlsx';
const convExcelFile = 'C:\\Users\\jvnim\\.gemini\\antigravity\\brain\\c33da8e7-8764-42e1-b958-2e6cc03ac577\\auditoria_sistema_preguntas_completa.xlsx';

parseMdToExcel(mdFile, excelFile, convExcelFile).catch(err => {
  console.error('Error al convertir el Markdown:', err);
  process.exit(1);
});
