// Acciones nuevas de la ficha (C20) sobre el borrador del workbook: duplicar, mover a otra sección y convertir una
// sección en repetición. La lógica vive en state/accionesConstructor.ts (pura, con Vitest); aquí sólo se cablea con
// `updateWorkbook` y la selección, para que la página no crezca.

import { applyRowMove } from "../../outline/outlineUtils";
import { alternarRepeticion, duplicarFila, planMoverASeccion } from "../../state/accionesConstructor";
import type { BuilderSelection, BuilderStructure, XlsformEditorWorkbook } from "../../types";

export function accionesNuevasFicha({ structure, workbook, selection, updateWorkbook, seleccionar }: {
  structure: BuilderStructure | null;
  workbook: XlsformEditorWorkbook | null;
  selection: BuilderSelection | null;
  updateWorkbook: (mutar: (draft: XlsformEditorWorkbook) => void) => void;
  seleccionar: (s: BuilderSelection) => void;
}) {
  const fila = selection?.kind === "survey" ? selection.rowIndex : null;
  return {
    duplicar: () => {
      if (!structure || fila == null) return;
      let nueva: number | null = null;
      updateWorkbook((draft) => { nueva = duplicarFila(draft, structure, fila).rowIndex; });
      if (nueva != null) seleccionar({ kind: "survey", rowIndex: nueva });
    },
    moverASeccion: (seccionFila: number | null) => {
      if (!structure || !workbook || fila == null) return;
      const plan = planMoverASeccion(structure, fila, seccionFila, workbook.survey.rows.length);
      if (!plan) return;
      updateWorkbook((draft) => applyRowMove(draft.survey, plan));
      seleccionar({ kind: "survey", rowIndex: plan.newStart });
    },
    alternarRepeticion: () => {
      if (!structure || fila == null) return;
      updateWorkbook((draft) => { alternarRepeticion(draft, structure, fila); });
    },
  };
}
