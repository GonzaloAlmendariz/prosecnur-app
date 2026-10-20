// Geometría del panel de condición del Mapa (E1, 2026-10-20). Ancho fijo, alto con tope y siempre dentro de la
// ventana: abre junto al punto donde se soltó la flecha, se voltea si no cabe y al arrastrarlo no sale de la ventana.
// Modelo puro: recibe medidas, devuelve coordenadas de ventana.

export const ANCHO_CONDICION = 360;
export const MARGEN_CONDICION = 16;
const SEPARACION = 12;
const ALTO_TOPE = 560;

export type Caja = { left: number; top: number };
/** `vw`/`vh` son el borde derecho e inferior del área. `x0`/`y0`, el izquierdo y el superior (0 = la ventana). */
type Medidas = { ancho: number; alto: number; vw: number; vh: number; x0?: number; y0?: number };

/** Alto máximo del panel: 560 px o lo que deje la ventana con 16 px de margen arriba y abajo. */
export function altoMaximoCondicion(vh: number): number {
  return Math.max(0, Math.min(ALTO_TOPE, Math.floor(vh - MARGEN_CONDICION * 2)));
}

/** Ancho del panel: 360 px salvo que la ventana no los tenga. */
export function anchoCondicion(vw: number): number {
  return Math.max(0, Math.min(ANCHO_CONDICION, Math.floor(vw - MARGEN_CONDICION * 2)));
}

/** Lleva la caja adentro de la ventana con 16 px de margen. Si no cabe, manda el borde izquierdo y el superior. */
export function encajarCondicion({ left, top, ancho, alto, vw, vh, x0 = 0, y0 = 0 }: Caja & Medidas): Caja {
  const minLeft = x0 + MARGEN_CONDICION;
  const minTop = y0 + MARGEN_CONDICION;
  const maxLeft = Math.max(minLeft, vw - ancho - MARGEN_CONDICION);
  const maxTop = Math.max(minTop, vh - alto - MARGEN_CONDICION);
  return {
    left: Math.round(Math.min(Math.max(left, minLeft), maxLeft)),
    top: Math.round(Math.min(Math.max(top, minTop), maxTop)),
  };
}

/** Dónde abre: abajo a la derecha del punto. Si no cabe a la derecha, a la izquierda. Si no cabe abajo, arriba. */
export function posicionInicialCondicion({ x, y, ancho, alto, vw, vh, x0 = 0, y0 = 0 }: { x: number; y: number } & Medidas): Caja {
  const left = x + SEPARACION + ancho <= vw - MARGEN_CONDICION ? x + SEPARACION : x - SEPARACION - ancho;
  const top = y + SEPARACION + alto <= vh - MARGEN_CONDICION ? y + SEPARACION : y - SEPARACION - alto;
  return encajarCondicion({ left, top, ancho, alto, vw, vh, x0, y0 });
}
