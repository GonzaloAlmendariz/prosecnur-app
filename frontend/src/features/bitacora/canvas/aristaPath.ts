// Trazado de aristas del lienzo (ADR 0047).
//
// Portado de `xlsformEditor/canvas-graph/GraphEdgeArrow.tsx`, donde el
// constructor de path vivía dentro del componente y por lo tanto no se podía
// probar. Acá es puro.

export type Ancla = "t" | "r" | "b" | "l";
export type Caja = { x: number; y: number; w: number; h: number };
export type Punto = { x: number; y: number };

/** Punto de salida de una arista en el borde de un nodo. */
export function puntoDeAncla(caja: Caja, ancla: Ancla): Punto {
  switch (ancla) {
    case "t": return { x: caja.x + caja.w / 2, y: caja.y };
    case "b": return { x: caja.x + caja.w / 2, y: caja.y + caja.h };
    case "l": return { x: caja.x, y: caja.y + caja.h / 2 };
    default: return { x: caja.x + caja.w, y: caja.y + caja.h / 2 };
  }
}

/**
 * Anclas que hacen el trazado más corto entre dos nodos.
 *
 * Se eligen solas porque pedirle al usuario que elija de qué lado sale cada
 * arista es trabajo que la geometría ya responde. El eje dominante manda: si
 * los nodos están más separados en horizontal, salen por los costados.
 */
export function anclasAutomaticas(desde: Caja, hasta: Caja): { from: Ancla; to: Ancla } {
  const dx = hasta.x + hasta.w / 2 - (desde.x + desde.w / 2);
  const dy = hasta.y + hasta.h / 2 - (desde.y + desde.h / 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { from: "r", to: "l" } : { from: "l", to: "r" };
  }
  return dy >= 0 ? { from: "b", to: "t" } : { from: "t", to: "b" };
}

/** Cuánto se separa la curva del nodo antes de girar. */
const TENSION_MIN = 28;
const TENSION_MAX = 140;

function tension(a: Punto, b: Punto): number {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  return Math.min(TENSION_MAX, Math.max(TENSION_MIN, d * 0.4));
}

/**
 * Curva de Bézier entre dos anclas.
 *
 * Los puntos de control salen PERPENDICULARES al borde de cada nodo, así la
 * arista nace y muere en ángulo recto y se lee de dónde a dónde va aunque
 * cruce otras. Una recta directa entre centros pasaría por encima de los nodos.
 */
export function pathDeArista(desde: Caja, hasta: Caja, from: Ancla, to: Ancla): string {
  const p0 = puntoDeAncla(desde, from);
  const p1 = puntoDeAncla(hasta, to);
  const t = tension(p0, p1);

  const c0 = desplazar(p0, from, t);
  const c1 = desplazar(p1, to, t);

  return `M ${r(p0.x)} ${r(p0.y)} C ${r(c0.x)} ${r(c0.y)}, ${r(c1.x)} ${r(c1.y)}, ${r(p1.x)} ${r(p1.y)}`;
}

/** Path de la arista fantasma mientras se arrastra hacia un destino aún libre. */
export function pathFantasma(desde: Caja, from: Ancla, cursor: Punto): string {
  const p0 = puntoDeAncla(desde, from);
  const t = tension(p0, cursor);
  const c0 = desplazar(p0, from, t);
  return `M ${r(p0.x)} ${r(p0.y)} C ${r(c0.x)} ${r(c0.y)}, ${r(cursor.x)} ${r(cursor.y)}, ${r(cursor.x)} ${r(cursor.y)}`;
}

/** Punto medio aproximado de la curva, para colgar la etiqueta. */
export function centroDeArista(desde: Caja, hasta: Caja, from: Ancla, to: Ancla): Punto {
  const p0 = puntoDeAncla(desde, from);
  const p1 = puntoDeAncla(hasta, to);
  const t = tension(p0, p1);
  const c0 = desplazar(p0, from, t);
  const c1 = desplazar(p1, to, t);
  // Bézier cúbica en t=0.5.
  return {
    x: (p0.x + 3 * c0.x + 3 * c1.x + p1.x) / 8,
    y: (p0.y + 3 * c0.y + 3 * c1.y + p1.y) / 8,
  };
}

function desplazar(p: Punto, ancla: Ancla, d: number): Punto {
  switch (ancla) {
    case "t": return { x: p.x, y: p.y - d };
    case "b": return { x: p.x, y: p.y + d };
    case "l": return { x: p.x - d, y: p.y };
    default: return { x: p.x + d, y: p.y };
  }
}

// Dos decimales: un path con quince cifras por punto infla el DOM sin que se
// note ni un píxel de diferencia.
function r(v: number): number {
  return Math.round(v * 100) / 100;
}
