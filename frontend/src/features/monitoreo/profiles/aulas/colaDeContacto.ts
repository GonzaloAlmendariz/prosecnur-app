import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
// La misma lista que libera una cadena de reemplazo: llamar a un aula que
// ya se aplicó —parcial incluida— es el mismo trabajo perdido en las dos.
import { ESTADOS_QUE_LIBERAN, cadenaPropia, sigueDormida } from "./candidatosDeReemplazo";

/**
 * A quién hay que llamar, y cuánto ha costado agendar.
 *
 * P2. Los campos del ciclo de contacto —teléfono, medio, fecha de llamada,
 * intentos— están todos en la tabla de la agenda, y no había ninguna vista que
 * ordenara el trabajo del día: hay que rastrear 196 filas para saber a quién
 * toca insistir.
 *
 * El panel contesta dos cosas con el mismo dato, y en este orden:
 *
 * 1. **La cola**: lo que sigue sin cita, con el que más intentos lleva primero
 *    —es el que se va a caer—.
 * 2. **El esfuerzo ya gastado**, por facultad. Cuando no queda nadie por llamar
 *    esto es lo único que el ciclo de contacto todavía puede decir, y sirve:
 *    una facultad que costó 4 intentos por aula va a costar lo mismo la próxima
 *    ola.
 */

export type PendienteDeContacto = {
  codigo: string;
  facultad: string;
  docente: string;
  telefono: string;
  medio: string;
  ultimaLlamada: string;
  intentos: number;
  /**
   * El STATUS DE LLAMADA tecleado por el equipo («No contesta», «Apagado»…):
   * el PORQUÉ detrás del número de gestiones. Textual y en sus palabras — una
   * lista cerrada se tragaría el vocabulario del operativo. "" si no hay.
   */
  estadoLlamada: string;
  /**
   * Esta fila es el RELEVO directo de un titular rechazado (caso A del
   * dictado 2026-09-03): el código del titular al que reemplaza. La regla es
   * la del motor (monitoreo_aulas_en_juego.R B13b): el rechazo del titular
   * pasa el eslabón a la primera reserva no caída aunque nadie la haya
   * contactado — es a la que hay que salir a llamar.
   */
  relevoDe?: string;
  /** RECIBIÓ CORREO, tal como lo escribió el equipo («SÍ»/«NO»/lo que sea). */
  correo: string;
};

/** Una cita ya cerrada: el trabajo hecho, con el horario que se fijó. */
export type CitaFijada = {
  codigo: string;
  facultad: string;
  docente: string;
  fecha: string;
  hora: string;
  intentos: number;
  /** `true` cuando ya se aplicó: la cita se cumplió. */
  aplicada: boolean;
};

export type EsfuerzoDeFacultad = {
  facultad: string;
  aulas: number;
  /** Intentos por aula, mediana. `null` si ninguna los declara. */
  intentos: number | null;
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor).trim();
}

function mediana(xs: number[]): number | null {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : Math.round(((o[m - 1] + o[m]) / 2) * 10) / 10;
}

/** Ya tiene cita: no entra en la cola. «Reagendada» también la tiene. */
function tieneCita(fila: MonitoreoAulasPlanRow): boolean {
  const s = texto(fila.sample_status).toLowerCase();
  return s.startsWith("agendada") || s.startsWith("reagendada");
}

