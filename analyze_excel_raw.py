import sys, openpyxl, re
from collections import Counter
sys.stdout.reconfigure(encoding='utf-8')

wb = openpyxl.load_workbook('definitivoPlantilla_ESTETICO_sin_avatar_secundario.xlsx', data_only=True)
ws = wb['Banco de Preguntas']

# Leer TODAS las celdas de las primeras 10 filas para entender la estructura
print("=== PRIMERAS 10 FILAS ===")
for ri in range(1, 11):
    row_vals = []
    for ci in range(1, 27):
        v = ws.cell(ri, ci).value
        if v is not None:
            row_vals.append(f"[C{ci}={repr(str(v)[:30])}]")
    if row_vals:
        print(f"Fila {ri}: {' '.join(row_vals)}")

# Encontrar la fila de cabeceras reales
print("\n=== BUSCANDO CABECERAS ===")
header_row = None
col_map = {}
for row_idx in range(1, 10):
    row = [ws.cell(row_idx, c).value for c in range(1, 27)]
    row_str = [str(v).strip() if v else '' for v in row]
    if 'ID' in row_str:
        header_row = row_idx
        for ci, v in enumerate(row, 1):
            if v:
                col_map[str(v).strip()] = ci
        print(f"Cabeceras en fila {row_idx}: {col_map}")
        break

# Leer datos brutos — fila por fila desde header+1
print("\n=== PRIMERAS 20 FILAS DE DATOS (valores raw) ===")
id_col = col_map.get('ID', 1)
av_col = col_map.get('Avatar Primario', 6)
fmt_col = col_map.get('Formato', 2)
opt_col = col_map.get('Opciones de Respuesta', 8)
av_opt3_col = col_map.get('Avatar interno FB opción 3', 7)

count = 0
for ri in range(header_row+1, ws.max_row+1):
    row = [ws.cell(ri, c).value for c in range(1, 27)]
    qid = row[id_col-1]
    if not qid or not str(qid).startswith('Q_'):
        continue
    av = row[av_col-1]
    fmt = row[fmt_col-1]
    opt = row[opt_col-1]
    av3 = row[av_opt3_col-1]
    print(f"  {qid} | Formato={fmt} | Avatar={repr(av)} | Opt3Avatar={repr(av3)} | Opts={repr(str(opt)[:50]) if opt else 'N/A'}")
    count += 1
    if count >= 20:
        break
