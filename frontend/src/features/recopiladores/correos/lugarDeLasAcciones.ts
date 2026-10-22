// lugarDeLasAcciones.ts — dónde va la barra flotante del bloque elegido.
//
// La barra (nombre, manija, subir, bajar, quitar) probaba cuatro lugares y
// elegía el que menos tapaba; en Dos imágenes caía abajo, a 600 px de donde se
// pulsó y fuera de la vista, y en Ícono con texto caía dentro, sobre el texto
// y el punto de aviso del bloque siguiente (N2 y N3 del re-QA e10). La regla
// ahora es una sola:
//
// - La barra va pegada al borde superior del bloque, por fuera (encima).
// - Si encima no se ve (el bloque empieza arriba del área visible o bajo la
//   barra del correo), la barra se oculta con una transición corta y vuelve
//   al subir (#2 del re-QA e10-2). Pegada a lo más alto visible del bloque
//   tapaba renglones del propio texto, y fuera de la hoja no hay dónde ponerla:
//   el lienzo mide lo mismo que la hoja en los tres anchos (margen 0 px a
//   1440, 1366 y 1024). Mover, subir, bajar y quitar siguen en el inspector y
//   con Alt + flechas.
// - Si el foco está en la barra, no se oculta: baja `respaldo` px hasta lo más
//   alto que se ve del bloque, para no perder al que va con el teclado.
// - Nunca queda fuera del área visible.
// - Deja libre la esquina derecha, donde van los puntos de aviso.
//
// Todo se mide en el espacio de la capa (rectángulos del iframe × escala).

import type { Rect } from "./estructuraCorreo";

export type LugarDeLasAcciones = "arriba" | "oculta";

/** Separación entre la barra y el borde del bloque. */
export const MARGEN_DE_LAS_ACCIONES = 6;

/** Alto de la barra: botones de 26 px, 2 px de relleno y el borde. */
export const ALTO_DE_LAS_ACCIONES = 32;

/**
 * La esquina de los puntos de aviso: el punto mide 20 px y sobresale 8 px
 * del borde derecho del bloque; la barra termina 6 px antes de él.
 */
export const RESERVA_DEL_PUNTO = 18;

/** Ancho estimado de la barra: el nombre a 11 px y cada botón de 26 px. */
export function anchoDeLasAcciones(nombre: string, botones: number): number {
  return Math.ceil(nombre.length * 6.4) + 14 + botones * 28 + 6;
}

/** La franja de la capa que se ve: de `arriba` a `abajo`, en el espacio de la capa. */
export type AreaVisible = { arriba: number; abajo: number };

/**
 * El lugar y el rectángulo de la barra del bloque `zona`. Sin `visible` (aún
 * sin medir) se supone que todo se ve.
 */
export function lugarDeLasAcciones(entrada: { zona: Rect; ancho: number; visible?: AreaVisible | null }): { lugar: LugarDeLasAcciones; rect: Rect; respaldo: number } {
  const { zona, ancho } = entrada;
  const visible = entrada.visible ?? { arriba: Number.NEGATIVE_INFINITY, abajo: Number.POSITIVE_INFINITY };
  const encima = zona.y - ALTO_DE_LAS_ACCIONES - MARGEN_DE_LAS_ACCIONES;
  // Encima del bloque y dentro de lo que se ve: ese es su lugar.
  const cabeEncima = encima >= visible.arriba && encima + ALTO_DE_LAS_ACCIONES <= visible.abajo;
  // Si no cabe, se oculta; su rectángulo es el de respaldo con el foco dentro:
  // lo más alto que se ve, sin bajar del final del bloque.
  let y = Math.max(encima, visible.arriba);
  y = Math.min(y, Math.max(encima, zona.y + zona.h - ALTO_DE_LAS_ACCIONES));
  // Nunca fuera del área visible.
  if (Number.isFinite(visible.abajo)) y = Math.min(y, visible.abajo - ALTO_DE_LAS_ACCIONES);
  if (Number.isFinite(visible.arriba)) y = Math.max(y, visible.arriba);
  const x = Math.max(0, zona.x + zona.w - RESERVA_DEL_PUNTO - ancho);
  // Oculta, sigue encima del bloque (se va con él mientras se desvanece);
  // `respaldo` es cuánto bajarla si el foco está dentro.
  return { lugar: cabeEncima ? "arriba" : "oculta", rect: { x, y: encima, w: ancho, h: ALTO_DE_LAS_ACCIONES }, respaldo: cabeEncima ? 0 : y - encima };
}

/** El rectángulo de un punto de aviso de una zona (esquina superior derecha). */
export function rectDelPunto(zona: Rect): Rect {
  return { x: zona.x + zona.w - 12, y: zona.y - 8, w: 20, h: 20 };
}

type Medible = { getBoundingClientRect: () => { top: number; bottom: number; height: number } };

/**
 * El área visible de la capa: la intersección de la ventana con cada
 * ancestro que recorta, menos la barra del correo si queda pegada encima.
 * `margen` deja aire contra los bordes.
 */
export function areaVisibleDeLaCapa(capa: HTMLElement, barra: Medible | null, margen = MARGEN_DE_LAS_ACCIONES): AreaVisible {
  const rc = capa.getBoundingClientRect();
  let arriba = 0;
  let abajo = typeof window === "undefined" ? Number.POSITIVE_INFINITY : window.innerHeight;
  for (let el = capa.parentElement; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if (!/(auto|scroll|hidden|clip)/.test(overflowY)) continue;
    const r = el.getBoundingClientRect();
    arriba = Math.max(arriba, r.top + el.clientTop);
    abajo = Math.min(abajo, r.top + el.clientTop + el.clientHeight);
  }
  if (barra) {
    const rb = barra.getBoundingClientRect();
    // La barra del correo va encima del lienzo: si se ve, tapa el borde de arriba del área.
    if (rb.height > 0 && rb.bottom > arriba && rb.top < abajo) arriba = rb.bottom;
  }
  return { arriba: arriba - rc.top + margen, abajo: abajo - rc.top - margen };
}
