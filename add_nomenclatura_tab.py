"""
Añade una nueva pestaña "📖 Nomenclatura y Guía" al Excel existente
con la descripción detallada de cada columna, valores posibles y ejemplos.
"""

import sys
sys.stdout.reconfigure(encoding='utf-8')

import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.styles.colors import Color
from openpyxl.utils import get_column_letter

EXCEL_PATH = r'definitivoPlantilla_ESTETICO.xlsx'

# ──────────────────────────────────────────────────────────────────────────────
# COLORES
# ──────────────────────────────────────────────────────────────────────────────
def fill(hex6):
    return PatternFill(fill_type="solid", fgColor=Color(rgb="FF" + hex6))

def font(bold=False, color="000000", size=10, italic=False, name="Calibri"):
    return Font(bold=bold, color=color, size=size, italic=italic, name=name)

def border_bottom(color="C0C0C0"):
    s = Side(style="thin", color=color)
    return Border(bottom=s)

def border_all(color="D0D0D0"):
    s = Side(style="thin", color=color)
    return Border(left=s, right=s, top=s, bottom=s)

def align(h="left", v="center", wrap=True):
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap)

def merge_apply(ws, r, c1, c2, value, fill_style, font_style, align_style=None):
    ws.merge_cells(start_row=r, start_column=c1, end_row=r, end_column=c2)
    cell = ws.cell(row=r, column=c1)
    cell.value = value
    cell.fill = fill_style
    cell.font = font_style
    cell.alignment = align_style or align("left", "center", False)
    return cell

# ──────────────────────────────────────────────────────────────────────────────
# DATOS: NOMENCLATURA DETALLADA
# ──────────────────────────────────────────────────────────────────────────────
# Estructura: (grupo_color, grupo_nombre, columnas)
# Columna: (nombre, tipo, descripcion_larga, valores_posibles, ejemplo)

