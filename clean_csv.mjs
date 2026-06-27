/**
 * clean_csv.mjs — Fase 4
 * 1. Elimina filas choice y constructor del CSV
 * 2. Actualiza scoring de 6 fill_blank piloto reescritas
 * 3. Añade 48 nuevas fill_blank (Q_FB_13 – Q_FB_60)
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'definitivoPlantilla_Banco_Preguntas_AhorroInvisible.csv');

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
  return lines.map(line => {
    const fields = []; let cur = ''; let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuote) {
        if (c === '"' && line[i+1] === '"') { cur += '"'; i++; }
        else if (c === '"') { inQuote = false; }
        else { cur += c; }
      } else {
        if (c === '"') { inQuote = true; }
        else if (c === ',') { fields.push(cur); cur = ''; }
        else { cur += c; }
      }
    }
    fields.push(cur); return fields;
  });
}
function escapeField(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n'))
    return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function rowToCSV(fields) { return fields.map(escapeField).join(','); }

// Scoring actualizado para 6 fill_blank del piloto
const FB_SCORING = {
  Q_P_01: [{label:'algo que me apetecia en ese momento sin necesitarlo',value:'apetece_momento',scores:{impulsivo:2}},{label:'una compra de impulso que habria lamentado despues',value:'compra_impulso',scores:{impulsivo:2}},{label:'un plan caro que no me apetecia realmente',value:'plan_social',scores:{social:2}},{label:'Otro',value:'otro',scores:null,freeText:true}],
  Q_P_04: [{label:'el almuerzo o taper para el trabajo',value:'taper_trabajo',scores:{comodo:2}},{label:'el desayuno o cafe de la manana',value:'desayuno_casa',scores:{comodo:2}},{label:'la cena, planificando en vez de improvisar',value:'cena_planificada',scores:{desordenado:2}},{label:'Otro',value:'otro',scores:null,freeText:true}],
  Q_P_07: [{label:'suscripciones o pagos recurrentes que no uso',value:'suscripcion_sin_uso',scores:{desordenado:2}},{label:'gastos pequenos invisibles que se acumulan',value:'gastos_invisibles',scores:{desordenado:2}},{label:'compras de comodidad que no son necesarias',value:'comodidad_innecesaria',scores:{comodo:2}},{label:'Otro',value:'otro',scores:null,freeText:true}],
  Q_P_10: [{label:'consumiciones y rondas de mas',value:'rondas',scores:{social:2}},{label:'el sitio elegido, optando por algo mas economico',value:'sitio_economico',scores:{social:2}},{label:'las compras impulsivas que surgieron en el grupo',value:'compra_grupo',scores:{impulsivo:2}},{label:'Otro',value:'otro',scores:null,freeText:true}],
  Q_P_13: [{label:'he cocinado en vez de pedir delivery o comida preparada',value:'cocinar_vs_delivery',scores:{comodo:2}},{label:'he usado transporte publico en vez de taxi o Uber',value:'transporte_publico',scores:{comodo:2}},{label:'he planificado la compra en vez de comprar sobre la marcha',value:'compra_planificada',scores:{desordenado:2}},{label:'Otro',value:'otro',scores:null,freeText:true}],
  Q_P_16: [{label:'algo que vi en redes sociales o publicidad',value:'redes_publicidad',scores:{impulsivo:2}},{label:'una oferta o descuento que me llego por mensaje',value:'oferta_mensaje',scores:{impulsivo:2}},{label:'un plan o gasto que propuso alguien del grupo',value:'plan_grupo',scores:{social:2}},{label:'Otro',value:'otro',scores:null,freeText:true}],
};
function fmtScoring(id) {
  const s = FB_SCORING[id]; if (!s) return '';
  return JSON.stringify(s.map(o=>({label:o.label,value:o.value,scores:o.scores,...(o.freeText?{freeText:true}:{})})));
}

// 48 nuevas filas fill_blank
// Orden columnas: ID,fmt,estado,texto,cat,avPrim,avSec,opts,sugAmt,mensual,anual,impacto,dia,franja,fase,cooldown,priority,scenario,intent,habit,tono,dificultad
const NEW_FB = [
['Q_FB_13','fill_blank','activo','Esta manana he salido de casa sin parar a comprar nada de camino: ____.','Rutina manana','comodo','desordenado','desayuno_casa [comodo+2] | cafe_termo [comodo+2] | ruta_plan [desordenado+2]','4','48','576','Salir de casa preparado ahorra ~48 EUR/mes','Lunes a Viernes','Manana','Cualquiera','3','8','3','gasto_evitado_manana','easy','motivador','low'],
['Q_FB_14','fill_blank','activo','Hoy he evitado el gasto en transporte de conveniencia eligiendo: ____.','Transporte','comodo','social','transporte_pub [comodo+2] | andar_bici [comodo+2] | compartir_v [social+2]','8','64','768','Evitar taxi ahorra ~64 EUR/mes','Lunes a Viernes','Manana','Cualquiera','3','8','3','gasto_evitado_transporte','easy','motivador','low'],
['Q_FB_15','fill_blank','activo','He hecho la compra del supermercado de forma mas inteligente: ____.','Compra supermercado','comodo','desordenado','lista_compra [comodo+2] | tienda_barata [comodo+2] | revisar_prev [desordenado+2]','15','30','360','Comprar con lista ahorra ~30 EUR/mes','Sabado, Domingo','Manana','Cualquiera','5','8','3','gasto_evitado_compra_lista','obvious','motivador','low'],
['Q_FB_16','fill_blank','activo','He reducido el gasto de conveniencia en el trabajo: ____.','Gastos trabajo','comodo','desordenado','agua_casa [comodo+2] | snack_casa [comodo+2] | mochila_prev [desordenado+2]','3','30','360','Llevar snack de casa ahorra ~30 EUR/mes','Lunes a Viernes','Manana','Cualquiera','3','7','2','gasto_evitado_trabajo','easy','motivador','low'],
['Q_FB_17','fill_blank','activo','He preparado el almuerzo yo mismo en vez de comprarlo fuera: ____.','Almuerzo','comodo','desordenado','sobras [comodo+2] | algo_rapido [comodo+2] | batch [desordenado+2]','7','56','672','Llevar almuerzo de casa ahorra ~56 EUR/mes','Lunes a Viernes','Manana','Cualquiera','3','9','3','gasto_evitado_almuerzo','easy','motivador','low'],
['Q_FB_18','fill_blank','activo','He elegido la alternativa mas barata en el gimnasio o deporte: ____.','Deporte y ocio activo','comodo','social','parque [comodo+2] | casa_gym [comodo+2] | actividad_gratis [social+2]','10','30','360','Entrenar al aire libre ahorra ~30 EUR/mes','Cualquier dia','Manana','Cualquiera','5','7','2','gasto_evitado_deporte','easy','motivador','medium'],
['Q_FB_19','fill_blank','activo','He ahorrado en el supermercado cambiando mi habito de compra: ____.','Compra supermercado','comodo','desordenado','marca_blanca [comodo+2] | comp_precios [comodo+2] | planif_oferta [desordenado+2]','12','36','432','Marca blanca y comparar ahorra ~36 EUR/mes','Sabado, Domingo','Manana','Cualquiera','7','7','2','gasto_evitado_super_habito','obvious','motivador','low'],
['Q_FB_20','fill_blank','activo','He reducido el gasto por pereza en casa esta tarde-noche: ____.','Tarde-noche','comodo','impulsivo','cocinar_vs_pedir [comodo+2] | metro_noche [comodo+2] | cap_entret [impulsivo+2]','10','40','480','Evitar la comodidad nocturna ahorra ~40 EUR/mes','Lunes a Jueves','Noche','Cualquiera','3','8','3','gasto_evitado_noche_comodo','obvious','motivador','medium'],
['Q_FB_21','fill_blank','activo','He ahorrado eligiendo la alternativa mas economica en vez de la comoda: ____.','Eleccion economica','comodo','desordenado','cocinar_vs_delivery [comodo+2] | tp_vs_taxi [comodo+2] | planif_compra [desordenado+2]','8','48','576','Elegir opciones economicas ahorra ~48 EUR/mes','Lunes a Viernes','Tarde','Cualquiera','4','8','3','gasto_evitado_eleccion_econ','obvious','motivador','medium'],
['Q_FB_22','fill_blank','activo','He evitado la compra de conveniencia en farmacia o tienda: ____.','Farmacia y tienda','comodo','desordenado','gen_barato [comodo+2] | mejor_precio [comodo+2] | ya_tenia [desordenado+2]','8','16','192','Alternativa generica ahorra ~16 EUR/mes','Cualquier dia','Tarde','Cualquiera','7','6','2','gasto_evitado_farmacia','obvious','motivador','low'],
['Q_FB_23','fill_blank','activo','He preparado la semana con antelacion para evitar gastos de comodidad: ____.','Planificacion semanal','comodo','desordenado','meal_prep [comodo+2] | ropa_lista [comodo+2] | plan_semanal [desordenado+2]','20','60','720','Preparar la semana ahorra ~60 EUR/mes','Domingo','Manana','Cualquiera','7','9','3','gasto_evitado_prep_semana','easy','motivador','low'],
['Q_FB_24','fill_blank','activo','He ahorrado evitando el gasto rapido de conveniencia al salir: ____.','Comida fuera economica','comodo','desordenado','mercado_vs_gas [comodo+2] | menu_dia [comodo+2] | comparar_antes [desordenado+2]','5','40','480','Menu del dia y mercado ahorra ~40 EUR/mes','Lunes a Viernes','Tarde','Cualquiera','4','7','2','gasto_evitado_conveniencia_salida','obvious','motivador','low'],
['Q_FB_25','fill_blank','activo','Hoy he propuesto al grupo un plan mas barato y lo han aceptado: ____.','Plan alternativo social','social','comodo','casa_vs_bar [social+2] | terraza_eco [social+2] | cocinar_juntos [comodo+2]','15','30','360','Proponer plan economico ahorra ~30 EUR/mes','Jueves, Viernes, Sabado','Tarde','Cualquiera','4','9','3','gasto_evitado_plan_alternativo','attractive','motivador','medium'],
['Q_FB_26','fill_blank','activo','He controlado el gasto en la ultima cena o comida de grupo: ____.','Cena de grupo','social','desordenado','pedido_sencillo [social+2] | compartir_plato [social+2] | tope_previo [desordenado+2]','12','30','360','Controlar cena de grupo ahorra ~30 EUR/mes','Viernes, Sabado','Noche','Cualquiera','5','9','3','gasto_evitado_cena_grupo','obvious','motivador','medium'],
['Q_FB_27','fill_blank','activo','He dicho que no a un plan social caro sin sentirme mal: ____.','Decir no al plan','social','impulsivo','quedado_casa [social+2] | plan_despues [social+2] | resistir_grupo [impulsivo+2]','20','40','480','Decir no a planes caros ahorra ~40 EUR/mes','Jueves, Viernes, Sabado','Tarde','Cualquiera','4','9','3','gasto_evitado_no_plan','obvious','motivador','high'],
['Q_FB_28','fill_blank','activo','He ahorrado en el transporte de vuelta de un plan nocturno: ____.','Transporte nocturno','social','comodo','metro_vuelta [social+2] | compartir_taxi [social+2] | salir_antes [comodo+2]','10','30','360','Metro vs taxi en la vuelta ahorra ~30 EUR/mes','Viernes, Sabado','Noche','Cualquiera','5','8','3','gasto_evitado_transporte_noche','obvious','motivador','medium'],
['Q_FB_29','fill_blank','activo','He controlado lo que gaste en la ultima salida de fin de semana: ____.','Salida finde','social','desordenado','efectivo_lim [social+2] | cuenta_sep [social+2] | tope_dia [desordenado+2]','20','40','480','Controlar el fin de semana ahorra ~40 EUR/mes','Lunes, Domingo','Manana','Cualquiera','5','9','3','gasto_evitado_control_finde','satisfying','motivador','medium'],
['Q_FB_30','fill_blank','activo','He reducido el gasto en la ultima celebracion o evento de grupo: ____.','Regalos y celebraciones','social','impulsivo','regalo_conjunto [social+2] | precio_acordado [social+2] | regalo_alternativo [impulsivo+2]','20','20','240','Acordar limite de regalo ahorra ~20 EUR/mes','Cualquier dia','Manana','Cualquiera','14','6','2','gasto_evitado_celebracion','obvious','motivador','medium'],
['Q_FB_31','fill_blank','activo','He controlado el gasto en el ultimo bar o restaurante: ____.','Bar y restaurante','social','desordenado','agua_noche [social+2] | no_ronda [social+2] | max_consumiciones [desordenado+2]','10','30','360','Controlar consumiciones ahorra ~30 EUR/mes','Viernes, Sabado, Domingo','Noche','Cualquiera','4','9','3','gasto_evitado_bar','obvious','motivador','medium'],
['Q_FB_32','fill_blank','activo','He ahorrado en comidas de trabajo o compromisos sociales: ____.','Comidas de trabajo','social','comodo','menu_eco [social+2] | traer_comida [social+2] | menos_salidas [comodo+2]','10','40','480','Menu economico en trabajo ahorra ~40 EUR/mes','Lunes a Viernes','Tarde','Cualquiera','7','7','2','gasto_evitado_comidas_trabajo','obvious','motivador','medium'],
['Q_FB_33','fill_blank','activo','He resistido la presion del grupo y he ahorrado en: ____.','Presion social evitada','social','impulsivo','no_ronda_presion [social+2] | no_compra_grupo [social+2] | no_presion_compra [impulsivo+2]','15','30','360','Resistir presion de grupo ahorra ~30 EUR/mes','Viernes, Sabado, Domingo','Tarde','Cualquiera','4','9','3','gasto_evitado_presion_grupo','obvious','motivador','high'],
['Q_FB_34','fill_blank','activo','He reducido el gasto en el ultimo viaje o escapada de grupo: ____.','Viajes y escapadas','social','desordenado','aloj_eco [social+2] | destino_eco [social+2] | planif_viaje [desordenado+2]','50','25','300','Planificar viajes ahorra ~25 EUR/mes','Lunes, Domingo','Manana','Cualquiera','30','6','2','gasto_evitado_viaje_grupo','obvious','motivador','medium'],
['Q_FB_35','fill_blank','activo','He ahorrado evitando el efecto de cascada en una salida nocturna: ____.','Escalada social nocturna','social','impulsivo','no_escalada [social+2] | ido_antes [social+2] | no_local_caro [impulsivo+2]','20','45','540','Cortar la escalada nocturna ahorra ~45 EUR/mes','Viernes, Sabado','Noche','Cualquiera','5','9','3','gasto_evitado_escalada_nocturna','obvious','motivador','high'],
['Q_FB_36','fill_blank','activo','He propuesto y liderado un plan social mas economico: ____.','Plan social barato','social','comodo','bbq_casa [social+2] | activ_gratis [social+2] | juegos_casa [comodo+2]','25','50','600','Liderar plan economico ahorra ~50 EUR/mes','Viernes, Sabado, Domingo','Tarde','Cualquiera','7','8','3','gasto_evitado_plan_liderado','attractive','motivador','medium'],
['Q_FB_37','fill_blank','activo','He vaciado el carrito de una tienda online sin comprar: ____.','Carrito abandonado','impulsivo','comodo','carrito_ropa [impulsivo+2] | carrito_tech [impulsivo+2] | carrito_deco [comodo+2]','35','70','840','Abandonar carritos ahorra ~70 EUR/mes','Cualquier dia','Noche','Cualquiera','4','9','3','gasto_evitado_carrito','obvious','motivador','high'],
['Q_FB_38','fill_blank','activo','He aplicado la regla de las 24 horas antes de comprar y he decidido no hacerlo: ____.','Regla 24h','impulsivo','desordenado','ya_no_queria [impulsivo+2] | alternativa_24h [impulsivo+2] | ya_tenia_similar [desordenado+2]','25','50','600','La regla de 24h ahorra ~50 EUR/mes','Cualquier dia','Manana','Cualquiera','5','9','3','gasto_evitado_24h','obvious','motivador','high'],
['Q_FB_39','fill_blank','activo','He ignorado una notificacion de oferta o descuento de: ____.','Notificaciones ignoradas','impulsivo','comodo','notif_ropa [impulsivo+2] | notif_app [impulsivo+2] | notif_super [comodo+2]','20','40','480','Ignorar notificaciones ahorra ~40 EUR/mes','Cualquier dia','Tarde','Cualquiera','3','8','3','gasto_evitado_notificacion','obvious','motivador','medium'],
['Q_FB_40','fill_blank','activo','He evitado la compra impulsiva despues de ver algo en redes: ____.','Compra por redes sociales','impulsivo','social','redes_producto [impulsivo+2] | influencer [impulsivo+2] | exp_social [social+2]','25','75','900','Evitar compras de redes ahorra ~75 EUR/mes','Cualquier dia','Noche','Cualquiera','4','9','3','gasto_evitado_redes','obvious','motivador','high'],
['Q_FB_41','fill_blank','activo','He resistido la urgencia de comprar algo de edicion limitada o con contador: ____.','Urgencia artificial','impulsivo','social','cuenta_atras [impulsivo+2] | preventa [impulsivo+2] | agota_presion [social+2]','40','40','480','Ignorar urgencias artificiales ahorra ~40 EUR/mes','Cualquier dia','Tarde','Cualquiera','5','8','3','gasto_evitado_urgencia_artificial','obvious','motivador','high'],
['Q_FB_42','fill_blank','activo','He parado una compra emocional que estaba a punto de hacer: ____.','Compra emocional','impulsivo','comodo','compra_aburrido [impulsivo+2] | compra_estres [impulsivo+2] | compra_capricho [comodo+2]','20','60','720','Parar compras emocionales ahorra ~60 EUR/mes','Cualquier dia','Tarde','Cualquiera','4','9','3','gasto_evitado_compra_emocional','obvious','motivador','high'],
['Q_FB_43','fill_blank','activo','He eliminado o bloqueado una tentacion de compra digital: ____.','Friccion compra digital','impulsivo','desordenado','desinstalar_app [impulsivo+2] | borrar_tarjeta [impulsivo+2] | cancelar_noti [desordenado+2]','0','30','360','Poner friccion digital ahorra ~30 EUR/mes','Cualquier dia','Noche','Cualquiera','14','8','3','gasto_evitado_friccion_digital','obvious','motivador','medium'],
['Q_FB_44','fill_blank','activo','He devuelto o cancelado una compra que habia hecho por impulso: ____.','Devolucion y rectificacion','impulsivo','social','devolver_ropa [impulsivo+2] | devolver_prod [impulsivo+2] | devolver_social [social+2]','30','30','360','Devolver compras impulsivas recupera ~30 EUR/mes','Cualquier dia','Manana','Cualquiera','7','7','2','gasto_evitado_devolucion','satisfying','motivador','medium'],
['Q_FB_45','fill_blank','activo','He evitado el gasto extra al completar una compra que ya habia hecho: ____.','Upsell evitado','impulsivo','comodo','no_accesorios [impulsivo+2] | no_seguro [impulsivo+2] | no_urgente [comodo+2]','15','15','180','Rechazar upsells ahorra ~15 EUR/mes','Cualquier dia','Tarde','Cualquiera','7','7','2','gasto_evitado_upsell','obvious','motivador','medium'],
['Q_FB_46','fill_blank','activo','He esperado antes de confirmar una compra grande y no la he hecho: ____.','Compra grande evitada','impulsivo','social','espera_100 [impulsivo+2] | espera_sub [impulsivo+2] | espera_feria [social+2]','80','30','360','Esperar antes de compra grande ahorra ~30 EUR/mes','Cualquier dia','Manana','Cualquiera','10','8','3','gasto_evitado_espera_grande','obvious','motivador','high'],
['Q_FB_47','fill_blank','activo','He parado la escalada de gasto en ocio digital o entretenimiento: ____.','Ocio digital','impulsivo','desordenado','no_ingame [impulsivo+2] | no_dlc [impulsivo+2] | cancel_premium [desordenado+2]','15','20','240','Parar escalada de ocio digital ahorra ~20 EUR/mes','Cualquier dia','Noche','Cualquiera','7','7','2','gasto_evitado_ocio_digital','obvious','motivador','medium'],
['Q_FB_48','fill_blank','activo','He resistido comprar algo solo porque estaba de oferta: ____.','Oferta resistida','impulsivo','comodo','oferta_ropa [impulsivo+2] | oferta_tech [impulsivo+2] | oferta_hogar [comodo+2]','30','45','540','Resistir ofertas sin necesidad ahorra ~45 EUR/mes','Cualquier dia','Tarde','Cualquiera','5','8','3','gasto_evitado_oferta_resistida','obvious','motivador','high'],
['Q_FB_49','fill_blank','activo','Esta semana he cancelado o reducido una suscripcion que no usaba: ____.','Suscripciones','desordenado','impulsivo','cancel_streaming [desordenado+2] | cancel_app [desordenado+2] | cancel_fisico [impulsivo+2]','10','15','180','Cancelar suscripciones sin uso ahorra ~15 EUR/mes','Cualquier dia','Manana','Inicio','14','8','3','gasto_evitado_suscripcion_desordenado','satisfying','motivador','low'],
['Q_FB_50','fill_blank','activo','He detectado y parado un cobro recurrente que no recordaba: ____.','Cobros olvidados','desordenado','comodo','trial_cobro [desordenado+2] | servicio_olv [desordenado+2] | tarifa_red [comodo+2]','12','20','240','Detectar cobros olvidados ahorra ~20 EUR/mes','Cualquier dia','Manana','Cualquiera','14','9','3','gasto_evitado_cobro_olvidado','satisfying','reflexivo','low'],
['Q_FB_51','fill_blank','activo','He planificado la semana con antelacion para evitar gastos imprevistos: ____.','Planificacion semanal','desordenado','comodo','menu_semana [desordenado+2] | rev_gastos [desordenado+2] | prep_urgencia [comodo+2]','20','40','480','Planificar la semana ahorra ~40 EUR/mes','Domingo','Manana','Cualquiera','7','9','3','gasto_evitado_planif_semana','obvious','motivador','low'],
['Q_FB_52','fill_blank','activo','He revisado mis extractos del banco y he encontrado donde ahorrar: ____.','Revision extracto','desordenado','impulsivo','cargos_auto [desordenado+2] | gastos_conv_rev [desordenado+2] | impulso_rev [impulsivo+2]','15','30','360','Revisar extracto mensual ahorra ~30 EUR/mes','Domingo, Lunes','Manana','Final','14','9','3','gasto_evitado_extracto','satisfying','reflexivo','low'],
['Q_FB_53','fill_blank','activo','He organizado mejor mi dinero esta semana: ____.','Organizacion financiera','desordenado','comodo','sep_fijos [desordenado+2] | anotar_gst [desordenado+2] | limite_cat [comodo+2]','0','50','600','Organizar el dinero en categorias ahorra ~50 EUR/mes','Lunes, Domingo','Manana','Inicio','7','8','3','gasto_evitado_organizacion','obvious','reflexivo','low'],
['Q_FB_54','fill_blank','activo','He evitado el gasto de emergencia por falta de planificacion: ____.','Gasto de emergencia evitado','desordenado','comodo','casa_prep [desordenado+2] | comida_prev [desordenado+2] | plan_b [comodo+2]','10','30','360','Prevenir emergencias ahorra ~30 EUR/mes','Cualquier dia','Tarde','Cualquiera','5','8','3','gasto_evitado_emergencia','obvious','motivador','low'],
['Q_FB_55','fill_blank','activo','He reducido el gasto en el supermercado evitando ir sin lista: ____.','Compra con lista','desordenado','impulsivo','lista_estricta [desordenado+2] | compra_online_plan [desordenado+2] | evitar_pasillo [impulsivo+2]','15','45','540','Comprar con lista fija ahorra ~45 EUR/mes','Sabado, Domingo','Manana','Cualquiera','7','9','3','gasto_evitado_compra_con_lista','obvious','motivador','low'],
['Q_FB_56','fill_blank','activo','He cancelado algo que tenia contratado y ya no justificaba: ____.','Contratos cancelados','desordenado','impulsivo','reserva_cancel [desordenado+2] | sub_auto [desordenado+2] | compra_futura [impulsivo+2]','20','20','240','Cancelar contratos innecesarios ahorra ~20 EUR/mes','Cualquier dia','Manana','Inicio','14','7','2','gasto_evitado_contrato','satisfying','motivador','low'],
['Q_FB_57','fill_blank','activo','He organizado mis gastos del mes y he encontrado margen de ahorro en: ____.','Revision mensual','desordenado','impulsivo','ocio_margen [desordenado+2] | comida_margen [desordenado+2] | ropa_margen [impulsivo+2]','20','40','480','Auditoria mensual ahorra ~40 EUR/mes','Domingo, Lunes','Manana','Final','30','9','3','gasto_evitado_auditoria_mensual','satisfying','reflexivo','low'],
['Q_FB_58','fill_blank','activo','He evitado un gasto por desorganizacion de mi tiempo: ____.','Gasto por desorganizacion','desordenado','comodo','salida_prep [desordenado+2] | llegada_tiempo [desordenado+2] | cita_tiempo [comodo+2]','10','20','240','Organizarse evita gastos de urgencia ~20 EUR/mes','Cualquier dia','Tarde','Cualquiera','5','7','2','gasto_evitado_desorg_tiempo','obvious','motivador','low'],
['Q_FB_59','fill_blank','activo','He ahorrado adelantandome en vez de dejarlo para el ultimo momento: ____.','Planificacion con antelacion','desordenado','comodo','reserva_ant [desordenado+2] | renovar_ant [desordenado+2] | regalo_ant [comodo+2]','20','20','240','Anticiparse reduce precios de urgencia ~20 EUR/mes','Cualquier dia','Manana','Cualquiera','14','7','2','gasto_evitado_anticipacion','obvious','motivador','medium'],
['Q_FB_60','fill_blank','activo','He eliminado o reducido un gasto fijo que ya no justificaba: ____.','Gastos fijos reducidos','desordenado','impulsivo','tarifa_fija [desordenado+2] | seguro_renegociar [desordenado+2] | sub_ocio [impulsivo+2]','15','20','240','Renegociar tarifas fijas ahorra ~20 EUR/mes','Cualquier dia','Manana','Inicio','30','7','2','gasto_evitado_gastos_fijos','satisfying','reflexivo','low'],
];

const raw = readFileSync(FILE, 'utf8').replace(/^\uFEFF/, '');
const rows = parseCSV(raw);
if (rows.length < 2) { console.error('CSV vacio. Abortando.'); process.exit(1); }

const headers = rows[0];
console.log('Columnas:', headers.length, ' | Filas:', rows.length - 1);

function colIdx(name) {
  const i = headers.findIndex(h => h.trim() === name.trim());
  if (i === -1) console.warn('  WARN columna no encontrada: ' + name);
  return i;
}
const IDX = {
  ID: colIdx('ID'), Formato: colIdx('Formato'),
  AvatarPrim: colIdx('Avatar primario'), AvatarSec: colIdx('Avatar secundario'),
  Scoring: colIdx('Scoring por opcion (JSON)'),
};
// Fallback si el nombre tiene tilde
if (IDX.Scoring === -1) IDX.Scoring = colIdx('Scoring por opci\u00f3n (JSON)');

function get(row, i) { return i !== -1 ? (row[i] ?? '') : ''; }

const dataRows = rows.slice(1);
let nChoice = 0, nConstr = 0;

const filtered = dataRows.filter(row => {
  const fmt = get(row, IDX.Formato).trim().toLowerCase();
  const ap  = get(row, IDX.AvatarPrim).trim().toLowerCase();
  const as_ = get(row, IDX.AvatarSec).trim().toLowerCase();
  if (fmt === 'choice') { nChoice++; return false; }
  if (ap === 'constructor' || as_ === 'constructor') { nConstr++; return false; }
  return true;
});

let nScoring = 0;
const updated = filtered.map(row => {
  const id = get(row, IDX.ID).trim();
  if (FB_SCORING[id] && IDX.Scoring !== -1) {
    const r = [...row]; r[IDX.Scoring] = fmtScoring(id); nScoring++; return r;
  }
  return row;
});

const headerMap = {};
headers.forEach((h, i) => { headerMap[h.trim()] = i; });

function buildRow(q) {
  const row = new Array(headers.length).fill('');
  const set = (col, val) => {
    const i = headerMap[col] ?? headerMap[col.normalize('NFD').replace(/\p{Diacritic}/gu, '')];
    if (i !== undefined) row[i] = String(val ?? '');
  };
  set('ID', q[0]); set('Formato', q[1]); set('Estado', q[2]);
  set('Texto de la pregunta', q[3]); set('Categor\u00eda de h\u00e1bito', q[4]);
  if (headerMap['Categor\u00eda de h\u00e1bito'] !== undefined) row[headerMap['Categor\u00eda de h\u00e1bito']] = q[4];
  else if (headerMap['Categoria de habito'] !== undefined) row[headerMap['Categoria de habito']] = q[4];
  set('Avatar primario', q[5]); set('Avatar secundario', q[6]);
  set('Opciones (opci\u00f3n [avatar+pts])', q[7]);
  if (headerMap['Opciones (opci\u00f3n [avatar+pts])'] !== undefined) row[headerMap['Opciones (opci\u00f3n [avatar+pts])']] = q[7];
  set('Permite Otro', 'true'); set('IA requerida para Otro', 'true'); set('Umbral confianza IA', '0.70');
  set('Placeholder Importe (\u20ac)', q[8]); set('Ahorro mensual interno (\u20ac)', q[9]); set('Ahorro anual interno (\u20ac)', q[10]);
  set('Impacto interno (no visible)', q[11]); set('Mejor d\u00eda', q[12]); set('Mejor franja', q[13]);
  set('Fase del mes', q[14]); set('Cooldown (d\u00edas)', q[15]); set('Priority base', q[16]);
  set('Scenario weight', q[17]); set('Intent (t\u00e9cnico)', q[18]); set('Habit principle', q[19]);
  set('Tono', q[20]); set('Dificultad', q[21]);
  return row;
}

const existingIds = new Set(updated.map(r => get(r, IDX.ID).trim()));
const newRows = NEW_FB.filter(q => !existingIds.has(q[0])).map(buildRow);

const out = [headers, ...updated, ...newRows];
writeFileSync(FILE, '\uFEFF' + out.map(rowToCSV).join('\r\n'), 'utf8');

console.log('\n OK CSV actualizado.');
console.log('  Eliminadas choice: ' + nChoice);
console.log('  Eliminadas constructor: ' + nConstr);
console.log('  Scoring piloto actualizado: ' + nScoring);
console.log('  Nuevas fill_blank anadidas: ' + newRows.length);
console.log('  Total filas resultantes: ' + (out.length - 1));
