import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { ESTADOS_OPERATIVOS } from "./aulasPresentation";
import { COLOR_AULA_LISTA, TRAMOS_DE_APLICACION } from "./estadoDeAplicacion";

/**
 * El estado de una fila, como chip de color y no como texto plano.
 *
 * Las tablas de los otros perfiles —acreditación, telefónico— llevan chips de
 * estado desde hace tiempo (`mon-quality-alert-chip` y compañía) y las de aulas
 * eran texto corrido: para saber cuántas aulas están reemplazadas había que
 * leer la columna fila a fila. Un estado es una categoría cerrada y corta; el
 * color hace el conteo por el ojo.
 *
 * **Los colores son los de la franja por día**, no unos nuevos: la misma aula
 * tiene que verse del mismo color en la barra de su día y en su fila de la
 * tabla, o las dos superficies dejan de hablar entre sí.
 */

/** Las columnas que son un ESTADO y no un dato libre. Lista cerrada a propósito. */
export const COLUMNAS_DE_ESTADO = new Set([
  "application_state",
  "sample_status",
  "application_status",
  "operational_status",
]);

/**
 * El estado OPERATIVO, agrupado por desenlace.
 *
 * Son once estados y no once colores: el color dice de qué familia es el
 * desenlace —todavía no sale a campo, está en campo, se recogió, cayó, necesita
 * decisión— y la etiqueta, que va al lado, conserva el detalle. Inventar once
 * colores obligaría a distinguir a ojo «contactada» de «planificada» por un
 * matiz, que es justo lo que un chip no sabe hacer.
 *
 * Este vocabulario es DISTINTO del de `application_state`, y por eso necesita su
 * propia tabla: buscar por etiqueta contra los tramos acertaba en `sample_status`
 * por coincidencia de rótulos —«Agendada», «Reemplazada»— y fallaba entero acá.
 * Medido sobre HSVG2026: las 168 filas de Brechas enseñaban «Planificada» sin
 * color, en la misma pantalla que otra tabla sí coloreaba sus estados.
 */
const COLOR_OPERATIVO: Record<string, string> = {
  // Todavía no sale a campo.
  planificada: COLOR_RESULTADO.pendiente,
  contactada: COLOR_RESULTADO.pendiente,
  // Lista o ya en el aula.
  agendada: COLOR_AULA_LISTA,
  en_campo: COLOR_AULA_LISTA,
  // Se recogió algo y todavía no cierra.
  aplicada: COLOR_RESULTADO.parcial,
  parcial: COLOR_RESULTADO.parcial,
  // El aula cayó.
  sin_acceso: COLOR_RESULTADO.rechazo,
  cancelada: COLOR_RESULTADO.rechazo,
  // Pide o ya tuvo una decisión.
  reemplazo_pendiente: COLOR_RESULTADO.revision,
  reemplazada: COLOR_RESULTADO.revision,
  // Cerrada de verdad.
  cerrada: COLOR_RESULTADO.efectiva,
};

/** El mismo mapa, indexado por el rótulo que de verdad llega a la celda. */
const COLOR_OPERATIVO_POR_ETIQUETA = new Map(
  ESTADOS_OPERATIVOS.map((e) => [e.label.toLowerCase(), COLOR_OPERATIVO[e.value]]),
);

/**
 * El color de un estado, buscado por su ETIQUETA visible.
 *
 * Se busca por etiqueta y no por clave porque a la celda llega ya traducido por
 * la capa de presentación —«Reemplazada», no `reemplazada`—, y duplicar aquí la
 * tabla de traducción sería una segunda verdad. Un estado que no esté en la
 * lista no se colorea: mejor sin color que con un color que signifique otra cosa.
 */
export function colorDeEstado(valor: string): string | null {
  const texto = valor.trim().toLowerCase();
  if (!texto) return null;
  const tramo = TRAMOS_DE_APLICACION.find((t) => t.etiqueta.toLowerCase() === texto);
  if (tramo) return tramo.color;
  const operativo = COLOR_OPERATIVO_POR_ETIQUETA.get(texto);
  if (operativo) return operativo;
  // «EN RESERVA 3» es el vocabulario del Excel: la reserva y su posición. El
  // número cambia la fila, no el estado.
  if (texto.startsWith("en reserva")) {
    return TRAMOS_DE_APLICACION.find((t) => t.clave === "en_reserva")?.color ?? null;
  }
  return null;
}

export function EstadoEnCelda({ valor }: { valor: string }) {
  const color = colorDeEstado(valor);
  if (!color) return <>{valor}</>;
  return (
    <span className="aulas-estado-chip" style={{ "--aulas-estado": color } as React.CSSProperties}>
      {valor}
    </span>
  );
}