GRUPOS = [
    {
        "color": "0F3460",
        "nombre": "🔑  IDENTIFICACIÓN",
        "descripcion": "Campos que identifican de forma única cada pregunta y permiten referenciarla desde código, base de datos y motor de selección.",
        "columnas": [
            {
                "nombre": "ID",
                "tipo": "Texto · Clave primaria",
                "descripcion": (
                    "Identificador único de la pregunta. Sigue el patrón Q_<SEGMENTO>_<NÚMERO>.\n"
                    "El segmento determina el avatar y el patrón conductual al que va dirigida la pregunta.\n"
                    "Este ID es el que usa el motor de selección, la base de datos y el sistema de cooldown.\n"
                    "No debe repetirse ni modificarse una vez la pregunta ha sido respondida por un usuario."
                ),
                "valores": (
                    "Q_CI_XX → Cómodo / Conveniencia Inmediata\n"
                    "Q_IM_XX → Cómodo / Improvisador\n"
                    "Q_FS_XX → Social / Fomo Social\n"
                    "Q_PA_XX → Social / Plan que se Alarga\n"
                    "Q_AE_XX → Impulsivo / Antojo Emocional\n"
                    "Q_CO_XX → Impulsivo / Cazador de Ofertas\n"
                    "Q_MF_XX → Desordenado / Microfugas\n"
                    "Q_SS_XX → Desordenado / Sin Sistema\n"
                    "Q_FB_XX → Fill Blank genérico (transversal)"
                ),
                "ejemplo": "Q_CI_01, Q_FB_37, Q_AE_03",
            },
            {
                "nombre": "Formato",
                "tipo": "Enum",
                "descripcion": (
                    "Define el tipo de interacción que el usuario tiene con la pregunta en la app.\n"
                    "Cada formato tiene un componente visual y de UX distinto.\n"
                    "'amount' es la pregunta más sencilla: el usuario simplemente introduce cuánto ha ahorrado.\n"
                    "'fill_blank' muestra una frase con un hueco y un desplegable con 3 opciones + 'Otro' libre."
                ),
                "valores": (
                    "amount     → Pregunta directa con campo de importe numérico\n"
                    "fill_blank → Frase incompleta con hueco + desplegable de opciones + 'Otro' con IA"
                ),
                "ejemplo": "amount, fill_blank",
            },
            {
                "nombre": "Estado",
                "tipo": "Enum",
                "descripcion": (
                    "Indica si la pregunta está activa y puede ser mostrada al usuario.\n"
                    "Las preguntas inactivas se mantienen en el banco como histórico pero el motor de selección las ignora.\n"
                    "Útil para retirar preguntas sin eliminarlas, manteniendo el historial de respuestas."
                ),
                "valores": (
                    "ACTIVO  → Visible y seleccionable por el motor\n"
                    "activo  → Equivalente (se normaliza internamente)\n"
                    "INACTIVO → Excluida del motor de selección"
                ),
                "ejemplo": "ACTIVO",
            },
        ],
    },
    {
        "color": "1565C0",
        "nombre": "💬  CONTENIDO",
        "descripcion": "El texto que el usuario ve en la app. Es la parte más visible del banco de preguntas.",
        "columnas": [
            {
                "nombre": "Texto de la Pregunta",
                "tipo": "Texto largo",
                "descripcion": (
                    "Texto exacto que aparece en la pantalla del usuario.\n"
                    "Para preguntas 'amount': redactada como escenario condicional (Si hoy has… ¿cuánto?)\n"
                    "Para preguntas 'fill_blank': frase con el hueco indicado con ____ al final.\n"
                    "El tono debe ser cercano, motivador y en segunda persona (tú).\n"
                    "Debe describir un logro concreto de ahorro ya realizado, no una intención futura."
                ),
                "valores": "Texto libre (máx. recomendado: 120 caracteres)",
                "ejemplo": "Si hoy has cocinado en casa en vez de pedir delivery, ¿cuánto te has ahorrado?",
            },
            {
                "nombre": "Categoría de Hábito",
                "tipo": "Texto · Etiqueta",
                "descripcion": (
                    "Categoría temática del hábito de ahorro que trabaja esta pregunta.\n"
                    "Se usa para agrupar preguntas por área en el dashboard de analytics.\n"
                    "También permite al sistema evitar mostrar preguntas de la misma categoría en días consecutivos."
                ),
                "valores": (
                    "Delivery, Cafés, Transporte, Comida, Compras, Servicios, Snacks,\n"
                    "Planificación, Ocio gratis, FOMO, Escalada social, Impulso,\n"
                    "Compra online, Suscripciones, Microfugas, Organización financiera, etc."
                ),
                "ejemplo": "Delivery, Planificación semanal, Escalada social",
            },
        ],
    },
    {
        "color": "00695C",
        "nombre": "👤  CLASIFICACIÓN DE AVATAR",
        "descripcion": "Define a qué perfil de usuario (avatar) va dirigida la pregunta y cómo afecta al scoring del perfil.",
        "columnas": [
            {
                "nombre": "Avatar Primario",
                "tipo": "Enum · FK a perfil",
                "descripcion": (
                    "Avatar principal al que va dirigida la pregunta.\n"
                    "El motor de selección prioriza preguntas cuyo avatar primario coincide con el perfil del usuario.\n"
                    "Los 4 avatares representan patrones conductuales de gasto detectados en la app."
                ),
                "valores": (
                    "comodo     → Gasta por comodidad y conveniencia\n"
                    "social     → Gasta por presión social o FOMO\n"
                    "impulsivo  → Compra por impulso, emoción o capricho\n"
                    "desordenado → Gasta por falta de planificación y control"
                ),
                "ejemplo": "comodo, social, impulsivo, desordenado",
            },
            {
                "nombre": "Avatar Secundario",
                "tipo": "Enum · Opcional",
                "descripcion": (
                    "Avatar secundario que también puede beneficiarse de esta pregunta.\n"
                    "Permite que la pregunta sea mostrada a usuarios con perfil mixto.\n"
                    "También determina qué opción del fill_blank puntúa al avatar secundario.\n"
                    "Puede estar vacío si la pregunta es muy específica de un único avatar."
                ),
                "valores": "comodo, social, impulsivo, desordenado (o vacío)",
                "ejemplo": "impulsivo (en una pregunta de avatar primario 'comodo')",
            },
        ],
    },
    {
        "color": "006064",
        "nombre": "🔘  OPCIONES (solo fill_blank)",
        "descripcion": "Define las 3 opciones del desplegable que el usuario ve cuando la pregunta es de tipo fill_blank. Cada opción tiene scoring por avatar.",
        "columnas": [
            {
                "nombre": "Opciones de Respuesta",
                "tipo": "Texto estructurado",
                "descripcion": (
                    "Solo para preguntas fill_blank. Las 3 opciones del desplegable.\n"
                    "Formato: label [avatar+puntos] | label [avatar+puntos] | label [avatar+puntos]\n"
                    "Opciones 1 y 2 apuntan al avatar primario. Opción 3 al secundario.\n"
                    "El label es el texto visible en el desplegable.\n"
                    "El value (usado internamente) se deriva del label en el código.\n"
                    "La opción 'Otro' siempre se añade implícitamente y permite texto libre analizado por IA."
                ),
                "valores": "label [avatar+pts] | label [avatar+pts] | label [avatar+pts]",
                "ejemplo": "pasta rápida [comodo+2] | tortilla [comodo+2] | sobras de la nevera [impulsivo+2]",
            },
            {
                "nombre": "Scoring por Opción (JSON)",
                "tipo": "JSON",
                "descripcion": (
                    "Scoring detallado en formato JSON para el sistema de perfilado.\n"
                    "Cada opción puede puntuar a múltiples avatares con distintos pesos.\n"
                    "Este JSON es el que procesa el motor internamente en dailyQuestionsBank.ts.\n"
                    "Formato: array de objetos con label, value y scores (objeto avatar:puntos).\n"
                    "Para preguntas 'amount' este campo está vacío (no hay opciones)."
                ),
                "valores": '[{"label":"texto","value":"clave","scores":{"avatar":puntos}}, ...]',
                "ejemplo": '[{"label":"pasta rápida","value":"pasta_rapida","scores":{"comodo":2}}]',
            },
        ],
    },
    {
        "color": "4E342E",
        "nombre": "🤖  INTELIGENCIA ARTIFICIAL",
        "descripcion": "Configuración del análisis por IA para la opción 'Otro' de tipo free-text en preguntas fill_blank.",
        "columnas": [
            {
                "nombre": "Permite Otro",
                "tipo": "Boolean",
                "descripcion": (
                    "Si es 'true', la pregunta fill_blank muestra una opción adicional 'Otro' que abre un campo de texto libre.\n"
                    "El usuario puede escribir su propio caso de ahorro.\n"
                    "Siempre es 'true' en preguntas fill_blank activas. En preguntas 'amount' es siempre 'false'."
                ),
                "valores": "true / false",
                "ejemplo": "true",
            },
            {
                "nombre": "IA requerida para Otro",
                "tipo": "Boolean",
                "descripcion": (
                    "Si es 'true', cuando el usuario elige 'Otro' y escribe texto libre,\n"
                    "ese texto se envía a la IA (Gemini) para análisis de intención conductual.\n"
                    "La IA determina a qué avatar puntúa y con qué puntos.\n"
                    "Si la IA no supera el umbral de confianza, la respuesta no suma puntos a ningún avatar."
                ),
                "valores": "true / false",
                "ejemplo": "true",
            },
            {
                "nombre": "Umbral Confianza IA",
                "tipo": "Decimal 0-1",
                "descripcion": (
                    "Confianza mínima que debe obtener la IA para que la respuesta libre del usuario\n"
                    "sume puntos al perfil de avatar.\n"
                    "Si la confianza de la IA es menor que este umbral, la respuesta se acepta\n"
                    "pero no afecta al scoring del perfil.\n"
                    "Valor estándar: 0.70 (70% de confianza mínima)."
                ),
                "valores": "0.0 a 1.0 (recomendado: 0.70)",
                "ejemplo": "0.70",
            },
        ],
    },
    {
        "color": "880E4F",
        "nombre": "💰  IMPACTO ECONÓMICO",
        "descripcion": "Valores económicos que el sistema usa para calcular y mostrar el ahorro generado por el usuario.",
        "columnas": [
            {
                "nombre": "Placeholder Importe (€)",
                "tipo": "Número entero",
                "descripcion": (
                    "Importe sugerido que aparece como hint o valor por defecto en el campo de importe.\n"
                    "Para preguntas 'amount': es el importe típico de ese ahorro concreto.\n"
                    "Para preguntas 'fill_blank': puede ser 0 (el usuario lo introduce libremente).\n"
                    "El usuario siempre puede modificarlo. Nunca se usa como valor forzado."
                ),
                "valores": "Número entero en euros (0 si no aplica)",
                "ejemplo": "12 (para un pedido de delivery evitado)",
            },
            {
                "nombre": "Ahorro Mensual Interno (€)",
                "tipo": "Número entero",
                "descripcion": (
                    "Estimación interna del ahorro mensual si el usuario repite este hábito sistemáticamente.\n"
                    "NUNCA se muestra al usuario directamente.\n"
                    "Se usa para calcular métricas internas y para ordenar preguntas por impacto.\n"
                    "Se calcula asumiendo una frecuencia realista (ej: 4 veces/semana para delivery)."
                ),
                "valores": "Número entero en euros/mes",
                "ejemplo": "48 (evitar 4 pedidos delivery/mes × 12€)",
            },
            {
                "nombre": "Ahorro Anual Interno (€)",
                "tipo": "Número entero",
                "descripcion": (
                    "Estimación interna del ahorro anual = Ahorro Mensual × 12.\n"
                    "NUNCA se muestra al usuario directamente.\n"
                    "Se usa para el cálculo del impacto anual proyectado en el dashboard interno."
                ),
                "valores": "Número entero en euros/año",
                "ejemplo": "576 (48€/mes × 12 meses)",
            },
            {
                "nombre": "Impacto Interno",
                "tipo": "Texto corto",
                "descripcion": (
                    "Descripción corta del impacto económico del hábito.\n"
                    "Texto interno para analytics y validación. No se muestra en la app.\n"
                    "Explica el cálculo detrás del ahorro mensual estimado."
                ),
                "valores": "Texto libre (máx. 80 caracteres)",
                "ejemplo": "Evitar 1 pedido semanal ahorra ~48 €/mes",
            },
        ],
    },
    {
        "color": "E65100",
        "nombre": "📅  CONTEXTO TEMPORAL",
        "descripcion": "Define cuándo es más relevante mostrar esta pregunta. El motor de selección usa estos campos para elegir la pregunta óptima según día, hora y fase del mes.",
        "columnas": [
            {
                "nombre": "Mejor Día",
                "tipo": "Texto / Lista de días",
                "descripcion": (
                    "Días de la semana en los que esta pregunta es más relevante y probable.\n"
                    "El motor prioriza preguntas cuyo 'Mejor Día' coincide con el día actual.\n"
                    "Se puede indicar un día solo, varios separados por coma, o 'Cualquier día'.\n"
                    "También se admite 'Lunes a Viernes' para preguntas laborales."
                ),
                "valores": (
                    "Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo\n"
                    "Cualquier día · Lunes a Viernes · Sábado, Domingo"
                ),
                "ejemplo": "Lunes, Martes, Miércoles, Jueves (preguntas de delivery de diario)",
            },
            {
                "nombre": "Mejor Franja",
                "tipo": "Enum",
                "descripcion": (
                    "Franja horaria en la que esta pregunta es más relevante.\n"
                    "El motor de selección puede actualizar la pregunta cuando cambia la franja horaria\n"
                    "(si el usuario aún no ha respondido la pregunta del día).\n"
                    "Franjas definidas: Madrugada 0-6h, Mañana 6-14h, Tarde 14-20h, Noche 20-24h."
                ),
                "valores": "Mañana · Tarde · Noche · Madrugada · Cualquiera",
                "ejemplo": "Noche (para preguntas de delivery) · Mañana (para cafés y transporte)",
            },
            {
                "nombre": "Fase del Mes",
                "tipo": "Enum",
                "descripcion": (
                    "Fase del mes en la que esta pregunta encaja mejor.\n"
                    "Inicio: días 1-10 (post-cobro, revisión de contratos).\n"
                    "Mitad: días 11-20 (control del gasto en curso).\n"
                    "Final: días 21-31 (reflexión, revisión de extracto).\n"
                    "Cualquiera: válida en cualquier momento del mes."
                ),
                "valores": "Inicio · Mitad · Final · Cualquiera",
                "ejemplo": "Inicio (revisión de suscripciones post-cobro) · Final (auditoría mensual)",
            },
            {
                "nombre": "Cooldown (días)",
                "tipo": "Número entero",
                "descripcion": (
                    "Número mínimo de días que deben pasar antes de volver a mostrar esta pregunta al mismo usuario.\n"
                    "Evita que el usuario vea la misma pregunta demasiado pronto.\n"
                    "Cooldown bajo (2-3): preguntas de hábitos diarios (delivery, café).\n"
                    "Cooldown medio (7): preguntas semanales (meal prep, revisión semanal).\n"
                    "Cooldown alto (14-30): preguntas de revisión mensual o cancelación de contratos."
                ),
                "valores": "Entero en días (mínimo 1, recomendado 2-30)",
                "ejemplo": "2 (delivery diario) · 7 (revisión semanal) · 30 (auditoría mensual)",
            },
        ],
    },
    {
        "color": "880E4F",
        "nombre": "⚖️  SCORING Y PRIORIDAD",
        "descripcion": "Parámetros que usa el motor de selección para puntuar y ordenar las preguntas candidatas. Cuanto mayor el score, más probable que se muestre.",
        "columnas": [
            {
                "nombre": "Priority Base",
                "tipo": "Entero 1-10",
                "descripcion": (
                    "Prioridad base de la pregunta en el motor de selección (1=baja, 10=máxima).\n"
                    "Se combina con el Scenario Weight y el contexto temporal para calcular el score final.\n"
                    "Preguntas con mayor impacto económico y mayor relevancia conductual tienen prioridad más alta.\n"
                    "9-10: preguntas estrella de alta frecuencia e impacto.\n"
                    "7-8: preguntas importantes pero más contextuales.\n"
                    "4-6: preguntas de apoyo y refuerzo."
                ),
                "valores": "1 a 10",
                "ejemplo": "9 (delivery evitado) · 6 (botella de agua)",
            },
            {
                "nombre": "Scenario Weight",
                "tipo": "Entero 1-3",
                "descripcion": (
                    "Peso del escenario en el cálculo del score final.\n"
                    "Multiplica la prioridad base cuando el contexto temporal coincide exactamente.\n"
                    "3: escenario de alta importancia estratégica.\n"
                    "2: escenario relevante pero no crítico.\n"
                    "1: escenario de apoyo o baja frecuencia."
                ),
                "valores": "1, 2 o 3",
                "ejemplo": "3 (delivery nocturno entre semana) · 1 (botella de agua)",
            },
        ],
    },
    {
        "color": "BF360C",
        "nombre": "🏷️  METADATOS CONDUCTUALES",
        "descripcion": "Etiquetas que clasifican la pregunta según su función conductual. Se usan para analytics, filtros y para que la IA comprenda el propósito de cada pregunta.",
        "columnas": [
            {
                "nombre": "Intent (técnico)",
                "tipo": "Texto · snake_case",
                "descripcion": (
                    "Intención conductual de la pregunta en formato técnico (snake_case).\n"
                    "Identifica el tipo de comportamiento de ahorro que registra la pregunta.\n"
                    "Se usa en analytics para agrupar preguntas por intención y medir conversión.\n"
                    "También es el identificador que usa la IA para clasificar respuestas libres."
                ),
                "valores": "Texto en snake_case sin tildes ni espacios",
                "ejemplo": "delivery_conveniencia_inmediata · gasto_evitado_compra_emocional",
            },
            {
                "nombre": "Habit Principle",
                "tipo": "Enum (Atomic Habits)",
                "descripcion": (
                    "Principio de formación de hábitos (framework Atomic Habits de James Clear)\n"
                    "al que apela esta pregunta.\n"
                    "obvious:    Hacer el buen hábito más visible/consciente.\n"
                    "attractive: Hacer el buen hábito más atractivo y deseable.\n"
                    "easy:       Reducir la fricción del buen hábito.\n"
                    "satisfying: Hacer el buen hábito recompensante e inmediatamente satisfactorio."
                ),
                "valores": "obvious · attractive · easy · satisfying",
                "ejemplo": "obvious (cerrar app sin comprar) · easy (cocinar en casa)",
            },
            {
                "nombre": "Tono",
                "tipo": "Enum",
                "descripcion": (
                    "Tono emocional del mensaje. Define cómo se comunica la app con el usuario.\n"
                    "motivador:   Celebra el logro y refuerza la identidad de ahorro.\n"
                    "reflexivo:   Invita a la toma de conciencia sin juzgar.\n"
                    "preventivo:  Alerta sobre un patrón de gasto antes de que ocurra.\n"
                    "celebratorio: Celebra un hito o racha de ahorro.\n"
                    "directo:     Comunicación clara y sin adornos.\n"
                    "neutral:     Sin carga emocional explícita."
                ),
                "valores": "motivador · reflexivo · preventivo · celebratorio · directo · neutral",
                "ejemplo": "motivador (delivery evitado) · reflexivo (revisión semanal)",
            },
            {
                "nombre": "Dificultad",
                "tipo": "Enum",
                "descripcion": (
                    "Dificultad percibida del hábito para el usuario promedio.\n"
                    "Se usa para balancear el banco: no mostrar solo preguntas difíciles o fáciles.\n"
                    "También se puede usar para adaptar la dificultad al nivel del usuario.\n"
                    "low:    Hábito fácil de adoptar, requiere poco esfuerzo.\n"
                    "medium: Hábito que requiere algo de planificación o fuerza de voluntad.\n"
                    "high:   Hábito difícil, requiere cambio de comportamiento significativo."
                ),
                "valores": "low · medium · high",
                "ejemplo": "low (llevar botella) · medium (cocinar en casa) · high (decir no a un plan)",
            },
        ],
    },
]

