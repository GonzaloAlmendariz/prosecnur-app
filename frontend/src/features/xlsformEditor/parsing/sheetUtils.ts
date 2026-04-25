// =============================================================================
// parsing/sheetUtils.ts — utilidades sobre XlsformEditorSheet
// =============================================================================
// Funciones puras de manipulación de hojas (clone, getSheet, ensureColumn,
// rowToRecord, setCell, insertRecord, deleteRow) y constructores básicos
// (makeSheet, createBlankWorkbook).
//
// Todo lo que vivía inline en `XlsformEditorPage.tsx` y no dependía del
// estado de React.
// =============================================================================

import type {
  SheetKey,
  XlsformEditorSheet,
  XlsformEditorWorkbook,
} from "../types";
import {
  CHOICES_COLUMNS,
  SETTINGS_COLUMNS,
  SURVEY_COLUMNS,
} from "../types";

// -----------------------------------------------------------------------------
// Constructores
// -----------------------------------------------------------------------------

export function makeSheet(name: string, columns: readonly string[]): XlsformEditorSheet {
  return { name, columns: [...columns], rows: [] };
}

export function createBlankWorkbook(): XlsformEditorWorkbook {
  return {
    survey: makeSheet("survey", SURVEY_COLUMNS),
    choices: makeSheet("choices", CHOICES_COLUMNS),
    settings: {
      name: "settings",
      columns: [...SETTINGS_COLUMNS],
      rows: [["Nuevo formulario", "nuevo_formulario", "1", "es"]],
    },
  };
}

// -----------------------------------------------------------------------------
// Clonado defensivo
// -----------------------------------------------------------------------------

export function cloneSheet(sheet: XlsformEditorSheet): XlsformEditorSheet {
  return {
    name: sheet.name ?? null,
    columns: [...sheet.columns],
    rows: sheet.rows.map((row) => [...row]),
  };
}

export function cloneWorkbook(book: XlsformEditorWorkbook): XlsformEditorWorkbook {
  return {
    survey: cloneSheet(book.survey),
    choices: cloneSheet(book.choices),
    settings: cloneSheet(book.settings),
    diagnostico: book.diagnostico ? cloneSheet(book.diagnostico) : null,
  };
}

// -----------------------------------------------------------------------------
// Acceso por SheetKey
// -----------------------------------------------------------------------------

export function getSheet(workbook: XlsformEditorWorkbook, key: SheetKey): XlsformEditorSheet | null {
  if (key === "diagnostico") return workbook.diagnostico ?? null;
  return workbook[key];
}

// -----------------------------------------------------------------------------
// Mutadores in-place (usados por el reducer; cuídate de pasar copias)
// -----------------------------------------------------------------------------

/** Asegura que la hoja tenga la columna pedida. Devuelve el índice. */
export function ensureColumn(sheet: XlsformEditorSheet, columnName: string): number {
  const idx = sheet.columns.indexOf(columnName);
  if (idx >= 0) return idx;
  sheet.columns.push(columnName);
  sheet.rows = sheet.rows.map((row) => {
    const next = [...row];
    next.push("");
    return next;
  });
  return sheet.columns.length - 1;
}

/** Convierte una fila del array `rows` a un Record column→value. */
export function rowToRecord(sheet: XlsformEditorSheet, rowIndex: number): Record<string, string> {
  const row = sheet.rows[rowIndex] ?? [];
  const out: Record<string, string> = {};
  sheet.columns.forEach((column, idx) => {
    out[column] = row[idx] ?? "";
  });
  return out;
}

/** Setea una celda creando columnas/filas faltantes con strings vacíos. */
export function setCell(
  sheet: XlsformEditorSheet,
  rowIndex: number,
  columnName: string,
  value: string,
): void {
  const colIndex = ensureColumn(sheet, columnName);
  while (sheet.rows.length <= rowIndex) {
    sheet.rows.push(new Array(sheet.columns.length).fill(""));
  }
  const row = [...(sheet.rows[rowIndex] ?? new Array(sheet.columns.length).fill(""))];
  while (row.length < sheet.columns.length) row.push("");
  row[colIndex] = value;
  sheet.rows[rowIndex] = row;
}

/** Inserta una fila en el índice dado, creando las columnas necesarias. */
export function insertRecord(
  sheet: XlsformEditorSheet,
  index: number,
  record: Record<string, string>,
): void {
  Object.keys(record).forEach((key) => {
    ensureColumn(sheet, key);
  });
  const row = sheet.columns.map((column) => record[column] ?? "");
  sheet.rows.splice(index, 0, row);
}

export function deleteRow(sheet: XlsformEditorSheet, rowIndex: number): void {
  sheet.rows.splice(rowIndex, 1);
}

// -----------------------------------------------------------------------------
// Otros helpers de hoja
// -----------------------------------------------------------------------------

/** Genera un nombre de columna disponible con prefijo + sufijo numérico. */
export function makeColumnName(sheet: XlsformEditorSheet, prefix = "columna"): string {
  let i = sheet.columns.length + 1;
  let candidate = `${prefix}_${i}`;
  while (sheet.columns.includes(candidate)) {
    i += 1;
    candidate = `${prefix}_${i}`;
  }
  return candidate;
}
