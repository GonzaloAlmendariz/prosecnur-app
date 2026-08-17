import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { TRAMOS_DE_APLICACION } from "./estadoDeAplicacion";

/**
 * La agenda leída como agenda: qué día se aplica cada curso-horario.
 *
 * La sección se llama Agenda y mostraba 196 filas planas. Cuándo se aplica cada
 * aula está en el plan —`FECHA DE APLICACION`, `DIA` y `HORA` del libro— y no
 * se podía leer sin recorrer la tabla entera: ni cuántos días dura el campo, ni
 * qué día está cargado, ni si lo de mañana ya recogió algo.
 *
 * El criterio es el del histórico del cálculo de muestra (ADR 0060): la
 * superficie narra en el orden en que se decide —primero cuándo, después en qué
 * estado— y las barras son CSS, sin Plotly, porque esta sección no debe
 * arrastrar el bundle de gráficos.
 *
 * **Los tramos son los mismos de Avance** —se IMPORTAN de `estadoDeAplicacion`,
 * no se copian—: dos lecturas del mismo hecho no pueden pintar distinto ni
 * conocer vocabularios diferentes.
 */

export type TramoDelDia = {
  clave: string;
  etiqueta: string;
  aulas: number;
  color: string;
};

export type DiaDeAgenda = {
  /** `YYYY-MM-DD`, o vacío en el grupo de las que no tienen fecha. */
  fecha: string;
  /** Cómo se lee: «Lunes 10/08», o «Sin fecha agendada». */
  etiqueta: string;
  aulas: number;
  tramos: TramoDelDia[];
  /** Las que ese día ya llegaron a su meta. */
  cumplen: number;
  /** Las que ese día no han recibido ni una respuesta. */
  sinEmpezar: number;
};

// Los tramos NO se declaran aquí: son los mismos de Avance y duplicarlos ya
// costó lo suyo. Al añadir «Reemplazada» al motor, esta copia no la conocía y
// la vista mostraba «Sin clasificar 2» — la salida declarada hizo su trabajo y
// no perdió las aulas, pero el vocabulario tenía dos dueños. Ahora uno.

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * «Lunes 10/08» a partir de la fecha ISO.
 *
 * Se compone desde la fecha y NO desde la columna `DIA` del libro: el día de la
 * semana escrito a mano puede no corresponder a la fecha, y entonces el grupo
 * diría un día y contendría otro.
 */
function etiquetaDeFecha(fecha: string) {
  if (!fecha) return "Sin fecha agendada";
  const [y, m, d] = fecha.split("-").map((n) => Number(n));
  if (!y || !m || !d) return fecha;
  // Mediodía UTC: a medianoche, el desfase horario del navegador puede correr
  // la fecha un día y cambiar el nombre del día de la semana.
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  if (Number.isNaN(dt.getTime())) return fecha;
  const nombre = DIAS[dt.getUTCDay()] ?? "";
  const dia = String(d).padStart(2, "0");
  const mes = String(m).padStart(2, "0");
  return nombre ? `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${dia}/${mes}` : `${dia}/${mes}`;
}

/**
 * Agrupa los cursos-horario por día agendado.
 *
 * Las que no tienen fecha **no se descartan**: van a su propio grupo al final.
 * Un aula sin fecha es justo la que nadie va a aplicar mañana, así que
 * esconderla sería esconder el problema.
 */
export function agendaPorDia(filas: ReadonlyArray<MonitoreoAulasPlanRow>) {
  const porFecha = new Map<string, MonitoreoAulasPlanRow[]>();
  for (const fila of filas) {
    const fecha = texto(fila.scheduled_date);
    const actual = porFecha.get(fecha);
    if (actual) actual.push(fila);
    else porFecha.set(fecha, [fila]);
  }

  const dias: DiaDeAgenda[] = [...porFecha.entries()].map(([fecha, propias]) => {
    const tramos: TramoDelDia[] = TRAMOS_DE_APLICACION.map((t) => ({ ...t, aulas: 0 }));
    let desconocidas = 0;
    for (const fila of propias) {
      const clave = texto(fila.application_state);
      const indice = TRAMOS_DE_APLICACION.findIndex((t) => t.clave === clave);
      // Misma salida declarada que en Avance: un estado nuevo del motor se
      // cuenta aparte en vez de desaparecer del reparto.
      if (indice < 0) desconocidas += 1;
      else tramos[indice].aulas += 1;
    }
    return {
      fecha,
      etiqueta: etiquetaDeFecha(fecha),
      aulas: propias.length,
      tramos: desconocidas
        ? [...tramos, { clave: "desconocido", etiqueta: "Sin clasificar", aulas: desconocidas, color: COLOR_RESULTADO.revision }]
        : tramos,
      cumplen: tramos.find((t) => t.clave === "cerrando")?.aulas ?? 0,
      sinEmpezar: (tramos.find((t) => t.clave === "pendiente")?.aulas ?? 0)
        + (tramos.find((t) => t.clave === "lista")?.aulas ?? 0),
    };
  });

  // Por fecha, y las sin fecha al final: son las que no tienen sitio en el
  // calendario y no deben abrir la lectura.
  dias.sort((a, b) => {
    if (!a.fecha) return 1;
    if (!b.fecha) return -1;
    return a.fecha.localeCompare(b.fecha);
  });

  const conFecha = dias.filter((d) => d.fecha);
  return {
    dias,
    /** Días de campo con al menos un curso-horario agendado. */
    diasDeCampo: conFecha.length,
    /** El día más cargado marca la escala de las barras. */
    tope: dias.reduce((max, d) => Math.max(max, d.aulas), 0),
    sinFecha: dias.find((d) => !d.fecha)?.aulas ?? 0,
    desde: conFecha[0]?.etiqueta ?? "",
    hasta: conFecha[conFecha.length - 1]?.etiqueta ?? "",
  };
}
