import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { esMuestraAgendada } from "./muestraAgendada";

/**
 * El ritmo diario de la agendación: cuántas citas se pactan por jornada y qué
 * tan rápido avanza el trabajo de contacto.
 *
 * Dictado de Gonzalo (2026-09-03, mirando la pestaña Contacto): «no hay forma
 * de poder ver el avance diario de agendación, qué tan rápido se agenda, el
 * ritmo diario».
 *
 * **El proxy se declara**: el libro no guarda cuándo se PACTÓ la cita — la
 * fecha que sí guarda es `contact_date`, la última gestión tecleada por el
 * equipo. Para un aula que quedó agendada, esa gestión es (casi siempre) la
 * llamada que consiguió la cita, así que el día de la agendación se lee de
 * ahí. Las agendadas sin fecha de gestión no se inventan: van al bucket
 * `sinFechaDeGestion` y la lectura las nombra.
 *
 * La proyección también declara su denominador: el ritmo es el promedio de
 * las jornadas CON actividad (una jornada sin llamadas no baja el ritmo del
 * equipo, dice que ese día no se trabajó la agenda), y con él se estima
 * cuántas jornadas de gestión faltan para vaciar la cola actual.
 */

export type JornadaDeAgendacion = {
  /** ISO `YYYY-MM-DD` de la gestión. */
  fecha: string;
  /** Citas cuya última gestión cayó ese día. */
  nuevas: number;
};

export type RitmoDeAgendacion = {
  /** Jornadas con al menos una agendada, ascendentes por fecha. */
  jornadas: JornadaDeAgendacion[];
  /** Agendadas con fecha de gestión legible (la suma de las jornadas). */
  conFecha: number;
  /** Agendadas cuya gestión no trae fecha legible: declaradas, no inventadas. */
  sinFechaDeGestion: number;
  /** La mejor jornada, o null sin jornadas. */
  pico: JornadaDeAgendacion | null;
  /** Promedio de agendadas por jornada CON actividad (1 decimal), o null. */
  porJornada: number | null;
};

const texto = (v: unknown): string =>
  typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();

/** Mismo criterio que la cola: agendada o reagendada = tiene cita. */
const tieneCita = (fila: MonitoreoAulasPlanRow): boolean => esMuestraAgendada(fila.sample_status);

/** ISO estricto, como `leerFecha`: cualquier otra forma no es una jornada. */
const fechaISO = (v: unknown): string => {
  const t = texto(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : "";
};

export function ritmoDeAgendacion(
  filas: ReadonlyArray<MonitoreoAulasPlanRow>,
): RitmoDeAgendacion {
  const porDia = new Map<string, number>();
  let sinFechaDeGestion = 0;
  for (const fila of filas) {
    if (!tieneCita(fila)) continue;
    const dia = fechaISO(fila.contact_date);
    if (!dia) {
      sinFechaDeGestion += 1;
      continue;
    }
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }
  const jornadas = [...porDia.entries()]
    .map(([fecha, nuevas]) => ({ fecha, nuevas }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const conFecha = jornadas.reduce((n, j) => n + j.nuevas, 0);
  const pico = jornadas.reduce<JornadaDeAgendacion | null>(
    (mejor, j) => (mejor === null || j.nuevas > mejor.nuevas ? j : mejor),
    null,
  );
  const porJornada = jornadas.length
    ? Math.round((conFecha / jornadas.length) * 10) / 10
    : null;
  return { jornadas, conFecha, sinFechaDeGestion, pico, porJornada };
}
