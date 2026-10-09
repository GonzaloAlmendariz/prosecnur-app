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

/**
 * El banco de reservas: existe, cuesta, y todavía no está en juego.
 *
 * Ni `pendiente` —que ya es «Sin agendar» y volvería a mezclarlas— ni un color
 * de desenlace: una reserva sin activar no es un resultado de encuesta. Se toma
 * el azul de marca aclarado, que en el resto de la app significa «declarado
 * pero inactivo».
 */
export const COLOR_AULA_EN_RESERVA = "#8fa3bf";

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
  // **Los participios concuerdan con la UNIDAD, que es masculina.** «Agendada» y
  // «Reemplazada» venían de cuando la unidad se llamaba «aula»; con
  // curso-horario arrastran un femenino que ya no tiene sujeto. Es el mismo
  // rastro que dejó «Ningún aula» y que «Justo» entre dos femeninos.
  { clave: "lista", etiqueta: "Agendado", color: COLOR_AULA_LISTA },
  // **«En aplicación», no «Aplicada»**, que es el participio de terminado y era
  // la MISMA palabra que el KPI «APLICADAS» de la banda, dos centímetros más
  // arriba. Medido el 2026-08-29: la leyenda decía «Aplicada 0» junto a una
  // banda que decía «APLICADAS 48», y las 48 estaban en «En cierre».
  //
  // La clave lo dice sola —`en_aplicacion`— y el motor también
  // (`monitoreo_aulas_universitarias.R:1335`): aquí cae lo que TIENE respuestas
  // pero todavía NO es `aplicada` ni `cerrada`; en cuanto lo es, pasa a
  // `cerrando`. O sea, en curso.
  //
  // Es la misma reparación que ya se le hizo al tramo de al lado cuando se
  // llamaba «Cumple» —ver el comentario de abajo—: dos superficies no pueden
  // usar la misma palabra para dos ejes distintos.
  // **UN solo tramo para los aplicados, y por decisión suya.**
  //
  // Aquí vivían dos: «En aplicación» (`en_aplicacion`, tiene respuestas o está
  // en campo) y «En cierre» (`cerrando`, aplicada, cerrada o ya en su meta).
  // Gonzalo, 2026-09-10: «no entiendo lo de en cierre», y al preguntarle:
  // «disuélvelo dentro de titulares aplicados».
  //
  // «En cierre» no salió nunca del operativo: se inventó aquí para sustituir a
  // «Cumple», que chocaba con el KPI de la banda. Y el choque que aquel arreglo
  // perseguía —la leyenda decía «Aplicada 0» junto a una banda que decía
  // «APLICADAS 48», con las 48 en el tramo de al lado— **desaparece al fundir
  // los dos**: ahora el tramo y la banda cuentan lo mismo y por eso pueden
  // llamarse igual. El defecto era la partición, no la palabra.
  //
  // Un tramo puede recoger VARIAS claves del motor: por eso `claves` es una
  // lista. El motor conserva las suyas —las usa para ordenar y para otros
  // paneles—; lo que se funde es el idioma de la pantalla.
  {
    clave: "aplicado",
    claves: ["en_aplicacion", "cerrando"],
    etiqueta: "Aplicado",
    color: COLOR_RESULTADO.efectiva,
  },
  // `REEMPLAZADA` en **STATUS MUESTRA**. Antes caían en «Sin agendar», que es
  // falso por partida doble: estaban agendadas y ya no van a aplicarse porque su
  // reserva tomó el relevo. Medido sobre el estudio de 196: de las 48 que decían
  // «Sin agendar», 26 eran éstas y 22 estaban agendadas con fecha —ni una sola
  // estaba realmente sin agendar—.
  { clave: "reemplazada", etiqueta: "Reemplazado", color: COLOR_RESULTADO.revision },
  // `EN RESERVA n` en **STATUS MUESTRA**. Tampoco pertenece al eje de
  // agendamiento: una reserva del banco no está sin agendar, es que NO hay que
  // agendarla salvo que caiga su titular. Contarla entre las pendientes le
  // pedía al coordinador que saliera a agendar ocho aulas que no debía tocar.
  //
  // El motor tenía escrita la regla —`grepl("^en reserva", …)`— y no podía casar
  // nunca: el normalizador ya había convertido «EN RESERVA 1» en `en_reserva`,
  // con guion bajo. Una regla muerta que documentaba un criterio inexistente.
  // Gris de marca y no el `pendiente` de «Sin agendar»: son estados distintos y
  // compartir color los volvería a mezclar, que es de lo que veníamos.
  { clave: "en_reserva", etiqueta: "En reserva", color: COLOR_AULA_EN_RESERVA },
] as const;

/**
 * Reparte los cursos-horario entre los cuatro estados del circuito.
 *
 * Un estado que el motor no declare **no se descarta en silencio**: se cuenta en
 * `desconocidas`. Si el día de mañana el engine añade un quinto estado, el
 * gráfico lo dirá en vez de perder aulas por el camino —que es exactamente el
 * patrón de lista cerrada que ya costó doce ítems de esta cola—.
 */
/**
 * Las claves del motor que recoge un tramo. Casi todos recogen la suya; los
 * aplicados recogen dos, y el día que el motor parta otro estado se resuelve
 * aquí sin tocar a los consumidores.
 */
export function clavesDelTramo(tramo: { clave: string; claves?: readonly string[] }): readonly string[] {
  return tramo.claves ?? [tramo.clave];
}

export function estadoDeAplicacion(filas: ReadonlyArray<MonitoreoAulasPlanRow>) {
  const estados: EstadoDeAplicacion[] = TRAMOS_DE_APLICACION.map((e) => ({
    clave: e.clave, etiqueta: e.etiqueta, aulas: 0, color: e.color,
  }));
  let desconocidas = 0;

  for (const fila of filas) {
    const clave = typeof fila.application_state === "string" ? fila.application_state.trim() : "";
    const indice = TRAMOS_DE_APLICACION.findIndex((e) => clavesDelTramo(e).includes(clave));
    if (indice < 0) { desconocidas += 1; continue; }
    estados[indice].aulas += 1;
  }

  return {
    estados,
    desconocidas,
    total: filas.length,
    /**
     * Las que todavía no han salido a campo: sin agendar más agendadas.
     *
     * NO es «sin respuestas», que es lo que decía y contaba por POSICIÓN
     * —`estados[0] + estados[1]`—. Dos problemas a la vez: el eje del
     * agendamiento no sabe de respuestas, y al entrar el sexto tramo los
     * índices dejaron de señalar lo que el comentario prometía. Quien quiera
     * las aulas sin una sola respuesta usa `coberturaPorAula().sinRespuestas`,
     * que sale del eje que sí las cuenta.
     */
    sinSalirACampo: estados.filter((e) => e.clave === "pendiente" || e.clave === "lista")
      .reduce((total, e) => total + e.aulas, 0),
  };
}
