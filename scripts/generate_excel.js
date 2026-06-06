const ExcelJS = require('exceljs');
const path = require('path');

async function generateExcel() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Antigravity AI';
  workbook.lastModifiedBy = 'Antigravity AI';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Definición de Estilos Comunes
  const fontTitle = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  const fontSubtitle = { name: 'Segoe UI', size: 11, italic: true, color: { argb: 'FFDDD6FF' } };
  const fontHeader = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  const fontData = { name: 'Segoe UI', size: 10 };
  const fontBoldData = { name: 'Segoe UI', size: 10, bold: true };
  const fontSectionHeader = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF391377' } };

  const fillTitle = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF391377' } // Morado Ahorro Invisible
  };
  const fillHeader = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1A093E' } // Morado más oscuro
  };
  const fillZebra = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF5F3FF' } // Morado muy suave
  };
  const fillWarning = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFECEF' } // Rosa muy suave para riesgos/warnings
  };
  const fillSuccess = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6F9EE' } // Verde suave para aciertos
  };

  const borderThin = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };

  const alignCenter = { vertical: 'middle', horizontal: 'center' };
  const alignLeft = { vertical: 'middle', horizontal: 'left', wrapText: true };
  const alignRight = { vertical: 'middle', horizontal: 'right' };

  // ==========================================
  // HOJA 1: DIAGNÓSTICO Y MEJORAS
  // ==========================================
  const sheet1 = workbook.addWorksheet('Diagnóstico y Mejoras');
  sheet1.views = [{ showGridLines: true }];

  // Banner superior
  sheet1.mergeCells('A1:D2');
  const cellA1 = sheet1.getCell('A1');
  cellA1.value = 'AUDITORÍA DEL SISTEMA DE PREGUNTAS DIARIAS';
  cellA1.font = fontTitle;
  cellA1.fill = fillTitle;
  cellA1.alignment = alignCenter;

  sheet1.mergeCells('A3:D3');
  const cellA3 = sheet1.getCell('A3');
  cellA3.value = 'Evaluación de calidad y prioridades de mejora';
  cellA3.font = fontSubtitle;
  cellA3.fill = fillTitle;
  cellA3.alignment = alignCenter;

  // Sección de Diagnóstico
  sheet1.getCell('A5').value = 'Diagnóstico Técnico Principal';
  sheet1.getCell('A5').font = fontSectionHeader;

  const diagData = [
    ['¿Genera texto o reutiliza?', 'Reutiliza preguntas existentes del banco estático de 135 preguntas hardcoded en dailyQuestionsBank.ts. La IA (Gemini) no genera texto libre, actúa como un enrutador inteligente de selección.'],
    ['¿La IA adapta al usuario?', 'Parcialmente, pero con una desconexión crítica. El endpoint /api/ai/daily-question con Gemini existe y procesa el contexto del usuario (fatiga, historial), pero la UI actualmente consume getTodayQuestion(), que es local y no usa IA en producción.'],
    ['¿Hay riesgo de repetición?', 'Sí, alto. El pool real se reduce a solo 30 preguntas por avatar con seed determinístico. Además, cooldownDays existe en el esquema pero no está implementado en el filtrado, por lo que un usuario puede repetir preguntas en menos de 4 semanas.'],
    ['¿Existe aprendizaje real?', 'Mínimo. Excluye las respondidas en los últimos 7 días y detecta fatiga (bajando dificultad o forzando cambio), pero no aprende de los importes ahorrados ni personaliza el tono.'],
  ];

  let currRow = 6;
  diagData.forEach(row => {
    sheet1.getCell(`A${currRow}`).value = row[0];
    sheet1.getCell(`A${currRow}`).font = fontBoldData;
    sheet1.getCell(`A${currRow}`).alignment = alignLeft;
    sheet1.getCell(`A${currRow}`).border = borderThin;
    
    sheet1.mergeCells(`B${currRow}:D${currRow}`);
    const cellB = sheet1.getCell(`B${currRow}`);
    cellB.value = row[1];
    cellB.font = fontData;
    cellB.alignment = alignLeft;
    cellB.border = borderThin;
    if (row[0].includes('desconexión') || row[0].includes('repetición')) {
      sheet1.getRow(currRow).eachCell(cell => cell.fill = fillWarning);
    }
    sheet1.getRow(currRow).height = 45;
    currRow++;
  });

  // Tabla de Mejoras Recomendadas
  currRow += 2;
  sheet1.getCell(`A${currRow}`).value = 'Plan de Mejoras Recomendadas (Por Prioridad)';
  sheet1.getCell(`A${currRow}`).font = fontSectionHeader;

  currRow++;
  const mHeaders = ['Prioridad', 'Mejora Recomendada', 'Impacto en la App', 'Esfuerzo Estimado'];
  mHeaders.forEach((h, idx) => {
    const colName = String.fromCharCode(65 + idx);
    const cell = sheet1.getCell(`${colName}${currRow}`);
    cell.value = h;
    cell.font = fontHeader;
    cell.fill = fillHeader;
    cell.alignment = alignCenter;
    cell.border = borderThin;
  });
  sheet1.getRow(currRow).height = 25;

  const mejoras = [
    [1, 'Conectar el endpoint /api/ai/daily-question a la UI (daily/page.tsx)', 'Crítico: Conecta la IA con el usuario final', 'Medio'],
    [2, 'Implementar el filtro de cooldown usando cooldownDays del banco', 'Alto: Soluciona el bug de repeticiones frecuentes', 'Bajo'],
    [3, 'Conectar logQuestionAnswer al flujo de respuesta del dashboard', 'Alto: Permite que el historial de la IA aprenda de la UI', 'Bajo'],
    [4, 'Ampliar el pool activo (permitir usar las 135 preguntas, no solo 30 por avatar)', 'Medio: Multiplica la variedad de preguntas mostradas', 'Bajo'],
    [5, 'Añadir control de repetición por categoría', 'Medio: Evita mostrar la misma categoría (ej. cafés) varios días seguidos', 'Medio'],
    [6, 'Añadir feedback de usuario ("No me interesa esta pregunta")', 'Medio: Mejora el modelo de usuario con interacción explícita', 'Medio'],
    [7, 'Implementar detección de similitud semántica con embeddings', 'Alto: Evita preguntas semánticamente idénticas', 'Alto'],
    [8, 'Activar el flag experimental para A/B testing de preguntas', 'Medio: Permite evaluar el impacto de nuevas preguntas científicamente', 'Alto'],
  ];

  mejoras.forEach(row => {
    currRow++;
    row.forEach((val, idx) => {
      const colName = String.fromCharCode(65 + idx);
      const cell = sheet1.getCell(`${colName}${currRow}`);
      cell.value = val;
      cell.font = idx === 0 ? fontBoldData : fontData;
      cell.border = borderThin;
      
      if (idx === 0) {
        cell.alignment = alignCenter;
      } else if (idx === 3) {
        cell.alignment = alignCenter;
        if (val === 'Bajo') cell.fill = fillSuccess;
        else if (val === 'Alto') cell.fill = fillWarning;
      } else {
        cell.alignment = alignLeft;
      }
    });
    sheet1.getRow(currRow).height = 30;
  });

  // Ajustes de columnas para hoja 1
  sheet1.getColumn('A').width = 25;
  sheet1.getColumn('B').width = 45;
  sheet1.getColumn('C').width = 45;
  sheet1.getColumn('D').width = 20;


  // ==========================================
  // HOJA 2: BANCO DE PREGUNTAS
  // ==========================================
  const sheet2 = workbook.addWorksheet('Estructura del Banco');
  sheet2.views = [{ showGridLines: true }];

  sheet2.getCell('A1').value = 'Banco de Preguntas Principal (135 Preguntas)';
  sheet2.getCell('A1').font = fontSectionHeader;

  sheet2.getCell('A2').value = 'Se distribuyen en 9 grupos de 15 preguntas cada uno:';
  sheet2.getCell('A2').font = fontData;

  const gHeaders = ['Prefijo ID', 'Grupo / Temática', 'Avatar', 'Subavatar'];
  gHeaders.forEach((h, idx) => {
    const colName = String.fromCharCode(65 + idx);
    const cell = sheet2.getCell(`${colName}4`);
    cell.value = h;
    cell.font = fontHeader;
    cell.fill = fillHeader;
    cell.alignment = alignCenter;
    cell.border = borderThin;
  });
  sheet2.getRow(4).height = 25;

  const grupos = [
    ['Q_CI_01–15', 'Conveniencia Inmediata', 'comodo', 'conveniencia_inmediata'],
    ['Q_IM_01–15', 'Improvisador', 'comodo', 'improvisador'],
    ['Q_FS_01–15', 'FOMO Social', 'social', 'fomo_social'],
    ['Q_PA_01–15', 'Plan que se Alarga', 'social', 'plan_que_se_alarga'],
    ['Q_AE_01–15', 'Antojo Emocional', 'impulsivo', 'antojo_emocional'],
    ['Q_CO_01–15', 'Cazador de Ofertas', 'impulsivo', 'cazador_de_ofertas'],
    ['Q_MF_01–15', 'Microfugas', 'desordenado', 'microfugas'],
    ['Q_SS_01–15', 'Sin Sistema', 'desordenado', 'sin_sistema'],
    ['Q_CT_01–15', 'Constructor (transversal)', 'constructor', '—'],
  ];

  currRow = 5;
  grupos.forEach((row, rIdx) => {
    row.forEach((val, idx) => {
      const colName = String.fromCharCode(65 + idx);
      const cell = sheet2.getCell(`${colName}${currRow}`);
      cell.value = val;
      cell.font = fontData;
      cell.border = borderThin;
      cell.alignment = alignLeft;
      if (rIdx % 2 === 0) cell.fill = fillZebra;
    });
    sheet2.getRow(currRow).height = 20;
    currRow++;
  });

  // Campos de DailyQuestion
  currRow += 2;
  sheet2.getCell(`A${currRow}`).value = 'Esquema de Datos de Pregunta (DailyQuestion)';
  sheet2.getCell(`A${currRow}`).font = fontSectionHeader;

  currRow++;
  const fieldsHeaders = ['Campo', 'Tipo', 'Descripción / Uso en el Algoritmo'];
  fieldsHeaders.forEach((h, idx) => {
    const colName = String.fromCharCode(65 + idx);
    const cell = sheet2.getCell(`${colName}${currRow}`);
    cell.value = h;
    cell.font = fontHeader;
    cell.fill = fillHeader;
    cell.alignment = alignCenter;
    cell.border = borderThin;
  });
  sheet2.getRow(currRow).height = 25;

  const campos = [
    ['id', 'string', 'Identificador único de la pregunta (ej. Q_CI_01)'],
    ['text', 'string', 'Pregunta literal que lee el usuario final'],
    ['suggestedAmount', 'number', 'Importe en euros sugerido para guardar'],
    ['habitCategory', 'string', 'Categoría de gasto (Delivery, Cafés, Suscripciones...)'],
    ['bestDays', 'string', 'Días recomendados (Lunes a Viernes, Fines de semana...)'],
    ['bestTimeWindow', 'string', 'Franja óptima (Mañana, Tarde, Noche, Cualquiera)'],
    ['monthPhase', 'string', 'Momento del mes ideal (Inicio, Mitad, Fin, Cualquiera)'],
    ['targetAvatarPrimary', 'AvatarKey', 'Avatar objetivo al que penaliza/incentiva'],
    ['targetSubavatarPrimary', 'SubavatarKey', 'Subavatar objetivo al que penaliza/incentiva'],
    ['scenarioWeight', 'number', 'Peso del escenario (1 a 3) en el scoring de Gemini'],
    ['priorityBase', 'number', 'Prioridad de la pregunta base (1 a 10)'],
    ['cooldownDays', 'number', 'Días a esperar para repetir. ¡DEFINIDO PERO NO USADO!'],
    ['monthlyDelta / yearlyDelta', 'number', 'Estimaciones de ahorro del impacto'],
    ['labelImpact', 'string', 'Mensaje de impacto que ve el usuario al contestar'],
    ['active', 'boolean', 'Activa/Inactiva en el pool global (siempre true en el código)'],
  ];

  campos.forEach((row, rIdx) => {
    currRow++;
    row.forEach((val, idx) => {
      const colName = String.fromCharCode(65 + idx);
      const cell = sheet2.getCell(`${colName}${currRow}`);
      cell.value = val;
      cell.font = idx === 0 ? fontBoldData : fontData;
      cell.border = borderThin;
      cell.alignment = alignLeft;
      
      if (idx === 0 && val.includes('cooldownDays')) {
        cell.fill = fillWarning;
      } else if (rIdx % 2 === 0) {
        cell.fill = fillZebra;
      }
    });
    sheet2.getRow(currRow).height = 20;
  });

  sheet2.getColumn('A').width = 25;
  sheet2.getColumn('B').width = 20;
  sheet2.getColumn('C').width = 55;
  sheet2.getColumn('D').width = 20;


  // ==========================================
  // HOJA 3: BASE DE DATOS SUPABASE
  // ==========================================
  const sheet3 = workbook.addWorksheet('Esquema de Base de Datos');
  sheet3.views = [{ showGridLines: true }];

  sheet3.getCell('A1').value = 'Tabla question_interactions (Supabase)';
  sheet3.getCell('A1').font = fontSectionHeader;
  sheet3.getCell('A2').value = 'Almacena el historial detallado de qué preguntas vio y respondió cada usuario.';
  sheet3.getCell('A2').font = fontData;

  const dbHeaders = ['Campo Supabase', 'Tipo de Dato', 'Descripción del Campo'];
  dbHeaders.forEach((h, idx) => {
    const colName = String.fromCharCode(65 + idx);
    const cell = sheet3.getCell(`${colName}4`);
    cell.value = h;
    cell.font = fontHeader;
    cell.fill = fillHeader;
    cell.alignment = alignCenter;
    cell.border = borderThin;
  });
  sheet3.getRow(4).height = 25;

  const dbSchema = [
    ['id', 'UUID', 'Llave primaria autogenerada'],
    ['user_id', 'UUID', 'Relación con auth.users (ID del usuario)'],
    ['question_id', 'TEXT', 'ID de la pregunta mostrada (ej. Q_PA_03)'],
    ['local_date', 'DATE', 'Fecha de la interacción (Timezone Madrid: YYYY-MM-DD)'],
    ['time_slot', 'TEXT', 'Franja del día en la que se mostró (Mañana, Tarde, Noche)'],
    ['attempt_number', 'SMALLINT', 'Intento de visualización del día (1, 2, o 3)'],
    ['responded', 'BOOLEAN', 'Indica si el usuario respondió la pregunta o la ignoró'],
    ['answer_key', 'TEXT', 'Acción elegida: saved (guardar), skip (saltar), zero (ahorro cero)'],
    ['saved_amount', 'NUMERIC(10,2)', 'Cantidad en euros ahorrada con esta pregunta'],
    ['avatar_dominant', 'TEXT', 'Avatar del usuario al responder'],
    ['avatar_secondary', 'TEXT', 'Subavatar del usuario al responder'],
    ['avatar_confidence', 'NUMERIC(3,2)', 'Confianza del avatar (0 a 1)'],
    ['ai_decision_type', 'TEXT', 'Tipo de decisión: select_question o skip_today'],
    ['ai_decision_reason', 'TEXT', 'Justificación del razonamiento de Gemini para su selección'],
    ['ai_from_model', 'BOOLEAN', 'True si usó la IA de Gemini, False si usó el motor local de fallback'],
    ['should_change_question', 'BOOLEAN', 'Indica si Gemini decidió cambiar la pregunta base de la matriz'],
    ['created_at', 'TIMESTAMPTZ', 'Fecha y hora de creación del log en Supabase'],
  ];

  currRow = 5;
  dbSchema.forEach((row, rIdx) => {
    row.forEach((val, idx) => {
      const colName = String.fromCharCode(65 + idx);
      const cell = sheet3.getCell(`${colName}${currRow}`);
      cell.value = val;
      cell.font = idx === 0 ? fontBoldData : fontData;
      cell.border = borderThin;
      cell.alignment = alignLeft;
      if (rIdx % 2 === 0) cell.fill = fillZebra;
    });
    sheet3.getRow(currRow).height = 20;
    currRow++;
  });

  sheet3.getColumn('A').width = 25;
  sheet3.getColumn('B').width = 18;
  sheet3.getColumn('C').width = 65;


  // ==========================================
  // HOJA 4: FLUJO END-TO-END
  // ==========================================
  const sheet4 = workbook.addWorksheet('Flujo End-to-End');
  sheet4.views = [{ showGridLines: true }];

  sheet4.getCell('A1').value = 'Riesgos del Flujo End-to-End por Pasos';
  sheet4.getCell('A1').font = fontSectionHeader;
  sheet4.getCell('A2').value = 'Detalle de los riesgos e inconsistencias en la integración de la IA y el cliente:';
  sheet4.getCell('A2').font = fontData;

  const fHeaders = ['Paso', 'Nombre del Paso', 'Componente / Archivo', 'Riesgo / Advertencia Detectada'];
  fHeaders.forEach((h, idx) => {
    const colName = String.fromCharCode(65 + idx);
    const cell = sheet4.getCell(`${colName}4`);
    cell.value = h;
    cell.font = fontHeader;
    cell.fill = fillHeader;
    cell.alignment = alignCenter;
    cell.border = borderThin;
  });
  sheet4.getRow(4).height = 25;

  const e2eFlujo = [
    [1, 'Auth + Init', 'daily/page.tsx', 'Ninguno. Inicializa la sesión y comprueba el onboarding correctamente.'],
    [2, 'Selección local', 'dashboardStore.ts > getTodayQuestion()', 'CRÍTICO: No usa la IA ni conecta con Supabase. Usa un motor local del cliente. El backend de IA está desconectado en producción.'],
    [3, 'Scoring en cliente', 'questionSelectionEngine.ts > selectQuestion()', 'Pool limitado: al filtrar por avatar se reduce la variedad de preguntas a 30. Además, el seed determinístico genera preguntas predecibles.'],
    [4, 'Generación de Hash', 'hashSeed()', 'Todos los usuarios con el mismo avatar en la misma franja horaria y día de la semana verán la misma pregunta exacta.'],
    [5, 'Auto-refresh', 'setInterval(60s)', 'Si el usuario tiene la página abierta y cambia la franja horaria, la pregunta cambiará en caliente si no ha respondido.'],
    [6, 'Persistencia local', 'storeSubmitDecision()', 'No actualiza la tabla question_interactions, solo guarda la respuesta en local e inserta en la tabla decisions. Desconexión del historial de la IA.'],
    [7, 'Sincronización', 'syncDecisionToSupabase()', 'Es asíncrona en el cliente y puede fallar silenciosamente en caso de desconexión sin notificar al usuario.'],
    [8, 'Procesamiento en API (IA)', 'POST /api/ai/daily-question', 'El endpoint funciona perfectamente en código pero no es consumido por la UI del dashboard.'],
    [9, 'Registro de Impresión', 'logQuestionImpression()', 'Solo se ejecuta en la Ruta B (API), la cual no está conectada. No se registran las impresiones reales en Supabase.'],
    [10, 'Registro de Respuesta en IA', 'logQuestionAnswer()', 'Solo es invocado por /api/questions/answer, el cual no se llama desde daily/page.tsx en el dashboard real.'],
  ];

  currRow = 5;
  e2eFlujo.forEach((row, rIdx) => {
    row.forEach((val, idx) => {
      const colName = String.fromCharCode(65 + idx);
      const cell = sheet4.getCell(`${colName}${currRow}`);
      cell.value = val;
      cell.font = fontData;
      cell.border = borderThin;
      cell.alignment = idx === 0 ? alignCenter : alignLeft;
      
      if (idx === 3 && val.includes('CRÍTICO')) {
        cell.fill = fillWarning;
        cell.font = fontBoldData;
      } else if (rIdx % 2 === 0) {
        cell.fill = fillZebra;
      }
    });
    sheet4.getRow(currRow).height = 40;
    currRow++;
  });

  sheet4.getColumn('A').width = 10;
  sheet4.getColumn('B').width = 25;
  sheet4.getColumn('C').width = 38;
  sheet4.getColumn('D').width = 55;


  // ==========================================
  // HOJA 5: REGLAS DE SCORING
  // ==========================================
  const sheet5 = workbook.addWorksheet('Reglas de Scoring');
  sheet5.views = [{ showGridLines: true }];

  sheet5.getCell('A1').value = 'Tabla de Reglas del Algoritmo de Scoring';
  sheet5.getCell('A1').font = fontSectionHeader;
  sheet5.getCell('A2').value = 'Pesos que definen qué tan idónea es una pregunta para el usuario en la selección:';
  sheet5.getCell('A2').font = fontData;

  const sHeaders = ['Regla', 'Variable Evaluada', 'Peso (Puntos)', 'Condición de Activación', 'Efecto del Peso', 'Estado / Archivo'];
  sHeaders.forEach((h, idx) => {
    const colName = String.fromCharCode(65 + idx);
    const cell = sheet5.getCell(`${colName}4`);
    cell.value = h;
    cell.font = fontHeader;
    cell.fill = fillHeader;
    cell.alignment = alignCenter;
    cell.border = borderThin;
  });
  sheet5.getRow(4).height = 25;

  const scoringRules = [
    ['Avatar Primario', 'targetAvatarPrimary', '+40', 'Coincide con el avatar dominante', 'Aumenta significativamente la relevancia del tema', 'selectQuestion()'],
    ['Avatar Secundario', 'targetAvatarSecondary', '+25', 'Coincide con el avatar secundario', 'Aumenta de forma media la relevancia del tema', 'selectQuestion()'],
    ['Subavatar Primario', 'targetSubavatarPrimary', '+20', 'Coincide con el subavatar dominante', 'Añade precisión a la subtemática', 'selectQuestion()'],
    ['Subavatar Secundario', 'targetSubavatarSecondary', '+15', 'Coincide con el subavatar secundario', 'Añade precisión a la subtemática secundaria', 'selectQuestion()'],
    ['Día de la semana', 'bestDays', '+20', 'Coincide el día de la semana actual', 'Promueve preguntas de fin de semana en días correctos', 'selectQuestion()'],
    ['Franja horaria', 'bestTimeWindow', '+15', 'Coincide la franja horaria del día', 'Adapta la pregunta al momento (Mañana, Tarde...)', 'selectQuestion()'],
    ['Fase del mes', 'monthPhase', '+10', 'Coincide la fase mensual (inicio, mitad...)', 'Adapta si se tiene dinero o se está a fin de mes', 'selectQuestion()'],
    ['Prioridad base', 'priorityBase', '+1 a +10', 'Siempre activo', 'Peso estático por defecto de la pregunta', 'selectQuestion()'],
    ['Peso del escenario', 'scenarioWeight', '+2 a +6', 'Valor * 2 del peso del escenario', 'Incentiva escenarios de preguntas complejas', 'selectQuestion()'],
    ['Bono constructor', 'streak', '+5', 'Racha de respuestas >= 7 días', 'Incentiva preguntas de tipo constructor', 'selectQuestion()'],
    ['Historial Reciente', 'recentQuestionIds', '-50', 'Pregunta mostrada en los últimos 7 días', 'Penaliza fuertemente la pregunta para no repetirla', 'selectQuestion()'],
    ['Cooldown', 'cooldownDays', '0', 'cooldownDays especificado en la pregunta', 'NO IMPLEMENTADO. No realiza ningún cambio', '⚠️ Solo en esquema'],
    ['Filtro por avatar', 'avatar', 'Filtro', 'Si el avatar no coincide', 'Excluye la pregunta de las opciones directamente', 'selectQuestion()'],
  ];

  currRow = 5;
  scoringRules.forEach((row, rIdx) => {
    row.forEach((val, idx) => {
      const colName = String.fromCharCode(65 + idx);
      const cell = sheet5.getCell(`${colName}${currRow}`);
      cell.value = val;
      cell.font = fontData;
      cell.border = borderThin;
      
      if (idx === 2) {
        cell.alignment = alignCenter;
        if (val.startsWith('+')) cell.font = fontBoldData;
        else if (val.startsWith('-')) cell.font = fontBoldData;
      } else {
        cell.alignment = alignLeft;
      }

      if (row[0].includes('Cooldown')) {
        cell.fill = fillWarning;
      } else if (rIdx % 2 === 0) {
        cell.fill = fillZebra;
      }
    });
    sheet5.getRow(currRow).height = 20;
    currRow++;
  });

  sheet5.getColumn('A').width = 25;
  sheet5.getColumn('B').width = 25;
  sheet5.getColumn('C').width = 15;
  sheet5.getColumn('D').width = 30;
  sheet5.getColumn('E').width = 45;
  sheet5.getColumn('F').width = 20;


  // Escribir el archivo final en el Workspace (ruta absoluta de Windows)
  const destPath = 'd:\\Javier\\AhorroInvisible\\mvp Ahorro invisible\\auditoria_sistema_preguntas.xlsx';
  await workbook.xlsx.writeFile(destPath);
  console.log(`Excel generado con éxito en: ${destPath}`);

  // Copia en el directorio de la conversación
  const convDestPath = 'C:\\Users\\jvnim\\.gemini\\antigravity\\brain\\c33da8e7-8764-42e1-b958-2e6cc03ac577\\auditoria_sistema_preguntas.xlsx';
  await workbook.xlsx.writeFile(convDestPath);
  console.log(`Copia del Excel generada en: ${convDestPath}`);
}

generateExcel().catch(err => {
  console.error('Error al generar el Excel:', err);
  process.exit(1);
});