# ──────────────────────────────────────────────────────────────────────────────
# SECCIÓN EXTRA: AVATARES
# ──────────────────────────────────────────────────────────────────────────────
AVATARES = [
    {
        "id": "comodo",
        "nombre": "😌 Cómodo / Conveniente",
        "color": "1565C0",
        "descripcion": (
            "Gasta más de lo necesario porque prefiere la opción más cómoda y rápida.\n"
            "Pide delivery en vez de cocinar, coge taxi en vez de metro, paga envío exprés.\n"
            "No es que no quiera ahorrar — es que en el momento, la comodidad tiene más peso.\n"
            "Su principal palanca de cambio: hacer la opción barata igual de cómoda."
        ),
        "segmentos": "Q_CI (Conveniencia Inmediata) · Q_IM (Improvisador)",
        "ejemplo_habito": "Delivery, taxi, café fuera, opciones premium, snacks de máquina",
    },
    {
        "id": "social",
        "nombre": "🎉 Social / FOMO",
        "color": "00695C",
        "descripcion": (
            "Gasta por presión social, miedo a perderse planes o por no querer quedar mal.\n"
            "Dice que sí a todo, paga rondas que no le toca, va a sitios caros por el grupo.\n"
            "El gasto escala cuando la noche se alarga: segunda ronda, cambio de sitio, taxi.\n"
            "Su principal palanca: darle herramientas para liderar planes económicos sin perder la vida social."
        ),
        "segmentos": "Q_FS (Fomo Social) · Q_PA (Plan que se Alarga)",
        "ejemplo_habito": "Rondas, planes caros por presión, taxi de madrugada, after improvisado",
    },
    {
        "id": "impulsivo",
        "nombre": "⚡ Impulsivo / Emocional",
        "color": "880E4F",
        "descripcion": (
            "Compra por impulso, emoción, aburrimiento o por ver algo atractivo en redes.\n"
            "Añade cosas al carrito que no necesita, cae en ofertas flash, compra para sentirse mejor.\n"
            "El problema no es la cantidad de cada compra sino la frecuencia y la acumulación.\n"
            "Su principal palanca: aumentar la fricción antes de comprar (esperar 24h, cerrar la app)."
        ),
        "segmentos": "Q_AE (Antojo Emocional) · Q_CO (Cazador de Ofertas)",
        "ejemplo_habito": "Compras online impulsivas, ropa sin necesitar, gadgets, ofertas flash",
    },
    {
        "id": "desordenado",
        "nombre": "📊 Desordenado / Sin Sistema",
        "color": "BF360C",
        "descripcion": (
            "No tiene control de sus gastos, paga servicios que no usa, se le olvidan cargos.\n"
            "No es mal gasto en cada decisión — es falta de sistema y de visión global.\n"
            "Acumula suscripciones olvidadas, no revisa el extracto, no tiene presupuesto.\n"
            "Su principal palanca: crear rutinas de revisión y sistemas automáticos de ahorro."
        ),
        "segmentos": "Q_MF (Microfugas) · Q_SS (Sin Sistema)",
        "ejemplo_habito": "Suscripciones sin uso, cargos automáticos olvidados, sin presupuesto",
    },
]

