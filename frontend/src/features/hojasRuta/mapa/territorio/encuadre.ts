import type { ContornoDistrito } from "../lienzo/capas";
import type { Caja } from "../lienzo/camara";
import { unirCajas } from "../lienzo/piezas";

/**
 * Qué encuadra Territorio (ADR 0119). Lima Metropolitana y Callao son un solo
 * marco; cada ciudad principal es otro. Mientras todo lo elegido está en Lima
 * se encuadra lo confirmado, como siempre (marcar un distrito no mueve el mapa);
 * en cuanto se elige un distrito de otra ciudad, el mapa va a esa ciudad entera,
 * o a todas las tocadas si son varias.
 */

const LIMA_CALLAO = new Set(["1501", "0701"]);
const marcoDe = (ubigeo: string) => (LIMA_CALLAO.has(ubigeo.slice(0, 4)) ? "lima" : ubigeo.slice(0, 4));

export function enLimaCallao(ubigeo: string): boolean {
  return marcoDe(ubigeo) === "lima";
}

export function cajaDeTerritorio(contornos: readonly ContornoDistrito[], elegidos: readonly string[], confirmados: readonly string[]): Caja | null {
  const marcos = new Set([...elegidos, ...confirmados].map(marcoDe));
  if (![...marcos].some((m) => m !== "lima")) {
    const conf = new Set(confirmados);
    return unirCajas(contornos.filter((c) => conf.has(c.ubigeo)).map((c) => c.caja)) ?? unirCajas(contornos.filter((c) => enLimaCallao(c.ubigeo)).map((c) => c.caja));
  }
  return unirCajas(contornos.filter((c) => marcos.has(marcoDe(c.ubigeo))).map((c) => c.caja));
}
