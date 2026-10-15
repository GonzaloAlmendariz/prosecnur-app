// =============================================================================
// canvas/paperSettings.ts — cuándo ofrecer «Ajustes de papel» en el inspector
// =============================================================================
// El bloque antes sólo aparecía si la fila ya traía algún `paper_*` importado,
// así que en un formulario creado en el editor no había dónde declarar una
// subsección o una letra impresa. Ahora está siempre para lo que se imprime
// (preguntas, notas, secciones, repeticiones), plegado salvo que la fila ya
// tenga ajustes.
// =============================================================================

import type { BuilderNode, BuilderNodeKind } from "../types";

const PRINTED_KINDS: ReadonlySet<BuilderNodeKind> = new Set(["question", "note", "section", "repeat"]);

type PaperFields = Pick<
  BuilderNode,
  "kind" | "paperNumber" | "paperLabel" | "paperSkip" | "paperGroup" | "paperSubgroup" | "paperSubletter" | "paperLayout"
>;

export function hasPaperOverrides(node: PaperFields): boolean {
  return [
    node.paperNumber,
    node.paperLabel,
    node.paperSkip,
    node.paperGroup,
    node.paperSubgroup,
    node.paperSubletter,
    node.paperLayout,
  ].some((value) => Boolean(value?.trim()));
}

/** Se ofrece para todo lo que se imprime; un cálculo sólo si ya trae ajustes. */
export function offersPaperSettings(node: PaperFields): boolean {
  return PRINTED_KINDS.has(node.kind) || hasPaperOverrides(node);
}
