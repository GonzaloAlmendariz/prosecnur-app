// lugarDeLasAcciones.ts — dónde va la barra flotante del bloque elegido.
//
// La barra (nombre, manija, subir, bajar, quitar) iba siempre encima del
// bloque, a la derecha, y tapaba el último renglón del bloque anterior (#7 del
// QA e10). Caber no es no pisarse: se prueban cuatro lugares junto al borde
// derecho del bloque y gana el primero que no toca ningún texto ni imagen del
// correo. Si ninguno queda libre, el que menos tapa.
//
// Todo se mide en el espacio de la capa (rectángulos del iframe × escala).

import type { Rect } from "./estructuraCorreo";

export type LugarDeLasAcciones = "arriba" | "dentro" | "abajo" | "dentro-abajo";

/** Separación entre la barra y el borde del bloque. */
export const MARGEN_DE_LAS_ACCIONES = 6;

/** Alto de la barra: botones de 26 px, 2 px de relleno y el borde. */
export const ALTO_DE_LAS_ACCIONES = 32;

/** Ancho estimado de la barra: el nombre a 11 px y cada botón de 26 px. */
export function anchoDeLasAcciones(nombre: string, botones: number): number {
  return Math.ceil(nombre.length * 6.4) + 14 + botones * 28 + 6;
}

function solape(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** El rectángulo que ocupa la barra en cada lugar (anclada al borde derecho del bloque). */
export function rectDeLasAcciones(zona: Rect, lugar: LugarDeLasAcciones, ancho: number): Rect {
  const x = zona.x + zona.w - ancho - (lugar === "dentro" || lugar === "dentro-abajo" ? MARGEN_DE_LAS_ACCIONES : 0);
  const y = lugar === "arriba"
    ? zona.y - ALTO_DE_LAS_ACCIONES - MARGEN_DE_LAS_ACCIONES
    : lugar === "dentro"
      ? zona.y + MARGEN_DE_LAS_ACCIONES
      : lugar === "abajo"
        ? zona.y + zona.h + MARGEN_DE_LAS_ACCIONES
        : zona.y + zona.h - ALTO_DE_LAS_ACCIONES - MARGEN_DE_LAS_ACCIONES;
  return { x, y, w: ancho, h: ALTO_DE_LAS_ACCIONES };
}

const ORDEN: readonly LugarDeLasAcciones[] = ["arriba", "dentro", "abajo", "dentro-abajo"];

/**
 * El primer lugar libre de texto e imágenes; si no hay, el que menos tapa. Un
 * lugar que se sale de la hoja (arriba del primer bloque, abajo del último)
 * no cuenta.
 */
export function lugarDeLasAcciones(entrada: {
  zona: Rect;
  /** Líneas de texto e imágenes del correo, en el espacio de la capa. */
  ocupados: readonly Rect[];
  ancho: number;
  /** Alto de la hoja: la barra no se sale de ella. */
  altoDeLaHoja: number;
}): LugarDeLasAcciones {
  const { zona, ocupados, ancho, altoDeLaHoja } = entrada;
  let mejor: { lugar: LugarDeLasAcciones; tapa: number } | null = null;
  for (const lugar of ORDEN) {
    const r = rectDeLasAcciones(zona, lugar, ancho);
    if (r.y < 0 || r.y + r.h > altoDeLaHoja || r.x < 0) continue;
    const tapa = ocupados.reduce((suma, o) => suma + solape(r, o), 0);
    if (tapa === 0) return lugar;
    if (!mejor || tapa < mejor.tapa) mejor = { lugar, tapa };
  }
  return mejor?.lugar ?? "dentro";
}

/**
 * Las líneas de texto y las imágenes del documento que caen cerca de la zona
 * (una franja de `margen` px arriba y abajo), en el espacio de la capa.
 */
export function ocupadosCercaDe(doc: Document, zona: Rect, escala: number, margen = 64): Rect[] {
  const desde = zona.y - margen;
  const hasta = zona.y + zona.h + margen;
  const out: Rect[] = [];
  const agregar = (r: DOMRect) => {
    if (!r.width || !r.height) return;
    const rect = { x: r.left * escala, y: r.top * escala, w: r.width * escala, h: r.height * escala };
    if (rect.y + rect.h >= desde && rect.y <= hasta) out.push(rect);
  };
  const cuerpo = doc.body;
  if (!cuerpo) return out;
  const caminante = doc.createTreeWalker(cuerpo, 4 /* NodeFilter.SHOW_TEXT */);
  const rango = doc.createRange();
  for (let nodo = caminante.nextNode(); nodo; nodo = caminante.nextNode()) {
    if (!(nodo.nodeValue ?? "").trim()) continue;
    rango.selectNodeContents(nodo);
    for (const r of Array.from(rango.getClientRects())) agregar(r);
  }
  for (const img of Array.from(doc.images)) agregar(img.getBoundingClientRect());
  return out;
}