# ──────────────────────────────────────────────────────────────────────────────
# SECCIÓN EXTRA: SEGMENTOS
# ──────────────────────────────────────────────────────────────────────────────
SEGMENTOS = [
    ("CI", "Conveniencia Inmediata", "comodo",     "7", "15→7", "Gasta por comodidad inmediata: delivery, taxi, café fuera, opciones premium"),
    ("IM", "Improvisador",           "comodo",     "7", "15→7", "No planifica y acaba pagando más: compra de emergencia, menú a la carta, taxi de última hora"),
    ("FS", "Fomo Social",            "social",     "8", "15→8", "Dice que sí a todo por miedo a perderse planes; gasta en salidas caras y rondas"),
    ("PA", "Plan que se Alarga",     "social",     "8", "15→8", "El plan escala: segunda ronda, cambio de bar, taxi de madrugada, after improvisado"),
    ("AE", "Antojo Emocional",       "impulsivo",  "8", "15→8", "Compra por impulso, emoción o aburrimiento: ropa, gadgets, caprichos online"),
    ("CO", "Cazador de Ofertas",     "impulsivo",  "7", "15→7", "Cae en ofertas aunque no las necesita; cree que ahorra pero en realidad gasta más"),
    ("MF", "Microfugas",             "desordenado","7", "15→7", "Gastos pequeños y frecuentes que pasan desapercibidos pero suman mucho al mes"),
    ("SS", "Sin Sistema",            "desordenado","8", "15→8", "Sin control financiero: suscripciones olvidadas, sin presupuesto, sin revisión"),
    ("FB", "Fill Blank Genérico",    "transversal","—", "80 fill_blank", "Preguntas de tipo fill_blank transversales a todos los avatares"),
]

