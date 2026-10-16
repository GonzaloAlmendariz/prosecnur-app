// =============================================================================
// resumen/preguntasDeSeccion.ts — la sección desplegada de la tabla de «Resumen»
// =============================================================================
// El clic en una fila de la tabla de secciones la despliega ahí mismo con sus
// preguntas (ítem 50): número de corrido, enunciado corto, tipo y minutos, con
// la regla de duración de `modeloResumen.ts`. Nada de esto navega; cada pregunta
// lleva su «Editar» discreto, la única salida al Constructor.
// =============================================================================

import type { BuilderStructure, CatalogSummary } from "../types";
import { stripMarkdown } from "../helpers/markdown";
import { typeLabel } from "../parsing/parseType";
import { segundosDePregunta, type FilaSeccion } from "./modeloResumen";

export type PreguntaDeSeccion = {
  rowIndex: number;
  name: string;
  /** Numeración de corrido de las preguntas del formulario, como en la Vista del cuestionario. */
  numero: number;
  enunciado: string;
  tipo: string;
  segundos: number;
};

const LARGO_ENUNCIADO = 90;

export function enunciadoCorto(texto: string, largo = LARGO_ENUNCIADO): string {
  const limpio = stripMarkdown(texto).replace(/\s+/g, " ").trim();
  return limpio.length > largo ? `${limpio.slice(0, largo - 1).trimEnd()}…` : limpio;
}

/** La clave de una fila en la dirección (`foco`): el `name` del grupo; la raíz no tiene, va por su id. */
export function claveSeccion(fila: Pick<FilaSeccion, "id" | "name">): string {
  return fila.name || fila.id;
}

export function preguntasDeSeccion(
  structure: BuilderStructure | null,
  catalogos: readonly CatalogSummary[],
  seccionId: string,
): PreguntaDeSeccion[] {
  const tamanoLista = new Map(catalogos.map((c) => [c.listName, c.items.length]));
  const filas: PreguntaDeSeccion[] = [];
  let numero = 0;
  for (const nodo of structure?.outline ?? []) {
    if (nodo.kind !== "question") continue;
    numero += 1;
    if (nodo.sectionId !== seccionId) continue;
    filas.push({
      rowIndex: nodo.rowIndex,
      name: nodo.name,
      numero,
      enunciado: enunciadoCorto(nodo.label || nodo.name),
      tipo: typeLabel(nodo.typeInfo.base),
      segundos: segundosDePregunta(nodo, tamanoLista),
    });
  }
  return filas;
}