export function colaDeContacto(
  filas: ReadonlyArray<MonitoreoAulasPlanRow>,
  /**
   * El pool COMPLETO con las reservas de cadena, solo para buscar el relevo
   * de un titular rechazado. La agenda del agendador excluye reservas a
   * propósito (llama titular por titular) y sin este segundo insumo la cadena
   * no existe para la cola. Por defecto, las mismas filas.
   */
  conReservas: ReadonlyArray<MonitoreoAulasPlanRow> = filas,
): {
  pendientes: PendienteDeContacto[];
  citadas: CitaFijada[];
  esfuerzo: EsfuerzoDeFacultad[];
  /** Cuántas se sacaron de la cola por estar ya aplicadas. Se declara, no se calla. */
  yaAplicadasSinCita: number;
  /**
   * Cuántas salieron de la cola porque el docente RECHAZÓ (B13b, tecleado en
   * STATUS MUESTRA). Se declara: el contador de la cola baja y quien reparte
   * llamadas tiene que saber por qué. `titulares` desagrega el rol — un
   * rechazo de titular abre reemplazo; el de una reserva no.
   */
  rechazadas: { total: number; titulares: number };
} {
  const pendientes: PendienteDeContacto[] = [];
  // **Las citadas también salen, con su horario.**
  //
  // El panel enseñaba sólo la cola —lo que falta— así que un horario fijado no
  // se veía nunca: por definición, quien tiene cita no está en la cola. Quien
  // agenda necesita las dos mitades, y la fecha que consiguió es el resultado
  // de su trabajo, no un dato de archivo.
  const citadas: CitaFijada[] = [];
  /** Aplicadas cuyo `sample_status` ya no dice «agendada»: ni cola ni cita. */
  let yaAplicadasSinCita = 0;
  const rechazadas = { total: 0, titulares: 0 };
  const titularesRechazados: MonitoreoAulasPlanRow[] = [];
  const porFacultad = new Map<string, number[]>();

  for (const fila of filas) {
    // La reserva adicional no se contacta: no cuelga de ningún titular.
    if (texto(fila.sample_role) === "extra_reserve_pool") continue;
    const facultad = texto(fila.faculty) || "Sin facultad";
    const intentos = Number(fila.contact_attempts);
    // Una reserva DORMIDA tampoco: no se llama hasta que su titular cae, y
    // meterla en la cola mandaría al equipo a perseguir aulas que nadie
    // necesita todavía. El criterio es el del espejo sancionado
    // (`sigueDormida`): mirar solo «EN RESERVA» dejaba dentro a las reservas
    // sembradas como SIN CONTACTAR — la divergencia de dos lecturas que ya
    // costó otras pestañas. Un titular jamás duerme por este eje.
    const dormida = texto(fila.sample_role) === "chain_reserve" && sigueDormida(fila);
    if (tieneCita(fila)) {
      if (Number.isFinite(intentos) && intentos > 0) {
        const xs = porFacultad.get(facultad) ?? [];
        xs.push(intentos);
        porFacultad.set(facultad, xs);
      }
      citadas.push({
        codigo: texto(fila.operational_code),
        facultad,
        docente: texto(fila.teacher),
        fecha: texto(fila.scheduled_date),
        hora: texto(fila.scheduled_time),
        intentos: Number.isFinite(intentos) ? intentos : 0,
        aplicada: ESTADOS_QUE_LIBERAN.has(texto(fila.operational_status).toLowerCase()),
      });
      continue;
    }
    if (dormida) continue;
    // Lo que ya cayó tampoco se persigue: su reemplazo es otro asunto.
    if (texto(fila.sample_status).toLowerCase().startsWith("reemplazada")) continue;
    // El RECHAZO tecleado (B13b) cierra la gestión: la cola mandaba a
    // INSISTIRLE a un docente que ya dijo que no — CH 90 estaba en «a quién
    // llamar» con su nota de rechazo al lado (dictado 2026-09-03). Mismo
    // criterio contains del motor; su reemplazo es otro asunto.
    if (/^rechaz/.test(texto(fila.sample_status).toLowerCase())) {
      rechazadas.total += 1;
      if (!fila.sample_role || texto(fila.sample_role) === "titular") {
        rechazadas.titulares += 1;
        titularesRechazados.push(fila);
      }
      continue;
    }
    // **Ni lo que ya se aplicó.**
    //
    // `tieneCita()` mira `sample_status`, y en cuanto un aula se aplica ese
    // estado deja de ser «agendada»: el aula volvía a la cola de contacto.
    // Medido el 2026-08-29 sobre `aulas_con_respuestas.pulso`: 10 citas fijadas
    // + 183 por contactar = 193, con **48 aplicadas**; o sea que 38 aulas ya
    // aplicadas estaban en la lista de a quién llamar.
    //
    // Es el mismo par de ejes de siempre —`sample_status` es el del muestreo y
    // `operational_status` el del operativo— y aquí manda el segundo: llamar a
    // un aula que ya se aplicó es trabajo perdido, y en una pantalla que existe
    // para repartir llamadas eso es lo caro.
    if (ESTADOS_QUE_LIBERAN.has(texto(fila.operational_status).toLowerCase())) {
      yaAplicadasSinCita += 1;
      continue;
    }
    pendientes.push({
      codigo: texto(fila.operational_code),
      facultad,
      docente: texto(fila.teacher),
      telefono: texto(fila.teacher_phone),
      medio: texto(fila.contact_medium),
      ultimaLlamada: texto(fila.contact_date),
      intentos: Number.isFinite(intentos) ? intentos : 0,
      // Los dos campos B23 que viajaban sin consumidor (7c8e0bd3): el estado
      // de la llamada y si el correo llegó — las dos mitades del contacto.
      estadoLlamada: texto(fila.call_status),
      correo: texto(fila.email_received),
    });
  }

  // El relevo del rechazo directo ENTRA a la cola (caso A del dictado
  // 2026-09-03: «se está optando por sus reemplazos directos para llamar»).
  // Misma regla que el motor (en_juego B13b) vía el espejo sancionado
  // `cadenaPropia`: la primera reserva de SU cadena que no cayó ni salió. Sin
  // esto, excluir al rechazado dejaba a la facultad con un hueco mudo en la
  // pantalla que reparte llamadas.
  const yaEnCola = new Set(pendientes.map((p) => p.codigo));
  for (const caido of titularesRechazados) {
    const relevo = cadenaPropia(conReservas, caido).find(
      (r) => !/^rechaz/.test(texto(r.sample_status).toLowerCase()),
    );
    if (!relevo) continue;
    const codigo = texto(relevo.operational_code);
    if (!codigo || yaEnCola.has(codigo)) continue;
    yaEnCola.add(codigo);
    const intentosRelevo = Number(relevo.contact_attempts);
    pendientes.push({
      codigo,
      facultad: texto(relevo.faculty) || "Sin facultad",
      docente: texto(relevo.teacher),
      telefono: texto(relevo.teacher_phone),
      medio: texto(relevo.contact_medium),
      ultimaLlamada: texto(relevo.contact_date),
      intentos: Number.isFinite(intentosRelevo) ? intentosRelevo : 0,
      estadoLlamada: texto(relevo.call_status),
      correo: texto(relevo.email_received),
      relevoDe: texto(caido.operational_code),
    });
  }

  // El que MÁS intentos lleva primero: es el que se va a caer, y decidir si se
  // insiste o se activa su reserva es la decisión del día.
  pendientes.sort((a, b) => b.intentos - a.intentos
    || a.facultad.localeCompare(b.facultad, "es")
    || a.codigo.localeCompare(b.codigo, "es", { numeric: true }));

  // Por fecha: la agenda se lee en orden de calendario, no por esfuerzo.
  citadas.sort((a, b) => a.fecha.localeCompare(b.fecha)
    || a.hora.localeCompare(b.hora)
    || a.codigo.localeCompare(b.codigo, "es", { numeric: true }));

  const esfuerzo = [...porFacultad.entries()]
    .map(([facultad, xs]) => ({ facultad, aulas: xs.length, intentos: mediana(xs) }))
    .sort((x, y) => (y.intentos ?? 0) - (x.intentos ?? 0) || y.aulas - x.aulas);

  return { pendientes, citadas, esfuerzo, yaAplicadasSinCita, rechazadas };
}
