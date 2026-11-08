// Las cifras que el inspector escribe junto a sus controles, leídas del detalle del motor (graficosCifras.ts): la base,
// el % de una categoría, la mayor, el antes y el después. Sin React y sin aproximar: lo que no está en el detalle no se
// escribe (devuelve null) y el control queda sin cifra.

import type { BaseDetalle, DetalleCifras, FilaDetalle, ValorDetalle } from "../../../../api/graficosCifras";
import { formatoConteo, formatoDecimal } from "../../../../lib/formatoNumero";

/** Los graficadores que publican detalle (graficos_cifras_detalle.R, `.CIFRAS_DETALLE_GRAFICADORES`). */
export const GRAFICADORES_CON_DETALLE: ReadonlySet<string> = new Set([
  "p_barras_categoricas", "p_barras_agrupadas", "p_barras_apiladas", "p_barras_multiapiladas", "p_barras_divergentes",
]);

export const conDetalle = (graficador: string) => GRAFICADORES_CON_DETALLE.has(graficador);

const norm = (s: string) => s.trim().toLocaleLowerCase("es");

/** Un por ciento como lo rotula la lámina («62%», «61.8%»), con los decimales del detalle. */
export function textoPct(valor: number | null | undefined, decimales: number): string | null {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return null;
  return `${formatoDecimal(valor, decimales)}%`;
}

/** La fila que resume el gráfico: la del total o, si hay una sola, ésa. Con varias barras y sin total, ninguna. */
export function filaPrincipal(det: DetalleCifras | null): FilaDetalle | null {
  if (!det || !det.filas.length) return null;
  return det.filas.find((f) => f.esTotal) ?? (det.filas.length === 1 ? det.filas[0] : null);
}

/** La categoría del detalle que corresponde a alguno de esos rótulos (el completo, el corto, el código). */
export function claveEnDetalle(det: DetalleCifras | null, rotulos: readonly (string | null | undefined)[]): string | null {
  if (!det) return null;
  const buscados = rotulos.filter((r): r is string => !!r && !!r.trim()).map(norm);
  const c = det.categorias.find((x) => buscados.includes(norm(x.clave)) || buscados.includes(norm(x.rotulo)));
  return c?.clave ?? null;
}

export function valorDe(fila: FilaDetalle | null, clave: string | null): ValorDetalle | null {
  if (!fila || !clave) return null;
  return fila.valores.find((v) => v.categoria === clave) ?? null;
}

/** El % rotulado de esa categoría en la fila principal, ya escrito; null si no está. */
export function pctDe(det: DetalleCifras | null, rotulos: readonly (string | null | undefined)[]): string | null {
  if (!det) return null;
  return textoPct(valorDe(filaPrincipal(det), claveEnDetalle(det, rotulos))?.valor, det.redondeo.decimales);
}

/** La categoría con la cifra rotulada más alta de la fila principal (sin especiales); null si no hay. */
export function mayorDe(det: DetalleCifras | null, sinClave: string | null = null): { clave: string; valor: number } | null {
  const fila = filaPrincipal(det);
  if (!det || !fila) return null;
  const especiales = new Set(det.categorias.filter((c) => c.especial).map((c) => c.clave));
  let mejor: { clave: string; valor: number } | null = null;
  for (const v of fila.valores) {
    if (v.valor === null || especiales.has(v.categoria) || v.categoria === sinClave) continue;
    if (!mejor || v.valor > mejor.valor) mejor = { clave: v.categoria, valor: v.valor };
  }
  return mejor;
}

/** El n de una base: los casos o, si no los declara, el ponderado. */
export function nDeBase(base: BaseDetalle | null | undefined): number | null {
  if (!base) return null;
  return base.nCasos ?? base.nPonderado;
}

/** «A → B», o sólo «B» si no cambia; null si falta el después. */
export function antesDespues(antes: string | null, despues: string | null): string | null {
  if (!despues) return null;
  return antes && antes !== despues ? `${antes} → ${despues}` : despues;
}

/** «Base 412 → 380», «Base 412»; null sin base. */
export function textoBase(antes: DetalleCifras | null, despues: DetalleCifras | null): string | null {
  const n = (d: DetalleCifras | null) => {
    const v = nDeBase(d?.base);
    return v === null ? null : formatoConteo(v);
  };
  const t = antesDespues(n(antes), n(despues));
  return t ? `Base ${t}` : null;
}
