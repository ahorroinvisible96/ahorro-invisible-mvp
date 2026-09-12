import sys, csv
sys.stdout.reconfigure(encoding='utf-8')
from collections import Counter, defaultdict

with open('definitivoPlantilla_Banco_Preguntas_AhorroInvisible.csv', encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))

seg_fmt = defaultdict(Counter)
for r in rows:
    seg = r['ID'].split('_')[1]
    seg_fmt[seg][r['Formato']] += 1

print('Segmento | amount | fill_blank | total')
for seg, cnt in sorted(seg_fmt.items()):
    a = cnt.get('amount', 0)
    fb = cnt.get('fill_blank', 0)
    print(f'  {seg:5} | {a:6} | {fb:10} | {a+fb}')

fb_rows = [r for r in rows if r['ID'].split('_')[1] == 'FB']
if fb_rows:
    print()
    print('Prefijo FB - primeras IDs:', [r['ID'] for r in fb_rows[:5]])
    print('Formato FB:', dict(Counter(r['Formato'] for r in fb_rows)))