# ──────────────────────────────────────────────────────────────────────────────
# CONSTRUIR LA HOJA
# ──────────────────────────────────────────────────────────────────────────────
wb = openpyxl.load_workbook(EXCEL_PATH)

# Eliminar hoja si ya existe
if "📖 Nomenclatura" in wb.sheetnames:
    del wb["📖 Nomenclatura"]

ws = wb.create_sheet("📖 Nomenclatura", 1)  # Segunda pestaña

# Anchos de columna
ws.column_dimensions['A'].width = 6
ws.column_dimensions['B'].width = 26
ws.column_dimensions['C'].width = 20
ws.column_dimensions['D'].width = 55
ws.column_dimensions['E'].width = 42
ws.column_dimensions['F'].width = 40

current_row = 1

# ── TÍTULO PRINCIPAL ──────────────────────────────────────────────────────────
ws.merge_cells(f'A{current_row}:F{current_row}')
c = ws.cell(row=current_row, column=1)
c.value = "📖  GUÍA DE NOMENCLATURA  |  Banco de Preguntas · Ahorro Invisible  |  v4.0"
c.fill = fill("1A1A2E")
c.font = Font(bold=True, color="FFFFFF", size=14, name="Calibri")
c.alignment = align("center", "center", False)
ws.row_dimensions[current_row].height = 38
current_row += 1

