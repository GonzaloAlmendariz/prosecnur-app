// =============================================================================
// outline/outlineUtils.ts — helpers para el outline drag-drop
// =============================================================================
// Funciones puras que apoyan al SurveyOutline:
//   - `computeRowMove(structure, fromRow, toRow)`: dado un drag de la fila X
//     hacia la fila Y, calcula el `(spliceStart, deleteCount, insertAt)` para
//     mutar `survey.rows` respetando el bloque atómico de begin/end.
//   - `validateDrop(structure, fromRow, toRow)`: ¿se permite ese movimiento?
//     Prohibido: caer sobre sí mismo, dentro de un bloque que es descendiente,
//     sobre un end_* sin begin coincidente.
//   - `applyRowMove(survey, plan)`: muta in-place el survey con el plan.
//
// El monolito ya tiene `moveSelection("up"|"down")` que opera sobre el
// vecino inmediato; esto generaliza para cualquier (from, to).
// =============================================================================

import type { BuilderStructure, XlsformEditorSheet } from "../types";

export type RowMovePlan = {
  /** Inicio del rango fuente (índice en survey.rows). */
  fromStart: number;
  /** Cantidad de filas a mover (incluye begin + contenido + end si aplica). */
  count: number;
  /** Índice destino donde insertar el bloque DESPUÉS de extraer la fuente. */
  insertAt: number;
  /** Índice donde quedará el begin del bloque tras la operación (para
   *  reposicionar la selección). */
  newStart: number;
};

/**
 * Calcula el plan de movimiento. Devuelve null si el movimiento no aplica
 * (no-op, caída sobre sí mismo, drop inválido).
 */
export function computeRowMove(
  structure: BuilderStructure | null,
  fromRow: number,
  toRow: number,
  /** Si `before=true`, insertamos justo antes de toRow; si false, después. */
  before: boolean,
): RowMovePlan | null {
  if (!structure) return null;
  if (fromRow === toRow) return null;
  const fromSpan = structure.spans.get(fromRow);
  if (!fromSpan) return null;

  // El target debe ser una fila top-level del outline (ya sea pregunta
  // o begin_*). Si es end_*, lo trasladamos al begin correspondiente.
  let targetTopRow = toRow;
  const targetIsTracked = structure.byRow.has(toRow);
  if (!targetIsTracked) {
    // Buscar si toRow cae dentro de un span — tomar el begin de ese span.
    for (const [start, span] of structure.spans.entries()) {
      if (toRow > span.start && toRow <= span.end) {
        targetTopRow = start;
        break;
      }
    }
  }

  const targetSpan = structure.spans.get(targetTopRow);
  if (!targetSpan) return null;

  // Prohibido: el target cae DENTRO del span fuente (ciclo).
  if (targetTopRow >= fromSpan.start && targetTopRow <= fromSpan.end) {
    return null;
  }

  const count = fromSpan.end - fromSpan.start + 1;

  // Calcular el insertAt. Pensamos en términos del array original:
  // el "before" puro es: insertar antes de targetSpan.start; "after" puro es:
  // insertar después de targetSpan.end (es decir, en targetSpan.end + 1).
  let rawInsertAt: number;
  if (before) {
    rawInsertAt = targetSpan.start;
  } else {
    rawInsertAt = targetSpan.end + 1;
  }

  // Si el rawInsertAt cae dentro o después del span fuente, hay que ajustar:
  // tras splice (eliminar count filas desde fromSpan.start), los índices
  // posteriores se desplazan -count.
  let adjustedInsertAt = rawInsertAt;
  if (rawInsertAt > fromSpan.start) {
    adjustedInsertAt = rawInsertAt - count;
  }
  // Si el insertAt termina dentro del rango original eliminado (caso de
  // drop sobre target == fromSpan), es no-op.
  if (adjustedInsertAt < 0) return null;

  // newStart: posición final del begin tras la operación.
  const newStart = adjustedInsertAt;

  // No-op si el rango se reinserta donde estaba.
  if (newStart === fromSpan.start) return null;

  return {
    fromStart: fromSpan.start,
    count,
    insertAt: adjustedInsertAt,
    newStart,
  };
}

/** Valida si un drop (from→to) es legal. Reusa computeRowMove para chequear. */
export function validateDrop(
  structure: BuilderStructure | null,
  fromRow: number,
  toRow: number,
  before: boolean,
): boolean {
  return computeRowMove(structure, fromRow, toRow, before) != null;
}

/** Muta el survey aplicando el plan. El caller pasa una copia editable. */
export function applyRowMove(survey: XlsformEditorSheet, plan: RowMovePlan): void {
  const block = survey.rows.slice(plan.fromStart, plan.fromStart + plan.count);
  survey.rows.splice(plan.fromStart, plan.count);
  survey.rows.splice(plan.insertAt, 0, ...block);
}
