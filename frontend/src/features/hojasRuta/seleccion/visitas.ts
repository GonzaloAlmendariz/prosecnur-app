/**
 * Visitas de una ruta (ADR 0116 §1), espejo de `api/R/hojas_ruta_tamano_extras.R`.
 * La no respuesta no resta entrevistas: suma visitas. Una manzana alcanza si tiene
 * viviendas ocupadas para las visitas que harán falta en el 90 % de las rutas.
 */

export type SupuestosVisitas = { respuesta: number; ocupacion?: number; modoSalto?: "auto" | "off" | "manual"; saltoManual?: number };

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
  // P(F = f) = C(f + k − 1, f) · p^k · (1 − p)^f, en escala logarítmica: p^k se va a 0
  // por underflow con p chico y k grande (revisión de U12, B1), y el término debe poder crecer.
  const log1p_ = Math.log(1 - p);
  let logpf = k * Math.log(p);
  let acumulada = Math.exp(logpf);
  let f = 0;
  while (acumulada < q - 1e-12 && f < 5_000_000) {
    logpf += Math.log((f + k) / (f + 1)) + log1p_;
    f += 1;
    acumulada += Math.exp(logpf);
  }
  return Math.max(visitasPorRuta(k, s), k + f);
}

/**
 * ¿La manzana alcanza? v_cap ya cuenta las visitas a viviendas desocupadas (éxito r·e),
 * así que no se vuelve a descontar la ocupación (revisión de U12, A2). Con salto manual
 * s, se recorren s viviendas por visita.
 */
export function alcanzaManzana(viviendas: number, k: number, s: SupuestosVisitas): boolean {
  const salto = s.modoSalto === "manual" ? Math.max(1, Math.round(s.saltoManual ?? 1)) : 1;
  return viviendas >= salto * visitasCap(k, s) - 1e-9;
}
