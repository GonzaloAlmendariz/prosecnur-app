// Mapa por rangos de una variable numérica: la lógica del editor que reemplaza a
// la tabla valor por valor cuando el origen es un número (una edad, un año, una
// fórmula). Lo usan Segmentos de cruce, Armonizar y Recodificar.
//
// - Qué valores entran a los rangos: los numéricos sin etiqueta propia. Un
//   código con etiqueta distinta de sí mismo («88 Otro») queda fuera y se
//   asigna aparte, nunca cae en «5 o más» por ser un número grande.
// - Los rangos se derivan del mapa guardado (tramos seguidos con el mismo
//   destino) para que reabrir muestre lo mismo que se guardó.
// - Cada cambio de los rangos devuelve la asignación completa de los valores
//   numéricos: los que caen en un rango van a su categoría, los demás quedan
//   sin mapa.

import type { Tramo } from "./segmentos/segmentosModel";

export type ValorConCasos = { codigo: string; etiqueta?: string | null; n?: number | null };
export type CategoriaDestino = { codigo: string; etiqueta: string };

const NUMERO = /^-?\d+(\.\d+)?$/;

/** Un código que se agrupa en rangos: numérico y sin etiqueta propia. */
export function entraEnRangos(v: ValorConCasos): boolean {
  if (!NUMERO.test(v.codigo)) return false;
  const e = (v.etiqueta ?? "").trim();
  return !e || e === v.codigo;
}

export function valoresNumericos(valores: readonly ValorConCasos[]): ValorConCasos[] {
  return valores.filter(entraEnRangos).sort((a, b) => Number(a.codigo) - Number(b.codigo));
}

function numero(s: string): number | null {
  const t = s.trim();
  return t && NUMERO.test(t) ? Number(t) : null;
}

function enRango(v: number, t: Tramo): boolean {
  const desde = numero(t.desde);
  const hasta = t.hasta.trim() ? numero(t.hasta) : Number.POSITIVE_INFINITY;
  return desde !== null && hasta !== null && v >= desde && v <= hasta;
}

/**
 * Los rangos que describe un mapa: valores seguidos con el mismo destino. El
 * último rango de la categoría más alta queda abierto («o más»). Sin nada
 * asignado, una fila vacía por categoría.
 */
export function tramosDesdeMapa(
  valores: readonly ValorConCasos[],
  mapa: Readonly<Record<string, string>>,
  escala: readonly CategoriaDestino[],
): Tramo[] {
  const nums = valoresNumericos(valores);
  const corridas: { desde: string; hasta: string; destino: string }[] = [];
  for (const v of nums) {
    const d = mapa[v.codigo];
    if (!d) continue;
    const previa = corridas[corridas.length - 1];
    if (previa && previa.destino === d) previa.hasta = v.codigo;
    else corridas.push({ desde: v.codigo, hasta: v.codigo, destino: d });
  }
  if (!corridas.length) {
    return (escala.length ? escala : [{ codigo: "", etiqueta: "" }])
      .map((c, i) => ({ clave: `t${i + 1}`, desde: "", hasta: "", destino: c.codigo }));
  }
  const maximo = nums.length ? nums[nums.length - 1].codigo : "";
  return corridas.map((c, i) => ({
    clave: `t${i + 1}`,
    desde: c.desde,
    hasta: i === corridas.length - 1 && c.hasta === maximo ? "" : c.hasta,
    destino: c.destino,
  }));
}

/** La asignación de cada valor numérico según los rangos; `null` = sin mapa. */
export function asignacionDesdeTramos(
  valores: readonly ValorConCasos[],
  tramos: readonly Tramo[],
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const v of valoresNumericos(valores)) {
    const t = tramos.find((x) => x.destino && enRango(Number(v.codigo), x));
    out[v.codigo] = t ? t.destino : null;
  }
  return out;
}

/** Casos que caen en cada rango (por clave); `null` si la data no trae conteos. */
export function casosPorTramo(valores: readonly ValorConCasos[], tramos: readonly Tramo[]): Record<string, number | null> {
  const nums = valoresNumericos(valores);
  const sinConteo = nums.some((v) => v.n === null || v.n === undefined);
  return Object.fromEntries(tramos.map((t) => [
    t.clave,
    sinConteo ? null : nums.filter((v) => enRango(Number(v.codigo), t)).reduce((s, v) => s + (v.n ?? 0), 0),
  ]));
}

/** Valores numéricos que ningún rango cubre (con casos), para decirlo. */
export function numericosSinRango(valores: readonly ValorConCasos[], tramos: readonly Tramo[]): ValorConCasos[] {
  return valoresNumericos(valores).filter((v) => (v.n ?? 1) > 0 && !tramos.some((t) => t.destino && enRango(Number(v.codigo), t)));
}

/** Lo que no entra a rangos: «88 Otro», «99 No sabe»… se asigna uno por uno. */
export function valoresAparte(valores: readonly ValorConCasos[]): ValorConCasos[] {
  return valores.filter((v) => !entraEnRangos(v));
}

/** «18 a 20», «21 o más», «Desde 5», con el texto que la persona escribió. */
export function textoTramo(t: Tramo): string {
  const desde = t.desde.trim();
  const hasta = t.hasta.trim();
  if (!desde) return "";
  if (!hasta) return `${desde} o más`;
  return desde === hasta ? desde : `${desde} a ${hasta}`;
}

/** Lo que impide leer los rangos: superposición o un «hasta» menor. */
export function avisoTramos(tramos: readonly Tramo[]): string {
  const intervalos: [number, number, number][] = [];
  for (const [i, t] of tramos.entries()) {
    const desde = numero(t.desde);
    const hasta = t.hasta.trim() ? numero(t.hasta) : Number.POSITIVE_INFINITY;
    if (t.desde.trim() && desde === null) return `El rango ${i + 1} necesita un número en «desde».`;
    if (t.hasta.trim() && hasta === null) return `El rango ${i + 1} necesita un número en «hasta».`;
    if (desde === null || hasta === null) continue;
    if (hasta < desde) return `En el rango ${i + 1}, «hasta» es menor que «desde».`;
    intervalos.push([desde, hasta, i]);
  }
  const ordenados = [...intervalos].sort((a, b) => a[0] - b[0]);
  for (let k = 1; k < ordenados.length; k++) {
    if (ordenados[k][0] <= ordenados[k - 1][1]) return `Los rangos ${ordenados[k - 1][2] + 1} y ${ordenados[k][2] + 1} se superponen.`;
  }
  return "";
}
