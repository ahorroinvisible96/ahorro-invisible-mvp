"""
Actualiza dailyQuestionsBank.ts:
1. Elimina las 60 preguntas amount podadas (las que no están en el CSV final)
2. Añade 32 nuevas preguntas fill_blank (Q_FB_61 - Q_FB_92)
3. Actualiza comentarios del header
"""

import re, sys
sys.stdout.reconfigure(encoding='utf-8')

TS_PATH = r'src\services\dailyQuestionsBank.ts'

with open(TS_PATH, encoding='utf-8') as f:
    content = f.read()

# IDs a eliminar (las 60 amount podadas por el script rebalance_bank.py)
IDS_TO_REMOVE = {
    'Q_CI_07', 'Q_CI_09', 'Q_CI_10', 'Q_CI_11', 'Q_CI_08', 'Q_CI_14', 'Q_CI_15', 'Q_CI_12',
    'Q_IM_04', 'Q_IM_05', 'Q_IM_11', 'Q_IM_12', 'Q_IM_06', 'Q_IM_09', 'Q_IM_10', 'Q_IM_15',
    'Q_FS_07', 'Q_FS_08', 'Q_FS_09', 'Q_FS_11', 'Q_FS_13', 'Q_FS_15', 'Q_FS_14',
    'Q_PA_03', 'Q_PA_06', 'Q_PA_07', 'Q_PA_08', 'Q_PA_10', 'Q_PA_11', 'Q_PA_13',
    'Q_AE_07', 'Q_AE_10', 'Q_AE_11', 'Q_AE_15', 'Q_AE_09', 'Q_AE_12', 'Q_AE_14',
    'Q_CO_03', 'Q_CO_06', 'Q_CO_10', 'Q_CO_11', 'Q_CO_13', 'Q_CO_14', 'Q_CO_15', 'Q_CO_09',
    'Q_MF_14', 'Q_MF_07', 'Q_MF_08', 'Q_MF_09', 'Q_MF_12', 'Q_MF_05', 'Q_MF_11', 'Q_MF_13',
    'Q_SS_11', 'Q_SS_15', 'Q_SS_05', 'Q_SS_07', 'Q_SS_12', 'Q_SS_13', 'Q_SS_14',
}

# Eliminar cada línea que contenga q('Q_XX_YY', ...) para los IDs a eliminar
lines = content.split('\n')
new_lines = []
removed_count = 0
for line in lines:
    matched = False
    for qid in IDS_TO_REMOVE:
        if f"q('{qid}'," in line:
            matched = True
            removed_count += 1
            break
    if not matched:
        new_lines.append(line)

print(f"Líneas amount eliminadas del TS: {removed_count}")
content = '\n'.join(new_lines)

