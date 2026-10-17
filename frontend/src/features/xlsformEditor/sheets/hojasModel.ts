// Modelo del Editor XLSForm: hojas, ayudas de columna en español (el nombre XLSForm no se traduce),
// columnas de papel y columnas con expresiones. Extraído de sheets/SheetsView.tsx — refactor puro, revamp 2026-10-16.

import type { XlsformEditorSheet } from "../types";

export type TabKey = "survey" | "choices" | "settings" | "paper";

export const SHEET_PANEL_ID = "xlsform-sheet-panel";

export const TAB_HELP: Record<TabKey, { label: string; code: string; detail: string }> = {
  survey: {
    label: "Preguntas",
    code: "survey",
    detail: "Filas del cuestionario: preguntas, notas, cálculos, secciones y lógica.",
  },
  choices: {
    label: "Opciones",
    code: "choices",
    detail: "Catálogos reutilizables para preguntas de selección.",
  },
  settings: {
    label: "Configuración",
    code: "settings",
    detail: "Título, ID, versión e idioma principal del formulario.",
  },
  paper: {
    label: "Papel/PDF",
    code: "paper",
    detail: "Ajustes opcionales de salida impresa, sin cambiar el formulario digital.",
  },
};

export const PDF_EXTENSION_COLUMNS = new Set([
  "paper_number",
  "paper_label",
  "paper_layout",
  "paper_group",
  "paper_subgroup",
  "paper_subletter",
  "paper_only",
  "paper_skip",
]);

export const COLUMN_HELP: Record<string, { label: string; detail: string; badge?: string }> = {
  type: {
    label: "Tipo",
    detail: "Define qué bloque es: texto, número, selección, sección, cierre técnico, nota o cálculo.",
  },
  name: {
    label: "Código",
    detail: "Nombre interno de la variable. Se usa en lógica, cálculos, filtros y exportación.",
  },
  label: {
    label: "Texto visible",
    detail: "Pregunta o título que verá la persona encuestada.",
  },
  hint: {
    label: "Ayuda",
    detail: "Aclaración breve que acompaña la pregunta.",
  },
  required: {
    label: "Obligatoria",
    detail: "Marca si la respuesta es necesaria cuando la pregunta está visible.",
  },
  relevant: {
    label: "Lógica",
    detail: "Regla que decide cuándo aparece la pieza.",
  },
  constraint: {
    label: "Validación",
    detail: "Regla que controla si una respuesta es aceptable.",
  },
  constraint_message: {
    label: "Mensaje de validación",
    detail: "Texto humano que aparece cuando la respuesta no cumple la regla.",
  },
  calculation: {
    label: "Cálculo",
    detail: "Fórmula que produce un valor automáticamente.",
  },
  choice_filter: {
    label: "Filtro de opciones",
    detail: "Reduce las opciones de un catálogo según una respuesta previa.",
  },
  appearance: {
    label: "Presentación",
    detail: "Ajuste visual del formulario digital, como minimal, search o field-list.",
  },
  list_name: {
    label: "Catálogo",
    detail: "Lista reutilizable a la que pertenece una opción.",
  },
  paper_number: {
    label: "N° en papel",
    detail: "Numeración opcional para el PDF o cuestionario en papel. No afecta al formulario digital.",
    badge: "Papel",
  },
  paper_label: {
    label: "Texto en papel",
    detail: "Texto alternativo para el PDF si el papel necesita una redacción distinta.",
    badge: "Papel",
  },
  paper_layout: {
    label: "Diseño en papel",
    detail: "Indicación opcional de layout para la versión PDF o papel.",
    badge: "Papel",
  },
  paper_group: {
    label: "Grupo en papel",
    detail: "Agrupa piezas en la maqueta de papel sin cambiar la lógica del formulario.",
    badge: "Papel",
  },
  paper_subgroup: {
    label: "Subsección en papel",
    detail: "Banda de segundo nivel en el PDF. Un valor nuevo abre otra subsección.",
    badge: "Papel",
  },
  paper_subletter: {
    label: "Letra en papel",
    detail: "En una matriz, numera la fila con a, b, c… en vez de un número. «@» marca el enunciado madre.",
    badge: "Papel",
  },
  paper_only: {
    label: "Solo papel",
    detail: "Marca piezas pensadas solo para la versión impresa.",
    badge: "Papel",
  },
  paper_skip: {
    label: "Ocultar en papel",
    detail: "Oculta esta pieza u opción en la versión PDF, sin ocultarla en el formulario digital.",
    badge: "Papel",
  },
};

export function isEmptyColumn(sheet: XlsformEditorSheet, columnName: string): boolean {
  const colIndex = sheet.columns.indexOf(columnName);
  if (colIndex < 0) return true;
  return sheet.rows.every((row) => !(row[colIndex] ?? "").trim());
}

export function isCollapsiblePdfColumn(sheetName: TabKey, columnName: string): boolean {
  return sheetName !== "paper" && PDF_EXTENSION_COLUMNS.has(columnName);
}

/** Columnas con expresiones — usamos `font-family: monospace` para
 *  facilitar lectura de `${var}`, operadores, etc. */
export const EXPRESSION_COLUMNS = new Set([
  "type",
  "relevant",
  "constraint",
  "calculation",
  "choice_filter",
  "default",
  "appearance",
  "name",
  "list_name",
  "trigger",
  "repeat_count",
]);
