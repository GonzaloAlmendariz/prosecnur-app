import type { HojasRutaAgeRange } from "../../../../api/hojasRuta";
import type { FilaMatriz } from "./matriz";

/** Una barra de la pirámide: el rango de edad con hombres y mujeres de la población objetivo. */
export type BarraPiramide = { rango: string; H: number; M: number };

/**
 * Pirámide de la población objetivo (checklist F8): suma la matriz por rango y sexo. Los rangos
 * van de mayor a menor edad, como se lee una pirámide (los mayores arriba).
 */
export function barrasDePiramide(filas: readonly FilaMatriz[], rangos: readonly HojasRutaAgeRange[]): BarraPiramide[] {
  const barras = rangos.map((r, i) => ({
    rango: r.label || (r.max === null ? `${r.min} y más` : `${r.min} a ${r.max}`),
    H: filas.reduce((a, f) => a + (f.porRango[i]?.H ?? 0), 0),
    M: filas.reduce((a, f) => a + (f.porRango[i]?.M ?? 0), 0),
  }));
  return barras.reverse();
}
