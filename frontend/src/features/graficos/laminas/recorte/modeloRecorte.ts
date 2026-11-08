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

/** El rótulo de las filas que van a Otros (R7-10), en esta lista y en la de Orden. */
export const EN_OTROS = "en Otros";

export type FilaVista =
  | { tipo: "categoria"; clave: string; valor: number | null; fuera: boolean; enOtros: boolean }
  | { tipo: "otros"; clave: string; valor: number | null };

/**
 * R7-10: las filas como se ven. Con Otros, Otros es una fila más SOBRE la línea (el motor la cuenta entre las N), así
 * que N es el número de filas visibles; debajo, las que van a Otros, marcadas. Sin Otros, la lista tal cual con lo que
 * queda fuera. `corte` es la fila sobre la que va la línea.
 */
export function filasVista(r: Recorte): { filas: FilaVista[]; corte: number } {
  if (!r.otros) {
    return { filas: r.filas.map((f) => ({ tipo: "categoria", ...f, enOtros: false })), corte: r.corte };
  }
  const dentro = r.filas.filter((f) => !f.fuera).map((f): FilaVista => ({ tipo: "categoria", ...f, enOtros: false }));
  const fuera = r.filas.filter((f) => f.fuera).map((f): FilaVista => ({ tipo: "categoria", ...f, enOtros: true }));
  return { filas: [...dentro, { tipo: "otros", clave: r.otros.clave, valor: r.otros.valor }, ...fuera], corte: dentro.length + 1 };
}

/**
 * Las categorías de la lista que el gráfico junta en Otros, por su clave en `categorias`: las que no salen en el detalle
 * cuando el detalle trae una categoría que no es de la lista (Otros). Las excluidas y las vacías no cuentan.
 */
export function clavesEnOtros(
  det: DetalleCifras | null, categorias: readonly { clave: string; rotulos: readonly string[] }[], fueraDeCuenta: ReadonlySet<string>,
): Set<string> {
  const fila = filaPrincipal(det);
  if (!fila) return new Set();
  const norm = (t: string) => t.trim().toLocaleLowerCase("es");
  const enDetalle = new Set(fila.valores.map((v) => norm(v.categoria)));
  const deLista = new Set(categorias.flatMap((c) => c.rotulos.map(norm)));
  if (![...enDetalle].some((k) => !deLista.has(k))) return new Set();
  return new Set(categorias
    .filter((c) => !fueraDeCuenta.has(c.clave) && !c.rotulos.some((r) => enDetalle.has(norm(r))))
    .map((c) => c.clave));
}

/** «Fuera: Otro, No sabe (7%)»; null si nada queda fuera o si el resto va a Otros (Otros es una fila, R7-10). */
export function textoFuera(r: Recorte | null): string | null {
  if (!r) return null;
  const fuera = r.filas.filter((f) => f.fuera);
  if (!fuera.length || r.otros) return null;
  const nombres = fuera.slice(0, NOMBRES_FUERA).map((f) => f.clave).join(", ");
  const resto = fuera.length > NOMBRES_FUERA ? ` y ${fuera.length - NOMBRES_FUERA} más` : "";
  const suma = fuera.reduce((s, f) => s + (f.valor ?? 0), 0);
  const pct = fuera.every((f) => f.valor !== null) ? textoPct(suma, r.decimales) : null;
  return `Fuera: ${nombres}${resto}${pct ? ` (${pct})` : ""}`;
}
