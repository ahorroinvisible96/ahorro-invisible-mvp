"""
Rebalance del banco de preguntas:
- Poda amount: 120 → 60 (conserva las 60 de mayor prioridad, equilibradas por segmento)
- Crea fill_blank: añade 32 nuevas para llegar a 80 (CSV actualmente tiene 48)
- Actualiza el CSV
- Muestra resumen
"""

import sys, csv
sys.stdout.reconfigure(encoding='utf-8')
from collections import defaultdict

CSV_PATH = 'definitivoPlantilla_Banco_Preguntas_AhorroInvisible.csv'

with open(CSV_PATH, encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    rows = list(reader)

amount_rows   = [r for r in rows if r['Formato'] == 'amount']
fillblank_rows= [r for r in rows if r['Formato'] == 'fill_blank']

print(f"ANTES  → amount: {len(amount_rows)}, fill_blank: {len(fillblank_rows)}, total: {len(rows)}")

# ─────────────────────────────────────────────────────────────────
# 1. PODA DE AMOUNT: conservar top 60 equilibradas por segmento
# ─────────────────────────────────────────────────────────────────
# 8 segmentos × 7 = 56 + 4 extras en los de mayor prio media = 60
# Estrategia: top 8 de cada segmento por Priority base, luego ajustar

seg_amount = defaultdict(list)
for r in amount_rows:
    seg = r['ID'].split('_')[1]
    seg_amount[seg].append(r)

# Ordenar cada segmento por Priority base descendente
for seg in seg_amount:
    seg_amount[seg].sort(key=lambda r: -int(r['Priority base']))

# Repartir 60 entre 8 segmentos: 8×4 + 4×7.5 → 7,7,7,8,7,7,8,7 → usamos 7 o 8
# Más limpio: top 8 de 4 segmentos + top 7 de 4 segmentos = 32+28=60
# Esos 4 segmentos serán los de mayor prioridad media
seg_avg_prio = {}
for seg, rlist in seg_amount.items():
    prios = [int(r['Priority base']) for r in rlist]
    seg_avg_prio[seg] = sum(prios)/len(prios)

segs_sorted = sorted(seg_avg_prio.keys(), key=lambda s: -seg_avg_prio[s])
print(f"\nSegmentos por prio media desc: {segs_sorted}")

quota = {}
for i, seg in enumerate(segs_sorted):
    quota[seg] = 8 if i < 4 else 7
print(f"Cuotas: {quota} → total={sum(quota.values())}")

kept_amount = []
dropped_amount = []
for seg, rlist in seg_amount.items():
    q_keep = quota[seg]
    kept_amount.extend(rlist[:q_keep])
    dropped_amount.extend(rlist[q_keep:])

print(f"\nAmount conservadas: {len(kept_amount)}")
print(f"Amount eliminadas: {len(dropped_amount)}")
print(f"  IDs eliminadas: {[r['ID'] for r in dropped_amount]}")

# ─────────────────────────────────────────────────────────────────
# 2. NUEVAS FILL_BLANK: 32 preguntas nuevas (FB_61 → FB_92)
# ─────────────────────────────────────────────────────────────────
# Distribuidas por avatar: 8 comodo, 8 social, 8 impulsivo, 8 desordenado

new_fb = [
    # ── CÓMODO (8 nuevas) ──────────────────────────────────────────────────────
    {
        'ID': 'Q_FB_61', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He resistido pedir delivery y he improvisado algo en casa: ____.',
        'Categoría de hábito': 'Delivery evitado', 'Avatar primario': 'comodo', 'Avatar secundario': 'impulsivo',
        'Opciones (opción [avatar+pts])': 'pasta_rapida [comodo+2] | tortilla [comodo+2] | sobras_nevera [impulsivo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '10', 'Ahorro mensual interno (€)': '40', 'Ahorro anual interno (€)': '480',
        'Impacto interno (no visible)': 'Improvisar en casa evita ~4 pedidos/mes',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Noche', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '3', 'Priority base': '8', 'Scenario weight': '3',
        'Intent (técnico)': 'gasto_evitado_delivery_improvisa', 'Habit principle': 'easy',
        'Tono': 'motivador', 'Dificultad': 'medium',
    },
    {
        'ID': 'Q_FB_62', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He elegido transporte más barato en vez del más cómodo para ir a: ____.',
        'Categoría de hábito': 'Transporte económico', 'Avatar primario': 'comodo', 'Avatar secundario': '',
        'Opciones (opción [avatar+pts])': 'trabajo_metro [comodo+2] | salida_bici [comodo+2] | recado_andando [comodo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '7', 'Ahorro mensual interno (€)': '28', 'Ahorro anual interno (€)': '336',
        'Impacto interno (no visible)': 'Sustituir 1 taxi diario ahorra ~28 EUR/mes',
        'Mejor día': 'Lunes a Viernes', 'Mejor franja': 'Mañana', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '3', 'Priority base': '7', 'Scenario weight': '2',
        'Intent (técnico)': 'gasto_evitado_transporte_eco', 'Habit principle': 'easy',
        'Tono': 'motivador', 'Dificultad': 'low',
    },
    {
        'ID': 'Q_FB_63', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He preparado la semana para no tener que gastar de urgencia en: ____.',
        'Categoría de hábito': 'Planificación semanal', 'Avatar primario': 'comodo', 'Avatar secundario': 'desordenado',
        'Opciones (opción [avatar+pts])': 'comida_semana [comodo+2] | ropa_prep [comodo+2] | gestiones_ant [desordenado+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '15', 'Ahorro mensual interno (€)': '50', 'Ahorro anual interno (€)': '600',
        'Impacto interno (no visible)': 'Preparar la semana evita gastos de urgencia ~50 EUR/mes',
        'Mejor día': 'Domingo', 'Mejor franja': 'Mañana', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '7', 'Priority base': '9', 'Scenario weight': '3',
        'Intent (técnico)': 'gasto_evitado_planif_urgencia', 'Habit principle': 'easy',
        'Tono': 'motivador', 'Dificultad': 'low',
    },
    {
        'ID': 'Q_FB_64', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He preferido la opción gratis a la de pago en: ____.',
        'Categoría de hábito': 'Opciones gratuitas', 'Avatar primario': 'comodo', 'Avatar secundario': 'impulsivo',
        'Opciones (opción [avatar+pts])': 'software_libre [comodo+2] | parque_gratis [comodo+2] | streaming_gratis [impulsivo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '5', 'Ahorro mensual interno (€)': '20', 'Ahorro anual interno (€)': '240',
        'Impacto interno (no visible)': 'Elegir gratis ahorra ~20 EUR/mes',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Tarde', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '4', 'Priority base': '6', 'Scenario weight': '2',
        'Intent (técnico)': 'gasto_evitado_opcion_gratis', 'Habit principle': 'obvious',
        'Tono': 'motivador', 'Dificultad': 'low',
    },
    {
        'ID': 'Q_FB_65', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He cocinado con lo que tenía en la despensa sin ir al super: ____.',
        'Categoría de hábito': 'Aprovechamiento despensa', 'Avatar primario': 'comodo', 'Avatar secundario': 'desordenado',
        'Opciones (opción [avatar+pts])': 'arroz_verduras [comodo+2] | lata_aprovechada [comodo+2] | congelado_util [desordenado+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '8', 'Ahorro mensual interno (€)': '32', 'Ahorro anual interno (€)': '384',
        'Impacto interno (no visible)': 'Aprovechar despensa evita ~4 compras extra/mes',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Noche', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '4', 'Priority base': '7', 'Scenario weight': '2',
        'Intent (técnico)': 'gasto_evitado_despensa', 'Habit principle': 'easy',
        'Tono': 'motivador', 'Dificultad': 'low',
    },
    {
        'ID': 'Q_FB_66', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He rechazado el complemento o servicio extra que me ofrecieron al comprar: ____.',
        'Categoría de hábito': 'Upsell rechazado', 'Avatar primario': 'comodo', 'Avatar secundario': 'impulsivo',
        'Opciones (opción [avatar+pts])': 'seguro_extra [comodo+2] | envio_express [comodo+2] | garantia_extendida [impulsivo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '8', 'Ahorro mensual interno (€)': '16', 'Ahorro anual interno (€)': '192',
        'Impacto interno (no visible)': 'Rechazar upsells ahorra ~16 EUR/mes',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Tarde', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '5', 'Priority base': '7', 'Scenario weight': '2',
        'Intent (técnico)': 'gasto_evitado_upsell_rechazo', 'Habit principle': 'obvious',
        'Tono': 'preventivo', 'Dificultad': 'medium',
    },
    {
        'ID': 'Q_FB_67', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He optado por hacer yo mismo algo que normalmente pago: ____.',
        'Categoría de hábito': 'DIY ahorro', 'Avatar primario': 'comodo', 'Avatar secundario': '',
        'Opciones (opción [avatar+pts])': 'limpieza_casa [comodo+2] | arreglo_ropa [comodo+2] | corte_pelo_casa [comodo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '15', 'Ahorro mensual interno (€)': '30', 'Ahorro anual interno (€)': '360',
        'Impacto interno (no visible)': 'DIY mensual ahorra ~30 EUR/mes',
        'Mejor día': 'Sábado, Domingo', 'Mejor franja': 'Mañana', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '7', 'Priority base': '7', 'Scenario weight': '2',
        'Intent (técnico)': 'gasto_evitado_diy', 'Habit principle': 'easy',
        'Tono': 'motivador', 'Dificultad': 'medium',
    },
    {
        'ID': 'Q_FB_68', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He comprado la versión básica en vez de la premium de: ____.',
        'Categoría de hábito': 'Versión básica elegida', 'Avatar primario': 'comodo', 'Avatar secundario': 'impulsivo',
        'Opciones (opción [avatar+pts])': 'producto_marca_blanca [comodo+2] | plan_basico_app [comodo+2] | modelo_anterior [impulsivo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '10', 'Ahorro mensual interno (€)': '25', 'Ahorro anual interno (€)': '300',
        'Impacto interno (no visible)': 'Elegir básico ahorra ~25 EUR/mes',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Tarde', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '5', 'Priority base': '7', 'Scenario weight': '2',
        'Intent (técnico)': 'gasto_evitado_version_basica', 'Habit principle': 'obvious',
        'Tono': 'motivador', 'Dificultad': 'low',
    },

    # ── SOCIAL (8 nuevas) ─────────────────────────────────────────────────────
    {
        'ID': 'Q_FB_69', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He organizado un plan en casa con amigos para ahorrar en: ____.',
        'Categoría de hábito': 'Plan en casa', 'Avatar primario': 'social', 'Avatar secundario': 'comodo',
        'Opciones (opción [avatar+pts])': 'cena_casa [social+2] | pelicula_casa [social+2] | juegos_mesa [comodo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '20', 'Ahorro mensual interno (€)': '50', 'Ahorro anual interno (€)': '600',
        'Impacto interno (no visible)': 'Plan en casa vs fuera ahorra ~50 EUR/mes',
        'Mejor día': 'Viernes, Sábado, Domingo', 'Mejor franja': 'Tarde', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '5', 'Priority base': '9', 'Scenario weight': '3',
        'Intent (técnico)': 'gasto_evitado_plan_casa', 'Habit principle': 'attractive',
        'Tono': 'motivador', 'Dificultad': 'medium',
    },
    {
        'ID': 'Q_FB_70', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He comunicado al grupo mi límite de gasto antes de salir y lo hemos respetado: ____.',
        'Categoría de hábito': 'Límite social comunicado', 'Avatar primario': 'social', 'Avatar secundario': 'desordenado',
        'Opciones (opción [avatar+pts])': 'limite_noche [social+2] | tope_cena [social+2] | max_consumicion [desordenado+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '15', 'Ahorro mensual interno (€)': '40', 'Ahorro anual interno (€)': '480',
        'Impacto interno (no visible)': 'Comunicar límite evita sobregastos grupales',
        'Mejor día': 'Viernes, Sábado', 'Mejor franja': 'Tarde', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '5', 'Priority base': '8', 'Scenario weight': '3',
        'Intent (técnico)': 'gasto_evitado_limite_comunicado', 'Habit principle': 'obvious',
        'Tono': 'motivador', 'Dificultad': 'high',
    },
    {
        'ID': 'Q_FB_71', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He elegido un plan cultural o de ocio económico en vez de uno caro: ____.',
        'Categoría de hábito': 'Ocio cultural barato', 'Avatar primario': 'social', 'Avatar secundario': '',
        'Opciones (opción [avatar+pts])': 'museo_gratis [social+2] | mercadillo [social+2] | concierto_gratis [social+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '20', 'Ahorro mensual interno (€)': '40', 'Ahorro anual interno (€)': '480',
        'Impacto interno (no visible)': 'Ocio cultural gratis ahorra ~40 EUR/mes',
        'Mejor día': 'Sábado, Domingo', 'Mejor franja': 'Mañana', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '7', 'Priority base': '7', 'Scenario weight': '2',
        'Intent (técnico)': 'gasto_evitado_ocio_cultural', 'Habit principle': 'attractive',
        'Tono': 'motivador', 'Dificultad': 'low',
    },
    {
        'ID': 'Q_FB_72', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He acordado con el grupo un límite de regalo o aportación para: ____.',
        'Categoría de hábito': 'Límite regalo acordado', 'Avatar primario': 'social', 'Avatar secundario': 'impulsivo',
        'Opciones (opción [avatar+pts])': 'cumple_amigo [social+2] | regalo_conjunto [social+2] | aportacion_viaje [impulsivo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '20', 'Ahorro mensual interno (€)': '20', 'Ahorro anual interno (€)': '240',
        'Impacto interno (no visible)': 'Acordar límites de regalo evita sobregastos',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Mañana', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '14', 'Priority base': '7', 'Scenario weight': '2',
        'Intent (técnico)': 'gasto_evitado_limite_regalo', 'Habit principle': 'obvious',
        'Tono': 'reflexivo', 'Dificultad': 'medium',
    },
    {
        'ID': 'Q_FB_73', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He salido antes para evitar que la noche se alargara y gastara más en: ____.',
        'Categoría de hábito': 'Salida a tiempo', 'Avatar primario': 'social', 'Avatar secundario': 'impulsivo',
        'Opciones (opción [avatar+pts])': 'copas_extra [social+2] | taxi_noche [social+2] | after_improvisado [impulsivo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '20', 'Ahorro mensual interno (€)': '40', 'Ahorro anual interno (€)': '480',
        'Impacto interno (no visible)': 'Salir antes evita escalada de gasto nocturno',
        'Mejor día': 'Sábado, Domingo', 'Mejor franja': 'Mañana', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '5', 'Priority base': '8', 'Scenario weight': '3',
        'Intent (técnico)': 'gasto_evitado_salida_tiempo', 'Habit principle': 'obvious',
        'Tono': 'motivador', 'Dificultad': 'high',
    },
    {
        'ID': 'Q_FB_74', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He preferido quedar a tomar algo sencillo en vez de ir a un sitio caro: ____.',
        'Categoría de hábito': 'Bar económico elegido', 'Avatar primario': 'social', 'Avatar secundario': 'comodo',
        'Opciones (opción [avatar+pts])': 'terraza_barrio [social+2] | cafe_sencillo [social+2] | bar_local [comodo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '10', 'Ahorro mensual interno (€)': '30', 'Ahorro anual interno (€)': '360',
        'Impacto interno (no visible)': 'Bar del barrio vs caro ahorra ~30 EUR/mes',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Tarde', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '4', 'Priority base': '8', 'Scenario weight': '3',
        'Intent (técnico)': 'gasto_evitado_bar_economico', 'Habit principle': 'attractive',
        'Tono': 'motivador', 'Dificultad': 'medium',
    },
    {
        'ID': 'Q_FB_75', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He dividido bien la cuenta en vez de pagar de más por ser el que invita: ____.',
        'Categoría de hábito': 'División justa cuenta', 'Avatar primario': 'social', 'Avatar secundario': 'desordenado',
        'Opciones (opción [avatar+pts])': 'cuenta_separada [social+2] | pagar_lo_mio [social+2] | app_split [desordenado+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '10', 'Ahorro mensual interno (€)': '20', 'Ahorro anual interno (€)': '240',
        'Impacto interno (no visible)': 'Dividir bien la cuenta evita pagar de más',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Tarde', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '5', 'Priority base': '7', 'Scenario weight': '2',
        'Intent (técnico)': 'gasto_evitado_cuenta_justa', 'Habit principle': 'satisfying',
        'Tono': 'reflexivo', 'Dificultad': 'medium',
    },
    {
        'ID': 'Q_FB_76', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He propuesto una actividad gratuita al grupo en vez de gastar en: ____.',
        'Categoría de hábito': 'Actividad gratuita liderada', 'Avatar primario': 'social', 'Avatar secundario': 'comodo',
        'Opciones (opción [avatar+pts])': 'deporte_parque [social+2] | ruta_senderismo [social+2] | bbq_casa [comodo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '25', 'Ahorro mensual interno (€)': '50', 'Ahorro anual interno (€)': '600',
        'Impacto interno (no visible)': 'Liderar actividad gratis ahorra ~50 EUR/mes',
        'Mejor día': 'Sábado, Domingo', 'Mejor franja': 'Mañana', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '7', 'Priority base': '8', 'Scenario weight': '3',
        'Intent (técnico)': 'gasto_evitado_actividad_gratis', 'Habit principle': 'attractive',
        'Tono': 'motivador', 'Dificultad': 'medium',
    },

    # ── IMPULSIVO (8 nuevas) ──────────────────────────────────────────────────
    {
        'ID': 'Q_FB_77', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He cerrado la app o web de compras sin añadir nada al carrito en: ____.',
        'Categoría de hábito': 'App cerrada sin comprar', 'Avatar primario': 'impulsivo', 'Avatar secundario': 'comodo',
        'Opciones (opción [avatar+pts])': 'amazon_cerrado [impulsivo+2] | zara_cerrado [impulsivo+2] | tienda_comida [comodo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '30', 'Ahorro mensual interno (€)': '60', 'Ahorro anual interno (€)': '720',
        'Impacto interno (no visible)': 'Cerrar app sin comprar evita ~60 EUR/mes',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Noche', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '3', 'Priority base': '9', 'Scenario weight': '3',
        'Intent (técnico)': 'gasto_evitado_app_cerrada', 'Habit principle': 'obvious',
        'Tono': 'motivador', 'Dificultad': 'high',
    },
    {
        'ID': 'Q_FB_78', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He esperado antes de comprar y al final he decidido no hacerlo porque: ____.',
        'Categoría de hábito': 'Decisión de espera', 'Avatar primario': 'impulsivo', 'Avatar secundario': 'desordenado',
        'Opciones (opción [avatar+pts])': 'ya_no_lo_queria [impulsivo+2] | encontre_alternativa [impulsivo+2] | ya_tenia_similar [desordenado+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '25', 'Ahorro mensual interno (€)': '50', 'Ahorro anual interno (€)': '600',
        'Impacto interno (no visible)': 'Esperar antes de comprar ahorra ~50 EUR/mes',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Mañana', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '5', 'Priority base': '9', 'Scenario weight': '3',
        'Intent (técnico)': 'gasto_evitado_espera_decision', 'Habit principle': 'obvious',
        'Tono': 'reflexivo', 'Dificultad': 'high',
    },
    {
        'ID': 'Q_FB_79', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He evitado comprar algo que vi en un anuncio o historia de redes sociales: ____.',
        'Categoría de hábito': 'Publicidad ignorada', 'Avatar primario': 'impulsivo', 'Avatar secundario': 'social',
        'Opciones (opción [avatar+pts])': 'producto_instagram [impulsivo+2] | ropa_tiktok [impulsivo+2] | plan_anuncio [social+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '25', 'Ahorro mensual interno (€)': '50', 'Ahorro anual interno (€)': '600',
        'Impacto interno (no visible)': 'Ignorar publicidad en redes ahorra ~50 EUR/mes',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Noche', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '4', 'Priority base': '9', 'Scenario weight': '3',
        'Intent (técnico)': 'gasto_evitado_publicidad_redes', 'Habit principle': 'obvious',
        'Tono': 'motivador', 'Dificultad': 'high',
    },
    {
        'ID': 'Q_FB_80', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He pensado si realmente lo necesitaba y he decidido no comprar: ____.',
        'Categoría de hábito': 'Reflexión antes de comprar', 'Avatar primario': 'impulsivo', 'Avatar secundario': '',
        'Opciones (opción [avatar+pts])': 'ropa_nueva [impulsivo+2] | gadget_tech [impulsivo+2] | accesorio_hogar [impulsivo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '30', 'Ahorro mensual interno (€)': '60', 'Ahorro anual interno (€)': '720',
        'Impacto interno (no visible)': 'Reflexionar antes de comprar ahorra ~60 EUR/mes',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Tarde', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '4', 'Priority base': '9', 'Scenario weight': '3',
        'Intent (técnico)': 'gasto_evitado_reflexion_compra', 'Habit principle': 'obvious',
        'Tono': 'reflexivo', 'Dificultad': 'high',
    },
    {
        'ID': 'Q_FB_81', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He desactivado las notificaciones de una app de compras para evitar tentaciones de: ____.',
        'Categoría de hábito': 'Fricción digital añadida', 'Avatar primario': 'impulsivo', 'Avatar secundario': 'desordenado',
        'Opciones (opción [avatar+pts])': 'alertas_amazon [impulsivo+2] | noti_ropa [impulsivo+2] | email_ofertas [desordenado+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '0', 'Ahorro mensual interno (€)': '30', 'Ahorro anual interno (€)': '360',
        'Impacto interno (no visible)': 'Desactivar notificaciones reduce compras impulsivas',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Mañana', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '14', 'Priority base': '8', 'Scenario weight': '2',
        'Intent (técnico)': 'gasto_evitado_notif_desactivadas', 'Habit principle': 'obvious',
        'Tono': 'preventivo', 'Dificultad': 'medium',
    },
    {
        'ID': 'Q_FB_82', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He comprado la versión de segunda mano en vez de nueva de: ____.',
        'Categoría de hábito': 'Segunda mano elegida', 'Avatar primario': 'impulsivo', 'Avatar secundario': 'comodo',
        'Opciones (opción [avatar+pts])': 'ropa_segunda [impulsivo+2] | libro_segunda [impulsivo+2] | mueble_segunda [comodo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '20', 'Ahorro mensual interno (€)': '40', 'Ahorro anual interno (€)': '480',
        'Impacto interno (no visible)': 'Segunda mano ahorra ~40 EUR/mes',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Tarde', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '7', 'Priority base': '8', 'Scenario weight': '2',
        'Intent (técnico)': 'gasto_evitado_segunda_mano', 'Habit principle': 'easy',
        'Tono': 'motivador', 'Dificultad': 'medium',
    },
    {
        'ID': 'Q_FB_83', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He frenado una compra emocional reconociendo que era por: ____.',
        'Categoría de hábito': 'Compra emocional frenada', 'Avatar primario': 'impulsivo', 'Avatar secundario': 'social',
        'Opciones (opción [avatar+pts])': 'aburrimiento [impulsivo+2] | estres_laboral [impulsivo+2] | presion_social [social+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '20', 'Ahorro mensual interno (€)': '60', 'Ahorro anual interno (€)': '720',
        'Impacto interno (no visible)': 'Identificar emocion detras de la compra la para',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Tarde', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '4', 'Priority base': '9', 'Scenario weight': '3',
        'Intent (técnico)': 'gasto_evitado_compra_emocional_reconocida', 'Habit principle': 'obvious',
        'Tono': 'reflexivo', 'Dificultad': 'high',
    },
    {
        'ID': 'Q_FB_84', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He utilizado lo que ya tenía en vez de comprar algo nuevo para: ____.',
        'Categoría de hábito': 'Reutilizar lo que hay', 'Avatar primario': 'impulsivo', 'Avatar secundario': 'desordenado',
        'Opciones (opción [avatar+pts])': 'ropa_armario [impulsivo+2] | herramienta_casa [impulsivo+2] | producto_viejo [desordenado+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '15', 'Ahorro mensual interno (€)': '30', 'Ahorro anual interno (€)': '360',
        'Impacto interno (no visible)': 'Reutilizar antes de comprar ahorra ~30 EUR/mes',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Tarde', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '5', 'Priority base': '8', 'Scenario weight': '2',
        'Intent (técnico)': 'gasto_evitado_reutilizar', 'Habit principle': 'easy',
        'Tono': 'motivador', 'Dificultad': 'medium',
    },

    # ── DESORDENADO (8 nuevas) ────────────────────────────────────────────────
    {
        'ID': 'Q_FB_85', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He encontrado y cancelado un servicio activo que no usaba: ____.',
        'Categoría de hábito': 'Servicio cancelado', 'Avatar primario': 'desordenado', 'Avatar secundario': 'impulsivo',
        'Opciones (opción [avatar+pts])': 'gym_no_usado [desordenado+2] | app_olvidada [desordenado+2] | servicio_aut [impulsivo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '15', 'Ahorro mensual interno (€)': '25', 'Ahorro anual interno (€)': '300',
        'Impacto interno (no visible)': 'Cancelar servicios sin usar ahorra ~25 EUR/mes',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Mañana', 'Fase del mes': 'Inicio',
        'Cooldown (días)': '14', 'Priority base': '9', 'Scenario weight': '3',
        'Intent (técnico)': 'gasto_evitado_servicio_cancelado', 'Habit principle': 'satisfying',
        'Tono': 'motivador', 'Dificultad': 'low',
    },
    {
        'ID': 'Q_FB_86', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He revisado mis finanzas esta semana y he identificado dónde puedo ahorrar: ____.',
        'Categoría de hábito': 'Revisión financiera activa', 'Avatar primario': 'desordenado', 'Avatar secundario': 'comodo',
        'Opciones (opción [avatar+pts])': 'suscripciones_rev [desordenado+2] | gastos_hormiga [desordenado+2] | comodidad_innec [comodo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '0', 'Ahorro mensual interno (€)': '35', 'Ahorro anual interno (€)': '420',
        'Impacto interno (no visible)': 'Revisar finanzas semanalmente identifica ahorros',
        'Mejor día': 'Domingo, Lunes', 'Mejor franja': 'Mañana', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '7', 'Priority base': '9', 'Scenario weight': '3',
        'Intent (técnico)': 'gasto_evitado_revision_finanzas', 'Habit principle': 'satisfying',
        'Tono': 'reflexivo', 'Dificultad': 'low',
    },
    {
        'ID': 'Q_FB_87', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He comparado precios antes de comprar y he elegido la opción más barata de: ____.',
        'Categoría de hábito': 'Comparación de precios', 'Avatar primario': 'desordenado', 'Avatar secundario': 'impulsivo',
        'Opciones (opción [avatar+pts])': 'supermercado_comp [desordenado+2] | seguro_comp [desordenado+2] | servicio_comp [impulsivo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '10', 'Ahorro mensual interno (€)': '30', 'Ahorro anual interno (€)': '360',
        'Impacto interno (no visible)': 'Comparar precios ahorra ~30 EUR/mes',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Mañana', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '5', 'Priority base': '8', 'Scenario weight': '2',
        'Intent (técnico)': 'gasto_evitado_comparacion_precios', 'Habit principle': 'obvious',
        'Tono': 'motivador', 'Dificultad': 'low',
    },
    {
        'ID': 'Q_FB_88', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He creado un presupuesto para esta categoría de gasto y lo he seguido: ____.',
        'Categoría de hábito': 'Presupuesto por categoría', 'Avatar primario': 'desordenado', 'Avatar secundario': '',
        'Opciones (opción [avatar+pts])': 'presup_ocio [desordenado+2] | presup_comida [desordenado+2] | presup_ropa [desordenado+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '0', 'Ahorro mensual interno (€)': '40', 'Ahorro anual interno (€)': '480',
        'Impacto interno (no visible)': 'Tener presupuesto por categoria limita el gasto',
        'Mejor día': 'Domingo, Lunes', 'Mejor franja': 'Mañana', 'Fase del mes': 'Inicio',
        'Cooldown (días)': '30', 'Priority base': '8', 'Scenario weight': '3',
        'Intent (técnico)': 'gasto_evitado_presupuesto_categoria', 'Habit principle': 'obvious',
        'Tono': 'reflexivo', 'Dificultad': 'low',
    },
    {
        'ID': 'Q_FB_89', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He anotado todos los gastos del día para no perder el control de: ____.',
        'Categoría de hábito': 'Registro de gastos diario', 'Avatar primario': 'desordenado', 'Avatar secundario': 'comodo',
        'Opciones (opción [avatar+pts])': 'gastos_efectivo [desordenado+2] | gastos_tarjeta [desordenado+2] | micro_gastos [comodo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '0', 'Ahorro mensual interno (€)': '25', 'Ahorro anual interno (€)': '300',
        'Impacto interno (no visible)': 'Registrar gastos diariamente da conciencia y control',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Noche', 'Fase del mes': 'Cualquiera',
        'Cooldown (días)': '3', 'Priority base': '7', 'Scenario weight': '2',
        'Intent (técnico)': 'gasto_evitado_registro_diario', 'Habit principle': 'satisfying',
        'Tono': 'reflexivo', 'Dificultad': 'low',
    },
    {
        'ID': 'Q_FB_90', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He negociado o buscado una oferta mejor antes de renovar: ____.',
        'Categoría de hábito': 'Negociación de contratos', 'Avatar primario': 'desordenado', 'Avatar secundario': '',
        'Opciones (opción [avatar+pts])': 'movil_renegoc [desordenado+2] | seguro_renegoc [desordenado+2] | internet_renegoc [desordenado+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '10', 'Ahorro mensual interno (€)': '20', 'Ahorro anual interno (€)': '240',
        'Impacto interno (no visible)': 'Renegociar tarifas ahorra ~20 EUR/mes',
        'Mejor día': 'Cualquier día', 'Mejor franja': 'Mañana', 'Fase del mes': 'Inicio',
        'Cooldown (días)': '30', 'Priority base': '8', 'Scenario weight': '2',
        'Intent (técnico)': 'gasto_evitado_negociacion', 'Habit principle': 'satisfying',
        'Tono': 'motivador', 'Dificultad': 'medium',
    },
    {
        'ID': 'Q_FB_91', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He hecho una auditoría rápida de mis gastos del mes y he encontrado: ____.',
        'Categoría de hábito': 'Auditoría mensual rápida', 'Avatar primario': 'desordenado', 'Avatar secundario': 'impulsivo',
        'Opciones (opción [avatar+pts])': 'gasto_hormiga_mes [desordenado+2] | sub_innecesaria [desordenado+2] | impulso_grande [impulsivo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '15', 'Ahorro mensual interno (€)': '30', 'Ahorro anual interno (€)': '360',
        'Impacto interno (no visible)': 'Auditoria mensual identifica 30 EUR/mes de margen',
        'Mejor día': 'Domingo, Lunes', 'Mejor franja': 'Mañana', 'Fase del mes': 'Final',
        'Cooldown (días)': '30', 'Priority base': '9', 'Scenario weight': '3',
        'Intent (técnico)': 'gasto_evitado_auditoria_rapida', 'Habit principle': 'satisfying',
        'Tono': 'reflexivo', 'Dificultad': 'low',
    },
    {
        'ID': 'Q_FB_92', 'Formato': 'fill_blank', 'Estado': 'activo',
        'Texto de la pregunta': 'He configurado un ahorro automático para no depender de la fuerza de voluntad en: ____.',
        'Categoría de hábito': 'Ahorro automático', 'Avatar primario': 'desordenado', 'Avatar secundario': 'comodo',
        'Opciones (opción [avatar+pts])': 'transferencia_aut [desordenado+2] | regla_redondeo [desordenado+2] | cuenta_ahorro_sep [comodo+2]',
        'Scoring por opción (JSON)': '',
        'Permite Otro': 'true', 'IA requerida para Otro': 'true', 'Umbral confianza IA': '0.70',
        'Placeholder Importe (€)': '50', 'Ahorro mensual interno (€)': '50', 'Ahorro anual interno (€)': '600',
        'Impacto interno (no visible)': 'Ahorro automatico asegura consistencia sin esfuerzo',
        'Mejor día': 'Domingo, Lunes', 'Mejor franja': 'Mañana', 'Fase del mes': 'Inicio',
        'Cooldown (días)': '30', 'Priority base': '9', 'Scenario weight': '3',
        'Intent (técnico)': 'gasto_evitado_ahorro_automatico', 'Habit principle': 'easy',
        'Tono': 'motivador', 'Dificultad': 'low',
    },
]

print(f"\nNuevas fill_blank generadas: {len(new_fb)}")

# ─────────────────────────────────────────────────────────────────
# 3. CONSTRUIR NUEVO CSV
# ─────────────────────────────────────────────────────────────────
new_rows = kept_amount + fillblank_rows + new_fb
amount_final   = [r for r in new_rows if r.get('Formato') == 'amount']
fillblank_final= [r for r in new_rows if r.get('Formato') == 'fill_blank']
print(f"\nDESPUÉS → amount: {len(amount_final)}, fill_blank: {len(fillblank_final)}, total: {len(new_rows)}")

with open(CSV_PATH, 'w', encoding='utf-8-sig', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(new_rows)

print("CSV guardado correctamente.")
