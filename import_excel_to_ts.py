"""
Fase 2: Importar Excel 'definitivoPlantilla_ESTETICO_sin_avatar_secundario.xlsx'
y regenerar completamente el bloque de preguntas en dailyQuestionsBank.ts.

Lógica:
- amount → llamadas q() conservando la firma actual
- fill_blank → objetos completos con blankOptions:
    opt1 scores: { avatarPrimario: 2 }
    opt2 scores: { avatarPrimario: 2 }
    opt3 scores: { avatarOpt3: 2 }   ← columna 'Avatar interno FB opción 3'
    + always allowOther: true, otherRequiresAI: true, aiConfidenceThreshold: 0.70
- targetAvatarSecondary ELIMINADO de todos los objetos
"""
import sys, re, json, openpyxl
from collections import defaultdict
sys.stdout.reconfigure(encoding='utf-8')

EXCEL = 'definitivoPlantilla_ESTETICO_sin_avatar_secundario.xlsx'
TS_PATH = r'src\services\dailyQuestionsBank.ts'

# ── 1. Leer Excel ─────────────────────────────────────────────────────────────
wb = openpyxl.load_workbook(EXCEL, data_only=True)
ws = wb['Banco de Preguntas']

col_map = {}
header_row = None
for row_idx in range(1, 8):
    row = [ws.cell(row_idx, c).value for c in range(1, 27)]
    row_str = [str(v).strip() if v else '' for v in row]
    if 'ID' in row_str and 'Formato' in row_str:
        header_row = row_idx
        for ci, v in enumerate(row, 1):
            if v:
                col_map[str(v).strip()] = ci
        break

id_col  = col_map['ID']
rows_data = []
for r in ws.iter_rows(min_row=header_row+1, values_only=True):
    qid = r[id_col-1]
    if qid and str(qid).startswith('Q_'):
        d = {k: r[v-1] for k, v in col_map.items()}
        rows_data.append(d)

print(f"Leídas {len(rows_data)} filas del Excel")

def s(val, default=''):
    """Safe string."""
    return str(val).strip() if val is not None else default

def i(val, default=0):
    """Safe int."""
    try: return int(val)
    except: return default

def f(val, default=0.0):
    """Safe float."""
    try: return float(val)
    except: return default

# ── 2. Construir mapa de opciones fill_blank desde el banco TS actual ─────────
# Las opciones (label, value) no están en el Excel — están en el TS.
# Estrategia: leer el TS actual, extraer los blankOptions de cada Q_FB_XX
# y reutilizarlos, solo actualizando el scores de la opción 3.
with open(TS_PATH, encoding='utf-8') as f_ts:
    ts_content = f_ts.read()

# Extraer bloques fill_blank existentes para recuperar sus blankOptions
fb_options_map = {}  # id → [ {label, value, scores}, ... ]
fb_meta_map = {}     # id → campos extra (suggestedAmount, habitCategory, etc.)

# Patrón para extraer cada bloque fill_blank completo
fb_block_pat = re.compile(
    r"\{\s*id:\s*'(Q_FB_[^']+)'(.*?)\n  \},?",
    re.DOTALL
)
blank_opt_pat = re.compile(
    r"\{\s*label:\s*'([^']+)',\s*value:\s*'([^']+)',\s*scores:\s*\{([^}]+)\}\s*\}",
)

for m in fb_block_pat.finditer(ts_content):
    qid = m.group(1)
    block = m.group(0)
    opts = []
    for om in blank_opt_pat.finditer(block):
        label = om.group(1)
        value = om.group(2)
        scores_raw = om.group(3).strip()  # e.g. "comodo: 2"
        scores = {}
        for part in scores_raw.split(','):
            part = part.strip()
            if ':' in part:
                av, pts = part.split(':', 1)
                scores[av.strip()] = int(pts.strip())
        opts.append({'label': label, 'value': value, 'scores': scores})
    if opts:
        fb_options_map[qid] = opts

print(f"Bloques fill_blank en TS existente: {len(fb_options_map)}")

# ── 3. Extraer el header y footer del TS para mantenerlos intactos ───────────
# Buscar el inicio del primer bloque de preguntas (const Q_CONVENIENCIA) y el final
# Queremos conservar TODO antes del primer 'const Q_' y todo después del último array

# Separamos en: HEADER (antes de las preguntas) + BODY (preguntas) + FOOTER (exports)
# El HEADER termina justo antes de la primera línea "const Q_"
# El FOOTER empieza desde "// ── Exportaciones"

