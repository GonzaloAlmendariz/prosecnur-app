// chipDeApertura.ts — dónde va el chip «Sólo en Recordatorio 1» de la apertura.
//
// El chip iba fijo arriba a la derecha DENTRO de la zona, y a 1024 px la
// primera línea de la apertura llega hasta el borde: el chip se montaba sobre
// el texto del correo. Caber no es no pisarse. Se mide la primera línea y el
// hueco sobre la zona; el chip va donde no tape nada y, si no hay sitio, no se
// pinta: su texto queda en el título de la zona.

import type { Rect } from "./estructuraCorreo";

export type LugarDelChip = "dentro" | "arriba" | null;

/** Ancho que ocupa el chip a 10.5 px, con su relleno: una estimación holgada. */
export function anchoDelChip(texto: string): number {
  return Math.ceil(texto.length * 6.2) + 16;
}

export const ALTO_DEL_CHIP = 18;
const MARGEN = 6;

export function lugarDelChip(entrada: {
  zona: Rect;
  /** La primera línea de texto de la zona; `null` si no tiene texto. */
  primeraLinea: Rect | null;
  /** El borde inferior de la zona de encima, o `null` si es la primera. */
  bordeDeArriba: number | null;
  anchoChip: number;
}): LugarDelChip {
  const { zona, primeraLinea, bordeDeArriba, anchoChip } = entrada;
  // Dentro, a la derecha, sólo si la primera línea deja ese hueco libre.
  const finDelTexto = primeraLinea ? primeraLinea.x + primeraLinea.w : zona.x;
  if (zona.x + zona.w - finDelTexto >= anchoChip + MARGEN * 2) return "dentro";
  // Encima de la zona, en el espacio entre bloques.
  const hueco = zona.y - (bordeDeArriba ?? 0);
  if (hueco >= ALTO_DEL_CHIP + 2) return "arriba";
  return null;
}
