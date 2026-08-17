import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";

/**
 * En qué punto del circuito está cada curso-horario.
 *
 * Es el eje de **agendamiento**, no el de cobertura: un aula puede estar
 * agendada y no haber recibido ni una respuesta, y eso no es lo mismo que un
 * aula que nadie ha llamado todavía. La distinción `pendiente` / `lista` no
 * aparece en el histograma de cobertura —las dos caen en «sin respuestas»— y es
 * justo la que dice si el trabajo que falta es de teléfono o de campo.
 */

/**
 * El azul de «lista» no sale de `COLOR_RESULTADO` a propósito.
 *
 * Esa paleta son los **desenlaces de una encuesta** —efectiva, parcial, rechazo,
 * pendiente— y «agendada, aún sin empezar» no es ninguno: es un estado del aula.
 * Pintarla de granate (`rechazo`) diría que alguien declinó, que es falso. Se
 * toma el azul de marca, que ya significa «declarado» en el resto de la app.
 */
export const COLOR_AULA_LISTA = "#002457";

export type EstadoDeAplicacion = {
  /** Clave tal como la emite `course_status.application_state`. */
  clave: string;
  /** Cómo se lee en el gráfico. */
  etiqueta: string;
  /** Cursos-horario en ese estado. */
  aulas: number;
  color: string;
};

/** Los cuatro estados en orden de circuito, de sin tocar a cerrada. */
const ESTADOS = [
  { clave: "pendiente", etiqueta: "Sin agendar", color: COLOR_RESULTADO.pendiente },
  { clave: "lista", etiqueta: "Agendada", color: COLOR_AULA_LISTA },
  { clave: "en_aplicacion", etiqueta: "En aplicación", color: COLOR_RESULTADO.parcial },
  { clave: "cerrando", etiqueta: "Meta alcanzada", color: COLOR_RESULTADO.efectiva },
] as const;

/**
 * Reparte los cursos-horario entre los cuatro estados del circuito.
 *
 * Un estado que el motor no declare **no se descarta en silencio**: se cuenta en
 * `desconocidas`. Si el día de mañana el engine añade un quinto estado, el
 * gráfico lo dirá en vez de perder aulas por el camino —que es exactamente el
 * patrón de lista cerrada que ya costó doce ítems de esta cola—.
 */
export function estadoDeAplicacion(filas: ReadonlyArray<MonitoreoAulasPlanRow>) {
  const estados: EstadoDeAplicacion[] = ESTADOS.map((e) => ({
    clave: e.clave, etiqueta: e.etiqueta, aulas: 0, color: e.color,
  }));
  let desconocidas = 0;

  for (const fila of filas) {
    const clave = typeof fila.application_state === "string" ? fila.application_state.trim() : "";
    const indice = ESTADOS.findIndex((e) => e.clave === clave);
    if (indice < 0) { desconocidas += 1; continue; }
    estados[indice].aulas += 1;
  }

  return {
    estados,
    desconocidas,
    total: filas.length,
    /** Las que aún no han recibido ni una respuesta: sin agendar más agendadas. */
    sinEmpezar: estados[0].aulas + estados[1].aulas,
  };
}