header_end_pat = re.compile(r'^(const Q_[A-Z_]+ *:)', re.MULTILINE)
m_header = header_end_pat.search(ts_content)
if not m_header:
    print("ERROR: No se encontró el inicio de las constantes de preguntas")
    sys.exit(1)

ts_header = ts_content[:m_header.start()]

# El FOOTER empieza desde el export del banco
footer_pat = re.compile(r'^// ── Banco principal', re.MULTILINE)
m_footer = footer_pat.search(ts_content)
if not m_footer:
    # Intentar con otra marca
    footer_pat2 = re.compile(r'^export const DAILY_QUESTIONS_BANK', re.MULTILINE)
    m_footer = footer_pat2.search(ts_content)

ts_footer = ts_content[m_footer.start():]

print(f"Header: {len(ts_header)} chars")
print(f"Footer: {len(ts_footer)} chars")

# ── 4. Generar el bloque de preguntas ────────────────────────────────────────

# Agrupar preguntas por segmento (primeras 2 letras del ID tipo Q_CI, Q_IM, etc.)
SEGMENT_NAMES = {
    'CI': ('Q_CONVENIENCIA', 'CONVENIENCIA INMEDIATA', 'comodo'),
    'IM': ('Q_IMPROVISADOR', 'IMPROVISADOR', 'comodo'),
    'FS': ('Q_FOMO_SOCIAL', 'FOMO SOCIAL', 'social'),
    'PA': ('Q_PLAN_ALARGA', 'PLAN QUE SE ALARGA', 'social'),
    'AE': ('Q_ANTOJO_EMO', 'ANTOJO EMOCIONAL', 'impulsivo'),
    'CO': ('Q_CAZADOR_OFERTAS', 'CAZADOR DE OFERTAS', 'impulsivo'),
    'MF': ('Q_MICROFUGAS', 'MICROFUGAS', 'desordenado'),
    'SS': ('Q_SIN_SISTEMA', 'SIN SISTEMA', 'desordenado'),
    'FB': ('Q_FILL_BLANK', 'FILL BLANK', 'transversal'),
}

segments = defaultdict(list)
for r in rows_data:
    qid = s(r['ID'])
    # Extraer segmento del ID: Q_CI_01 → CI
    m = re.match(r'Q_([A-Z]+)_', qid)
    seg = m.group(1) if m else 'FB'
    segments[seg].append(r)

def bool_ts(val):
    v = s(val).lower()
    return 'true' if v in ('true', '1', 'yes', 'sí', 'si') else 'false'

def gen_amount(r):
    """Genera una línea q(...) para preguntas amount."""
    qid   = s(r['ID'])
    text  = s(r['Texto de la Pregunta']).replace("'", "\\'")
    cat   = s(r['Categoría de Hábito']).replace("'", "\\'")
    days  = s(r['Mejor Día'], 'Cualquier día').replace("'", "\\'")
    wind  = s(r['Mejor Franja'], 'Cualquiera').replace("'", "\\'")
    phase = s(r['Fase del Mes'], 'Cualquiera').replace("'", "\\'")
    av    = s(r['Avatar Primario'], 'comodo')
    sw    = i(r['Scenario Weight'], 2)
    prio  = i(r['Priority Base'], 7)
    cool  = i(r['Cooldown (días)'], 3)
    mon   = i(r['Ahorro Mensual Interno (€)'], 0)
    yr    = i(r['Ahorro Anual Interno (€)'], 0)
    ph    = i(r['Placeholder Importe (€)'], 0)
    label = s(r['Impacto Interno'], '').replace("'", "\\'")
    intent= s(r['Intent (técnico)'], '').replace("'", "\\'")
    habit = s(r['Habit Principle'], 'easy').replace("'", "\\'")
    tone  = s(r['Tono'], 'motivador').replace("'", "\\'")
    diff  = s(r['Dificultad'], 'medium').replace("'", "\\'")

    return (
        f"  q('{qid}', '{text}', {ph},\n"
        f"    '{cat}', '{days}', '{wind}', '{phase}',\n"
        f"    '{av}', '', {sw}, {prio}, {cool}, {mon}, {yr},\n"
        f"    '{label}',\n"
        f"    '{intent}', '{habit}', '{tone}', '{diff}'),\n"
    )

