"""
Genera un Excel estético con los datos de definitivoPlantilla_Banco_Preguntas_AhorroInvisible.csv
aplicando la estética de "plantilla excel.xlsx"
"""

import sys
import csv
import re
sys.stdout.reconfigure(encoding='utf-8')

import openpyxl
from openpyxl.styles import (
    PatternFill, Font, Alignment, Border, Side, GradientFill
)
from openpyxl.utils import get_column_letter
from openpyxl.utils.cell import coordinate_from_string

# ─────────────────────────────────────────────
# PALETA DE COLORES (extraída de plantilla excel.xlsx)
# ─────────────────────────────────────────────
COLOR_TITLE_BG      = "1A1A2E"   # Fila 1 título
COLOR_TITLE_FG      = "FFFFFF"

COLOR_GROUP_HDR_BG  = "0F3460"   # Fila de grupos de columnas (fila 2)
COLOR_GROUP_HDR_FG  = "FFFFFF"

COLOR_COL_HDR_BG    = "0F3460"   # Fila de cabeceras (fila 3)
COLOR_COL_HDR_FG    = "FFFFFF"

COLOR_SECTION_BG    = "16213E"   # Encabezado de sección (▶ CONVENIENCIA INMEDIATA...)
COLOR_SECTION_FG    = "FFFFFF"

COLOR_SUBHDR_BG     = "E8EAF6"   # Sub-cabeceras (★ EJEMPLOS / ✏ FILAS)
COLOR_SUBHDR_FG     = "1A237E"

COLOR_EXAMPLE_BG    = "FFFFF9C4" # Filas de ejemplo (amarillo claro)  ← nota: rgb sin FF prefix
COLOR_EXAMPLE_BG    = "FFF9C4"

COLOR_DATA_ODD_BG   = "F5F6FA"   # Filas de datos impares
COLOR_DATA_EVEN_BG  = "FFFFFF"   # Filas de datos pares

COLOR_BORDER        = "C0C0C0"   # Bordes

# Colores de grupos de columnas (fila 2, distintos por grupo)
GROUP_COLORS = {
    "IDENTIFICACIÓN":   "0F3460",
    "ESTADO":           "7B1FA2",
    "CONTENIDO":        "1565C0",
    "CLASIFICACIÓN":    "00695C",
    "CONDUCTA":         "4A148C",
    "CONTEXTO TEMPORAL":"E65100",
    "SCORING":          "880E4F",
    "IMPACTO":          "880E4F",
    "METADATOS":        "BF360C",
    "OPCIONES":         "006064",
    "FEEDBACK":         "4E342E",
    "SCORING AVANZADO": "4E342E",
    "IA":               "4E342E",
}

# ─────────────────────────────────────────────
# COLUMNAS DEL CSV → mapeo a cabeceras del Excel
# ─────────────────────────────────────────────
# Las columnas del CSV (en orden):
# ID, Formato, Estado, Texto de la pregunta, Categoría de hábito,
# Avatar primario, Avatar secundario, Opciones (opción [avatar+pts]),
# Scoring por opción (JSON), Permite Otro, IA requerida para Otro,
# Umbral confianza IA, Placeholder Importe (€), Ahorro mensual interno (€),
# Ahorro anual interno (€), Impacto interno (no visible), Mejor día,
# Mejor franja, Fase del mes, Cooldown (días), Priority base,
# Scenario weight, Intent (técnico), Habit principle, Tono, Dificultad

CSV_COLUMNS = [
    "ID",
    "Formato",
    "Estado",
    "Texto de la pregunta",
    "Categoría de hábito",
    "Avatar primario",
    "Avatar secundario",
    "Opciones (opción [avatar+pts])",
    "Scoring por opción (JSON)",
    "Permite Otro",
    "IA requerida para Otro",
    "Umbral confianza IA",
    "Placeholder Importe (€)",
    "Ahorro mensual interno (€)",
    "Ahorro anual interno (€)",
    "Impacto interno (no visible)",
    "Mejor día",
    "Mejor franja",
    "Fase del mes",
    "Cooldown (días)",
    "Priority base",
    "Scenario weight",
    "Intent (técnico)",
    "Habit principle",
    "Tono",
    "Dificultad",
]

