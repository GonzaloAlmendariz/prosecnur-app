/**
 * Espejo en TS del cálculo de tamaño de `hojas_ruta_sample_size_preview()`
 * (api/R/hojas_ruta_engine.R ~4296–4490), para que la sección Muestra responda
 * al instante mientras se mueven los controles (ADR 0114 §6). R sigue siendo la
 * fuente de verdad: al guardar manda el backend, y `tamanoMuestra.contract.test.ts`
 * prueba contra un golden generado por el propio engine que este espejo da lo
 * mismo, hasta los desempates del reparto.
 *
 * Si cambian las fórmulas del engine, se regenera el golden
 * (scratchpad golden_tamano.R, descrito en el test) y este archivo se ajusta.
 */

export type ModoTamano = "calculator" | "external_total" | "external_district";
export type ModoAsignacion = "proportional" | "uniform" | "compromise";

export type ParametrosTamano = {
  confianza: number;
  margenTotal: number;
  margenDistrito: number;
  p: number;
  deff: number;
  asignacion: ModoAsignacion;
  /** `enforce_district_floor`: el margen por distrito es requisito, no sólo un máximo. */
  piso: boolean;
  respuesta: number;
  fpc: boolean;
  margenPorDistrito?: Record<string, number>;
  deffPorDistrito?: Record<string, number>;
};

export type EntradaTamano = {
  distritos: ReadonlyArray<{ ubigeo: string; distrito: string; poblacion: number }>;
  parametros: ParametrosTamano;
  modo: ModoTamano;
  /** N total cuando el modo es `external_total`. */
  nTotal: number;
  /** N por ubigeo cuando el modo es `external_district`. */
  nPorDistrito: Record<string, number>;
  porRuta: number;
};

export type FilaTamano = { ubigeo: string; distrito: string; poblacion: number; nMinimo: number; nUsado: number; margen: number | null; margenObjetivo: number; deff: number };

export type ResultadoTamano = {
  z: number;
  poblacionTotal: number;
  nTotalMinimo: number;
  sumaMinimos: number;
  nRecomendado: number;
  nUsado: number;
  multiploDeRuta: boolean;
  margenTotal: number | null;
  contactos: number;
  filas: FilaTamano[];
};

