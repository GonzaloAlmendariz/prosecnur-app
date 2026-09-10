import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { TRAMOS_DE_APLICACION, clavesDelTramo } from "./estadoDeAplicacion";

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
/**
 * `"2026-09-15"` → la fecha construida, o `null` si ese día NO existe.
 *
 * `Date.UTC` no rechaza un 31 de septiembre: lo **corre** al 1 de octubre y
 * devuelve un instante perfectamente válido, así que `Number.isNaN` no lo
 * detecta. Como el número impreso salía del texto crudo y el nombre del día de
 * la fecha corrida, un `2026-09-31` del libro se rotulaba «Jueves 31/09»: un día
 * de la semana que pertenece a otra fecha, pegado a una que no existe. Se
 * comprueba que la fecha construida sea la misma que se pidió.
 *
 * Mediodía UTC por lo de siempre: a medianoche el desfase horario del navegador
 * corre la fecha un día y con ella el nombre del día.
 */
export function fechaIsoReal(fecha: string): { anio: number; mes: number; dia: number; fecha: Date } | null {
  const [anio, mes, dia] = fecha.split("-").map((n) => Number(n));
  if (!anio || !mes || !dia) return null;
  const dt = new Date(Date.UTC(anio, mes - 1, dia, 12));
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getUTCFullYear() !== anio || dt.getUTCMonth() !== mes - 1 || dt.getUTCDate() !== dia) return null;
  return { anio, mes, dia, fecha: dt };
}

export function etiquetaDeFecha(fecha: string) {
  if (!fecha) return "Sin fecha agendada";
  const partes = fechaIsoReal(fecha);
  // Una fecha imposible se devuelve TAL CUAL, sin nombre de día. Inventarle uno
  // la disfrazaba de fecha buena; cruda se ve que el libro trae un problema.
  if (!partes) return fecha;
  const nombre = DIAS[partes.fecha.getUTCDay()] ?? "";
  const dia = String(partes.dia).padStart(2, "0");
  const mes = String(partes.mes).padStart(2, "0");
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
      // Por LISTA de claves y no por la clave del tramo: un tramo puede recoger
      // varias del motor —los aplicados recogen `en_aplicacion` y `cerrando`— y
      // con la comparación 1 a 1 esas filas caían en «Sin clasificar», que es
      // peor que perderlas: las cuenta y las muestra con el nombre equivocado.
      const indice = TRAMOS_DE_APLICACION.findIndex((t) => clavesDelTramo(t).includes(clave));
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
      // El tramo se llama `aplicado` desde que «En cierre» se disolvió dentro
      // de los aplicados (2026-09-10): al curso-horario se va una sola vez, así
      // que no hay «en curso» que separar de «cerrando». Leer la clave vieja
      // dejaba esta cuenta en CERO sin que nada fallara salvo su propio test.
      cumplen: tramos.find((t) => t.clave === "aplicado")?.aulas ?? 0,
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
    /**
     * Los tramos que aparecen en ALGUNA barra, con su total del periodo.
     *
     * Es la leyenda: las barras se pintaban con seis colores y el único modo de
     * saber cuál era cuál era pasar el ratón segmento a segmento. Sale de aquí
     * y no del componente para que use exactamente los mismos colores y
     * etiquetas que los tramos —dueño único, `estadoDeAplicacion`— y para que
     * un tramo que no ocurre en este estudio no ocupe sitio en la leyenda.
     */
    leyenda: TRAMOS_DE_APLICACION
      .map((t) => ({
        clave: t.clave,
        etiqueta: t.etiqueta,
        color: t.color,
        aulas: dias.reduce(
          (suma, d) => suma + (d.tramos.find((x) => x.clave === t.clave)?.aulas ?? 0),
          0,
        ),
      }))
      .filter((t) => t.aulas > 0),
    /** Días de campo con al menos un curso-horario agendado. */
    diasDeCampo: conFecha.length,
    /** El día más cargado marca la escala de las barras. */
    tope: dias.reduce((max, d) => Math.max(max, d.aulas), 0),
    sinFecha: dias.find((d) => !d.fecha)?.aulas ?? 0,
    desde: conFecha[0]?.etiqueta ?? "",
    hasta: conFecha[conFecha.length - 1]?.etiqueta ?? "",
  };
}
