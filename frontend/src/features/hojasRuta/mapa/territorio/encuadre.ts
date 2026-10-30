import type { ContornoDistrito } from "../lienzo/capas";
import type { Caja } from "../lienzo/camara";
import { unirCajas } from "../lienzo/piezas";

/**
 * Qué encuadra Territorio (ADR 0119). Lima Metropolitana y Callao son un solo
 * marco; cada ciudad principal es otro. Mientras todo lo elegido está en Lima
 * se encuadra lo confirmado, como siempre (marcar un distrito no mueve el mapa).
 * En cuanto entra un distrito de otra ciudad, el mapa va a la ciudad del último
 * elegido fuera de Lima: Lima y Arequipa caben juntas sólo a escala de país
 * (770 km), donde los distritos son puntos; el resto se ve alejando el zoom.
 */

const LIMA_CALLAO = new Set(["1501", "0701"]);
const marcoDe = (ubigeo: string) => (LIMA_CALLAO.has(ubigeo.slice(0, 4)) ? "lima" : ubigeo.slice(0, 4));

export function enLimaCallao(ubigeo: string): boolean {
  return marcoDe(ubigeo) === "lima";
}

/** La ciudad (código de provincia) que manda en el encuadre, o null si todo está en Lima. */
export function ciudadEnFoco(elegidos: readonly string[], confirmados: readonly string[]): string | null {
  const fuera = [...confirmados, ...elegidos].filter((u) => !enLimaCallao(u));
  return fuera.length ? marcoDe(fuera[fuera.length - 1]) : null;
}

export function cajaDeTerritorio(contornos: readonly ContornoDistrito[], elegidos: readonly string[], confirmados: readonly string[]): Caja | null {
  const ciudad = ciudadEnFoco(elegidos, confirmados);
  if (ciudad) return unirCajas(contornos.filter((c) => marcoDe(c.ubigeo) === ciudad).map((c) => c.caja));
  const conf = new Set(confirmados);
  return unirCajas(contornos.filter((c) => conf.has(c.ubigeo)).map((c) => c.caja)) ?? unirCajas(contornos.filter((c) => enLimaCallao(c.ubigeo)).map((c) => c.caja));
}
