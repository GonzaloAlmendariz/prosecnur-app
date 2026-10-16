// Los códigos de una variable de origen para los editores que la mapean a una
// escala (segmentos de cruce, ADR 0107; «Recodificar una pregunta», ADR 0106).
// Lógica pura: une lo que la data trae (`GET /api/carga/codigos-observados`)
// con la lista de respuestas del instrumento.

import type { CodigosObservados } from "../../api/codigosObservados";

/** Un código del origen, con sus casos si se leyeron de la data. */
export type CodigoDeOrigen = { codigo: string; etiqueta: string; n: number | null };

const ENTERO = /^-?\d+$/;

/** Enteros en orden numérico; cualquier otra lista conserva su orden. */
export function ordenarCodigos<T extends { codigo: string }>(codigos: readonly T[]): T[] {
  return codigos.every((c) => ENTERO.test(c.codigo))
    ? [...codigos].sort((a, b) => Number(a.codigo) - Number(b.codigo))
    : [...codigos];
}

/**
 * Los valores que la data trae, con sus casos y la etiqueta del instrumento
 * cuando la data no trae una. Las opciones del instrumento que nadie eligió
 * se suman con 0 casos: también hay que decidir a dónde van. `null` si no hay
 * observados que usar (no llegaron, o la variable es de texto).
 */
export function codigosConObservados(
  opciones: readonly { codigo: string; etiqueta: string }[],
  observados: CodigosObservados | null,
): CodigoDeOrigen[] | null {
  if (!observados || observados.tipo === "texto") return null;
  const etiquetas = new Map(opciones.map((o) => [o.codigo, o.etiqueta]));
  const out = new Map<string, CodigoDeOrigen>();
  for (const c of observados.codigos) {
    out.set(c.codigo, { codigo: c.codigo, etiqueta: c.etiqueta || etiquetas.get(c.codigo) || "", n: c.n });
  }
  for (const o of opciones) if (!out.has(o.codigo)) out.set(o.codigo, { codigo: o.codigo, etiqueta: o.etiqueta, n: 0 });
  return ordenarCodigos([...out.values()]);
}
