import sys, openpyxl
from collections import Counter, defaultdict
sys.stdout.reconfigure(encoding='utf-8')

wb = openpyxl.load_workbook('definitivoPlantilla_ESTETICO_sin_avatar_secundario.xlsx', data_only=True)
ws = wb['Banco de Preguntas']

# Encontrar fila de cabeceras reales
col_map = {}
header_row = None
for row_idx in range(1, 8):
    row = [ws.cell(row_idx, c).value for c in range(1, ws.max_column+1)]
    row_str = [str(v).strip() if v else '' for v in row]
    if 'ID' in row_str and 'Formato' in row_str:
        header_row = row_idx
        for ci, v in enumerate(row, 1):
            if v:
                col_map[str(v).strip()] = ci
        break

print('Fila cabeceras:', header_row)
print('Columnas detectadas:', list(col_map.keys()))
print()

# Leer datos
rows = []
id_col = col_map.get('ID', 1)
for r in ws.iter_rows(min_row=header_row+1, values_only=True):
    val = r[id_col-1]
    if val and str(val).startswith('Q_'):
        rows.append({k: r[v-1] for k,v in col_map.items()})

print(f'Total filas Q_: {len(rows)}')
formatos = Counter(str(r.get('Formato','')).strip() for r in rows)
print('Formatos:', dict(formatos))
avatares = Counter(str(r.get('Avatar primario','')).strip() for r in rows)
print('Avatares primarios:', dict(avatares))
estados = Counter(str(r.get('Estado','')).strip() for r in rows)
print('Estados:', dict(estados))

# Buscar columnas especiales
print('\nTodas las columnas:')
for k in col_map:
    print(' ', k)

# Muestra opciones
fb_rows = [r for r in rows if str(r.get('Formato','')).strip() == 'fill_blank']
print(f'\nfill_blank count: {len(fb_rows)}')
# Buscar la columna de opciones
opt_col = None
for k in col_map:
    if 'opcion' in k.lower() or 'opci' in k.lower():
        opt_col = k
        print('Columna de opciones:', k)
        break

if opt_col and fb_rows:
    print('Muestra opciones (primeras 3 fill_blank):')
    for r in fb_rows[:3]:
        v = r.get(opt_col, '')
        print(f"  {r.get('ID')}: {str(v)[:90]}")