# Nombres de cabecera que aparecerán en el Excel (más descriptivos, al estilo plantilla)
EXCEL_HEADERS = [
    "ID",
    "Formato",
    "Estado",
    "Texto de la Pregunta",
    "Categoría de Hábito",
    "Avatar Primario",
    "Avatar Secundario",
    "Opciones de Respuesta",
    "Scoring por Opción (JSON)",
    "Permite Otro",
    "IA requerida para Otro",
    "Umbral Confianza IA",
    "Placeholder Importe (€)",
    "Ahorro Mensual Interno (€)",
    "Ahorro Anual Interno (€)",
    "Impacto Interno",
    "Mejor Día",
    "Mejor Franja",
    "Fase del Mes",
    "Cooldown (días)",
    "Priority Base",
    "Scenario Weight",
    "Intent (técnico)",
    "Habit Principle",
    "Tono",
    "Dificultad",
]

# Grupos de columnas (para fila 2 con colores distintos)
COLUMN_GROUPS = [
    ("IDENTIFICACIÓN",    [0, 1, 2]),          # ID, Formato, Estado
    ("CONTENIDO",         [3]),                 # Texto de la pregunta
    ("CLASIFICACIÓN",     [4, 5, 6]),           # Categoría, Avatares
    ("OPCIONES",          [7, 8]),              # Opciones, Scoring JSON
    ("IA",                [9, 10, 11]),         # Permite Otro, IA, Umbral
    ("IMPACTO",           [12, 13, 14, 15]),    # Placeholders y ahorro
    ("CONTEXTO TEMPORAL", [16, 17, 18, 19]),    # Día, Franja, Fase, Cooldown
    ("SCORING",           [20, 21]),            # Priority, Scenario weight
    ("METADATOS",         [22, 23, 24, 25]),    # Intent, Habit, Tono, Dificultad
]

# Anchuras de columna (en caracteres)
COLUMN_WIDTHS = [
    14,   # ID
    14,   # Formato
    12,   # Estado
    60,   # Texto de la Pregunta
    22,   # Categoría de Hábito
    16,   # Avatar Primario
    16,   # Avatar Secundario
    50,   # Opciones de Respuesta
    50,   # Scoring por Opción (JSON)
    13,   # Permite Otro
    20,   # IA requerida para Otro
    18,   # Umbral Confianza IA
    20,   # Placeholder Importe (€)
    22,   # Ahorro Mensual Interno (€)
    20,   # Ahorro Anual Interno (€)
    30,   # Impacto Interno
    20,   # Mejor Día
    14,   # Mejor Franja
    14,   # Fase del Mes
    15,   # Cooldown (días)
    13,   # Priority Base
    16,   # Scenario Weight
    22,   # Intent (técnico)
    16,   # Habit Principle
    12,   # Tono
    12,   # Dificultad
]

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def make_fill(hex_color):
    # Ensure color has FF alpha prefix for openpyxl
    if len(hex_color) == 6:
        hex_color = "FF" + hex_color
    from openpyxl.styles.colors import Color
    return PatternFill(fill_type="solid", fgColor=Color(rgb=hex_color))

def make_font(bold=False, color="000000", size=9, name="Calibri"):
    return Font(bold=bold, color=color, size=size, name=name)

def make_border(color=COLOR_BORDER):
    side = Side(style="thin", color=color)
    return Border(left=side, right=side, top=side, bottom=side)

def make_center_align(wrap=False):
    return Alignment(horizontal="center", vertical="center", wrap_text=wrap)

def make_left_align(wrap=True):
    return Alignment(horizontal="left", vertical="center", wrap_text=wrap)

def apply_cell(ws, row, col, value=None, fill=None, font=None,
               alignment=None, border=None):
    cell = ws.cell(row=row, column=col)
    if value is not None:
        cell.value = value
    if fill is not None:
        cell.fill = fill
    if font is not None:
        cell.font = font
    if alignment is not None:
        cell.alignment = alignment
    if border is not None:
        cell.border = border
    return cell

def safe_merge(ws, start_row, start_col, end_row, end_col):
    """Merge cells, catching errors if already merged."""
    try:
        ws.merge_cells(
            start_row=start_row, start_column=start_col,
            end_row=end_row, end_column=end_col
        )
    except Exception:
        pass

# ─────────────────────────────────────────────
# DETECTAR SEGMENTOS / PREFIJOS a partir de IDs
# ─────────────────────────────────────────────
# Los IDs tienen el formato: Q_<SEGMENTO>_XX
# Ej: Q_CI_01 → Conveniencia Inmediata
#     Q_IM_01 → Improvisador
#     Q_FS_01 → Fomo Social
#     Q_PA_01 → Plan que se Alarga
#     Q_AE_01 → Antojo Emocional
#     Q_CO_01 → Cazador de Ofertas
#     Q_MF_01 → Microfugas
#     Q_SS_01 → Sin Sistema
#     Q_P_01  → Preguntas Perfil
#     Q_RE_01 → Reflexión

