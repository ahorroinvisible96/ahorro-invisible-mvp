"""
Aplica TODAS las correcciones detectadas en la auditoría:
A. Normalizar Estado: activo → ACTIVO
B. Corregir Manana → Mañana en Mejor franja
C. Rellenar Avatar secundario vacío en 5 preguntas (Q_FB_71 se elimina, no se corrige)
D. Eliminar 20 fill_blank de menor prioridad (5 por avatar)
E. Columna JSON queda vacía (documentada en nomenclatura)
"""

import sys, csv, re
sys.stdout.reconfigure(encoding='utf-8')

CSV_PATH = 'definitivoPlantilla_Banco_Preguntas_AhorroInvisible.csv'

with open(CSV_PATH, encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    rows = list(reader)

print(f"Filas cargadas: {len(rows)}")

# ──────────────────────────────────────────────────────────────────────────────
# D. IDs a ELIMINAR (20 fill_blank, 5 por avatar)
# ──────────────────────────────────────────────────────────────────────────────
IDS_ELIMINAR = {
    # comodo (prio 6-7)
    'Q_FB_22', 'Q_FB_64', 'Q_FB_16', 'Q_FB_18', 'Q_FB_19',
    # social (prio 6-7) — Q_FB_71 tiene avatar_sec vacío pero se elimina aquí
    'Q_FB_30', 'Q_FB_34', 'Q_FB_32', 'Q_FB_71', 'Q_FB_72',
    # impulsivo (prio 7-8)
    'Q_FB_44', 'Q_FB_45', 'Q_FB_47', 'Q_FB_39', 'Q_FB_41',
    # desordenado (prio 7)
    'Q_FB_56', 'Q_FB_58', 'Q_FB_59', 'Q_FB_60', 'Q_FB_89',
}

# ──────────────────────────────────────────────────────────────────────────────
# C. Avatar secundario a rellenar (opción 3 → avatar detectado)
#    Solo las que NO se eliminan
# ──────────────────────────────────────────────────────────────────────────────
FIX_AVATAR_SEC = {
    'Q_FB_62': 'comodo',       # opt3: recado_andando [comodo+2]
    'Q_FB_67': 'comodo',       # opt3: corte_pelo_casa [comodo+2]
    # Q_FB_71 → eliminada
    'Q_FB_80': 'impulsivo',    # opt3: accesorio_hogar [impulsivo+2]
    'Q_FB_88': 'desordenado',  # opt3: presup_ropa [desordenado+2]
    'Q_FB_90': 'desordenado',  # opt3: internet_renegoc [desordenado+2]
}

# ──────────────────────────────────────────────────────────────────────────────
# APLICAR CORRECCIONES FILA A FILA
# ──────────────────────────────────────────────────────────────────────────────
new_rows = []
stats = {
    'eliminadas': 0,
    'estado_corregido': 0,
    'manana_corregido': 0,
    'avatar_sec_corregido': 0,
}

for r in rows:
    qid = r['ID'].strip()

    # D. Eliminar
    if qid in IDS_ELIMINAR:
        stats['eliminadas'] += 1
        continue

    # A. Normalizar Estado
    if r['Estado'].strip() == 'activo':
        r['Estado'] = 'ACTIVO'
        stats['estado_corregido'] += 1

    # B. Corregir Manana → Mañana
    if r['Mejor franja'].strip() == 'Manana':
        r['Mejor franja'] = 'Mañana'
        stats['manana_corregido'] += 1

    # C. Rellenar Avatar secundario
    if qid in FIX_AVATAR_SEC:
        r['Avatar secundario'] = FIX_AVATAR_SEC[qid]
        stats['avatar_sec_corregido'] += 1

    new_rows.append(r)

# ──────────────────────────────────────────────────────────────────────────────
# RESUMEN
# ──────────────────────────────────────────────────────────────────────────────
print("\n=== CORRECCIONES APLICADAS ===")
print(f"  D. Eliminadas          : {stats['eliminadas']} fill_blank")
print(f"  A. Estado normalizado  : {stats['estado_corregido']} filas (activo → ACTIVO)")
print(f"  B. Mañana corregido    : {stats['manana_corregido']} filas (Manana → Mañana)")
print(f"  C. Avatar sec. fijado  : {stats['avatar_sec_corregido']} preguntas")

amount_f   = [r for r in new_rows if r['Formato'] == 'amount']
fillblank_f= [r for r in new_rows if r['Formato'] == 'fill_blank']
print(f"\n=== TOTALES FINALES ===")
print(f"  amount    : {len(amount_f)}")
print(f"  fill_blank: {len(fillblank_f)}")
print(f"  TOTAL     : {len(new_rows)}")

# Verificar estado normalizado
estados_restantes = set(r['Estado'] for r in new_rows)
print(f"\n  Estados únicos: {estados_restantes}")

# Verificar franjas
franjas_restantes = set(r['Mejor franja'] for r in new_rows)
print(f"  Franjas únicas: {sorted(franjas_restantes)}")

# Verificar avatar secundario corregido
for qid, av in FIX_AVATAR_SEC.items():
    row = next((r for r in new_rows if r['ID'] == qid), None)
    if row:
        print(f"  {qid}: Avatar secundario = '{row['Avatar secundario']}'  ✓")

# ──────────────────────────────────────────────────────────────────────────────
# GUARDAR CSV
# ──────────────────────────────────────────────────────────────────────────────
with open(CSV_PATH, 'w', encoding='utf-8-sig', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(new_rows)

print(f"\n✅ CSV guardado: {len(new_rows)} filas")
