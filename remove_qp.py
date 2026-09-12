import sys, csv
sys.stdout.reconfigure(encoding='utf-8')

CSV_PATH = r'definitivoPlantilla_Banco_Preguntas_AhorroInvisible.csv'

with open(CSV_PATH, encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    all_rows = list(reader)

print(f'Total filas original: {len(all_rows)}')

# Filtrar fuera las Q_P_
filtered = [r for r in all_rows if not r.get('ID','').strip().startswith('Q_P_')]
removed  = [r for r in all_rows if r.get('ID','').strip().startswith('Q_P_')]

print(f'Eliminadas: {len(removed)}')
for r in removed:
    print(f'  - {r["ID"]}')
print(f'Quedan: {len(filtered)}')

# Guardar con BOM para compatibilidad Excel
with open(CSV_PATH, 'w', encoding='utf-8-sig', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(filtered)

print('CSV guardado correctamente.')
