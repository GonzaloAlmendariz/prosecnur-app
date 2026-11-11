// Un solo dueño para los enlaces que llevan a una pestaña de Carga (ADR 0142).
// Codificación, Segmentos y el recorrido de la serie los toman de aquí (o de los
// módulos que los reexportan) para que una clave renombrada cambie en un sitio.

import { conNivel, serializarDireccion } from "../../lib/navegacion/direccion";

/** Pestaña Variables con la base elegida: columnas propias, calculadas y la marca de ya codificada. */
export function hrefVariablesBase(base: string): string {
  return `/carga${conNivel("?pestana=variables", "foco", base || null)}`;
}

/**
 * Dónde se declara el motivo de las preguntas retiradas: el bloque de origen
 * externo de Carga › Revisión, con esa base como base revisada.
 */
export function hrefDeclararRetiradas(base: string): string {
  return `/carga${conNivel("?pestana=revision", "foco", base || null)}`;
}

/** Bases del estudio, desde el recorrido de la serie. */
export const DIRECCION_BASES_SERIE = serializarDireccion({
  modulo: "procesamiento",
  seccion: "carga",
  pestana: "bases",
});
