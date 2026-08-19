import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * La agenda agrupada por facultad, para saber a dónde hay que ir.
 *
 * La tabla de la agenda lista las 196 en orden de curso-horario, que es el
 * orden para BUSCAR una: se sabe el código y se quiere su fila. Pero la pregunta
 * de campo es la contraria —«hoy me toca Derecho, ¿qué aulas son, a qué hora y
 * en qué pabellón?»— y contestarla obliga a rastrear las 196 filas y reconstruir
 * el grupo a mano.
 *
 * Con 11 a 20 facultades, que es lo normal, eso es entre 10 y 18 barridos de la
 * tabla por cada día de campo.
 */

export type AulaEnAgenda = {
  codigo: string;
  docente: string;
  fecha: string;
  hora: string;
  /** «LUN 08:00 A101»: el texto descriptivo del libro, que es dónde está el aula. */
  donde: string;
  estado: string;
  /**
   * Lo que anotó quien agendó. Viaja en `replacement_note` —el motor acepta ahí
   * la columna OBSERVACIONES del libro— y hasta hoy no la pedía ninguna
   * superficie: el dato llegaba, tenía rótulo y no se veía en ninguna parte.
   */
  nota: string;
};

export type FacultadEnAgenda = {
  facultad: string;
  aulas: AulaEnAgenda[];
  /** Las que ya no están sólo planificadas: alguien las movió. */
  enMarcha: number;
  /** El primer día con aula de esa facultad, para ordenarlas por urgencia. */
  primeraFecha: string;
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor).trim();
}

/**
 * @param filas la agenda ya sin banco —los extras no están agendados y no
 *   tienen a dónde ir—, tal como la recibe la tabla de al lado.
 */
export function agendaPorFacultad(filas: ReadonlyArray<MonitoreoAulasPlanRow>): FacultadEnAgenda[] {
  const porFacultad = new Map<string, AulaEnAgenda[]>();

  for (const fila of filas) {
    const facultad = texto(fila.faculty) || "Sin facultad";
    const aula: AulaEnAgenda = {
      codigo: texto(fila.operational_code),
      docente: texto(fila.teacher),
      fecha: texto(fila.scheduled_date),
      hora: texto(fila.scheduled_time),
      donde: texto(fila.label),
      // El estado OPERATIVO y no el de muestra: lo que se pregunta antes de
      // salir es si el aula ya se aplicó, no si es titular o reemplazo.
      estado: texto(fila.operational_status) || "planificada",
      nota: texto((fila as { replacement_note?: unknown }).replacement_note),
    };
    const grupo = porFacultad.get(facultad);
    if (grupo) grupo.push(aula);
    else porFacultad.set(facultad, [aula]);
  }

  const salida: FacultadEnAgenda[] = [];
  for (const [facultad, aulas] of porFacultad) {
    // Dentro de la facultad, en el orden en que hay que ir: por día y hora. Un
    // aula sin fecha va al final —no se puede planificar— en vez de encabezar
    // el grupo, que es lo que hace una cadena vacía al ordenar.
    aulas.sort((a, b) => {
      if (!a.fecha !== !b.fecha) return a.fecha ? -1 : 1;
      return a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora)
        || a.codigo.localeCompare(b.codigo, "es", { numeric: true });
    });
    const conFecha = aulas.filter((a) => a.fecha);
    salida.push({
      facultad,
      aulas,
      enMarcha: aulas.filter((a) => a.estado !== "planificada").length,
      primeraFecha: conFecha.length ? conFecha[0].fecha : "",
    });
  }

  // Las facultades por la fecha de su primera aula: el orden en que llegan los
  // días, que es para lo que sirve la vista. Alfabético serviría para buscar una
  // facultad concreta, y para eso ya está la tabla de al lado con su buscador.
  return salida.sort((x, y) => {
    if (!x.primeraFecha !== !y.primeraFecha) return x.primeraFecha ? -1 : 1;
    return x.primeraFecha.localeCompare(y.primeraFecha)
      || y.aulas.length - x.aulas.length
      || x.facultad.localeCompare(y.facultad, "es");
  });
}