def gen_fillblank(r, opts_from_ts):
    """Genera un objeto fill_blank completo."""
    qid    = s(r['ID'])
    text   = s(r['Texto de la Pregunta']).replace("'", "\\'")
    cat    = s(r['Categoría de Hábito']).replace("'", "\\'")
    days   = s(r['Mejor Día'], 'Cualquier día').replace("'", "\\'")
    wind   = s(r['Mejor Franja'], 'Cualquiera').replace("'", "\\'")
    phase  = s(r['Fase del Mes'], 'Cualquiera').replace("'", "\\'")
    av     = s(r['Avatar Primario'], 'comodo')
    av3    = s(r['Avatar interno FB opción 3'], av)  # ← columna clave del Excel
    sw     = i(r['Scenario Weight'], 2)
    prio   = i(r['Priority Base'], 7)
    cool   = i(r['Cooldown (días)'], 5)
    mon    = i(r['Ahorro Mensual Interno (€)'], 0)
    yr     = i(r['Ahorro Anual Interno (€)'], 0)
    ph     = i(r['Placeholder Importe (€)'], 0)
    label  = s(r['Impacto Interno'], '').replace("'", "\\'")
    intent = s(r['Intent (técnico)'], '').replace("'", "\\'")
    habit  = s(r['Habit Principle'], 'easy').replace("'", "\\'")
    tone   = s(r['Tono'], 'motivador').replace("'", "\\'")
    diff   = s(r['Dificultad'], 'medium').replace("'", "\\'")
    conf   = f(r['Umbral Confianza IA'], 0.70)
    allow  = bool_ts(r['Permite Otro'])
    ia_req = bool_ts(r['IA requerida para Otro'])

    # Opciones: usar del TS si existen, sino generar genéricas
    if opts_from_ts and len(opts_from_ts) >= 3:
        o1 = opts_from_ts[0]
        o2 = opts_from_ts[1]
        o3 = opts_from_ts[2]
        # Actualizar scores según Excel
        o1_scores = f"{{ {av}: 2 }}"
        o2_scores = f"{{ {av}: 2 }}"
        o3_scores = f"{{ {av3}: 2 }}"
        opts_str = (
            f"      {{ label: '{o1['label']}', value: '{o1['value']}', scores: {o1_scores} }},\n"
            f"      {{ label: '{o2['label']}', value: '{o2['value']}', scores: {o2_scores} }},\n"
            f"      {{ label: '{o3['label']}', value: '{o3['value']}', scores: {o3_scores} }},\n"
        )
    else:
        # Opciones genéricas si no se encontraron en TS
        opts_str = (
            f"      {{ label: 'opción 1', value: 'opt_1', scores: {{ {av}: 2 }} }},\n"
            f"      {{ label: 'opción 2', value: 'opt_2', scores: {{ {av}: 2 }} }},\n"
            f"      {{ label: 'opción 3', value: 'opt_3', scores: {{ {av3}: 2 }} }},\n"
        )

    return (
        f"  {{\n"
        f"    id: '{qid}', text: '{text}',\n"
        f"    format: 'fill_blank' as const,\n"
        f"    blankOptions: [\n"
        f"{opts_str}"
        f"    ],\n"
        f"    allowOther: {allow}, otherRequiresAI: {ia_req}, aiConfidenceThreshold: {conf:.2f},\n"
        f"    suggestedAmount: {ph}, habitCategory: '{cat}', bestDays: '{days}', bestTimeWindow: '{wind}',\n"
        f"    monthPhase: '{phase}', targetAvatarPrimary: '{av}',\n"
        f"    scenarioWeight: {sw}, priorityBase: {prio}, cooldownDays: {cool}, monthlyDelta: {mon}, yearlyDelta: {yr},\n"
        f"    labelImpact: '{label}',\n"
        f"    active: true, intent: '{intent}', habit_principle: '{habit}', tone: '{tone}', difficulty: '{diff}', experimental: false,\n"
        f"  }},\n"
    )

# ── 5. Generar todos los bloques de segmentos ─────────────────────────────────
body_parts = []

# Primero amount (todos los segmentos excepto FB)
for seg, (const_name, seg_label, seg_av) in SEGMENT_NAMES.items():
    if seg == 'FB':
        continue
    seg_rows = segments.get(seg, [])
    amount_rows = [r for r in seg_rows if s(r.get('Formato', '')) == 'amount']
    if not amount_rows:
        continue

    body_parts.append(f"\n// ── {seg_label} ({'amount'}) ─────────────────────────────────────────────────\n")
    body_parts.append(f"const {const_name}: DailyQuestion[] = [\n")
    for r in amount_rows:
        body_parts.append(gen_amount(r))
    body_parts.append("];\n")