# Nuevas preguntas fill_blank a insertar antes del cierre de Q_FILL_BLANK
NEW_FB_QUESTIONS = """
  // ── CÓMODO (nuevas Q_FB_61–Q_FB_68) ─────────────────────────────────────────
  {
    id: 'Q_FB_61', format: 'fill_blank',
    text: 'He resistido pedir delivery y he improvisado algo en casa: ____.',
    blankOptions: [
      { label: 'pasta rápida con lo que había',            value: 'pasta_rapida',  scores: { comodo: 2 } },
      { label: 'una tortilla o huevos revueltos',           value: 'tortilla',      scores: { comodo: 2 } },
      { label: 'sobras de la nevera que aún estaban bien',  value: 'sobras_nevera', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Delivery evitado', bestDays: 'Cualquier día', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: 'impulsivo',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 3, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Improvisar en casa evita ~4 pedidos/mes',
    active: true, intent: 'gasto_evitado_delivery_improvisa', habit_principle: 'easy', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_62', format: 'fill_blank',
    text: 'He elegido transporte más barato en vez del más cómodo para ir a: ____.',
    blankOptions: [
      { label: 'el trabajo (metro o bus en vez de taxi)', value: 'trabajo_metro', scores: { comodo: 2 } },
      { label: 'una salida (bici o andando)',             value: 'salida_bici',   scores: { comodo: 2 } },
      { label: 'un recado cercano (andando)',             value: 'recado_andando', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 7, habitCategory: 'Transporte económico', bestDays: 'Lunes a Viernes', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: '',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 3, monthlyDelta: 28, yearlyDelta: 336,
    labelImpact: 'Sustituir 1 taxi diario ahorra ~28 €/mes',
    active: true, intent: 'gasto_evitado_transporte_eco', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_63', format: 'fill_blank',
    text: 'He preparado la semana para no tener que gastar de urgencia en: ____.',
    blankOptions: [
      { label: 'comida (meal prep del domingo)',       value: 'comida_semana', scores: { comodo: 2 } },
      { label: 'ropa (lista la noche anterior)',       value: 'ropa_prep',    scores: { comodo: 2 } },
      { label: 'gestiones que dejo para el último momento', value: 'gestiones_ant', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Planificación semanal', bestDays: 'Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: 'desordenado',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 7, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Preparar la semana evita gastos de urgencia ~50 €/mes',
    active: true, intent: 'gasto_evitado_planif_urgencia', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_64', format: 'fill_blank',
    text: 'He preferido la opción gratis a la de pago en: ____.',
    blankOptions: [
      { label: 'software o herramienta (alternativa gratuita)', value: 'software_libre',   scores: { comodo: 2 } },
      { label: 'ocio (parque, biblioteca, ruta)',                value: 'parque_gratis',    scores: { comodo: 2 } },
      { label: 'entretenimiento (streaming o podcast gratuito)', value: 'streaming_gratis', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 5, habitCategory: 'Opciones gratuitas', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: 'impulsivo',
    scenarioWeight: 2, priorityBase: 6, cooldownDays: 4, monthlyDelta: 20, yearlyDelta: 240,
    labelImpact: 'Elegir gratis ahorra ~20 €/mes',
    active: true, intent: 'gasto_evitado_opcion_gratis', habit_principle: 'obvious', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_65', format: 'fill_blank',
    text: 'He cocinado con lo que tenía en la despensa sin ir al supermercado: ____.',
    blankOptions: [
      { label: 'arroz, pasta o legumbres que tenía', value: 'arroz_verduras', scores: { comodo: 2 } },
      { label: 'una lata o conserva que estaba olvidada', value: 'lata_aprovechada', scores: { comodo: 2 } },
      { label: 'algo del congelador que tenía pendiente', value: 'congelado_util', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 8, habitCategory: 'Aprovechamiento despensa', bestDays: 'Cualquier día', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: 'desordenado',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 4, monthlyDelta: 32, yearlyDelta: 384,
    labelImpact: 'Aprovechar despensa evita ~4 compras extra/mes',
    active: true, intent: 'gasto_evitado_despensa', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_66', format: 'fill_blank',
    text: 'He rechazado el complemento o servicio extra que me ofrecieron al comprar: ____.',
    blankOptions: [
      { label: 'seguro o garantía extendida',     value: 'seguro_extra',        scores: { comodo: 2 } },
      { label: 'envío exprés (no urgía)',          value: 'envio_express',       scores: { comodo: 2 } },
      { label: 'accesorio o upgrade del producto', value: 'garantia_extendida', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 8, habitCategory: 'Upsell rechazado', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: 'impulsivo',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 5, monthlyDelta: 16, yearlyDelta: 192,
    labelImpact: 'Rechazar upsells ahorra ~16 €/mes',
    active: true, intent: 'gasto_evitado_upsell_rechazo', habit_principle: 'obvious', tone: 'preventivo', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_67', format: 'fill_blank',
    text: 'He optado por hacer yo mismo algo que normalmente pago: ____.',
    blankOptions: [
      { label: 'limpieza o mantenimiento del hogar', value: 'limpieza_casa', scores: { comodo: 2 } },
      { label: 'arreglo de ropa o costura',          value: 'arreglo_ropa',  scores: { comodo: 2 } },
      { label: 'un corte de pelo o cuidado personal', value: 'corte_pelo_casa', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'DIY ahorro', bestDays: 'Sábado, Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: '',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 7, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'DIY mensual ahorra ~30 €/mes',
    active: true, intent: 'gasto_evitado_diy', habit_principle: 'easy', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_68', format: 'fill_blank',
    text: 'He comprado la versión básica en vez de la premium de: ____.',
    blankOptions: [
      { label: 'un producto (marca blanca vs marca)',       value: 'producto_marca_blanca', scores: { comodo: 2 } },
      { label: 'un plan o app (básico en vez de premium)', value: 'plan_basico_app',        scores: { comodo: 2 } },
      { label: 'un dispositivo (modelo anterior o básico)', value: 'modelo_anterior',       scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Versión básica elegida', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'comodo', targetAvatarSecondary: 'impulsivo',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 5, monthlyDelta: 25, yearlyDelta: 300,
    labelImpact: 'Elegir básico ahorra ~25 €/mes',
    active: true, intent: 'gasto_evitado_version_basica', habit_principle: 'obvious', tone: 'motivador', difficulty: 'low', experimental: false,
  },

  // ── SOCIAL (nuevas Q_FB_69–Q_FB_76) ──────────────────────────────────────────
  {
    id: 'Q_FB_69', format: 'fill_blank',
    text: 'He organizado un plan en casa con amigos para ahorrar en: ____.',
    blankOptions: [
      { label: 'cena en casa (cocinamos juntos)',   value: 'cena_casa',   scores: { social: 2 } },
      { label: 'película o serie en casa',          value: 'pelicula_casa', scores: { social: 2 } },
      { label: 'juegos de mesa o actividad en casa', value: 'juegos_mesa', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Plan en casa', bestDays: 'Viernes, Sábado, Domingo', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: 'comodo',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 5, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Plan en casa vs fuera ahorra ~50 €/mes',
    active: true, intent: 'gasto_evitado_plan_casa', habit_principle: 'attractive', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_70', format: 'fill_blank',
    text: 'He comunicado al grupo mi límite de gasto antes de salir y lo hemos respetado: ____.',
    blankOptions: [
      { label: 'el límite de gasto de la noche',    value: 'limite_noche',    scores: { social: 2 } },
      { label: 'el tope máximo de la cena',         value: 'tope_cena',       scores: { social: 2 } },
      { label: 'el máximo por consumición o copa', value: 'max_consumicion', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Límite social comunicado', bestDays: 'Viernes, Sábado', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: 'desordenado',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 5, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Comunicar límite evita sobregastos grupales',
    active: true, intent: 'gasto_evitado_limite_comunicado', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_71', format: 'fill_blank',
    text: 'He elegido un plan cultural o de ocio económico en vez de uno caro: ____.',
    blankOptions: [
      { label: 'museo gratuito o con descuento', value: 'museo_gratis',   scores: { social: 2 } },
      { label: 'mercadillo o feria local',       value: 'mercadillo',    scores: { social: 2 } },
      { label: 'concierto o evento gratuito',    value: 'concierto_gratis', scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Ocio cultural barato', bestDays: 'Sábado, Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: '',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 7, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Ocio cultural gratis ahorra ~40 €/mes',
    active: true, intent: 'gasto_evitado_ocio_cultural', habit_principle: 'attractive', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_72', format: 'fill_blank',
    text: 'He acordado con el grupo un límite de regalo o aportación para: ____.',
    blankOptions: [
      { label: 'cumpleaños de un amigo',         value: 'cumple_amigo',    scores: { social: 2 } },
      { label: 'regalo conjunto entre varios',   value: 'regalo_conjunto', scores: { social: 2 } },
      { label: 'aportación a un viaje o escapada', value: 'aportacion_viaje', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Límite regalo acordado', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: 'impulsivo',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 14, monthlyDelta: 20, yearlyDelta: 240,
    labelImpact: 'Acordar límites de regalo evita sobregastos',
    active: true, intent: 'gasto_evitado_limite_regalo', habit_principle: 'obvious', tone: 'reflexivo', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_73', format: 'fill_blank',
    text: 'He salido antes para evitar que la noche se alargara y gastara más en: ____.',
    blankOptions: [
      { label: 'copas extra de madrugada',          value: 'copas_extra',      scores: { social: 2 } },
      { label: 'taxi de vuelta muy caro',            value: 'taxi_noche',       scores: { social: 2 } },
      { label: 'after o local improvisado más caro', value: 'after_improvisado', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Salida a tiempo', bestDays: 'Sábado, Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: 'impulsivo',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 5, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Salir antes evita escalada de gasto nocturno',
    active: true, intent: 'gasto_evitado_salida_tiempo', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_74', format: 'fill_blank',
    text: 'He preferido quedar a tomar algo sencillo en vez de ir a un sitio caro: ____.',
    blankOptions: [
      { label: 'terraza del barrio o bar local',   value: 'terraza_barrio', scores: { social: 2 } },
      { label: 'café o vermú sencillo',             value: 'cafe_sencillo',  scores: { social: 2 } },
      { label: 'sitio de toda la vida más barato', value: 'bar_local',      scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Bar económico elegido', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: 'comodo',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 4, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Bar del barrio vs caro ahorra ~30 €/mes',
    active: true, intent: 'gasto_evitado_bar_economico', habit_principle: 'attractive', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_75', format: 'fill_blank',
    text: 'He dividido bien la cuenta en vez de pagar de más por ser quien invita: ____.',
    blankOptions: [
      { label: 'pedí cuenta separada',             value: 'cuenta_separada', scores: { social: 2 } },
      { label: 'pagué solo lo mío (sin ronda)',    value: 'pagar_lo_mio',   scores: { social: 2 } },
      { label: 'usamos una app para dividir bien', value: 'app_split',      scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'División justa cuenta', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: 'desordenado',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 5, monthlyDelta: 20, yearlyDelta: 240,
    labelImpact: 'Dividir bien la cuenta evita pagar de más',
    active: true, intent: 'gasto_evitado_cuenta_justa', habit_principle: 'satisfying', tone: 'reflexivo', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_76', format: 'fill_blank',
    text: 'He propuesto una actividad gratuita al grupo en vez de gastar en: ____.',
    blankOptions: [
      { label: 'deporte en el parque o cancha gratis', value: 'deporte_parque',   scores: { social: 2 } },
      { label: 'ruta de senderismo o paseo en grupo',  value: 'ruta_senderismo',  scores: { social: 2 } },
      { label: 'barbacoa o picnic en casa/parque',     value: 'bbq_casa',         scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 25, habitCategory: 'Actividad gratuita liderada', bestDays: 'Sábado, Domingo', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'social', targetAvatarSecondary: 'comodo',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 7, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Liderar actividad gratis ahorra ~50 €/mes',
    active: true, intent: 'gasto_evitado_actividad_gratis', habit_principle: 'attractive', tone: 'motivador', difficulty: 'medium', experimental: false,
  },

  // ── IMPULSIVO (nuevas Q_FB_77–Q_FB_84) ───────────────────────────────────────
  {
    id: 'Q_FB_77', format: 'fill_blank',
    text: 'He cerrado la app o web de compras sin añadir nada al carrito en: ____.',
    blankOptions: [
      { label: 'Amazon o Aliexpress',         value: 'amazon_cerrado', scores: { impulsivo: 2 } },
      { label: 'tienda de ropa online',       value: 'zara_cerrado',   scores: { impulsivo: 2 } },
      { label: 'app de comida o delivery',    value: 'tienda_comida',  scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 30, habitCategory: 'App cerrada sin comprar', bestDays: 'Cualquier día', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: 'comodo',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 3, monthlyDelta: 60, yearlyDelta: 720,
    labelImpact: 'Cerrar app sin comprar evita ~60 €/mes',
    active: true, intent: 'gasto_evitado_app_cerrada', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_78', format: 'fill_blank',
    text: 'He esperado antes de comprar y al final he decidido no hacerlo porque: ____.',
    blankOptions: [
      { label: 'ya no lo quería tanto',              value: 'ya_no_lo_queria',  scores: { impulsivo: 2 } },
      { label: 'encontré una alternativa más barata', value: 'encontre_alternativa', scores: { impulsivo: 2 } },
      { label: 'me di cuenta de que ya tenía algo similar', value: 'ya_tenia_similar', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 25, habitCategory: 'Decisión de espera', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: 'desordenado',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 5, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Esperar antes de comprar ahorra ~50 €/mes',
    active: true, intent: 'gasto_evitado_espera_decision', habit_principle: 'obvious', tone: 'reflexivo', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_79', format: 'fill_blank',
    text: 'He evitado comprar algo que vi en un anuncio o historia de redes sociales: ____.',
    blankOptions: [
      { label: 'un producto de Instagram o TikTok', value: 'producto_instagram', scores: { impulsivo: 2 } },
      { label: 'ropa o accesorio de un influencer',  value: 'ropa_tiktok',       scores: { impulsivo: 2 } },
      { label: 'un plan o servicio anunciado',       value: 'plan_anuncio',      scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 25, habitCategory: 'Publicidad ignorada', bestDays: 'Cualquier día', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: 'social',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Ignorar publicidad en redes ahorra ~50 €/mes',
    active: true, intent: 'gasto_evitado_publicidad_redes', habit_principle: 'obvious', tone: 'motivador', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_80', format: 'fill_blank',
    text: 'He pensado si realmente lo necesitaba y he decidido no comprar: ____.',
    blankOptions: [
      { label: 'una prenda de ropa nueva',     value: 'ropa_nueva',      scores: { impulsivo: 2 } },
      { label: 'un gadget o accesorio tech',   value: 'gadget_tech',     scores: { impulsivo: 2 } },
      { label: 'un artículo de decoración',    value: 'accesorio_hogar', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 30, habitCategory: 'Reflexión antes de comprar', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 60, yearlyDelta: 720,
    labelImpact: 'Reflexionar antes de comprar ahorra ~60 €/mes',
    active: true, intent: 'gasto_evitado_reflexion_compra', habit_principle: 'obvious', tone: 'reflexivo', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_81', format: 'fill_blank',
    text: 'He desactivado las notificaciones de una app de compras para evitar tentaciones de: ____.',
    blankOptions: [
      { label: 'alertas de ofertas de Amazon o tiendas', value: 'alertas_amazon',  scores: { impulsivo: 2 } },
      { label: 'notificaciones de ropa o moda',          value: 'noti_ropa',       scores: { impulsivo: 2 } },
      { label: 'emails de ofertas y newsletters',        value: 'email_ofertas',   scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 0, habitCategory: 'Fricción digital añadida', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: 'desordenado',
    scenarioWeight: 2, priorityBase: 8, cooldownDays: 14, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Desactivar notificaciones reduce compras impulsivas',
    active: true, intent: 'gasto_evitado_notif_desactivadas', habit_principle: 'obvious', tone: 'preventivo', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_82', format: 'fill_blank',
    text: 'He comprado la versión de segunda mano en vez de nueva de: ____.',
    blankOptions: [
      { label: 'ropa o complementos (Vinted, Wallapop)', value: 'ropa_segunda',   scores: { impulsivo: 2 } },
      { label: 'libro o juego (segunda mano)',           value: 'libro_segunda',  scores: { impulsivo: 2 } },
      { label: 'mueble o artículo de hogar',             value: 'mueble_segunda', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Segunda mano elegida', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: 'comodo',
    scenarioWeight: 2, priorityBase: 8, cooldownDays: 7, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Segunda mano ahorra ~40 €/mes',
    active: true, intent: 'gasto_evitado_segunda_mano', habit_principle: 'easy', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_83', format: 'fill_blank',
    text: 'He frenado una compra emocional reconociendo que era por: ____.',
    blankOptions: [
      { label: 'aburrimiento o falta de estímulo',     value: 'aburrimiento',    scores: { impulsivo: 2 } },
      { label: 'estrés o mal día en el trabajo',       value: 'estres_laboral',  scores: { impulsivo: 2 } },
      { label: 'presión del grupo o ganas de encajar', value: 'presion_social',  scores: { social: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 20, habitCategory: 'Compra emocional frenada', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: 'social',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 4, monthlyDelta: 60, yearlyDelta: 720,
    labelImpact: 'Identificar emoción detrás de la compra la para',
    active: true, intent: 'gasto_evitado_compra_emocional_reconocida', habit_principle: 'obvious', tone: 'reflexivo', difficulty: 'high', experimental: false,
  },
  {
    id: 'Q_FB_84', format: 'fill_blank',
    text: 'He utilizado lo que ya tenía en vez de comprar algo nuevo para: ____.',
    blankOptions: [
      { label: 'vestirme (ropa del armario que no usaba)', value: 'ropa_armario',     scores: { impulsivo: 2 } },
      { label: 'una tarea (herramienta que ya tenía)',     value: 'herramienta_casa', scores: { impulsivo: 2 } },
      { label: 'un uso (producto viejo aún útil)',         value: 'producto_viejo',   scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Reutilizar lo que hay', bestDays: 'Cualquier día', bestTimeWindow: 'Tarde',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'impulsivo', targetAvatarSecondary: 'desordenado',
    scenarioWeight: 2, priorityBase: 8, cooldownDays: 5, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Reutilizar antes de comprar ahorra ~30 €/mes',
    active: true, intent: 'gasto_evitado_reutilizar', habit_principle: 'easy', tone: 'motivador', difficulty: 'medium', experimental: false,
  },

  // ── DESORDENADO (nuevas Q_FB_85–Q_FB_92) ─────────────────────────────────────
  {
    id: 'Q_FB_85', format: 'fill_blank',
    text: 'He encontrado y cancelado un servicio activo que no usaba: ____.',
    blankOptions: [
      { label: 'gimnasio o clases que no iba',    value: 'gym_no_usado',  scores: { desordenado: 2 } },
      { label: 'app o herramienta olvidada',       value: 'app_olvidada', scores: { desordenado: 2 } },
      { label: 'servicio con renovación automática', value: 'servicio_aut', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Servicio cancelado', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Inicio', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: 'impulsivo',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 14, monthlyDelta: 25, yearlyDelta: 300,
    labelImpact: 'Cancelar servicios sin usar ahorra ~25 €/mes',
    active: true, intent: 'gasto_evitado_servicio_cancelado', habit_principle: 'satisfying', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_86', format: 'fill_blank',
    text: 'He revisado mis finanzas esta semana y he identificado dónde puedo ahorrar: ____.',
    blankOptions: [
      { label: 'suscripciones o cargos automáticos', value: 'suscripciones_rev', scores: { desordenado: 2 } },
      { label: 'gastos hormiga del día a día',        value: 'gastos_hormiga',   scores: { desordenado: 2 } },
      { label: 'gastos de comodidad innecesarios',    value: 'comodidad_innec',  scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 0, habitCategory: 'Revisión financiera activa', bestDays: 'Domingo, Lunes', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: 'comodo',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 7, monthlyDelta: 35, yearlyDelta: 420,
    labelImpact: 'Revisar finanzas semanalmente identifica ahorros',
    active: true, intent: 'gasto_evitado_revision_finanzas', habit_principle: 'satisfying', tone: 'reflexivo', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_87', format: 'fill_blank',
    text: 'He comparado precios antes de comprar y he elegido la opción más barata de: ____.',
    blankOptions: [
      { label: 'supermercado (marca blanca vs marca)', value: 'supermercado_comp', scores: { desordenado: 2 } },
      { label: 'seguro o contrato (comparador online)', value: 'seguro_comp',      scores: { desordenado: 2 } },
      { label: 'un servicio o producto de ocio',       value: 'servicio_comp',    scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Comparación de precios', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: 'impulsivo',
    scenarioWeight: 2, priorityBase: 8, cooldownDays: 5, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Comparar precios ahorra ~30 €/mes',
    active: true, intent: 'gasto_evitado_comparacion_precios', habit_principle: 'obvious', tone: 'motivador', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_88', format: 'fill_blank',
    text: 'He creado un presupuesto para esta categoría de gasto y lo he seguido: ____.',
    blankOptions: [
      { label: 'presupuesto de ocio del mes',  value: 'presup_ocio',   scores: { desordenado: 2 } },
      { label: 'presupuesto de alimentación',  value: 'presup_comida', scores: { desordenado: 2 } },
      { label: 'presupuesto de ropa',          value: 'presup_ropa',   scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 0, habitCategory: 'Presupuesto por categoría', bestDays: 'Domingo, Lunes', bestTimeWindow: 'Mañana',
    monthPhase: 'Inicio', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: '',
    scenarioWeight: 3, priorityBase: 8, cooldownDays: 30, monthlyDelta: 40, yearlyDelta: 480,
    labelImpact: 'Tener presupuesto por categoría limita el gasto',
    active: true, intent: 'gasto_evitado_presupuesto_categoria', habit_principle: 'obvious', tone: 'reflexivo', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_89', format: 'fill_blank',
    text: 'He anotado todos los gastos del día para no perder el control de: ____.',
    blankOptions: [
      { label: 'gastos en efectivo que suelo olvidar', value: 'gastos_efectivo', scores: { desordenado: 2 } },
      { label: 'pagos pequeños con tarjeta',           value: 'gastos_tarjeta',  scores: { desordenado: 2 } },
      { label: 'micro-gastos de conveniencia diarios', value: 'micro_gastos',    scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 0, habitCategory: 'Registro de gastos diario', bestDays: 'Cualquier día', bestTimeWindow: 'Noche',
    monthPhase: 'Cualquiera', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: 'comodo',
    scenarioWeight: 2, priorityBase: 7, cooldownDays: 3, monthlyDelta: 25, yearlyDelta: 300,
    labelImpact: 'Registrar gastos diariamente da conciencia y control',
    active: true, intent: 'gasto_evitado_registro_diario', habit_principle: 'satisfying', tone: 'reflexivo', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_90', format: 'fill_blank',
    text: 'He negociado o buscado una oferta mejor antes de renovar: ____.',
    blankOptions: [
      { label: 'tarifa de móvil o internet',       value: 'movil_renegoc',   scores: { desordenado: 2 } },
      { label: 'seguro (coche, hogar, salud)',      value: 'seguro_renegoc',  scores: { desordenado: 2 } },
      { label: 'tarifa de luz o gas',               value: 'internet_renegoc', scores: { desordenado: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 10, habitCategory: 'Negociación de contratos', bestDays: 'Cualquier día', bestTimeWindow: 'Mañana',
    monthPhase: 'Inicio', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: '',
    scenarioWeight: 2, priorityBase: 8, cooldownDays: 30, monthlyDelta: 20, yearlyDelta: 240,
    labelImpact: 'Renegociar tarifas ahorra ~20 €/mes',
    active: true, intent: 'gasto_evitado_negociacion', habit_principle: 'satisfying', tone: 'motivador', difficulty: 'medium', experimental: false,
  },
  {
    id: 'Q_FB_91', format: 'fill_blank',
    text: 'He hecho una auditoría rápida de mis gastos del mes y he encontrado: ____.',
    blankOptions: [
      { label: 'gastos hormiga que no controlaba',    value: 'gasto_hormiga_mes', scores: { desordenado: 2 } },
      { label: 'suscripción innecesaria que cancelaré', value: 'sub_innecesaria', scores: { desordenado: 2 } },
      { label: 'un impulso grande del que no era consciente', value: 'impulso_grande', scores: { impulsivo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 15, habitCategory: 'Auditoría mensual rápida', bestDays: 'Domingo, Lunes', bestTimeWindow: 'Mañana',
    monthPhase: 'Final', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: 'impulsivo',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 30, monthlyDelta: 30, yearlyDelta: 360,
    labelImpact: 'Auditoría mensual identifica ~30 €/mes de margen',
    active: true, intent: 'gasto_evitado_auditoria_rapida', habit_principle: 'satisfying', tone: 'reflexivo', difficulty: 'low', experimental: false,
  },
  {
    id: 'Q_FB_92', format: 'fill_blank',
    text: 'He configurado un ahorro automático para no depender de la fuerza de voluntad en: ____.',
    blankOptions: [
      { label: 'transferencia automática a cuenta ahorro', value: 'transferencia_aut', scores: { desordenado: 2 } },
      { label: 'regla de redondeo o ahorro inteligente',   value: 'regla_redondeo',   scores: { desordenado: 2 } },
      { label: 'cuenta separada de ahorros sin tarjeta',   value: 'cuenta_ahorro_sep', scores: { comodo: 2 } },
    ],
    allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70,
    suggestedAmount: 50, habitCategory: 'Ahorro automático', bestDays: 'Domingo, Lunes', bestTimeWindow: 'Mañana',
    monthPhase: 'Inicio', targetAvatarPrimary: 'desordenado', targetAvatarSecondary: 'comodo',
    scenarioWeight: 3, priorityBase: 9, cooldownDays: 30, monthlyDelta: 50, yearlyDelta: 600,
    labelImpact: 'Ahorro automático asegura consistencia sin esfuerzo',
    active: true, intent: 'gasto_evitado_ahorro_automatico', habit_principle: 'easy', tone: 'motivador', difficulty: 'low', experimental: false,
  },
"""

