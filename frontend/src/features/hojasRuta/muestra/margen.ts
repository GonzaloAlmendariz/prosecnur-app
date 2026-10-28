import type { HojasRutaSampleSizeConfig } from "../../../api/hojasRuta";

// Margen de error de una proporción con efecto de diseño y corrección por
// población finita. Es la misma fórmula que usa el diagnóstico de Muestra y la
// curva «qué compra cada N»: vive aquí para que las dos no se separen.

export function inverseStandardNormal(p: number) {
  // Acklam's algorithm — buena precisión para qnorm sin dependencias.
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number, r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= pHigh) {
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
          ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

export function computeMarginError(
  population: number,
  n: number,
  settings: HojasRutaSampleSizeConfig,
  ubigeo?: string,
): number | null {
  if (!Number.isFinite(population) || !Number.isFinite(n) || population <= 0 || n <= 0) return null;
  const z = inverseStandardNormal((1 + settings.confidence_level) / 2);
  const pq = settings.expected_proportion * (1 - settings.expected_proportion);
  const overrides = settings.design_effect_overrides ?? {};
  const deff = ubigeo && overrides[ubigeo] != null && Number.isFinite(overrides[ubigeo])
    ? Math.max(0.1, overrides[ubigeo])
    : Math.max(0.1, settings.design_effect);
  const fpc = settings.apply_fpc && population > 1
    ? Math.sqrt(Math.max(0, (population - Math.min(n, population)) / (population - 1)))
    : 1;
  return z * Math.sqrt(deff * pq / n) * fpc;
}