# Fill blank — bloque único
fb_rows_all = []
for seg_rows in segments.values():
    fb_rows_all.extend([r for r in seg_rows if s(r.get('Formato', '')) == 'fill_blank'])

# También los FB del segmento FB
fb_rows_all.extend([r for r in segments.get('FB', []) if s(r.get('Formato', '')) == 'fill_blank'])

# Deduplicar por ID
seen_ids = set()
fb_unique = []
for r in fb_rows_all:
    qid = s(r['ID'])
    if qid not in seen_ids:
        seen_ids.add(qid)
        fb_unique.append(r)

body_parts.append(f"\n// ── FILL BLANK ─────────────────────────────────────────────────────────────\n")
body_parts.append(f"const Q_FILL_BLANK: DailyQuestion[] = [\n")
missing_opts = 0
for r in fb_unique:
    qid = s(r['ID'])
    opts = fb_options_map.get(qid, [])
    if not opts:
        missing_opts += 1
    body_parts.append(gen_fillblank(r, opts))
body_parts.append("];\n")

if missing_opts:
    print(f"⚠ {missing_opts} fill_blank sin opciones en TS existente → opciones genéricas")

body = ''.join(body_parts)

# ── 6. Reconstruir el FOOTER: actualizar el array DAILY_QUESTIONS_BANK ────────
# Encontrar y actualizar la línea del DAILY_QUESTIONS_BANK spread
# Construir la lista de const names para el spread
amount_consts = [SEGMENT_NAMES[s][0] for s in SEGMENT_NAMES if s != 'FB' and segments.get(s)]

# Actualizar el spread en el footer
spread_pat = re.compile(
    r'export const DAILY_QUESTIONS_BANK[^=]+=\s*\[[^\]]*\];',
    re.DOTALL
)
new_spread = (
    "export const DAILY_QUESTIONS_BANK: DailyQuestion[] = [\n"
    + ''.join(f"  ...{c},\n" for c in amount_consts)
    + "  ...Q_FILL_BLANK,\n"
    + "];"
)
new_footer, n_rep = spread_pat.subn(new_spread, ts_footer)
if n_rep == 0:
    print("⚠ No se pudo actualizar DAILY_QUESTIONS_BANK spread automáticamente")
    new_footer = ts_footer

# ── 7. Ensamblar y escribir ───────────────────────────────────────────────────
new_ts = ts_header + body + '\n' + new_footer

with open(TS_PATH, 'w', encoding='utf-8') as fw:
    fw.write(new_ts)

print(f"\n✅ dailyQuestionsBank.ts regenerado")
print(f"   amount preguntas: {sum(1 for r in rows_data if s(r.get('Formato',''))=='amount')}")
print(f"   fill_blank preguntas: {len(fb_unique)}")
print(f"   fill_blank con opciones del TS: {len(fb_unique) - missing_opts}")
print(f"   Total: {len(rows_data)}")

# ── 8. Verificación: contar targetAvatarSecondary con valor ───────────────────
with open(TS_PATH, encoding='utf-8') as fv:
    content_verify = fv.read()

sec_with_value = len(re.findall(r"targetAvatarSecondary:\s*'(?:comodo|social|impulsivo|desordenado)'", content_verify))
print(f"\nVerificación targetAvatarSecondary con valor != '': {sec_with_value} (debe ser 0)")

# Contar opciones 3 correctamente asignadas
# Para cada fill_blank en el Excel, verificar que su opt3 tiene el avatar correcto
errors_opt3 = 0
for r in fb_unique:
    qid = s(r['ID'])
    av3_expected = s(r['Avatar interno FB opción 3'], s(r['Avatar Primario'], ''))
    if not av3_expected:
        continue
    # Buscar en el TS generado
    block_m = re.search(rf"id:\s*'{re.escape(qid)}'.*?\n  \}},?", content_verify, re.DOTALL)
    if not block_m:
        continue
    block = block_m.group(0)
    # Encontrar la 3ª opción
    opts_found = list(re.finditer(r"scores:\s*\{([^}]+)\}", block))
    if len(opts_found) >= 3:
        opt3_score = opts_found[2].group(1).strip()
        if av3_expected not in opt3_score:
            errors_opt3 += 1
            print(f"  ⚠ {qid}: opt3 esperado='{av3_expected}' actual='{opt3_score}'")

print(f"Opciones 3 correctas: {len(fb_unique) - errors_opt3}/{len(fb_unique)}")
