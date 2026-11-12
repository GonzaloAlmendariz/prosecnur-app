// Analítica › Libro de códigos con la forma del prototipo (panel "Libro de
// códigos" de "Analítica, Entrega"): qué variables entran al libro, agrupadas
// por sección, y sus códigos dichos en una línea. Sale de la misma lectura que
// Datos (`/api/analitica/data-review`) con las etiquetas ya confirmadas; no es
// el archivo generado: el motor no publica una vista previa del libro.

import type { DataReviewVariable } from "../../../api/analitica";
import { formatoConteo } from "../../../lib/formatoNumero";
import type { DataReviewSectionGroup } from "../datos/borradorDeEtiquetas";

export type SeccionDelLibro = { id: string; nombre: string; variables: DataReviewVariable[] };

/** Las secciones con solo las variables que entran; una sección sin ninguna no aparece. */
export function seccionesDelLibro(
  grupos: readonly DataReviewSectionGroup[],
  entra: (variable: DataReviewVariable, grupo: DataReviewSectionGroup) => boolean,
): SeccionDelLibro[] {
  return grupos
    .map((g) => ({ id: g.id, nombre: g.name, variables: g.variables.filter((v) => entra(v, g)) }))
    .filter((s) => s.variables.length > 0);
}

/**
 * Los códigos de una pregunta en una línea, en el orden en que llegan: con
 * tres o menos, todos ("1 Sí, 2 No, 98 No sabe"); con más, el primero y el
 * último ("1 Muy insatisfecho a 5 Muy satisfecho"). Sin opciones, vacío.
 */
export function codigosEnTexto(
  opciones: readonly { code: string }[],
  etiquetaDe: (code: string) => string,
): string {
  if (opciones.length === 0) return "";
  const uno = (o: { code: string }) => `${o.code} ${etiquetaDe(o.code)}`.trim();
  if (opciones.length <= 3) return opciones.map(uno).join(", ");
  return `${uno(opciones[0])} a ${uno(opciones[opciones.length - 1])}`;
}

/** "58 variables en 8 secciones", con su concordancia. */
export function resumenDelLibro(secciones: readonly SeccionDelLibro[]): string {
  const variables = secciones.reduce((suma, s) => suma + s.variables.length, 0);
  return `${formatoConteo(variables)} ${variables === 1 ? "variable" : "variables"} en ${formatoConteo(secciones.length)} ${secciones.length === 1 ? "sección" : "secciones"}`;
}
