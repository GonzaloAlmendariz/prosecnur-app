import { TRAMOS_DE_APLICACION } from "./estadoDeAplicacion";

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
