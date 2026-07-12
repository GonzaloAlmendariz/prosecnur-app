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

/**
 * Calcula el plan para mover UNA fila de cierre de sección (`end_group` /
 * `end_repeat`) a una nueva posición. A diferencia de `computeRowMove`, aquí
 * NO se mueve un span: se reubica la sola fila de cierre, lo que cambia qué
 * preguntas quedan dentro de la sección. Restricciones:
 *   - El cierre no puede cruzar ANTES de su `begin` (mínimo: begin + 1).
 *   - No puede caer estrictamente dentro de una sección/repeat ANIDADA en
 *     esta (partiría el bloque hijo).
 *   - No puede salir del alcance de la sección padre (si la hay).
 * Devuelve un `RowMovePlan` de `count: 1`, o null si el movimiento es
 * inválido o no-op.
 */
export function computeEndMove(
  structure: BuilderStructure | null,
  endRow: number,
  toRow: number,
  before: boolean,
): RowMovePlan | null {
  if (!structure) return null;
  if (endRow === toRow) return null;

  // Sección dueña de este cierre + su padre.
  let beginRow: number | null = null;
  let parentId: string | null = null;
  for (const meta of structure.sections.values()) {
    if (meta.endRowIndex === endRow && meta.rowIndex != null) {
      beginRow = meta.rowIndex;
      parentId = meta.parentId;
      break;
    }
  }
  if (beginRow == null) return null;

  // Límite superior: el fin de la sección padre (o el fin del survey).
  const parentMeta = parentId ? structure.sections.get(parentId) ?? null : null;
  const upperBound =
    parentMeta && parentMeta.kind !== "root" && parentMeta.endRowIndex != null
      ? parentMeta.endRowIndex // el cierre debe quedar ANTES del cierre del padre
      : Number.POSITIVE_INFINITY;

  // Índice de inserción crudo (en el array original).
  const rawInsertAt = before ? toRow : toRow + 1;

  // Rechazar si cae dentro de una sección/repeat ANIDADA dentro de esta
  // (entre begin y endRow). Partir un bloque hijo dejaría el XLSForm roto.
  for (const [start, span] of structure.spans.entries()) {
    if (start <= beginRow) continue; // no es hijo (está en/antes del begin)
    if (start >= endRow) continue; // fuera del rango actual de la sección
    // `span` es un bloque hijo [start..end]; insertar estrictamente adentro
    // (start < pos <= end) lo partiría.
    if (rawInsertAt > start && rawInsertAt <= span.end) return null;
  }

  // Ajuste por la extracción de la fila de cierre (1 fila).
  let adjustedInsertAt = rawInsertAt;
  if (rawInsertAt > endRow) adjustedInsertAt -= 1;

  // Restricción dura: quedar estrictamente DESPUÉS de su begin.
  if (adjustedInsertAt <= beginRow) return null;
  // Y dentro del alcance del padre (tras el ajuste, el cierre del padre
  // también se corre -1 si estaba después de endRow).
  const adjustedUpper =
    upperBound === Number.POSITIVE_INFINITY
      ? upperBound
      : upperBound > endRow
        ? upperBound - 1
        : upperBound;
  if (adjustedInsertAt > adjustedUpper) return null;

  // No-op: reinsertar donde ya estaba.
  if (adjustedInsertAt === endRow) return null;

  return {
    fromStart: endRow,
    count: 1,
    insertAt: adjustedInsertAt,
    newStart: adjustedInsertAt,
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
