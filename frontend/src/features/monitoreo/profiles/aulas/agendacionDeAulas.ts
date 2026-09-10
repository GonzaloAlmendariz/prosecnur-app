import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * **Cómo va la agendación**, que es lo que decide a qué aulas se va a ir.
 *
 * Gonzalo: «es muy importante tener en Resumen cómo va la agendación de aulas,
 * porque es lo que nos permite decir a estas aulas vamos a ir a aplicar, y eso
 * está en el Sheets».
 *
 * **No es el mismo dato que «Estado de aplicación».** Aquel reparte los
 * titulares por su punto del circuito —aplicados, agendados, sin agendar— y
 * contesta dónde está cada uno HOY. Éste contesta si el trabajo de agendar va a
 * un ritmo que alcance: cuántos quedan sin fecha, a qué velocidad se les está
 * poniendo fecha y hasta qué día llega lo que ya tiene.
 *
 * **La fecha de agendar no es la de aplicar.** `contact_date` es cuándo se
 * habló con el docente y `scheduled_date` cuándo se va al aula; mezclarlas
 * daría un ritmo de agendación que en realidad es el calendario de visitas.
 *
 * **Y no se proyecta.** Él descartó el pronóstico lineal para las aplicaciones y
 * aquí valdría lo mismo: se publican los días medidos y lo que falta, y quien
 * lee saca la cuenta con su propio criterio sobre cuántos días quedan.
 */

const texto = (v: unknown) => (v == null ? "" : String(v)).trim();
const fecha = (v: unknown) => texto(v).match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";

/** Los que el sorteo pide visitar; las reservas no se agendan hasta que hacen falta. */
const esTitular = (f: MonitoreoRow) => texto(f.sample_role).toLowerCase() === "titular";

export type AgendacionDeAulas = {
  titulares: number;
  /** Ya tienen fecha de visita, se hayan aplicado o no. */
  conFecha: number;
  /** Ni fecha ni desenlace: son el trabajo que queda. */
  sinFecha: number;
  /** Cuántos de los que quedan pertenecen a cada facultad, de mayor a menor. */
  faltanPorFacultad: Array<{ facultad: string; aulas: number }>;
  /** Agendados por día, del más viejo al más nuevo. */
  porDia: Array<{ fecha: string; aulas: number }>;
  /** Lo agendado en los últimos días con actividad, para leer el ritmo actual. */
  ultimosDias: number;
  ultimosAulas: number;
  /** El último día con visita agendada: hasta ahí llega el plan de campo. */
  hasta: string;
};

/** Su desenlace ya no es agendarse. */
const FUERA = new Set(["reemplazada", "rechazo", "rechazada", "retirada", "cancelada"]);

export function agendacionDeAulas(
  agenda: ReadonlyArray<MonitoreoRow> | null | undefined,
  { ultimos = 3 }: { ultimos?: number } = {},
): AgendacionDeAulas {
  const vacio: AgendacionDeAulas = {
    titulares: 0, conFecha: 0, sinFecha: 0, faltanPorFacultad: [],
    porDia: [], ultimosDias: 0, ultimosAulas: 0, hasta: "",
  };
  const filas = (agenda ?? []).filter(esTitular);
  if (!filas.length) return vacio;

  const porDia = new Map<string, number>();
  const faltan = new Map<string, number>();
  let conFecha = 0;
  let sinFecha = 0;
  let hasta = "";

  for (const f of filas) {
    const cuandoSeAgendo = fecha(f.contact_date);
    if (cuandoSeAgendo) porDia.set(cuandoSeAgendo, (porDia.get(cuandoSeAgendo) ?? 0) + 1);

    const cuandoSeVisita = fecha(f.scheduled_date);
    if (cuandoSeVisita) {
      conFecha += 1;
      if (cuandoSeVisita > hasta) hasta = cuandoSeVisita;
      continue;
    }
    // **Un rechazo no está pendiente de agendar**: su desenlace ya ocurrió y
    // contarlo entre lo que falta pediría un trabajo que nadie va a hacer.
    const estado = texto(f.application_state).toLowerCase()
      || texto(f.sample_status).toLowerCase();
    if (FUERA.has(estado)) continue;
    sinFecha += 1;
    const fac = texto(f.faculty) || texto(f.stratum) || "Sin facultad";
    faltan.set(fac, (faltan.get(fac) ?? 0) + 1);
  }

  const dias = [...porDia.entries()]
    .map(([f, aulas]) => ({ fecha: f, aulas }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  // Los últimos días CON actividad, no los últimos del calendario: un fin de
  // semana sin agendar hundiría el ritmo con ceros que nadie trabajó.
  const cola = dias.slice(-ultimos);

  return {
    titulares: filas.length,
    conFecha,
    sinFecha,
    faltanPorFacultad: [...faltan.entries()]
      .map(([facultad, aulas]) => ({ facultad, aulas }))
      .sort((a, b) => b.aulas - a.aulas || a.facultad.localeCompare(b.facultad)),
    porDia: dias,
    ultimosDias: cola.length,
    ultimosAulas: cola.reduce((n, d) => n + d.aulas, 0),
    hasta,
  };
}