# Insertar las nuevas preguntas antes del cierre del array Q_FILL_BLANK (antes de "];")
# El cierre del array está en la línea con "];"
# Lo hacemos buscando el último cierre del array fill_blank
MARKER = '];\n\n// ═══════════════════════════════════════════════════════════════════════════════\n// Banco completo y helpers'
if MARKER not in content:
    # Buscar alternativa
    print("MARKER no encontrado, buscando alternativa...")
    # Buscar el último ]; antes del export
    idx = content.rfind('];\n\n/**\n * Banco completo')
    if idx == -1:
        idx = content.rfind('];\n\nexport const DAILY_QUESTIONS_BANK')
    print(f"Posición encontrada: {idx}")
    insert_pos = idx
    content = content[:insert_pos] + NEW_FB_QUESTIONS + content[insert_pos:]
else:
    insert_pos = content.find(MARKER)
    content = content[:insert_pos] + NEW_FB_QUESTIONS + content[insert_pos:]

# Actualizar comentario de header
content = content.replace(
    '15 preguntas × 8 combinaciones (amount):\n *   1. Cómodo   / conveniencia_inmediata  (Q_CI_01 – Q_CI_15)\n *   2. Cómodo   / improvisador            (Q_IM_01 – Q_IM_15)\n *   3. Social   / fomo_social             (Q_FS_01 – Q_FS_15)\n *   4. Social   / plan_que_se_alarga      (Q_PA_01 – Q_PA_15)\n *   5. Impulsivo / antojo_emocional       (Q_AE_01 – Q_AE_15)\n *   6. Impulsivo / cazador_de_ofertas     (Q_CO_01 – Q_CO_15)\n *   7. Desordenado / microfugas           (Q_MF_01 – Q_MF_15)\n *   8. Desordenado / sin_sistema          (Q_SS_01 – Q_SS_15)\n *\n * 12 preguntas fill_blank orientadas a ahorro (Q_FB_01 – Q_FB_12)',
    '7-8 preguntas × 8 combinaciones (amount) = 60:\n *   1. Cómodo   / conveniencia_inmediata  (Q_CI)\n *   2. Cómodo   / improvisador            (Q_IM)\n *   3. Social   / fomo_social             (Q_FS)\n *   4. Social   / plan_que_se_alarga      (Q_PA)\n *   5. Impulsivo / antojo_emocional       (Q_AE)\n *   6. Impulsivo / cazador_de_ofertas     (Q_CO)\n *   7. Desordenado / microfugas           (Q_MF)\n *   8. Desordenado / sin_sistema          (Q_SS)\n *\n * 80 preguntas fill_blank orientadas a ahorro (Q_FB_01 – Q_FB_92)'
)

# Actualizar comentario del export
content = content.replace(
    "* Banco completo de preguntas.\n * Tipos disponibles: 'amount' (120 preguntas) y 'fill_blank' (60 preguntas).\n * Total: 180 preguntas activas.",
    "* Banco completo de preguntas.\n * Tipos disponibles: 'amount' (60 preguntas) y 'fill_blank' (80 preguntas).\n * Total: 140 preguntas activas."
)

with open(TS_PATH, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\n✅ dailyQuestionsBank.ts actualizado.")

# Verificar conteo
amount_count = content.count("format: 'amount'") + content.count('format: \'amount\'')
fb_count = content.count("format: 'fill_blank'") + content.count('format: \'fill_blank\'')
# Contar por llamadas a q()
q_calls = content.count("  q('Q_")
fb_objects = content.count("id: 'Q_FB_")
print(f"  amount lines con q(): ~{q_calls} (aprox)")
print(f"  fill_blank objects: {fb_objects}")
