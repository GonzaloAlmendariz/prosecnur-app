// =============================================================================
// types.ts — tipos compartidos del editor XLSForm
// =============================================================================
// Toda la representación interna que usa el editor: el workbook, la estructura
// derivada del survey (jerarquía de groups/repeats), catálogos, dependencias
// detectadas y diagnostics.
//
// Convención: tipos públicos sin prefijo, no exportamos union types triviales
// solo para "documentar" (los inlineamos en los call-sites).
// =============================================================================

import type { ReactNode } from "react";
import type { XlsformEditorSheet, XlsformEditorWorkbook } from "../../api/client";

// Re-exportamos los tipos del client para que los consumidores del editor
// no tengan que conocer su origen.
export type { XlsformEditorSheet, XlsformEditorWorkbook };

// -----------------------------------------------------------------------------
// Hojas del workbook + selección
// -----------------------------------------------------------------------------

/** Identifica qué hoja del workbook se está mirando. */
export type SheetKey = "survey" | "choices" | "settings" | "paper" | "diagnostico";

/**
 * Modo del editor. `builder` es el constructor visual guiado; `advanced` era
 * el editor de hojas crudas — se elimina en el revamp Fase 1, pero el tipo
 * se mantiene durante la migración para no romper imports.
 */
export type EditorMode = "builder" | "advanced";

/** Selección actual: el form root (settings) o una fila concreta del survey. */
export type BuilderSelection =
  | { kind: "settings" }
  | { kind: "survey"; rowIndex: number };

// -----------------------------------------------------------------------------
// Parsing del campo `type` (ej. "select_one colores" → base + listName)
// -----------------------------------------------------------------------------

export type TypeInfo = {
  raw: string;
  base: string;
  listName: string;
};

// -----------------------------------------------------------------------------
// Estructura derivada de la hoja survey
// -----------------------------------------------------------------------------

/**
 * Categoría visual del nodo en el outline. No se mapea 1:1 con `type` porque
 * agrupamos `begin_group` y `begin_repeat` en `section`/`repeat`, etc.
 */
export type BuilderNodeKind = "section" | "repeat" | "question" | "note" | "calculate";

/**
 * Una fila del survey ya parseada y enriquecida. Mantenemos `rowIndex` como
 * la fuente de verdad de identidad — la posición en el array `sheet.rows`.
 */
export type BuilderNode = {
  rowIndex: number;
  depth: number;
  kind: BuilderNodeKind;
  label: string;
  name: string;
  sectionId: string;
  typeInfo: TypeInfo;
  required: boolean;
  relevant: string;
  constraint: string;
  calculation: string;
  choiceFilter: string;
  hint: string;
  appearance: string;
  paperNumber?: string;
  paperLabel?: string;
  paperLayout?: string;
  paperGroup?: string;
  paperOnly?: string;
  paperSkip?: string;
  repeat_count?: string;
  read_only?: string;
  required_message?: string;
  parameters?: string;
};

/** Metadatos de una sección (group o repeat). */
export type SectionMeta = {
  id: string;
  rowIndex: number | null;
  endRowIndex: number | null;
  depth: number;
  kind: "root" | "section" | "repeat";
  label: string;
  name: string;
  parentId: string | null;
  itemCount: number;
};

/** Estructura completa derivada del survey. Se reconstruye en cada cambio. */
export type BuilderStructure = {
  outline: BuilderNode[];
  byRow: Map<number, BuilderNode>;
  sections: Map<string, SectionMeta>;
  rowToSectionId: Map<number, string>;
  firstSelectableRow: number | null;
  /** Para cada `begin_group`/`begin_repeat`, el rango [start, end] que cubre. */
  spans: Map<number, { start: number; end: number }>;
  /** end_group / end_repeat sin su begin correspondiente. */
  unmatchedEndRows: number[];
  /** begin_group / begin_repeat sin su end correspondiente. */
  unclosedSectionIds: string[];
};

// -----------------------------------------------------------------------------
// Catálogos (hoja choices)
// -----------------------------------------------------------------------------

export type ChoiceItem = {
  rowIndex: number;
  name: string;
  label: string;
};

export type CatalogSummary = {
  listName: string;
  title: string;
  items: ChoiceItem[];
};

// -----------------------------------------------------------------------------
// Diagnostics
// -----------------------------------------------------------------------------

export type BuilderDiagnostic = {
  id: string;
  level: "warn" | "info";
  title: string;
  detail: string;
  rowIndex?: number;
  catalogName?: string;
};

// -----------------------------------------------------------------------------
// Menú "Agregar elemento" (acciones del + dentro de una sección)
// -----------------------------------------------------------------------------

export type AddMenuItem = {
  key: string;
  label: string;
  hint: string;
  icon: ReactNode;
  action: () => void;
};

// -----------------------------------------------------------------------------
// Dependencias entre preguntas (vars referenciadas en relevant/constraint/...)
// -----------------------------------------------------------------------------

export type DependencyKind = "relevant" | "constraint" | "calculation" | "choice_filter";

export type XlsformDependency = {
  fromRowIndex: number;
  fromName: string;
  toName: string;
  kind: DependencyKind;
  expression: string;
};

// -----------------------------------------------------------------------------
// Índice global del workbook (cache derivado, lo recalculamos por cada workbook)
// -----------------------------------------------------------------------------

export type XlsformIndex = {
  structure: BuilderStructure;
  catalogs: CatalogSummary[];
  variablesByName: Map<string, BuilderNode[]>;
  catalogsByName: Map<string, CatalogSummary>;
  questionsByCatalog: Map<string, BuilderNode[]>;
  dependencies: XlsformDependency[];
  dependentsByName: Map<string, XlsformDependency[]>;
  dependenciesByName: Map<string, XlsformDependency[]>;
  missingReferences: XlsformDependency[];
  stats: {
    nQuestions: number;
    nSections: number;
    nCatalogs: number;
    nDependencies: number;
    nMissingReferences: number;
  };
};

// -----------------------------------------------------------------------------
// Constantes de columnas mínimas por hoja (usadas al crear workbook en blanco)
// -----------------------------------------------------------------------------

export const SURVEY_COLUMNS: readonly string[] = [
  "type",
  "name",
  "label",
  "hint",
  "required",
  "relevant",
  "constraint",
  "calculation",
  "choice_filter",
  "appearance",
  "paper_number",
  "paper_label",
  "paper_layout",
  "paper_group",
  "paper_only",
  "paper_skip",
];

export const CHOICES_COLUMNS: readonly string[] = ["list_name", "name", "label", "paper_skip"];

export const SETTINGS_COLUMNS: readonly string[] = [
  "form_title",
  "form_id",
  "version",
  "default_language",
];

export const PAPER_COLUMNS: readonly string[] = [
  "id",
  "kind",
  "position",
  "title",
  "body",
  "layout",
];
