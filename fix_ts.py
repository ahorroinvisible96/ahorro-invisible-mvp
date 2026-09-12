"""
Elimina del dailyQuestionsBank.ts las 20 preguntas fill_blank podadas.
También corrige los avatares secundarios de las 5 preguntas afectadas.
"""
import sys, re
sys.stdout.reconfigure(encoding='utf-8')

TS_PATH = r'src\services\dailyQuestionsBank.ts'

with open(TS_PATH, encoding='utf-8') as f:
    content = f.read()

# ── D. IDs fill_blank a eliminar del TS ──────────────────────────────
IDS_ELIMINAR_FB = {
    'Q_FB_22', 'Q_FB_64', 'Q_FB_16', 'Q_FB_18', 'Q_FB_19',
    'Q_FB_30', 'Q_FB_34', 'Q_FB_32', 'Q_FB_71', 'Q_FB_72',
    'Q_FB_44', 'Q_FB_45', 'Q_FB_47', 'Q_FB_39', 'Q_FB_41',
    'Q_FB_56', 'Q_FB_58', 'Q_FB_59', 'Q_FB_60', 'Q_FB_89',
}

# Las preguntas fill_blank en el TS son objetos de varias líneas.
# Patrón: desde "  {" que contiene "id: 'Q_FB_XX'" hasta el "  }," o "  },"
# Usamos una aproximación: extraer bloques entre { ... } al nivel del array

# Estrategia: eliminar cada bloque que empieza con "  {\n" y contiene "id: 'Q_FB_XX'"
removed = 0
for qid in IDS_ELIMINAR_FB:
    # Patrón del bloque: { ... id: 'Q_FB_XX' ... }
    # Buscamos el bloque completo (puede ser multi-línea con llaves anidadas)
    pattern = re.compile(
        r'\n  \{[^{}]*?id:\s*\'%s\'.*?\n  \},' % re.escape(qid),
        re.DOTALL
    )
    new_content, n = pattern.subn('', content)
    if n > 0:
        content = new_content
        removed += 1
        print(f"  Eliminado: {qid}")
    else:
        # Intentar sin coma al final (último elemento del array)
        pattern2 = re.compile(
            r'\n  \{[^{}]*?id:\s*\'%s\'.*?\n  \}' % re.escape(qid),
            re.DOTALL
        )
        new_content2, n2 = pattern2.subn('', content)
        if n2 > 0:
            content = new_content2
            removed += 1
            print(f"  Eliminado (sin coma): {qid}")
        else:
            print(f"  ⚠ NO ENCONTRADO: {qid}")

print(f"\nBloques eliminados: {removed} / {len(IDS_ELIMINAR_FB)}")

# ── C. Corregir targetAvatarSecondary en 5 preguntas ─────────────────
FIX_AVATAR_SEC_TS = {
    'Q_FB_62': 'comodo',
    'Q_FB_67': 'comodo',
    'Q_FB_80': 'impulsivo',
    'Q_FB_88': 'desordenado',
    'Q_FB_90': 'desordenado',
}

av_fixed = 0
for qid, av in FIX_AVATAR_SEC_TS.items():
    # Buscar el bloque de esta pregunta y dentro, la línea targetAvatarSecondary: ''
    # Patrón: dentro del bloque de qid, reemplazar targetAvatarSecondary: ''
    block_pattern = re.compile(
        r"(id:\s*'%s'.*?targetAvatarSecondary:\s*)''" % re.escape(qid),
        re.DOTALL
    )
    new_content, n = block_pattern.subn(rf"\g<1>'{av}'", content)
    if n > 0:
        content = new_content
        av_fixed += 1
        print(f"  Avatar sec corregido: {qid} → '{av}'")
    else:
        print(f"  ⚠ No se pudo corregir avatar sec: {qid}")

print(f"\nAvatares secundarios corregidos: {av_fixed}")

# ── Actualizar comentario del header ─────────────────────────────────
content = content.replace(
    "* Tipos disponibles: 'amount' (60 preguntas) y 'fill_blank' (80 preguntas).\n * Total: 140 preguntas activas.",
    "* Tipos disponibles: 'amount' (60 preguntas) y 'fill_blank' (60 preguntas).\n * Total: 120 preguntas activas."
)
content = content.replace(
    "* 80 preguntas fill_blank orientadas a ahorro (Q_FB_01 – Q_FB_92)",
    "* 60 preguntas fill_blank orientadas a ahorro (Q_FB_01 – Q_FB_92, sin las 20 podadas)"
)

with open(TS_PATH, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\n✅ dailyQuestionsBank.ts actualizado.")

# Verificación rápida
fb_count = len(re.findall(r"id:\s*'Q_FB_", content))
print(f"   fill_blank objects en TS: {fb_count}")
q_calls = len(re.findall(r"  q\('Q_[A-Z]{2}_", content))
print(f"   amount q() calls en TS  : {q_calls}")
