/**
 * Visitas de una ruta (ADR 0116 §1), espejo de `api/R/hojas_ruta_tamano_extras.R`.
 * La no respuesta no resta entrevistas: suma visitas. Una manzana alcanza si tiene
 * viviendas ocupadas para las visitas que harán falta en el 90 % de las rutas.
 */

export type SupuestosVisitas = { respuesta: number; ocupacion?: number };

/** `ceil(k / (r·e))`. */
export function visitasPorRuta(k: number, s: SupuestosVisitas): number {
  if (k <= 0) return 0;
  return Math.ceil(k / Math.max(1e-6, s.respuesta * (s.ocupacion ?? 1)));
}

/** k + el cuantil 0,9 de los fracasos de una binomial negativa (éxito r·e); nunca menos que la media. */
export function visitasCap(k: number, s: SupuestosVisitas, q = 0.9): number {
  if (k <= 0) return 0;
  const p = Math.min(1, Math.max(1e-6, s.respuesta * (s.ocupacion ?? 1)));
  if (p >= 1) return k;
  // P(F = f) = C(f + k − 1, f) · p^k · (1 − p)^f, acumulada hasta llegar a q.
  let pf = Math.pow(p, k);
  let acumulada = pf;
  let f = 0;
  while (acumulada < q - 1e-12 && f < 100000) {
    pf *= ((f + k) / (f + 1)) * (1 - p);
    f += 1;
    acumulada += pf;
  }
  return Math.max(visitasPorRuta(k, s), k + f);
}

/** ¿La manzana alcanza? Con salto automático o apagado: V·e ≥ v_cap. */
export function alcanzaManzana(viviendas: number, k: number, s: SupuestosVisitas): boolean {
  return viviendas * (s.ocupacion ?? 1) >= visitasCap(k, s) - 1e-9;
}
