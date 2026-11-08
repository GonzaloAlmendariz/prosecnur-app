// La lista de «Orden» siempre a la vista (ítem 3 de la oleada del inspector, 2026-11-08): en cualquier modo se ve el orden
// en que se dibujará, y al pasar el cursor por otro modo, el que dibujaría ese. Reproduce `.goc_orden_codigos`
// (api/R/graficos_orden_categorias.R) con lo que `/categorias` ya trae (`datos.orden` sin invertir, `n` de cada una):
//  - frecuencia: de mayor a menor n; invertida, de menor a mayor (empates por orden del instrumento);
//  - instrumento y recetario: su orden, invertido de punta a punta si se pide;
//  - siempre los residuales al final;
//  - personalizado: `ordenMostrado` (la parte listada invertida, el resto detrás).
// Puro.

import type { GraficosCategorias } from "../../../api/graficos";
import { ordenHeredado, ordenMostrado, tieneOrdenHeredado, type ModoOrden, type OrdenCategorias } from "./ordenCategorias";

export type ModoFijo = Exclude<ModoOrden, "personalizado">;
export const MODOS_FIJOS: readonly ModoFijo[] = ["recetario", "frecuencia", "instrumento"];

const alFinal = (codigos: readonly string[], datos: GraficosCategorias): string[] => {
  const residual = new Map(datos.categorias.map((c) => [c.codigo, c.residual]));
  return [...codigos.filter((k) => !residual.get(k)), ...codigos.filter((k) => residual.get(k))];
};

/** Los códigos de `base` que existen, seguidos de los que falten en orden del instrumento. */
function completa(base: readonly string[], datos: GraficosCategorias): string[] {
  const existe = new Set(datos.categorias.map((c) => c.codigo));
  const dentro = base.filter((k) => existe.has(k));
  const vistos = new Set(dentro);
  return [...dentro, ...datos.categorias.map((c) => c.codigo).filter((k) => !vistos.has(k))];
}

function porFrecuencia(datos: GraficosCategorias, invertir: boolean): string[] {
  if (!invertir && datos.orden.frecuencia.length) return alFinal(completa(datos.orden.frecuencia, datos), datos);
  const conIndice = datos.categorias.map((c, i) => ({ codigo: c.codigo, n: Number.isFinite(c.n) ? c.n : 0, i }));
  conIndice.sort((a, b) => (invertir ? a.n - b.n : b.n - a.n) || a.i - b.i);
  return alFinal(conIndice.map((c) => c.codigo), datos);
}

/** El orden que dibuja un modo fijo, con o sin invertir. */
export function ordenDelModo(modo: ModoFijo, datos: GraficosCategorias, invertir: boolean): string[] {
  // El recetario es uno de los otros dos modos (`modo_recetario`); sin saber cuál, su lista tal cual.
  const efectivo = modo === "recetario" && datos.modo_recetario && datos.modo_recetario !== "personalizado" ? datos.modo_recetario : modo;
  if (efectivo === "frecuencia") return porFrecuencia(datos, invertir);
  const base = completa(efectivo === "instrumento" ? datos.orden.instrumento : datos.orden.recetario, datos);
  return alFinal(invertir ? [...base].reverse() : base, datos);
}

/** Un orden elegido con los controles anteriores, dicho como modo fijo; `null` si es manual o desconocido. */
const MODO_HEREDADO: Readonly<Record<string, { modo: ModoFijo; invertir: boolean }>> = {
  "De mayor a menor": { modo: "frecuencia", invertir: false },
  "De menor a mayor": { modo: "frecuencia", invertir: true },
  "Como en el instrumento": { modo: "instrumento", invertir: false },
};

/**
 * La lista que se ve: con `vista` (el modo bajo el cursor), la de ese modo; si no, la del modo guardado. Con un orden
 * heredado en «Recetario» manda ese orden; si es manual no hay cómo reproducirlo y la respuesta es `null` (la tarjeta
 * dice que trae un orden elegido antes).
 */
export function ordenVisible(orden: OrdenCategorias, datos: GraficosCategorias, args: Readonly<Record<string, unknown>>, vista: ModoFijo | null = null): string[] | null {
  const modo = vista ?? orden.modo;
  if (modo === "personalizado") return ordenMostrado(orden.lista, datos, orden.invertir);
  if (modo === "recetario" && tieneOrdenHeredado(args)) {
    const h = MODO_HEREDADO[ordenHeredado(args) ?? ""];
    return h ? ordenDelModo(h.modo, datos, h.invertir) : null;
  }
  return ordenDelModo(modo, datos, orden.invertir);
}