SEGMENT_NAMES = {
    "CI": "🎯  CONVENIENCIA INMEDIATA  |  Segmento: Cómodo  |  Prefijo: Q_CI",
    "IM": "🎯  IMPROVISADOR  |  Segmento: Cómodo  |  Prefijo: Q_IM",
    "FS": "🎯  FOMO SOCIAL  |  Segmento: Social  |  Prefijo: Q_FS",
    "PA": "🎯  PLAN QUE SE ALARGA  |  Segmento: Social  |  Prefijo: Q_PA",
    "AE": "🎯  ANTOJO EMOCIONAL  |  Segmento: Impulsivo  |  Prefijo: Q_AE",
    "CO": "🎯  CAZADOR DE OFERTAS  |  Segmento: Impulsivo  |  Prefijo: Q_CO",
    "MF": "🎯  MICROFUGAS  |  Segmento: Desordenado  |  Prefijo: Q_MF",
    "SS": "🎯  SIN SISTEMA  |  Segmento: Desordenado  |  Prefijo: Q_SS",
    "P":  "📋  PREGUNTAS DE PERFIL  |  Segmento: Transversal  |  Prefijo: Q_P",
    "RE": "🔄  REFLEXIÓN  |  Segmento: Transversal  |  Prefijo: Q_RE",
    "LP": "💡  LOGRO / PREVENCIÓN  |  Prefijo: Q_LP",
}

def get_prefix(row_id):
    """Extrae el prefijo del ID (ej. 'Q_CI_01' → 'CI')"""
    parts = row_id.strip().split("_")
    if len(parts) >= 3:
        return parts[1]
    elif len(parts) == 2:
        return parts[1]
    return "?"

# ─────────────────────────────────────────────
# LEER CSV
# ─────────────────────────────────────────────
CSV_PATH = r"d:\Javier\AhorroInvisible\mvp Ahorro invisible\ahorro-invisible-mvp\definitivoPlantilla_Banco_Preguntas_AhorroInvisible.csv"
OUTPUT_PATH = r"d:\Javier\AhorroInvisible\mvp Ahorro invisible\ahorro-invisible-mvp\definitivoPlantilla_ESTETICO.xlsx"

