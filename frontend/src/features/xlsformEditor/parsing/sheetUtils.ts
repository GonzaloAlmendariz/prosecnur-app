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
  PAPER_COLUMNS,
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
    paper: makeSheet("paper", PAPER_COLUMNS),
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
    paper: book.paper ? cloneSheet(book.paper) : makeSheet("paper", PAPER_COLUMNS),
    diagnostico: book.diagnostico ? cloneSheet(book.diagnostico) : null,
    surveyMonkeyLogic: book.surveyMonkeyLogic
      ? {
          rules: (book.surveyMonkeyLogic.rules ?? book.surveyMonkeyLogic.advanced_rules ?? []).map((rule) => ({ ...rule })),
          advanced_rules: (book.surveyMonkeyLogic.advanced_rules ?? book.surveyMonkeyLogic.rules ?? []).map((rule) => ({ ...rule })),
          visual_rules: (book.surveyMonkeyLogic.visual_rules ?? []).map((rule) => ({
            ...rule,
            choices: rule.choices.map((choice) => ({ ...choice, action: { ...choice.action } })),
          })),
          choice_order_overrides: Object.fromEntries(
            Object.entries(book.surveyMonkeyLogic.choice_order_overrides).map(([key, labels]) => [key, [...labels]]),
          ),
        }
      : null,
  };
}

// -----------------------------------------------------------------------------
// Acceso por SheetKey
// -----------------------------------------------------------------------------

export function getSheet(workbook: XlsformEditorWorkbook, key: SheetKey): XlsformEditorSheet | null {
  if (key === "diagnostico") return workbook.diagnostico ?? null;
  if (key === "paper") return workbook.paper ?? null;
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
  applyMultilingualFallback(out, "label");
  applyMultilingualFallback(out, "hint");
  applyMultilingualFallback(out, "constraint_message");
  applyMultilingualFallback(out, "required_message");
  return out;
}

function applyMultilingualFallback(record: Record<string, string>, base: string) {
  const candidates = Object.keys(record)
    .filter((key) => key.toLowerCase().startsWith(`${base.toLowerCase()}::`))
    .sort((a, b) => {
      const aLang = a.split("::").slice(1).join("::").toLowerCase();
      const bLang = b.split("::").slice(1).join("::").toLowerCase();
      if (aLang === "es") return -1;
      if (bLang === "es") return 1;
      return a.localeCompare(b);
    });
  const first = candidates.map((key) => record[key]).find((value) => Boolean(value));
  if (first) record[base] = first;
}

/**
 * Lee la celda de una fila/columna. Devuelve "" si la celda no existe.
 */
export function getCell(
  sheet: XlsformEditorSheet,
  rowIndex: number,
  columnName: string,
): string {
  const colIndex = sheet.columns.indexOf(columnName);
  if (colIndex < 0) return "";
  const row = sheet.rows[rowIndex];
  if (!row) return "";
  return row[colIndex] ?? "";
}

/**
 * Reemplaza todas las apariciones de `${oldName}` por `${newName}` en
 * cualquier celda de las columnas listadas, sobre TODAS las filas.
 * Usado para refactor automático cuando se renombra una pregunta —
 * actualiza referencias en relevant/constraint/calculation/etc.
 *
 * Devuelve el número de celdas modificadas (no el número de
 * sustituciones — una celda puede tener múltiples ocurrencias de
 * `${oldName}` y se cuenta como 1).
 */
export function replaceVarReferences(
  sheet: XlsformEditorSheet,
  oldName: string,
  newName: string,
  columns: string[],
): number {
  if (oldName === newName || !oldName || !newName) return 0;
  // Escapar caracteres regex peligrosos en el old name. Los names
  // válidos de XLSForm matchean /^[a-zA-Z_][a-zA-Z0-9_]*$/ así que no
  // tienen metacharacters, pero por si acaso defensivo.
  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\$\\{${escaped}\\}`, "g");
  const replacement = `\${${newName}}`;
  let cellsChanged = 0;
  for (const col of columns) {
    const colIdx = sheet.columns.indexOf(col);
    if (colIdx < 0) continue;
    for (let r = 0; r < sheet.rows.length; r += 1) {
      const row = sheet.rows[r]!;
      const cell = row[colIdx] ?? "";
      if (!cell.includes(`\${${oldName}}`)) continue;
      const newCell = cell.replace(pattern, replacement);
      if (newCell !== cell) {
        const nextRow = [...row];
        nextRow[colIdx] = newCell;
        sheet.rows[r] = nextRow;
        cellsChanged += 1;
      }
    }
  }
  return cellsChanged;
}

/**
 * Columnas del sheet `survey` que pueden contener referencias `${var}`.
 * Usado por `replaceVarReferences` cuando se renombra una pregunta.
 */
export const SURVEY_COLUMNS_WITH_VAR_REFS: readonly string[] = [
  "relevant",
  "constraint",
  "calculation",
  "choice_filter",
  "default",
  "label",
  "hint",
  "repeat_count",
  "constraint_message",
  "required_message",
  "trigger",
  "paper_label",
  "paper_skip",
];

/**
 * Encuentra todas las filas que referencian `${name}` en cualquiera de
 * las columnas indicadas. Usado para advertir antes de borrar/renombrar
 * una pregunta que es referenciada por otras.
 *
 * Devuelve una lista de objetos con la fila, la columna y un snippet
 * de la celda donde aparece. Útil para mostrar al usuario "esta
 * pregunta está usada en N lugares" con detalle.
 *
 * Filtra `excludeRowIndex` para no incluir la propia fila (la pregunta
 * que se está borrando podría auto-referenciarse via `calculate` y eso
 * no es una "referencia a otra").
 */
export type VarReference = {
  rowIndex: number;
  column: string;
  snippet: string;
};
export function findVarReferences(
  sheet: XlsformEditorSheet,
  name: string,
  columns: readonly string[],
  excludeRowIndex?: number,
): VarReference[] {
  if (!name) return [];
  const needle = `\${${name}}`;
  const out: VarReference[] = [];
  for (const col of columns) {
    const colIdx = sheet.columns.indexOf(col);
    if (colIdx < 0) continue;
    for (let r = 0; r < sheet.rows.length; r += 1) {
      if (r === excludeRowIndex) continue;
      const row = sheet.rows[r]!;
      const cell = row[colIdx] ?? "";
      if (cell.includes(needle)) {
        // Snippet: hasta 60 chars centrados en el match.
        const idx = cell.indexOf(needle);
        const start = Math.max(0, idx - 20);
        const end = Math.min(cell.length, idx + needle.length + 20);
        const snippet =
          (start > 0 ? "…" : "") +
          cell.slice(start, end) +
          (end < cell.length ? "…" : "");
        out.push({ rowIndex: r, column: col, snippet });
      }
    }
  }
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
