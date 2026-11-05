/**
 * Cálculos de presentación del grupo «Tamaño y precisión» (maqueta aprobada). No deciden el N: el motor
 * (muestra/motorTamano.ts) sigue siendo la fuente; esto sólo valida lo escrito y deriva lo que se muestra.
 */

/** El N escrito, sin separadores de miles ni espacios; `null` si no es un entero positivo. */
export function leerN(texto: string): number | null {
  const limpio = texto.replace(/[\s., ]/g, "");
  if (!/^\d+$/.test(limpio)) return null;
  const n = Number(limpio);
  return n > 0 ? n : null;
}

/** Los dos múltiplos de k más cercanos a n (el de abajo, nunca menor que k, y el de arriba); `null` si n ya lo es. */
export function multiplosCercanos(n: number, k: number): [number, number] | null {
  if (!(k > 0) || n % k === 0) return null;
  const abajo = Math.max(k, Math.floor(n / k) * k);
  return [abajo, Math.ceil(n / k) * k];
}

/** Los divisores de n entre `desde` y `hasta` (encuestas por ruta que dejan rutas completas). */
export function divisoresEntre(n: number, desde = 4, hasta = 12): number[] {
  const out: number[] = [];
  for (let k = desde; k <= hasta; k += 1) if (n > 0 && n % k === 0) out.push(k);
  return out;
}

/** Intervalo para una proporción de 50 % con el margen total del diseño, en puntos porcentuales. */
export function intervaloP50(margenTotal: number | null): [number, number] | null {
  if (margenTotal == null || !Number.isFinite(margenTotal)) return null;
  return [50 - margenTotal * 100, 50 + margenTotal * 100];
}

/** Tamaño efectivo: las encuestas que valen como muestreo aleatorio simple con este efecto de diseño. */
export const nEfectivo = (n: number, deff: number) => (deff > 0 ? Math.round(n / deff) : n);
