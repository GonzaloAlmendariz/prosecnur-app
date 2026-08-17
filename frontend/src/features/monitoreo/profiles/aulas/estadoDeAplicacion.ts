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

/**
 * Los cuatro estados, con el nombre que el equipo ya usa en su Excel.
 *
 * Cada rótulo sale de una columna, no de una invención mía:
 *
 *   Sin agendar  ← la negación de `AGENDADA` en **STATUS MUESTRA**
 *   Reemplazada  ← `REEMPLAZADA` en **STATUS MUESTRA**
 *   Agendada     ← `AGENDADA` en **STATUS MUESTRA**
 *   Aplicada     ← `APLICADA` en **STATUS DE APLICACIÓN**
 *   Cumple       ← `CUMPLE` en **VALIDO TOTAL**, que es la columna con la que el
 *                  Excel marca si el aula llegó a su umbral
 *
 * Antes decían «En aplicación» y «Meta alcanzada», que describen lo mismo con
 * palabras que no están en ninguna parte del operativo.
 */
export const TRAMOS_DE_APLICACION = [
  { clave: "pendiente", etiqueta: "Sin agendar", color: COLOR_RESULTADO.pendiente },
  { clave: "lista", etiqueta: "Agendada", color: COLOR_AULA_LISTA },
  { clave: "en_aplicacion", etiqueta: "Aplicada", color: COLOR_RESULTADO.parcial },
  { clave: "cerrando", etiqueta: "Cumple", color: COLOR_RESULTADO.efectiva },
  // `REEMPLAZADA` en **STATUS MUESTRA**. Antes caían en «Sin agendar», que es
  // falso por partida doble: estaban agendadas y ya no van a aplicarse porque su
  // reserva tomó el relevo. Medido sobre el estudio de 196: de las 48 que decían
  // «Sin agendar», 26 eran éstas y 22 estaban agendadas con fecha —ni una sola
  // estaba realmente sin agendar—.
  { clave: "reemplazada", etiqueta: "Reemplazada", color: COLOR_RESULTADO.revision },
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
  const estados: EstadoDeAplicacion[] = TRAMOS_DE_APLICACION.map((e) => ({
    clave: e.clave, etiqueta: e.etiqueta, aulas: 0, color: e.color,
  }));
  let desconocidas = 0;

  for (const fila of filas) {
    const clave = typeof fila.application_state === "string" ? fila.application_state.trim() : "";
    const indice = TRAMOS_DE_APLICACION.findIndex((e) => e.clave === clave);
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
