// «Máximo de categorías» con su línea de corte (oleada I2, ítem 5), sin React. Dos variantes del gráfico van en un lote:
//   - «todas»: sin recorte (el máximo en su tope), la lista completa en el orden de la lámina con el % de cada una;
//   - «vista»: con el máximo que se ve (el guardado o el que se está arrastrando).
// Lo que está en «todas» y no en «vista» queda fuera del gráfico; lo que está en «vista» y no en «todas» es la categoría
// que agrupa el resto («Otros»). Así se dice lo que el motor hace (cuántas conserva con Otros, en qué orden), sin
// recalcularlo aquí.

import type { DetalleCifras } from "../../../../api/graficosCifras";
import { filaPrincipal, textoPct } from "../cifrasInspector/modeloCifras";
import type { VarianteDetalle } from "../cifrasInspector/useDetalleCifras";

type Args = Readonly<Record<string, unknown>>;

/** Los args de recorte que tienen línea de corte (sólo los graficadores con detalle la dibujan). */
export const ARGS_RECORTE: ReadonlySet<string> = new Set(["max_categorias", "top_k", "top_n"]);
/** El máximo «sin recorte» que se pide para ver la lista entera. */
export const TOPE_SIN_RECORTE = 999;
/** Cuántos nombres se escriben en «Fuera: …» antes de «y N más». */
const NOMBRES_FUERA = 4;

export const TODAS = "todas";
export const VISTA = "vista";

export function variantesRecorte(args: Args, argName: string, borrador: number | null): VarianteDetalle[] {
  return [
    { clave: TODAS, args: { ...args, [argName]: TOPE_SIN_RECORTE } },
    { clave: VISTA, args: borrador === null ? args : { ...args, [argName]: borrador } },
  ];
}

export type FilaRecorte = { clave: string; valor: number | null; fuera: boolean };
export type Recorte = { filas: FilaRecorte[]; otros: { clave: string; valor: number | null } | null; corte: number; decimales: number };

/** La lista completa con lo que queda fuera; null sin la fila principal de «todas». */
export function recorteDe(todas: DetalleCifras | null, vista: DetalleCifras | null): Recorte | null {
  const fTodas = filaPrincipal(todas);
  if (!todas || !fTodas) return null;
  const fVista = filaPrincipal(vista);
  const enVista = new Set(fVista?.valores.map((v) => v.categoria) ?? []);
  const enTodas = new Set(fTodas.valores.map((v) => v.categoria));
  const filas = fTodas.valores.map((v) => ({ clave: v.categoria, valor: v.valor, fuera: !!fVista && !enVista.has(v.categoria) }));
  const otro = fVista?.valores.find((v) => !enTodas.has(v.categoria));
  const primera = filas.findIndex((f) => f.fuera);
  return { filas, otros: otro ? { clave: otro.categoria, valor: otro.valor } : null, corte: primera < 0 ? filas.length : primera, decimales: todas.redondeo.decimales };
}

/** «Fuera: Otro, No sabe (7%)», o con Otros «Otros = 7%»; null si nada queda fuera. */
export function textoFuera(r: Recorte | null): string | null {
  if (!r) return null;
  const fuera = r.filas.filter((f) => f.fuera);
  if (!fuera.length) return null;
  if (r.otros) {
    const pct = textoPct(r.otros.valor, r.decimales);
    return pct ? `${r.otros.clave} = ${pct}` : null;
  }
  const nombres = fuera.slice(0, NOMBRES_FUERA).map((f) => f.clave).join(", ");
  const resto = fuera.length > NOMBRES_FUERA ? ` y ${fuera.length - NOMBRES_FUERA} más` : "";
  const suma = fuera.reduce((s, f) => s + (f.valor ?? 0), 0);
  const pct = fuera.every((f) => f.valor !== null) ? textoPct(suma, r.decimales) : null;
  return `Fuera: ${nombres}${resto}${pct ? ` (${pct})` : ""}`;
}