# ── SUBTÍTULO ─────────────────────────────────────────────────────────────────
ws.merge_cells(f'A{current_row}:F{current_row}')
c = ws.cell(row=current_row, column=1)
c.value = "Este documento explica el propósito exacto de cada columna del banco, sus valores posibles y cómo los usa el motor de la app."
c.fill = fill("16213E")
c.font = Font(bold=False, color="B0BEC5", size=10, italic=True, name="Calibri")
c.alignment = align("center", "center", False)
ws.row_dimensions[current_row].height = 22
current_row += 2

# ═══════════════════════════════════════════════════════════════════
# SECCIÓN 1: COLUMNAS DEL BANCO
# ═══════════════════════════════════════════════════════════════════
ws.merge_cells(f'A{current_row}:F{current_row}')
c = ws.cell(row=current_row, column=1)
c.value = "━━━  SECCIÓN 1: DESCRIPCIÓN DETALLADA DE COLUMNAS  ━━━"
c.fill = fill("0D1B2A")
c.font = Font(bold=True, color="64B5F6", size=11, name="Calibri")
c.alignment = align("center", "center", False)
ws.row_dimensions[current_row].height = 26
current_row += 1

# Cabecera de columnas
headers = ["", "Campo", "Tipo de dato", "Descripción detallada", "Valores posibles", "Ejemplo real"]
header_colors = ["0F3460"] * 6
for i, h in enumerate(headers):
    c = ws.cell(row=current_row, column=i+1)
    c.value = h
    c.fill = fill("0F3460")
    c.font = Font(bold=True, color="FFFFFF", size=9, name="Calibri")
    c.alignment = align("center", "center", False)
    c.border = border_all()
ws.row_dimensions[current_row].height = 22
current_row += 1

