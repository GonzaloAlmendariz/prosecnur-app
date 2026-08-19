import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

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

export function colaDeContacto(filas: ReadonlyArray<MonitoreoAulasPlanRow>): {
  pendientes: PendienteDeContacto[];
  esfuerzo: EsfuerzoDeFacultad[];
} {
  const pendientes: PendienteDeContacto[] = [];
  const porFacultad = new Map<string, number[]>();

  for (const fila of filas) {
    // El banco no se contacta: no cuelga de ningún titular.
    if (texto(fila.sample_role) === "extra_reserve_pool") continue;
    const facultad = texto(fila.faculty) || "Sin facultad";
    const intentos = Number(fila.contact_attempts);
    // Una reserva DORMIDA tampoco: no se llama hasta que su titular cae, y
    // meterla en la cola mandaría al equipo a perseguir aulas que nadie
    // necesita todavía.
    const dormida = texto(fila.sample_status).toLowerCase().startsWith("en reserva")
      || texto(fila.sample_status).toLowerCase().startsWith("en_reserva");
    if (tieneCita(fila)) {
      if (Number.isFinite(intentos) && intentos > 0) {
        const xs = porFacultad.get(facultad) ?? [];
        xs.push(intentos);
        porFacultad.set(facultad, xs);
      }
      continue;
    }
    if (dormida) continue;
    // Lo que ya cayó tampoco se persigue: su reemplazo es otro asunto.
    if (texto(fila.sample_status).toLowerCase().startsWith("reemplazada")) continue;
    pendientes.push({
      codigo: texto(fila.operational_code),
      facultad,
      docente: texto(fila.teacher),
      telefono: texto(fila.teacher_phone),
      medio: texto(fila.contact_medium),
      ultimaLlamada: texto(fila.contact_date),
      intentos: Number.isFinite(intentos) ? intentos : 0,
    });
  }

  // El que MÁS intentos lleva primero: es el que se va a caer, y decidir si se
  // insiste o se activa su reserva es la decisión del día.
  pendientes.sort((a, b) => b.intentos - a.intentos
    || a.facultad.localeCompare(b.facultad, "es")
    || a.codigo.localeCompare(b.codigo, "es", { numeric: true }));

  const esfuerzo = [...porFacultad.entries()]
    .map(([facultad, xs]) => ({ facultad, aulas: xs.length, intentos: mediana(xs) }))
    .sort((x, y) => (y.intentos ?? 0) - (x.intentos ?? 0) || y.aulas - x.aulas);

  return { pendientes, esfuerzo };
}
