// Disposición de las opciones en «Probar formulario» (E4 editor-conjoint, 2026-11-06): la plataforma pinta una
// escala `likert` en fila, con el rótulo bajo cada punto, y `columns` en varias columnas. La decisión es la misma
// que usa la vista previa del Constructor (`previewKindForType`), para que las dos vistas no se contradigan.

import { previewKindForType } from "../../canvas/previewInputs";
import type { BuilderNode } from "../../types";

export type DisposicionOpciones = "lista" | "escala" | "columnas";

export function disposicionOpciones(node: Pick<BuilderNode, "typeInfo" | "appearance">): DisposicionOpciones {
  const kind = previewKindForType(node);
  if (kind === "select-likert") return "escala";
  if (kind === "select-columns") return "columnas";
  return "lista";
}

/** Clase del contenedor de opciones para cada disposición. */
export const CLASE_DISPOSICION: Record<DisposicionOpciones, string> = {
  lista: "",
  escala: " is-escala",
  columnas: " is-columnas",
};
