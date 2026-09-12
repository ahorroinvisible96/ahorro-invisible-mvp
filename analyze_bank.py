import sys, csv
sys.stdout.reconfigure(encoding='utf-8')
from collections import defaultdict, Counter

CSV_PATH = 'definitivoPlantilla_Banco_Preguntas_AhorroInvisible.csv'

with open(CSV_PATH, encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    rows = list(reader)

amount_rows = [r for r in rows if r['Formato'] == 'amount']
fillblank_rows = [r for r in rows if r['Formato'] == 'fill_blank']

print(f"Amount: {len(amount_rows)}")
print(f"Fill_blank: {len(fillblank_rows)}")

# Ver distribucion de amount por segmento y prioridad
seg_amount = defaultdict(list)
for r in amount_rows:
    seg = r['ID'].split('_')[1]
    seg_amount[seg].append(r)

print("\nDistribucion amount por segmento:")
for seg, rlist in sorted(seg_amount.items()):
    prios = [int(r['Priority base']) for r in rlist if r['Priority base'].strip().isdigit()]
    print(f"  {seg}: {len(rlist)} preguntas | prio min={min(prios) if prios else 'N/A'} max={max(prios) if prios else 'N/A'}")

# Para dejar las 60 mejores: ordenar por priority base desc, tomar top 60
# primero conservar distribucion equilibrada por segmento (8 segmentos * ~7-8 c/u = 60)
# Segmentos: CI, IM, FS, PA, AE, CO, MF, SS
segs = sorted(seg_amount.keys())
print(f"\nSegmentos con amount: {segs}")
print(f"Si reparto 60 entre {len(segs)} segmentos: {60/len(segs):.1f} c/u")
