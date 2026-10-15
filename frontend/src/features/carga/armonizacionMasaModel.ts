/**
 * Asignar en masa dentro del mapa de una base (F2 de la prueba real de la
 * matriz HSyVbG): agrupar 26 departamentos en «Provincias» eran 26 selectores
 * por base. Se marcan los códigos y se llevan juntos a una categoría.
 *
 * Lógica pura: qué está marcado, qué se puede marcar y la acción del reducer
 * que lo aplica. El componente sólo pinta.
 */

import type { AccionArmonizacion, FilaMapa } from "./armonizacionModel";

/** Valor del selector de la barra que significa «quitar el destino». */
export const DESTINO_SIN_MAPA = "__sin_mapa__";

export function alternarMarca(
  marcados: ReadonlySet<string>,
  codigo: string,
  marcado: boolean,
): Set<string> {
  const out = new Set(marcados);
  if (marcado) out.add(codigo);
  else out.delete(codigo);
  return out;
}

/** Los marcados que siguen en la tabla, en el orden de la tabla. */
export function marcadosVigentes(marcados: ReadonlySet<string>, filas: readonly FilaMapa[]): string[] {
  return filas.filter((f) => marcados.has(f.codigo)).map((f) => f.codigo);
}

export function codigosSinMapa(filas: readonly FilaMapa[]): string[] {
  return filas.filter((f) => f.sinMapa).map((f) => f.codigo);
}

/** «Marcar todos los sin mapa» suma a lo marcado; no desmarca lo que ya estaba. */
export function marcarSinMapa(marcados: ReadonlySet<string>, filas: readonly FilaMapa[]): Set<string> {
  return new Set([...marcados, ...codigosSinMapa(filas)]);
}

export function textoMarcados(n: number): string {
  if (n === 0) return "Ningún código marcado";
  return n === 1 ? "1 marcado" : `${n} marcados`;
}

/**
 * La acción que lleva los marcados al destino elegido. `null` si no hay nada
 * que asignar: sin marcados o sin destino elegido.
 */
export function accionAsignarMarcados(
  base: string,
  marcados: readonly string[],
  eleccion: string,
  conocidos: readonly string[],
): AccionArmonizacion | null {
  if (marcados.length === 0 || !eleccion) return null;
  return {
    tipo: "destinos",
    base,
    codigos: marcados,
    destino: eleccion === DESTINO_SIN_MAPA ? null : eleccion,
    conocidos,
  };
}
