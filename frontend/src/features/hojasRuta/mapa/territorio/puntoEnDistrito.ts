import type { ContornoDistrito } from "../lienzo/capas";

/** Punto en un anillo plano (x1,y1,x2,y2…) por cruce de rayos. */
export function puntoEnAnillo(x: number, y: number, anillo: readonly number[]): boolean {
  let dentro = false;
  const n = anillo.length >> 1;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = anillo[2 * i], yi = anillo[2 * i + 1], xj = anillo[2 * j], yj = anillo[2 * j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** El distrito bajo un punto del mundo, o `null`. Primero descarta por caja. */
export function distritoEnPunto(contornos: readonly ContornoDistrito[], x: number, y: number): ContornoDistrito | null {
  for (const c of contornos) {
    if (x < c.caja[0] || x > c.caja[2] || y < c.caja[1] || y > c.caja[3]) continue;
    // Par-impar: un punto dentro de un hueco de la huella no es del distrito.
    if (c.anillos.filter((r) => puntoEnAnillo(x, y, r)).length % 2 === 1) return c;
  }
  return null;
}
