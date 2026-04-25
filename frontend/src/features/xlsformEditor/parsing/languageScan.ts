// =============================================================================
// parsing/languageScan.ts — detecta columnas multi-idioma (label::*, hint::*)
// =============================================================================
// La Fase 1 del revamp solo edita el campo base (`label`, `hint`, `media::*`).
// Pero los XLSForm importados de los instrumentos del corpus traen variantes
// por idioma:
//
//   label::English, label::Français, label::العربية
//   hint::English, hint::Français
//   media::image::English, …
//
// Cuando el editor detecta esas columnas:
//   1. Banner amarillo arriba del Inspector explicando que se preservan al
//      exportar pero no se editan visualmente en F1.
//   2. Lista de los idiomas detectados (códigos ISO o el sufijo literal).
//   3. Conteo total de filas que tienen al menos un campo en otro idioma.
//
// Multi-idioma editable es trabajo de Fase 2.
// =============================================================================

import type { XlsformEditorWorkbook } from "../types";

export type ForeignLanguageNotice = {
  /** Idiomas detectados en survey/choices (ej. ["English", "Français", "العربية"]). */
  languages: string[];
  /** Cantidad total de columnas extra detectadas (label::X + hint::X + media::*::X). */
  columnCount: number;
  /** Cantidad de filas survey con al menos un valor no vacío en alguna columna extra. */
  rowCount: number;
};

const COLUMN_PATTERN = /^(?:label|hint|media::[a-z]+|constraint_message|required_message)::(.+)$/i;

/**
 * Escanea las hojas survey y choices del workbook buscando columnas con
 * sufijo de idioma. Si detecta alguna, devuelve el aviso resumido. Si no
 * hay idiomas extra, devuelve null y el caller no muestra banner.
 */
export function scanForeignLanguages(
  workbook: XlsformEditorWorkbook | null,
): ForeignLanguageNotice | null {
  if (!workbook) return null;

  const languages = new Set<string>();
  const foreignColumns: Array<{ sheet: "survey" | "choices"; index: number }> = [];

  // Survey: columnas con sufijo ::idioma
  workbook.survey.columns.forEach((col, index) => {
    const match = COLUMN_PATTERN.exec(col);
    if (match && match[1]) {
      languages.add(match[1].trim());
      foreignColumns.push({ sheet: "survey", index });
    }
  });

  // Choices: típicamente solo label::X.
  workbook.choices.columns.forEach((col, index) => {
    const match = COLUMN_PATTERN.exec(col);
    if (match && match[1]) {
      languages.add(match[1].trim());
      foreignColumns.push({ sheet: "choices", index });
    }
  });

  if (foreignColumns.length === 0) return null;

  // Cantidad de filas survey con al menos un valor no vacío en una columna foreign.
  let rowCount = 0;
  const surveyForeignIdx = foreignColumns
    .filter((c) => c.sheet === "survey")
    .map((c) => c.index);
  for (const row of workbook.survey.rows) {
    if (surveyForeignIdx.some((idx) => (row[idx] ?? "").trim() !== "")) {
      rowCount += 1;
    }
  }

  return {
    languages: Array.from(languages).sort((a, b) => a.localeCompare(b)),
    columnCount: foreignColumns.length,
    rowCount,
  };
}
