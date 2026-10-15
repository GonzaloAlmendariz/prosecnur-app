// La regla general de redondeo y decimales del informe (R2 del rediseño, 2026-10-15). Puro. El motor guarda método y
// decimales por tipo de gráfico (`preset.calculos`); la «regla del informe» es lo que comparten la mayoría de los tipos,
// y un tipo que se aparta de ella «tiene regla propia». Elegir la general la escribe en todos los tipos a la vez
// (`conMetodoEnTodas` / `conDecimalesEnTodas`), así que después del clic no queda ninguno con regla propia.

import { METODO_ESTANDAR, type FilaCalculo } from "./modeloEstiloInforme";

/** El valor más frecuente (empate: el primero que aparece). */
function moda<T>(valores: readonly T[]): T | null {
  const cuenta = new Map<T, number>();
  for (const v of valores) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  let mejor: T | null = null;
  let n = 0;
  for (const [v, c] of cuenta) if (c > n) { mejor = v; n = c; }
  return mejor;
}

export type ReglaGeneral = {
  /** Método que comparten la mayoría de los tipos que suman 100 %. */
  metodo: string;
  /** Decimales que comparten la mayoría de los tipos con decimales. */
  decimales: number;
  /** Tipos que se apartan de la regla general (en método o en decimales). */
  conReglaPropia: string[];
};

export function reglaGeneral(filas: readonly FilaCalculo[]): ReglaGeneral {
  const cierran = filas.filter((f) => f.admiteMetodo);
  const conDecimales = filas.filter((f) => f.campoDecimales);
  const metodo = moda(cierran.map((f) => f.metodo)) ?? METODO_ESTANDAR;
  const decimales = moda(conDecimales.map((f) => f.decimales)) ?? 0;
  const conReglaPropia = filas
    .filter((f) => (f.admiteMetodo && f.metodo !== metodo) || (f.campoDecimales && f.decimales !== decimales))
    .map((f) => f.preset);
  return { metodo, decimales, conReglaPropia };
}