with open(CSV_PATH, encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    csv_rows = list(reader)

print(f"Leídas {len(csv_rows)} filas del CSV.")

# ─────────────────────────────────────────────
# AGRUPAR FILAS POR SEGMENTO
# ─────────────────────────────────────────────
from collections import OrderedDict

segments = OrderedDict()
for row in csv_rows:
    row_id = row.get("ID", "").strip()
    prefix = get_prefix(row_id)
    if prefix not in segments:
        segments[prefix] = []
    segments[prefix].append(row)

print(f"Segmentos encontrados: {list(segments.keys())}")

# ─────────────────────────────────────────────
# CREAR WORKBOOK
# ─────────────────────────────────────────────
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Banco de Preguntas"

num_cols = len(EXCEL_HEADERS)

# ─────────────────────────────────────────────
# FILA 1: TÍTULO PRINCIPAL
# ─────────────────────────────────────────────
TITLE_ROW = 1
safe_merge(ws, TITLE_ROW, 1, TITLE_ROW, num_cols)
apply_cell(
    ws, TITLE_ROW, 1,
    value="🏦  BANCO DE PREGUNTAS  |  Ahorro Invisible  |  v4.0",
    fill=make_fill(COLOR_TITLE_BG),
    font=Font(bold=True, color=COLOR_TITLE_FG, size=14, name="Calibri"),
    alignment=Alignment(horizontal="center", vertical="center"),
)
ws.row_dimensions[TITLE_ROW].height = 36

# ─────────────────────────────────────────────
# FILA 2: GRUPOS DE COLUMNAS
# ─────────────────────────────────────────────
GROUP_ROW = 2
ws.row_dimensions[GROUP_ROW].height = 22

# Llenar toda la fila con color base
for c in range(1, num_cols + 1):
    apply_cell(ws, GROUP_ROW, c,
               fill=make_fill(COLOR_GROUP_HDR_BG),
               font=make_font(bold=True, color=COLOR_GROUP_HDR_FG, size=9))

# Escribir grupos con sus colores
for group_name, col_indices in COLUMN_GROUPS:
    color = GROUP_COLORS.get(group_name, COLOR_GROUP_HDR_BG)
    start_col = col_indices[0] + 1
    end_col = col_indices[-1] + 1
    if start_col == end_col:
        apply_cell(ws, GROUP_ROW, start_col,
                   value=group_name,
                   fill=make_fill(color),
                   font=make_font(bold=True, color=COLOR_GROUP_HDR_FG, size=9),
                   alignment=make_center_align())
    else:
        safe_merge(ws, GROUP_ROW, start_col, GROUP_ROW, end_col)
        apply_cell(ws, GROUP_ROW, start_col,
                   value=group_name,
                   fill=make_fill(color),
                   font=make_font(bold=True, color=COLOR_GROUP_HDR_FG, size=9),
                   alignment=make_center_align())
        for c in range(start_col + 1, end_col + 1):
            ws.cell(row=GROUP_ROW, column=c).fill = make_fill(color)

# ─────────────────────────────────────────────
# FILA 3: CABECERAS DE COLUMNAS
# ─────────────────────────────────────────────
HDR_ROW = 3
ws.row_dimensions[HDR_ROW].height = 46

for i, header in enumerate(EXCEL_HEADERS):
    apply_cell(
        ws, HDR_ROW, i + 1,
        value=header,
        fill=make_fill(COLOR_COL_HDR_BG),
        font=make_font(bold=True, color=COLOR_COL_HDR_FG, size=9),
        alignment=Alignment(horizontal="center", vertical="center", wrap_text=True),
        border=make_border()
    )

# ─────────────────────────────────────────────
# FILAS DE DATOS (agrupadas por segmento)
# ─────────────────────────────────────────────
current_row = 4

for seg_prefix, rows in segments.items():
    # ── Encabezado de sección ──────────────────────────────────────────
    section_name = SEGMENT_NAMES.get(seg_prefix, f"▶  SEGMENTO {seg_prefix}")
    safe_merge(ws, current_row, 1, current_row, num_cols)
    apply_cell(
        ws, current_row, 1,
        value=f"▶  {section_name}  |  Total: {len(rows)} preguntas",
        fill=make_fill(COLOR_SECTION_BG),
        font=Font(bold=True, color=COLOR_SECTION_FG, size=10, name="Calibri"),
        alignment=Alignment(horizontal="left", vertical="center"),
    )
    ws.row_dimensions[current_row].height = 22
    current_row += 1

    # ── Filas de datos ─────────────────────────────────────────────────
    for row_idx, row in enumerate(rows):
        row_color = COLOR_EXAMPLE_BG if row_idx % 2 == 0 else COLOR_DATA_ODD_BG
        ws.row_dimensions[current_row].height = 18

        for col_idx, csv_col in enumerate(CSV_COLUMNS):
            val = row.get(csv_col, "").strip()
            col_num = col_idx + 1

            # Ajuste de alineación según tipo de columna
            if col_num == 4:  # Texto de la pregunta → izquierda con wrap
                align = Alignment(horizontal="left", vertical="center", wrap_text=True)
            elif col_num in [8, 9]:  # Opciones y JSON → izquierda con wrap
                align = Alignment(horizontal="left", vertical="center", wrap_text=True)
            else:
                align = Alignment(horizontal="center", vertical="center", wrap_text=False)

            apply_cell(
                ws, current_row, col_num,
                value=val,
                fill=make_fill(row_color),
                font=make_font(size=9),
                alignment=align,
                border=Border(
                    bottom=Side(style="thin", color=COLOR_BORDER)
                )
            )

        current_row += 1

    # Separador entre secciones
    safe_merge(ws, current_row, 1, current_row, num_cols)
    ws.cell(row=current_row, column=1).fill = make_fill("E8EAF6")
    ws.row_dimensions[current_row].height = 6
    current_row += 1

# ─────────────────────────────────────────────
# ANCHOS DE COLUMNA
# ─────────────────────────────────────────────
for i, width in enumerate(COLUMN_WIDTHS):
    ws.column_dimensions[get_column_letter(i + 1)].width = width

# ─────────────────────────────────────────────
# CONGELAR PANELES (hasta columna E, fila 4)
# ─────────────────────────────────────────────
ws.freeze_panes = "D4"

# ─────────────────────────────────────────────
# FILTROS AUTOMÁTICOS
# ─────────────────────────────────────────────
ws.auto_filter.ref = f"A3:{get_column_letter(num_cols)}3"

# ─────────────────────────────────────────────
# GUARDAR
# ─────────────────────────────────────────────
wb.save(OUTPUT_PATH)
print(f"\n✅ Excel generado correctamente en:\n   {OUTPUT_PATH}")
print(f"   Filas de datos: {len(csv_rows)}")
print(f"   Columnas: {num_cols}")
