// =============================================================================
// outline/outlineUtils.ts — plan de movimiento de filas del survey
// =============================================================================
// `RowMovePlan` describe un bloque (begin + contenido + end, o una sola fila) que se extrae y se reinserta;
// `applyRowMove` lo aplica. El plan lo arma el modelo de la Estructura (`planMoverA`, modeloEstructura.ts). El
// cálculo viejo por par de filas (computeRowMove / computeEndMove / validateDrop) se fue con el arrastre anterior.
// =============================================================================

import type { XlsformEditorSheet } from "../types";

export type RowMovePlan = {
  /** Inicio del rango fuente (índice en survey.rows). */
  fromStart: number;
  /** Cantidad de filas a mover (incluye begin + contenido + end si aplica). */
  count: number;
  /** Índice destino donde insertar el bloque DESPUÉS de extraer la fuente. */
  insertAt: number;
  /** Índice donde quedará el begin del bloque tras la operación (para reposicionar la selección). */
  newStart: number;
};

/** Muta el survey aplicando el plan. El caller pasa una copia editable. */
export function applyRowMove(survey: XlsformEditorSheet, plan: RowMovePlan): void {
  const block = survey.rows.slice(plan.fromStart, plan.fromStart + plan.count);
  survey.rows.splice(plan.fromStart, plan.count);
  survey.rows.splice(plan.insertAt, 0, ...block);
}
