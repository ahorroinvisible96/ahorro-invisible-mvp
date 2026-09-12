"""
Elimina Avatar Secundario de todo el banco:
- CSV: vacía la columna 'Avatar secundario' en todas las filas
         y actualiza la opción 3 de fill_blank para que puntúe al avatar PRIMARIO
- TS:  pone targetAvatarSecondary: '' en todas las preguntas
        y actualiza el scores de la opción 3 de cada fill_blank al avatar primario
"""
import sys, csv, re
sys.stdout.reconfigure(encoding='utf-8')

# ══════════════════════════════════════════════════════════════════
# 1. CSV
# ══════════════════════════════════════════════════════════════════
CSV_PATH = 'definitivoPlantilla_Banco_Preguntas_AhorroInvisible.csv'

with open(CSV_PATH, encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    rows = list(reader)

csv_fixes = 0
for r in rows:
    r['Avatar secundario'] = ''          # vaciar siempre
    # Para fill_blank: cambiar el avatar en la opción 3 al avatar primario
    if r['Formato'] == 'fill_blank':
        av_prim = r['Avatar primario'].strip()
        opts_raw = r.get('Opciones (opción [avatar+pts])', '').strip()
        if opts_raw and av_prim:
            opts = [o.strip() for o in opts_raw.split('|')]
            if len(opts) == 3:
                # Reemplazar el avatar en la opción 3: [cualquier_avatar+N] → [av_prim+N]
                opts[2] = re.sub(r'\[(\w+)(\+\d+)\]', f'[{av_prim}\\2]', opts[2])
                r['Opciones (opción [avatar+pts])'] = ' | '.join(opts)
                csv_fixes += 1

print(f"CSV: Avatar secundario vaciado en {len(rows)} filas")
print(f"CSV: Opción 3 actualizada al avatar primario en {csv_fixes} fill_blank")

with open(CSV_PATH, 'w', encoding='utf-8-sig', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"✅ CSV guardado")

# ══════════════════════════════════════════════════════════════════
# 2. TYPESCRIPT
# ══════════════════════════════════════════════════════════════════
TS_PATH = r'src\services\dailyQuestionsBank.ts'

with open(TS_PATH, encoding='utf-8') as f:
    content = f.read()

# A) Poner targetAvatarSecondary: '' en todas las preguntas amount
#    Patrón en q(): el parámetro as2 (AvatarKey | '') se pasa directamente
#    Solo necesitamos asegurarnos de que en el objeto final quede ''
#    Las preguntas amount usan la función q() que tiene el param as2
#    → simplemente no cambiamos los q() calls: ya tienen '' en muchos casos
#    → para los que tienen 'comodo', 'social', etc. como as2, los vaciamos

# Reemplazar en las llamadas q() el parámetro as2 (antepenúltimo argumento)
# Formato: q('id', 'text', amount, 'cat', 'days', 'window', 'phase', avatarPrimary, avatarSecondary, weight, prio, cooldown, monthly, yearly, 'label')
# El avatarSecondary es el 9º parámetro

def replace_as2_in_q_call(match):
    """Vacía el parámetro as2 en llamadas q() si no está ya vacío."""
    full = match.group(0)
    # Reemplazar cualquier valor entre comillas del param as2 con ''
    # as2 va después del avatar primario (que es comodo/social/impulsivo/desordenado)
    avatars = ['comodo', 'social', 'impulsivo', 'desordenado']
    for av in avatars:
        pattern = re.compile(r"('(?:comodo|social|impulsivo|desordenado)',\s*)'(?:comodo|social|impulsivo|desordenado)'")
        if pattern.search(full):
            full = pattern.sub(r"\1''", full, count=1)
            break
    return full

# Más directo: en las líneas con q('Q_XX_YY', ...) reemplazar pares de avatares consecutivos
lines = content.split('\n')
new_lines = []
q_fixed = 0
for line in lines:
    if re.search(r"q\('Q_[A-Z]{2}_\d+',", line):
        # Hay un avatar primario seguido de un avatar secundario
        new_line = re.sub(
            r"'(comodo|social|impulsivo|desordenado)',\s*'(comodo|social|impulsivo|desordenado)'",
            lambda m: f"'{m.group(1)}', ''",
            line
        )
        if new_line != line:
            q_fixed += 1
        new_lines.append(new_line)
    else:
        new_lines.append(line)

content = '\n'.join(new_lines)
print(f"\nTS: targetAvatarSecondary vaciado en {q_fixed} llamadas q() (amount)")

# B) En los objetos fill_blank: poner targetAvatarSecondary: ''
#    y actualizar el scores de la opción 3 al avatar primario
# Estrategia: para cada bloque fill_blank, detectar el avatar primario
# y reemplazar targetAvatarSecondary por ''

# Vaciar targetAvatarSecondary en fill_blank objects
ts_sec_fixed = len(re.findall(r"targetAvatarSecondary:\s*'(?:comodo|social|impulsivo|desordenado)'", content))
content = re.sub(
    r"targetAvatarSecondary:\s*'(?:comodo|social|impulsivo|desordenado)'",
    "targetAvatarSecondary: ''",
    content
)
print(f"TS: targetAvatarSecondary vaciado en {ts_sec_fixed} fill_blank objects")

# C) Actualizar scores de opción 3 en fill_blank: cambiar al avatar primario
# Buscamos bloques fill_blank completos y dentro de cada uno,
# encontramos el targetAvatarPrimary y lo usamos para reemplazar el scores de la 3ª opción
def fix_fb_block(match):
    block = match.group(0)
    # Detectar avatar primario
    prim_m = re.search(r"targetAvatarPrimary:\s*'(\w+)'", block)
    if not prim_m:
        return block
    av_prim = prim_m.group(1)
    
    # Encontrar las 3 blankOptions y cambiar la scores del 3er elemento
    # Contar ocurrencias de { label: ..., value: ..., scores: {...} }
    opts = list(re.finditer(
        r'\{[^{}]*?label:[^{}]*?scores:\s*\{[^}]*\}[^{}]*?\}',
        block, re.DOTALL
    ))
    if len(opts) < 3:
        return block
    
    # Tomar la 3ª opción y reemplazar su scores
    opt3 = opts[2]
    opt3_text = opt3.group(0)
    # Reemplazar el avatar en scores: { avatar: N } → { av_prim: N }
    new_opt3 = re.sub(
        r'scores:\s*\{[^}]*\}',
        lambda sm: re.sub(r'\b(comodo|social|impulsivo|desordenado)\b', av_prim, sm.group(0)),
        opt3_text
    )
    if new_opt3 != opt3_text:
        # Reemplazar en el bloque (solo la 3ª ocurrencia)
        start = opt3.start()
        end = opt3.end()
        block = block[:start] + new_opt3 + block[end:]
    
    return block

# Aplicar a cada bloque fill_blank
fb_pattern = re.compile(
    r"\{[^{}]*?id:\s*'Q_FB_[^']*'.*?format:\s*'fill_blank'.*?\n  \},?",
    re.DOTALL
)
new_content, count = fb_pattern.subn(fix_fb_block, content)
print(f"TS: Opción 3 scores actualizado al avatar primario en {count} fill_blank")
content = new_content

# D) Actualizar comentario de la interfaz
content = content.replace(
    '  /** Avatar secundario que también encaja (vacío si no aplica) */',
    '  /** Avatar secundario — eliminado, siempre vacío */'
)

with open(TS_PATH, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"✅ TS guardado")

# Verificación
remaining_sec = len(re.findall(r"targetAvatarSecondary:\s*'(?:comodo|social|impulsivo|desordenado)'", content))
print(f"\nVerificación: targetAvatarSecondary con valor != '' → {remaining_sec} (debe ser 0)")
