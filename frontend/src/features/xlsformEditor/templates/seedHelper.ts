// =============================================================================
// templates/seedHelper.ts — convertir un seed declarativo en XlsformEditorWorkbook
// =============================================================================
// Cada template seed expone un objeto plano (`TemplateSeed`) con los datos del
// formulario en forma legible (titulos, lista de filas survey, lista de
// catálogos). Esta función materializa eso en un workbook listo para abrir
// en el editor.
//
// Reglas:
//   - Se asegura que la hoja survey tenga TODAS las columnas que cualquier
//     fila del seed referencia (no solo las SURVEY_COLUMNS por defecto).
//   - Las choices se ordenan en bloque por listName para que el .xlsx
//     exportado mantenga consistencia.
//   - Settings: una sola fila con form_title/form_id/version/default_language.
// =============================================================================

import type {
  XlsformEditorSheet,
  XlsformEditorWorkbook,
} from "../types";
import {
  CHOICES_COLUMNS,
  SETTINGS_COLUMNS,
  SURVEY_COLUMNS,
} from "../types";

export type TemplateId = "blank" | "household" | "service-quality" | "census";

export type SeedSurveyRow = Record<string, string>;
export type SeedCatalog = {
  listName: string;
  items: Array<{ name: string; label: string }>;
};

export type TemplateSeed = {
  id: TemplateId;
  /** Nombre humano que se muestra en la galería. */
  title: string;
  /** Resumen corto para la card de la galería. */
  description: string;
  /** Bullets cortitos sobre qué incluye (3-4 ítems). */
  highlights: string[];
  /** Acento de la card (hex). */
  accent: string;
  /** Settings */
  formTitle: string;
  formId: string;
  defaultLanguage?: string; // por defecto "es"
  /** Filas del survey, en orden de aparición. */
  surveyRows: SeedSurveyRow[];
  /** Catálogos definidos en este seed. */
  catalogs: SeedCatalog[];
};

/**
 * Construye un workbook editable a partir de un seed declarativo. Útil para
 * la galería de plantillas y para tests/snapshots.
 */
export function buildWorkbookFromSeed(seed: TemplateSeed): XlsformEditorWorkbook {
  // Survey: superset de columnas (defaults + cualquier columna mencionada).
  const surveyColumns: string[] = [...SURVEY_COLUMNS];
  for (const row of seed.surveyRows) {
    for (const key of Object.keys(row)) {
      if (!surveyColumns.includes(key)) surveyColumns.push(key);
    }
  }
  const surveyRows: string[][] = seed.surveyRows.map((record) =>
    surveyColumns.map((column) => record[column] ?? ""),
  );

  const survey: XlsformEditorSheet = {
    name: "survey",
    columns: surveyColumns,
    rows: surveyRows,
  };

  // Choices: bloques por catálogo en el orden del seed.
  const choicesColumns: string[] = [...CHOICES_COLUMNS];
  const choicesRows: string[][] = [];
  for (const catalog of seed.catalogs) {
    for (const item of catalog.items) {
      const record: Record<string, string> = {
        list_name: catalog.listName,
        name: item.name,
        label: item.label,
      };
      choicesRows.push(choicesColumns.map((column) => record[column] ?? ""));
    }
  }
  const choices: XlsformEditorSheet = {
    name: "choices",
    columns: choicesColumns,
    rows: choicesRows,
  };

  // Settings: una sola fila.
  const settings: XlsformEditorSheet = {
    name: "settings",
    columns: [...SETTINGS_COLUMNS],
    rows: [
      [seed.formTitle, seed.formId, "1", seed.defaultLanguage ?? "es"],
    ],
  };

  return { survey, choices, settings, diagnostico: null };
}