for grupo in GRUPOS:
    # Encabezado de grupo
    ws.merge_cells(f'A{current_row}:F{current_row}')
    c = ws.cell(row=current_row, column=1)
    c.value = f"  {grupo['nombre']}"
    c.fill = fill(grupo['color'])
    c.font = Font(bold=True, color="FFFFFF", size=10, name="Calibri")
    c.alignment = align("left", "center", False)
    ws.row_dimensions[current_row].height = 22
    current_row += 1

    # Descripción del grupo
    ws.merge_cells(f'B{current_row}:F{current_row}')
    c = ws.cell(row=current_row, column=1)
    c.value = ""
    c = ws.cell(row=current_row, column=2)
    c.value = f"ℹ  {grupo['descripcion']}"
    c.fill = fill("E8EAF6")
    c.font = Font(bold=False, color="1A237E", size=9, italic=True, name="Calibri")
    c.alignment = align("left", "center", True)
    ws.row_dimensions[current_row].height = 30
    current_row += 1

    for idx, col in enumerate(grupo['columnas']):
        # Número
        c = ws.cell(row=current_row, column=1)
        c.value = ""
        c.fill = fill("F5F6FA" if idx % 2 == 0 else "FFFFFF")

        # Nombre de campo
        c = ws.cell(row=current_row, column=2)
        c.value = f"  {col['nombre']}"
        c.fill = fill("EEF2FF" if idx % 2 == 0 else "F8F9FF")
        c.font = Font(bold=True, color="1A237E", size=10, name="Calibri")
        c.alignment = align("left", "center", False)
        c.border = border_all("D0D8FF")

        # Tipo
        c = ws.cell(row=current_row, column=3)
        c.value = col['tipo']
        c.fill = fill("EEF2FF" if idx % 2 == 0 else "F8F9FF")
        c.font = Font(bold=False, color="5C6BC0", size=9, italic=True, name="Calibri")
        c.alignment = align("center", "center", False)
        c.border = border_all("D0D8FF")

        # Descripción
        c = ws.cell(row=current_row, column=4)
        c.value = col['descripcion']
        c.fill = fill("FAFBFF" if idx % 2 == 0 else "FFFFFF")
        c.font = Font(bold=False, color="212121", size=9, name="Calibri")
        c.alignment = align("left", "top", True)
        c.border = border_all("E0E0E0")

        # Valores posibles
        c = ws.cell(row=current_row, column=5)
        c.value = col['valores']
        c.fill = fill("FFF8E1" if idx % 2 == 0 else "FFFDE7")
        c.font = Font(bold=False, color="5D4037", size=9, name="Courier New")
        c.alignment = align("left", "top", True)
        c.border = border_all("FFE0B2")

        # Ejemplo
        c = ws.cell(row=current_row, column=6)
        c.value = col['ejemplo']
        c.fill = fill("E8F5E9" if idx % 2 == 0 else "F1F8E9")
        c.font = Font(bold=False, color="2E7D32", size=9, italic=True, name="Calibri")
        c.alignment = align("left", "top", True)
        c.border = border_all("C8E6C9")

        ws.row_dimensions[current_row].height = max(60, 15 * col['descripcion'].count('\n') + 20)
        current_row += 1

    current_row += 1  # Espacio entre grupos

# ═══════════════════════════════════════════════════════════════════
# SECCIÓN 2: AVATARES
# ═══════════════════════════════════════════════════════════════════
current_row += 1
ws.merge_cells(f'A{current_row}:F{current_row}')
c = ws.cell(row=current_row, column=1)
c.value = "━━━  SECCIÓN 2: PERFILES DE AVATAR (4 tipos de usuario)  ━━━"
c.fill = fill("0D1B2A")
c.font = Font(bold=True, color="64B5F6", size=11, name="Calibri")
c.alignment = align("center", "center", False)
ws.row_dimensions[current_row].height = 26
current_row += 1

for av in AVATARES:
    ws.merge_cells(f'A{current_row}:F{current_row}')
    c = ws.cell(row=current_row, column=1)
    c.value = f"  {av['nombre']}  |  ID técnico: {av['id']}"
    c.fill = fill(av['color'])
    c.font = Font(bold=True, color="FFFFFF", size=10, name="Calibri")
    c.alignment = align("left", "center", False)
    ws.row_dimensions[current_row].height = 22
    current_row += 1

    data = [
        ("Descripción",     av['descripcion']),
        ("Segmentos",       av['segmentos']),
        ("Gastos típicos",  av['ejemplo_habito']),
    ]
    for i, (label, value) in enumerate(data):
        c = ws.cell(row=current_row, column=1)
        c.value = ""

        c2 = ws.cell(row=current_row, column=2)
        c2.value = label
        c2.fill = fill("F5F5F5")
        c2.font = Font(bold=True, color="424242", size=9, name="Calibri")
        c2.alignment = align("right", "top", False)

        ws.merge_cells(f'C{current_row}:F{current_row}')
        c3 = ws.cell(row=current_row, column=3)
        c3.value = value
        c3.fill = fill("FAFAFA")
        c3.font = Font(bold=False, color="212121", size=9, name="Calibri")
        c3.alignment = align("left", "top", True)
        c3.border = border_bottom()

        ws.row_dimensions[current_row].height = max(35, 14 * value.count('\n') + 18)
        current_row += 1

    current_row += 1

