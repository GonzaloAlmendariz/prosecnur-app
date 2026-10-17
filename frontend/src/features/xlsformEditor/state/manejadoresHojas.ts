// Manejadores del Editor XLSForm (celdas, filas y columnas en bruto). Extraídos de XlsformEditorPage.tsx
// (refactor puro, revamp 2026-10-16): la página los crea con su `updateWorkbook` y su canal de avisos.

import type { XlsformEditorWorkbook } from "../types";
import { PAPER_COLUMNS } from "../types";
import {
  deleteRow,
  ensureColumn,
  getCell,
  makeSheet,
  replaceVarReferences,
  setCell,
  SURVEY_COLUMNS_WITH_VAR_REFS,
} from "../parsing/sheetUtils";

export type EditableSheetKey = "survey" | "choices" | "settings" | "paper";

export function editableSheet(draft: XlsformEditorWorkbook, sheetName: EditableSheetKey) {
  if (sheetName === "paper" && !draft.paper) draft.paper = makeSheet("paper", PAPER_COLUMNS);
  return draft[sheetName]!;
}

const NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function crearManejadoresHojas(
  updateWorkbook: (mutar: (draft: XlsformEditorWorkbook) => void) => void,
  avisarReferencias: (cambiadas: number, anterior: string, nuevo: string) => void,
) {
  return {
    sheetsUpdateCell(sheetName: EditableSheetKey, rowIndex: number, columnName: string, value: string) {
      updateWorkbook((draft) => {
        // Si es la columna `name` de survey, también propagamos referencias (mismo refactor que en
        // updateSurveyField). Sheets no debería ser un escape hatch silencioso para romper referencias.
        if (sheetName === "survey" && columnName === "name") {
          const oldName = getCell(draft.survey, rowIndex, "name");
          const newName = value;
          if (oldName && newName && oldName !== newName && NAME_RE.test(oldName) && NAME_RE.test(newName)) {
            const cellsChanged = replaceVarReferences(draft.survey, oldName, newName, [...SURVEY_COLUMNS_WITH_VAR_REFS]);
            if (cellsChanged > 0) queueMicrotask(() => avisarReferencias(cellsChanged, oldName, newName));
          }
        }
        setCell(editableSheet(draft, sheetName), rowIndex, columnName, value);
      });
    },
    sheetsAddRow(sheetName: EditableSheetKey) {
      updateWorkbook((draft) => {
        const sheet = editableSheet(draft, sheetName);
        sheet.rows.push(new Array(sheet.columns.length).fill(""));
      });
    },
    sheetsDeleteRow(sheetName: EditableSheetKey, rowIndex: number) {
      updateWorkbook((draft) => {
        deleteRow(editableSheet(draft, sheetName), rowIndex);
      });
    },
    sheetsMoveRow(sheetName: EditableSheetKey, rowIndex: number, direction: "up" | "down") {
      updateWorkbook((draft) => {
        const sheet = editableSheet(draft, sheetName);
        const target = direction === "up" ? rowIndex - 1 : rowIndex + 1;
        if (target < 0 || target >= sheet.rows.length) return;
        const next = [...sheet.rows];
        [next[rowIndex], next[target]] = [next[target]!, next[rowIndex]!];
        sheet.rows = next;
      });
    },
    sheetsAddColumn(sheetName: EditableSheetKey, columnName: string) {
      updateWorkbook((draft) => {
        ensureColumn(editableSheet(draft, sheetName), columnName);
      });
    },
  };
}