/** Inversa de la normal estándar (Acklam), precisa a ~1e-9: suficiente para `qnorm((1 + c) / 2)`. */
export function qnorm(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= 1 - pl) {
    const q = p - 0.5, r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

/** `.hojas_ruta_allocate_integer`: mayor resto; empata por peso y luego por orden original. */
export function repartirEnteros(pesos: readonly number[], n: number): number[] {
  const w = pesos.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  const suma = w.reduce((a, b) => a + b, 0);
  if (!w.length || n <= 0 || suma <= 0) return w.map(() => 0);
  const crudo = w.map((x) => (n * x) / suma);
  const out = crudo.map(Math.floor);
  let resto = n - out.reduce((a, b) => a + b, 0);
  const orden = crudo.map((v, i) => ({ i, frac: v - out[i], peso: w[i] })).sort((x, y) => y.frac - x.frac || y.peso - x.peso || x.i - y.i);
  for (const o of orden) {
    if (resto <= 0) break;
    out[o.i] += 1;
    resto -= 1;
  }
  return out;
}

/** `.hojas_ruta_allocate_by_mode` + `.hojas_ruta_allocate_with_floor`. */
export function repartirPorModo(poblacion: readonly number[], n: number, modo: ModoAsignacion, pisos?: readonly number[]): number[] {
  const p = poblacion.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  let w = modo === "uniform" ? p.map((x) => (x > 0 ? 1 : 0)) : modo === "compromise" ? p.map(Math.sqrt) : p;
  if (modo === "uniform" && w.every((x) => x <= 0)) w = p.map(() => 1);
  const f = (pisos ?? p.map(() => 0)).map((x) => Math.max(0, Math.trunc(x)));
  const total = f.reduce((a, b) => a + b, 0);
  if (n <= total) return f;
  const extra = repartirEnteros(w, n - total);
  return f.map((x, i) => x + extra[i]);
}

/**
 * Margen total que daría otro N con los mismos supuestos (brecha B34): la misma
 * fórmula de `margenCon` sobre la población total, para comparar alternativas.
 */
export function margenTotalParaN(e: EntradaTamano, n: number): number | null {
  return calcularTamano({ ...e, modo: "external_total", nTotal: n, nPorDistrito: {} }).margenTotal;
}

export function calcularTamano(e: EntradaTamano): ResultadoTamano {
  const P = e.parametros;
  const ruta = Math.max(1, Math.trunc(e.porRuta));
  const z = qnorm((1 + P.confianza) / 2);
  const pq = P.p * (1 - P.p);
  const deffDe = (u?: string) => {
    const base = Math.max(0.1, P.deff);
    const v = u ? P.deffPorDistrito?.[u] : undefined;
    return v !== undefined && Number.isFinite(v) && v >= 0.1 ? v : base;
  };
  const margenDe = (u?: string) => {
    const v = u ? P.margenPorDistrito?.[u] : undefined;
    return v !== undefined && Number.isFinite(v) && v >= 0.001 && v <= 0.8 ? v : P.margenDistrito;
  };
  const nNecesario = (N: number, margen: number, deff: number) => {
    if (N <= 0) return 0;
    const nd = (deff * z * z * pq) / (margen * margen);
    return Math.min(N, Math.ceil(P.fpc ? (N * nd) / (N + nd - 1) : nd));
  };
  const margenCon = (N: number, n: number, deff: number) => {
    if (N <= 0 || n <= 0) return null;
    const fpc = P.fpc && N > 1 ? Math.sqrt(Math.max(0, (N - Math.min(n, N)) / (N - 1))) : 1;
    return z * Math.sqrt((deff * pq) / n) * fpc;
  };
  const aRuta = (n: number) => Math.ceil(Math.max(1, n) / ruta) * ruta;

  // R ordena los distritos por nombre antes de repartir.
  const ds = [...e.distritos].sort((a, b) => (a.distrito < b.distrito ? -1 : a.distrito > b.distrito ? 1 : 0));
  const poblacionTotal = ds.reduce((a, d) => a + d.poblacion, 0);
  const nTotalMinimo = aRuta(nNecesario(poblacionTotal, P.margenTotal, deffDe()));
  const minimos = ds.map((d) => aRuta(nNecesario(d.poblacion, margenDe(d.ubigeo), deffDe(d.ubigeo))));
  const sumaMinimos = minimos.reduce((a, b) => a + b, 0);
  const nRecomendado = P.piso ? Math.max(nTotalMinimo, sumaMinimos) : nTotalMinimo;

  const externoPorDistrito = e.modo === "external_district";
  const sumaExterna = ds.reduce((a, d) => a + (e.nPorDistrito[d.ubigeo] ?? 0), 0);
  const nObjetivo = e.modo === "calculator" ? nRecomendado : e.nTotal;
  const nUsado = Math.max(0, externoPorDistrito && sumaExterna > 0 ? sumaExterna : nObjetivo);
  const multiploDeRuta = externoPorDistrito ? ds.every((d) => (e.nPorDistrito[d.ubigeo] ?? 0) % ruta === 0) : nUsado % ruta === 0;

  let usados: number[];
  if (externoPorDistrito) {
    usados = ds.map((d) => e.nPorDistrito[d.ubigeo] ?? 0);
  } else if (multiploDeRuta && nUsado > 0) {
    const rutas = nUsado / ruta;
    let pisos = P.piso && nUsado >= sumaMinimos ? minimos.map((m) => Math.floor(m / ruta)) : ds.map(() => 0);
    if (pisos.reduce((a, b) => a + b, 0) > rutas) pisos = ds.map(() => 0);
    usados = repartirPorModo(ds.map((d) => d.poblacion), rutas, P.asignacion, pisos).map((r) => r * ruta);
  } else {
    const pisos = P.piso && nUsado >= sumaMinimos ? minimos : ds.map(() => 0);
    usados = repartirPorModo(ds.map((d) => d.poblacion), nUsado, P.asignacion, pisos);
  }

  return {
    z,
    poblacionTotal,
    nTotalMinimo,
    sumaMinimos,
    nRecomendado,
    nUsado,
    multiploDeRuta,
    margenTotal: margenCon(poblacionTotal, nUsado, deffDe()),
    contactos: Math.ceil(nUsado / P.respuesta),
    filas: ds.map((d, i) => ({ ubigeo: d.ubigeo, distrito: d.distrito, poblacion: d.poblacion, nMinimo: minimos[i], nUsado: usados[i], margen: margenCon(d.poblacion, usados[i], deffDe(d.ubigeo)), margenObjetivo: margenDe(d.ubigeo), deff: deffDe(d.ubigeo) })),
  };
}
