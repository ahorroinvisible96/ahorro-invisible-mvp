"""
Auditoría completa del CSV antes de aplicar correcciones.
Detecta: estados no uniformes, tildes, avatar_secundario vacío con opción 3,
distribución de fill_blank por avatar, y uso de las columnas de scoring.
"""
import sys, csv, re
sys.stdout.reconfigure(encoding='utf-8')
from collections import Counter, defaultdict

CSV_PATH = 'definitivoPlantilla_Banco_Preguntas_AhorroInvisible.csv'
with open(CSV_PATH, encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    rows = list(reader)

print("=" * 70)
print("AUDITORÍA BANCO DE PREGUNTAS")
print("=" * 70)

amount_rows    = [r for r in rows if r['Formato'] == 'amount']
fillblank_rows = [r for r in rows if r['Formato'] == 'fill_blank']

print(f"\n1. TOTALES")
print(f"   Total filas      : {len(rows)}")
print(f"   amount           : {len(amount_rows)}")
print(f"   fill_blank       : {len(fillblank_rows)}")

# ── ESTADO ───────────────────────────────────────────────────────────
print(f"\n2. VALORES DE 'Estado'")
estados = Counter(r['Estado'] for r in rows)
for k,v in estados.items():
    print(f"   '{k}' → {v} preguntas")

# ── MAÑANA vs MANANA ─────────────────────────────────────────────────
print(f"\n3. 'Mejor franja' — valores distintos")
franjas = Counter(r['Mejor franja'] for r in rows)
for k, v in franjas.items():
    print(f"   '{k}' → {v}")

# ── FILL_BLANK: avatar secundario vacío pero opción 3 con avatar ─────
print(f"\n4. FILL_BLANK con Avatar Secundario vacío pero opción 3 apunta a avatar")
problemas_avatar = []
for r in fillblank_rows:
    av_sec = r.get('Avatar secundario', '').strip()
    opciones = r.get('Opciones (opción [avatar+pts])', '').strip()
    if not av_sec and opciones:
        # Verificar si la opción 3 referencia un avatar
        opts = [o.strip() for o in opciones.split('|')]
        if len(opts) >= 3:
            opt3 = opts[2]
            # Buscar patrón [avatar+pts]
            match = re.search(r'\[(\w+)\+', opt3)
            if match:
                problemas_avatar.append((r['ID'], av_sec, opt3, match.group(1)))

print(f"   Encontrados: {len(problemas_avatar)}")
for qid, av_sec, opt3, detected_av in problemas_avatar[:10]:
    print(f"   {qid}: av_sec='{av_sec}' | opt3='{opt3}' → detectado='{detected_av}'")
if len(problemas_avatar) > 10:
    print(f"   ... y {len(problemas_avatar)-10} más")

# ── FILL_BLANK: distribución por avatar principal ────────────────────
print(f"\n5. FILL_BLANK por Avatar Primario")
fb_by_avatar = defaultdict(list)
for r in fillblank_rows:
    fb_by_avatar[r['Avatar primario']].append(r['ID'])
for av, ids in sorted(fb_by_avatar.items()):
    print(f"   {av:12} → {len(ids)} preguntas  |  IDs: {ids[:3]}...")

# ── SCORING: columna JSON vacía o rellena ───────────────────────────
print(f"\n6. SCORING POR OPCIÓN (JSON) — uso de la columna")
json_col = 'Scoring por opción (JSON)'
rellenas   = [r for r in rows if r.get(json_col, '').strip()]
vacias     = [r for r in rows if not r.get(json_col, '').strip()]
print(f"   Filas con JSON relleno : {len(rellenas)}")
print(f"   Filas con JSON vacío   : {len(vacias)}")
if rellenas:
    print(f"   Ejemplo relleno: {rellenas[0]['ID']} → '{rellenas[0][json_col][:80]}'")

# ── OPCIONES: columna fill_blank bien formada ───────────────────────
print(f"\n7. FILL_BLANK — opciones bien formadas (3 opciones con [avatar+pts])")
bien_formadas = 0
mal_formadas = []
for r in fillblank_rows:
    opts_raw = r.get('Opciones (opción [avatar+pts])', '').strip()
    opts = [o.strip() for o in opts_raw.split('|') if o.strip()]
    validas = [bool(re.search(r'\[\w+\+\d+\]', o)) for o in opts]
    if len(opts) == 3 and all(validas):
        bien_formadas += 1
    else:
        mal_formadas.append((r['ID'], len(opts), opts_raw[:60]))
print(f"   Bien formadas: {bien_formadas}")
print(f"   Mal formadas : {len(mal_formadas)}")
for qid, n, raw in mal_formadas[:5]:
    print(f"   {qid}: {n} opciones → '{raw}'")

# ── CUÁLES fill_blank eliminar (5 por avatar) ───────────────────────
print(f"\n8. PROPUESTA DE ELIMINACIÓN — 5 fill_blank por avatar (menor Priority base)")
to_drop_proposal = []
for av, ids in fb_by_avatar.items():
    av_rows = [r for r in fillblank_rows if r['Avatar primario'] == av]
    av_rows_sorted = sorted(av_rows, key=lambda r: int(r['Priority base']) if r['Priority base'].strip().isdigit() else 0)
    # Los 5 de menor prioridad
    drop_5 = av_rows_sorted[:5]
    to_drop_proposal.extend(drop_5)
    print(f"   {av:12} → eliminar: {[r['ID'] for r in drop_5]} (prios: {[r['Priority base'] for r in drop_5]})")

print(f"\n   Total a eliminar: {len(to_drop_proposal)}")
print(f"   fill_blank resultante: {len(fillblank_rows) - len(to_drop_proposal)}")
