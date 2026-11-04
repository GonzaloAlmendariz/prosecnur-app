// Escalas de los gráficos del explorador, sin React: marcas «redondas» para leer un
// valor intermedio, fechas repartidas en el eje y un encuadre que no deja que un
// atípico aplaste al resto. Lo comparten la serie, la dispersión, las cajas y el
// histograma, así que todos los ejes del explorador se leen igual.

/** Paso «lindo» (1, 2, 2.5 o 5 × 10^k) para unas `cuantas` marcas en el rango. */
function pasoLindo(rango: number, cuantas: number): number {
  const bruto = rango / Math.max(1, cuantas);
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const frac = bruto / potencia;
  const lindo = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return lindo * potencia;
}

export type Escala = { desde: number; hasta: number; marcas: number[] };

/**
 * El rango [min, max] extendido a marcas redondas. Un rango sin ancho (todos los
 * valores iguales) se abre a su alrededor para que el dato no quede pegado al eje.
 */
export function escalaLinda(min: number, max: number, cuantas = 5): Escala {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { desde: 0, hasta: 1, marcas: [0, 1] };
  if (max < min) [min, max] = [max, min];
  if (max === min) {
    const abre = min === 0 ? 1 : Math.abs(min) * 0.1;
    min -= abre;
    max += abre;
  }
  const paso = pasoLindo(max - min, cuantas);
  const desde = Math.floor(min / paso) * paso;
  const hasta = Math.ceil(max / paso) * paso;
  const marcas: number[] = [];
  // Redondeo para que 0.1 + 0.2 no deje marcas como 0.30000000000000004.
  for (let v = desde; v <= hasta + paso / 2; v += paso) marcas.push(Number(v.toPrecision(12)));
  return { desde, hasta, marcas };
}

/** Escala que arranca en cero: conteos y porcentajes no se leen bien con el cero recortado. */
export function escalaDesdeCero(max: number, cuantas = 5): Escala {
  return escalaLinda(0, Math.max(max, 1), cuantas);
}

/** Hasta `cuantas` fechas repartidas a lo largo del eje, siempre con la primera y la última. */
export function marcasDeFechas(fechas: readonly string[], cuantas = 5): string[] {
  if (fechas.length <= cuantas) return [...fechas];
  const paso = (fechas.length - 1) / (cuantas - 1);
  return [...new Set(Array.from({ length: cuantas }, (_, i) => fechas[Math.round(i * paso)]))];
}

// «set», como el eje de fechas de Monitoreo (core/ejeDeFechas): en el Perú se dice setiembre.
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

/** «2026-06-13» → «13 jun». Lo que no es una fecha ISO queda como vino. */
export function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1] ?? m[2]}`;
}

function cuantil(ordenados: readonly number[], p: number): number {
  const i = (ordenados.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return ordenados[lo] + (ordenados[hi] - ordenados[lo]) * (i - lo);
}

/**
 * Encuadre de un eje: todo el rango, salvo que haya atípicos lejanos —más allá de
 * 3 × IQR de los cuartiles (vallas de Tukey)—. Entonces se encuadra lo que queda
 * dentro de las vallas y se cuentan los que quedan fuera, que el gráfico dice
 * aparte: un solo −63,148 aplastaba a los otros 36 casos contra el borde.
 */
export function encuadre(valores: readonly number[]): { min: number; max: number; fuera: number } {
  const v = valores.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!v.length) return { min: 0, max: 1, fuera: 0 };
  const min = v[0];
  const max = v[v.length - 1];
  const q1 = cuantil(v, 0.25);
  const q3 = cuantil(v, 0.75);
  const iqr = q3 - q1;
  if (v.length < 8 || iqr <= 0) return { min, max, fuera: 0 };
  const dentro = v.filter((x) => x >= q1 - 3 * iqr && x <= q3 + 3 * iqr);
  if (dentro.length === v.length) return { min, max, fuera: 0 };
  return { min: dentro[0], max: dentro[dentro.length - 1], fuera: v.length - dentro.length };
}

/** Posición lineal de `v` en [0, largo] según la escala (fuera del rango se pega al borde). */
export function proyectar(v: number, escala: Pick<Escala, "desde" | "hasta">, largo: number): number {
  const r = escala.hasta - escala.desde;
  if (r <= 0) return largo / 2;
  return Math.min(largo, Math.max(0, ((v - escala.desde) / r) * largo));
}
