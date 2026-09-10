import type { MonitoreoAulasDashboard } from "../../../../api/monitoreo";

/**
 * El estado de aplicación leído por ROL, que es la forma del libro.
 *
 * La hoja «Aulas Aplicadas (Campo)» va por bloques —`TITULAR`, `REEMPLAZO 1`…
 * `REEMPLAZO 11`— y cada uno lleva su propio `STATUS DE APLICACIÓN`. Gonzalo,
 * 2026-09-10: «ahí en el Sheets te recomiendo que también te guíes de los
 * estados del Sheets, porque la idea es que ambos hablen el mismo idioma».
 *
 * Este módulo NO calcula nada: el reparto lo hace el motor
 * (`monitoreo_aulas_rol_y_estado.R`) sobre el plan entero, antes del recorte a
 * 500 filas. Aquí sólo se le pone nombre en castellano y se decide el orden de
 * lectura. Calcularlo otra vez de este lado sería la segunda expresión del
 * mismo dato, que es la familia de defectos que este perfil lleva persiguiendo.
 */

export type TramoDeRol = {
  clave: string;
  etiqueta: string;
  /** Qué decisión habilita, o por qué NO pide ninguna. */
  detalle: string;
  aulas: number;
  tono: "pendiente" | "parcial" | "efectiva" | "rechazo" | "revision" | "apagado";
};

export type GrupoDeRol = {
  clave: "titulares" | "reemplazos" | "banco";
  etiqueta: string;
  nota: string;
  total: number;
  tramos: TramoDeRol[];
};

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? Math.round(x) : 0;
};

/**
 * Los tres grupos en orden de lectura: primero el trabajo que hay que hacer,
 * después el respaldo que lo sostiene, y al final el banco, que no cuelga de
 * ningún titular.
 *
 * Devuelve `null` cuando el motor no publica el bloque —un tablero construido
 * con una versión anterior—, para que la vista pueda decirlo en vez de dibujar
 * tres grupos en cero, que se leería como «no hay nada» y es otra cosa.
 */
export function estadoPorRol(
  dashboard: MonitoreoAulasDashboard | null | undefined,
  /**
   * La facultad en foco, si el selector de la cabecera tiene una puesta.
   *
   * **Se pide su bloque al motor, no se filtra aquí.** Gonzalo, 2026-09-10: «el
   * selector no hace que los gráficos actualicen; cuando yo selecciono una
   * facultad, debería mostrarme sólo la de esa facultad». Filtrar en la pantalla
   * habría significado filtrar `course_status`, que viaja recortado a 500 filas
   * de las 1 392 del plan: el reparto de un recorte con nombre de facultad.
   *
   * Una facultad que el motor no reparte —porque no tiene ni un curso-horario—
   * devuelve `null`, y la vista lo dice en vez de enseñar tres grupos en cero.
   */
  facultad?: string,
): GrupoDeRol[] | null {
  const bloque = facultad
    ? dashboard?.course_status_rol_y_estado_por_facultad?.[facultad]
    : dashboard?.course_status_rol_y_estado;
  if (!bloque || (!bloque.titulares && !bloque.reemplazos && !bloque.banco)) return null;
  const t = bloque.titulares ?? {};
  const r = bloque.reemplazos ?? {};
  const b = bloque.banco ?? {};

  return [
    {
      clave: "titulares",
      etiqueta: "Titulares",
      nota: "el trabajo que el sorteo pide hacer",
      total: n(t.total),
      tramos: [
        { clave: "aplicado", etiqueta: "Aplicados", tono: "efectiva",
          detalle: "ya se visitaron; al curso-horario se va una sola vez" },
        { clave: "agendado", etiqueta: "Agendados", tono: "parcial",
          detalle: "tienen fecha y todavía no se han visitado" },
        { clave: "sin_agendar", etiqueta: "Sin agendar", tono: "pendiente",
          detalle: "hay que llamar al docente" },
        // **`rechazo` y no `revision`.** El vocabulario de resultado los separa:
        // `revision` es «necesita una decisión antes de contar» y `rechazo` es
        // «la persona declinó», que es exactamente lo que pasó aquí. Con
        // `revision` el tramo salía en gris azulado oscuro —medido en pantalla:
        // rgb(71,79,91)— y la barra tenía TRES neutros seguidos; un rechazo es
        // un problema y tiene que verse como tal.
        { clave: "rechazado", etiqueta: "Rechazados", tono: "rechazo",
          detalle: "el docente dijo que no; los cubre su cadena" },
        { clave: "reemplazado", etiqueta: "Reemplazados", tono: "apagado",
          detalle: "cayeron y su reserva tomó el relevo" },
      ].map((x) => ({ ...x, aulas: n((t as Record<string, unknown>)[x.clave]) })) as TramoDeRol[],
    },
    {
      clave: "reemplazos",
      etiqueta: "Reemplazos de cadena",
      nota: "el respaldo de cada titular, en orden",
      total: n(r.total),
      tramos: [
        { clave: "utilizado", etiqueta: "Utilizados", tono: "efectiva",
          detalle: "entraron a cubrir a su titular" },
        { clave: "en_cadena", etiqueta: "En cadena", tono: "parcial",
          detalle: "su titular sigue sin resolverse, así que todavía pueden entrar" },
        // **El tramo que justifica el panel entero.** Antes las 1 173 reservas
        // caían en un solo cajón —«En reserva»— que no distinguía la que puede
        // entrar mañana de la que ya no va a entrar nunca. Sólo una pide
        // atención, y la otra abulta el tablero sin decir nada.
        { clave: "al_aire", etiqueta: "Al aire", tono: "apagado",
          detalle: "su slot ya está cubierto: no se van a usar" },
      ].map((x) => ({ ...x, aulas: n((r as Record<string, unknown>)[x.clave]) })) as TramoDeRol[],
    },
    {
      clave: "banco",
      etiqueta: "Banco de extras",
      nota: "aulas adicionales que no cuelgan de ningún titular",
      total: n(b.total),
      tramos: [
        { clave: "utilizado", etiqueta: "Utilizadas", tono: "efectiva",
          detalle: "se llamaron para cerrar una cuota" },
        { clave: "disponible", etiqueta: "Disponibles", tono: "pendiente",
          detalle: "esperando en su estrato" },
      ].map((x) => ({ ...x, aulas: n((b as Record<string, unknown>)[x.clave]) })) as TramoDeRol[],
    },
  ];
}

/**
 * Lo que el reparto NO coloca, por grupo. Un caso que no cayera en ninguna rama
 * se vería aquí en vez de desaparecer: es el mismo control que el motor ya tiene
 * en su test de sumas, repetido en la pantalla porque el payload puede venir de
 * una versión distinta de la que dibuja.
 */
export function sinColocar(grupo: GrupoDeRol): number {
  const suma = grupo.tramos.reduce((total, t) => total + t.aulas, 0);
  return Math.max(0, grupo.total - suma);
}