# ═══════════════════════════════════════════════════════════════════
# SECCIÓN 3: SEGMENTOS
# ═══════════════════════════════════════════════════════════════════
current_row += 1
ws.merge_cells(f'A{current_row}:F{current_row}')
c = ws.cell(row=current_row, column=1)
c.value = "━━━  SECCIÓN 3: SEGMENTOS DEL BANCO (prefijos de ID)  ━━━"
c.fill = fill("0D1B2A")
c.font = Font(bold=True, color="64B5F6", size=11, name="Calibri")
c.alignment = align("center", "center", False)
ws.row_dimensions[current_row].height = 26
current_row += 1

# Cabecera tabla segmentos — sin merge para evitar conflictos
seg_headers_simple = ["Prefijo", "Nombre del Segmento", "Avatar", "Nº Preguntas", "Descripción"]
seg_cols_simple = [1, 2, 3, 4, 5]
for col_idx, (h, sc) in enumerate(zip(seg_headers_simple, seg_cols_simple)):
    c = ws.cell(row=current_row, column=sc)
    c.value = h
    c.fill = fill("1A237E")
    c.font = Font(bold=True, color="FFFFFF", size=9, name="Calibri")
    c.alignment = align("center", "center", False)
    c.border = border_all()
# Descripción en columna F
c = ws.cell(row=current_row, column=6)
c.value = "Descripción"
c.fill = fill("1A237E")
c.font = Font(bold=True, color="FFFFFF", size=9, name="Calibri")
c.alignment = align("center", "center", False)
c.border = border_all()
ws.row_dimensions[current_row].height = 22
current_row += 1

avatar_colors = {"comodo": "E3F2FD", "social": "E8F5E9", "impulsivo": "FCE4EC", "desordenado": "FFF3E0", "transversal": "F3E5F5"}
avatar_font_colors = {"comodo": "0D47A1", "social": "1B5E20", "impulsivo": "880E4F", "desordenado": "BF360C", "transversal": "4A148C"}

for i, (prefix, name, avatar, _prio_col, n_questions, desc) in enumerate(SEGMENTOS):
    bg = avatar_colors.get(avatar, "F5F5F5")
    fc = avatar_font_colors.get(avatar, "212121")
    row_bg = "FAFAFA" if i % 2 == 0 else "FFFFFF"

    # Col A: prefijo
    c = ws.cell(row=current_row, column=1)
    c.value = f"Q_{prefix}"
    c.fill = fill(bg)
    c.font = Font(bold=True, color=fc, size=10, name="Courier New")
    c.alignment = align("center", "center", False)
    c.border = border_all()

    # Col B: nombre (cols B+C combinadas)
    ws.merge_cells(start_row=current_row, start_column=2, end_row=current_row, end_column=3)
    c = ws.cell(row=current_row, column=2)
    c.value = name
    c.fill = fill(row_bg)
    c.font = Font(bold=True, color="212121", size=9, name="Calibri")
    c.alignment = align("left", "center", False)
    c.border = border_all()

    # Col D: avatar
    c = ws.cell(row=current_row, column=4)
    c.value = avatar
    c.fill = fill(bg)
    c.font = Font(bold=False, color=fc, size=9, italic=True, name="Calibri")
    c.alignment = align("center", "center", False)
    c.border = border_all()

    # Col E: num preguntas
    c = ws.cell(row=current_row, column=5)
    c.value = n_questions
    c.fill = fill(row_bg)
    c.font = Font(bold=True, color="424242", size=9, name="Calibri")
    c.alignment = align("center", "center", False)
    c.border = border_all()

    # Col F: descripcion
    c = ws.cell(row=current_row, column=6)
    c.value = desc
    c.fill = fill(row_bg)
    c.font = Font(bold=False, color="424242", size=9, name="Calibri")
    c.alignment = align("left", "center", True)
    c.border = border_all()

    ws.row_dimensions[current_row].height = 20
    current_row += 1

# ── PIE DE PÁGINA ─────────────────────────────────────────────────
current_row += 2
ws.merge_cells(f'A{current_row}:F{current_row}')
c = ws.cell(row=current_row, column=1)
c.value = "📌  Esta guía se actualiza junto con el banco de preguntas. Cualquier nueva columna debe documentarse aquí."
c.fill = fill("1A1A2E")
c.font = Font(bold=False, color="90CAF9", size=9, italic=True, name="Calibri")
c.alignment = align("center", "center", False)
ws.row_dimensions[current_row].height = 20

# Congelar fila de título
ws.freeze_panes = "A3"

# ──────────────────────────────────────────────────────────────────────────────
# GUARDAR
# ──────────────────────────────────────────────────────────────────────────────
wb.save(EXCEL_PATH)
print(f"✅ Pestaña '📖 Nomenclatura' añadida correctamente a {EXCEL_PATH}")
print(f"   Filas generadas: {current_row}")
