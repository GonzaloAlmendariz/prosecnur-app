/**
 * Si una fila del plan con fecha es una visita que alguien va a hacer.
 *
 * `dashboard.agenda` es **el plan entero** —`agenda = .monitoreo_aulas_records(plan_df)`
 * en `api/R/monitoreo_aulas_universitarias.R`—: titulares, reservas de cadena y
 * el banco de extras, todas con su `scheduled_date`. Proyectar sobre «tiene
 * fecha por delante» contaba como trabajo comprometido cosas que nadie va a
 * aplicar, y eso **tapa la brecha justo donde la alerta existe para verla**.
 *
 * Medido sobre el fixture de agenda larga, de las 269 filas con fecha por
 * delante del corte:
 *
 * | rol | agendada | aplicada | en_reserva | reemplazada |
 * |---|---|---|---|---|
 * | titular | 146 | 0 | 0 | **24** |
 * | chain_reserve | 14 | 0 | **10** | **2** |
 * | extra_reserve_pool | 0 | 3 | **70** | 0 |
 *
 * Las 106 en negrita no son visitas: 80 duermen en reserva esperando que caiga
 * alguien, y 26 son aulas que YA cayeron y fueron reemplazadas. Al sembrar 30
 * extras mas en dos facultades, su brecha proyectada bajo de 152 a 81 sin que
 * nadie fuera a aplicar una sola: ese fue el sintoma que lo destapo.
 *
 * Es el mismo error que el motor ya tenia escrito en otro sitio —«las 639
 * reservas del BANCO no son aulas que alguien vaya a visitar: contarlas como
 * aulas por debajo de su meta convertia el banco en deuda»— cometido de nuevo
 * una capa mas arriba.
 *
 * ## Por qué se excluye en vez de permitir
 *
 * Una lista cerrada de estados «buenos» se traga en silencio lo que no
 * reconoce: en un estudio real con `contactada` o `planificada`, un allow-list
 * de `agendada` dejaria la proyeccion en cero sin avisar. Se nombran los
 * estados que descalifican y **todo lo demas, incluido un estado nuevo, cuenta**
 * —que es el error barato: proyectar de mas se ve, proyectar de menos no—.
 *
 * Una fila con fecha y **sin** estado si cuenta: la fecha es el hecho positivo,
 * y un plan recien importado no trae estado todavia.
 */

/** Estados que dicen que esa fila no es una visita por hacer. */
const NO_ES_VISITA = new Set([
  "-",              // como el equipo escribe «todavía nada aquí» en el Excel
  "sin_contactar",  // tiene fecha pero nadie ha llamado
  "en_reserva",     // duerme esperando que caiga su titular
  "reemplazada",    // ya cayó: la cubre otro eslabón
]);

export function esVisitaComprometida(sampleStatus: unknown): boolean {
  const v = String(sampleStatus ?? "").trim().toLowerCase();
  // «en reserva 3» es el vocabulario del Excel para la reserva que aún espera;
  // el normalizador convierte unas y deja otras, así que se reconocen las dos.
  if (v.startsWith("en reserva") || v.startsWith("en_reserva")) return false;
  return !NO_ES_VISITA.has(v);
}
