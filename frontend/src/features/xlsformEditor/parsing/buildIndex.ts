// =============================================================================
// parsing/buildIndex.ts — derivar la estructura jerárquica del survey + índice
// =============================================================================
// El editor mantiene en memoria el `XlsformEditorWorkbook` (3 hojas como arrays
// de strings). Para renderizar el outline jerárquico, validar referencias y
// detectar dependencias necesitamos un *cache derivado* — el `XlsformIndex` —
// que se recalcula completo en cada cambio del workbook (es barato; los
// formularios típicos rondan 100-400 filas).
//
// Funciones expuestas:
//   - `parseBuilderStructure(survey)` → `BuilderStructure`
//   - `extractChoiceItems(choices, listName)` → opciones de una lista
//   - `buildCatalogs(choices)` → todas las listas
//   - `buildXlsformIndex(workbook)` → todo junto + dependencias detectadas
//   - `resolveInsertionIndex(structure, selection, survey)` → dónde insertar
//     una pregunta nueva según el cursor actual
//   - `getSiblingRows(structure, rowIndex)` → previo/siguiente del mismo padre
//   - `previewKindLabel(node)` → etiqueta humana del tipo de fila
// =============================================================================

import type {
  BuilderNode,
  BuilderNodeKind,
  BuilderSelection,
  BuilderStructure,
  CatalogSummary,
  ChoiceItem,
  DependencyKind,
  SectionMeta,
  XlsformDependency,
  XlsformEditorSheet,
  XlsformEditorWorkbook,
  XlsformIndex,
} from "../types";
import {
  asRequired,
  extractExpressionVariables,
  parseType,
  typeLabel,
} from "./parseType";
import { rowToRecord } from "./sheetUtils";

// -----------------------------------------------------------------------------
// Choices: lista de opciones por listName
// -----------------------------------------------------------------------------

export function extractChoiceItems(
  choicesSheet: XlsformEditorSheet,
  listName: string,
): ChoiceItem[] {
  const listCol = choicesSheet.columns.indexOf("list_name");
  const nameCol = choicesSheet.columns.indexOf("name");
  const labelCol = choicesSheet.columns.indexOf("label");
  if (listCol < 0) return [];
  return choicesSheet.rows
    .map((row, rowIndex) => ({
      rowIndex,
      listName: row[listCol] ?? "",
      name: nameCol >= 0 ? (row[nameCol] ?? "") : "",
      label: labelCol >= 0 ? (row[labelCol] ?? "") : "",
    }))
    .filter((row) => row.listName === listName)
    .map(({ rowIndex, name, label }) => ({ rowIndex, name, label }));
}

export function buildCatalogs(choicesSheet: XlsformEditorSheet): CatalogSummary[] {
  const listCol = choicesSheet.columns.indexOf("list_name");
  const nameCol = choicesSheet.columns.indexOf("name");
  const labelCol = choicesSheet.columns.indexOf("label");
  if (listCol < 0) return [];

  const groups = new Map<string, ChoiceItem[]>();
  choicesSheet.rows.forEach((row, rowIndex) => {
    const listName = (row[listCol] ?? "").trim();
    if (!listName) return;
    const item: ChoiceItem = {
      rowIndex,
      name: nameCol >= 0 ? (row[nameCol] ?? "") : "",
      label: labelCol >= 0 ? (row[labelCol] ?? "") : "",
    };
    const current = groups.get(listName) ?? [];
    current.push(item);
    groups.set(listName, current);
  });

  return Array.from(groups.entries())
    .map(([listName, items]) => ({
      listName,
      title: items[0]?.label || listName,
      items,
    }))
    .sort((a, b) => a.listName.localeCompare(b.listName));
}

// -----------------------------------------------------------------------------
// Dependencias detectadas en relevant/constraint/calculation/choice_filter
// -----------------------------------------------------------------------------

function collectDependencies(node: BuilderNode): XlsformDependency[] {
  const sources: Array<{ kind: DependencyKind; expression: string }> = [
    { kind: "relevant", expression: node.relevant },
    { kind: "constraint", expression: node.constraint },
    { kind: "calculation", expression: node.calculation },
    { kind: "choice_filter", expression: node.choiceFilter },
  ];

  return sources
    .filter((item) => !!item.expression)
    .flatMap((source) =>
      extractExpressionVariables(source.expression).map((toName) => ({
        fromRowIndex: node.rowIndex,
        fromName: node.name,
        toName,
        kind: source.kind,
        expression: source.expression,
      })),
    );
}

// -----------------------------------------------------------------------------
// Estructura jerárquica del survey
// -----------------------------------------------------------------------------

export function parseBuilderStructure(survey: XlsformEditorSheet): BuilderStructure {
  const outline: BuilderNode[] = [];
  const byRow = new Map<number, BuilderNode>();
  const rowToSectionId = new Map<number, string>();
  const sections = new Map<string, SectionMeta>();
  const spans = new Map<number, { start: number; end: number }>();
  const unmatchedEndRows: number[] = [];
  const unclosedSectionIds: string[] = [];

  sections.set("root", {
    id: "root",
    rowIndex: null,
    endRowIndex: null,
    depth: 0,
    kind: "root",
    label: "Formulario principal",
    name: "root",
    parentId: null,
    itemCount: 0,
  });

  const stack: string[] = ["root"];

  survey.rows.forEach((_, rowIndex) => {
    const record = rowToRecord(survey, rowIndex);
    const typeInfo = parseType(record.type ?? "");
    const label =
      (record.label ?? "").trim() ||
      (record.name ?? "").trim() ||
      `Elemento ${rowIndex + 1}`;
    const sectionId = stack[stack.length - 1] ?? "root";

    if (typeInfo.base === "end_group" || typeInfo.base === "end_repeat") {
      if (stack.length <= 1) {
        unmatchedEndRows.push(rowIndex);
        return;
      }
      const closing = stack.pop();
      if (closing && sections.has(closing)) {
        const meta = sections.get(closing)!;
        meta.endRowIndex = rowIndex;
        sections.set(closing, meta);
        if (meta.rowIndex != null) {
          spans.set(meta.rowIndex, { start: meta.rowIndex, end: rowIndex });
        }
      }
      return;
    }

    if (typeInfo.base === "begin_group" || typeInfo.base === "begin_repeat") {
      const id = `section-${rowIndex}`;
      const kind: BuilderNodeKind = typeInfo.base === "begin_repeat" ? "repeat" : "section";
      const depth = Math.max(stack.length - 1, 0);
      const node: BuilderNode = {
        rowIndex,
        depth,
        kind,
        label,
        name: (record.name ?? "").trim(),
        sectionId,
        typeInfo,
        required: false,
        relevant: (record.relevant ?? "").trim(),
        constraint: (record.constraint ?? "").trim(),
        calculation: (record.calculation ?? "").trim(),
        choiceFilter: (record.choice_filter ?? "").trim(),
        hint: (record.hint ?? "").trim(),
        appearance: (record.appearance ?? "").trim(),
      };
      outline.push(node);
      byRow.set(rowIndex, node);
      rowToSectionId.set(rowIndex, sectionId);
      spans.set(rowIndex, { start: rowIndex, end: rowIndex });
      sections.set(id, {
        id,
        rowIndex,
        endRowIndex: null,
        depth,
        kind: kind === "repeat" ? "repeat" : "section",
        label,
        name: (record.name ?? "").trim(),
        parentId: sectionId,
        itemCount: 0,
      });
      stack.push(id);
      const parent = sections.get(sectionId);
      if (parent) parent.itemCount += 1;
      return;
    }

    if (!typeInfo.base) return;

    const kind: BuilderNodeKind =
      typeInfo.base === "note"
        ? "note"
        : typeInfo.base === "calculate"
          ? "calculate"
          : "question";

    const node: BuilderNode = {
      rowIndex,
      depth: Math.max(stack.length - 1, 0),
      kind,
      label,
      name: (record.name ?? "").trim(),
      sectionId,
      typeInfo,
      required: asRequired(record.required ?? ""),
      relevant: (record.relevant ?? "").trim(),
      constraint: (record.constraint ?? "").trim(),
      calculation: (record.calculation ?? "").trim(),
      choiceFilter: (record.choice_filter ?? "").trim(),
      hint: (record.hint ?? "").trim(),
      appearance: (record.appearance ?? "").trim(),
    };
    outline.push(node);
    byRow.set(rowIndex, node);
    rowToSectionId.set(rowIndex, sectionId);
    spans.set(rowIndex, { start: rowIndex, end: rowIndex });
    const section = sections.get(sectionId);
    if (section) section.itemCount += 1;
  });

  // Secciones sin cerrar: el span se extiende hasta el final del survey.
  for (const id of stack.slice(1)) {
    const meta = sections.get(id);
    if (!meta || meta.rowIndex == null) continue;
    unclosedSectionIds.push(id);
    spans.set(meta.rowIndex, {
      start: meta.rowIndex,
      end: Math.max(survey.rows.length - 1, meta.rowIndex),
    });
  }

  return {
    outline,
    byRow,
    sections,
    rowToSectionId,
    firstSelectableRow: outline[0]?.rowIndex ?? null,
    spans,
    unmatchedEndRows,
    unclosedSectionIds,
  };
}

// -----------------------------------------------------------------------------
// Índice global del workbook (todo en uno)
// -----------------------------------------------------------------------------

export function buildXlsformIndex(workbook: XlsformEditorWorkbook): XlsformIndex {
  const structure = parseBuilderStructure(workbook.survey);
  const catalogs = buildCatalogs(workbook.choices);
  const variablesByName = new Map<string, BuilderNode[]>();
  const catalogsByName = new Map<string, CatalogSummary>();
  const questionsByCatalog = new Map<string, BuilderNode[]>();
  const dependencies: XlsformDependency[] = [];
  const dependentsByName = new Map<string, XlsformDependency[]>();
  const dependenciesByName = new Map<string, XlsformDependency[]>();

  catalogs.forEach((catalog) => catalogsByName.set(catalog.listName, catalog));

  structure.outline.forEach((node) => {
    if (node.name) {
      const current = variablesByName.get(node.name) ?? [];
      current.push(node);
      variablesByName.set(node.name, current);
    }
    if (node.typeInfo.listName) {
      const current = questionsByCatalog.get(node.typeInfo.listName) ?? [];
      current.push(node);
      questionsByCatalog.set(node.typeInfo.listName, current);
    }

    const nodeDependencies = collectDependencies(node);
    dependencies.push(...nodeDependencies);
    if (node.name && nodeDependencies.length) {
      dependenciesByName.set(node.name, [
        ...(dependenciesByName.get(node.name) ?? []),
        ...nodeDependencies,
      ]);
    }
    nodeDependencies.forEach((dependency) => {
      dependentsByName.set(dependency.toName, [
        ...(dependentsByName.get(dependency.toName) ?? []),
        dependency,
      ]);
    });
  });

  const missingReferences = dependencies.filter(
    (dependency) => !variablesByName.has(dependency.toName),
  );

  return {
    structure,
    catalogs,
    variablesByName,
    catalogsByName,
    questionsByCatalog,
    dependencies,
    dependentsByName,
    dependenciesByName,
    missingReferences,
    stats: {
      nQuestions: structure.outline.filter(
        (node) => node.kind === "question" || node.kind === "note" || node.kind === "calculate",
      ).length,
      nSections: Array.from(structure.sections.values()).filter(
        (section) => section.kind !== "root",
      ).length,
      nCatalogs: catalogs.length,
      nDependencies: dependencies.length,
      nMissingReferences: missingReferences.length,
    },
  };
}

// -----------------------------------------------------------------------------
// Helpers de inserción y navegación
// -----------------------------------------------------------------------------

/**
 * Calcula el índice donde insertar una pregunta nueva según la selección
 * actual. Si la selección es una sección abierta, inserta justo antes del
 * `end_*` correspondiente.
 */
export function resolveInsertionIndex(
  structure: BuilderStructure | null,
  selection: BuilderSelection | null,
  survey: XlsformEditorSheet,
): number {
  if (!structure || !selection || selection.kind === "settings") return survey.rows.length;
  const node = structure.byRow.get(selection.rowIndex);
  if (!node) return survey.rows.length;
  if (node.kind === "section" || node.kind === "repeat") {
    const section = Array.from(structure.sections.values()).find(
      (entry) => entry.rowIndex === selection.rowIndex,
    );
    if (section && section.endRowIndex != null) return section.endRowIndex;
  }
  const sectionId = structure.rowToSectionId.get(selection.rowIndex);
  const section = sectionId ? structure.sections.get(sectionId) : null;
  if (section && section.kind !== "root" && section.endRowIndex != null) return section.endRowIndex;
  return selection.rowIndex + 1;
}

export function previewKindLabel(node: BuilderNode | null): string {
  if (!node) return "Elemento";
  if (node.kind === "section") return "Sección";
  if (node.kind === "repeat") return "Bloque repetido";
  if (node.kind === "note") return "Texto informativo";
  if (node.kind === "calculate") return "Cálculo";
  return typeLabel(node.typeInfo.base);
}

export function getSiblingRows(
  structure: BuilderStructure | null,
  rowIndex: number | null,
): { prevRow: number | null; nextRow: number | null } {
  if (!structure || rowIndex == null) return { prevRow: null, nextRow: null };
  const node = structure.byRow.get(rowIndex);
  if (!node) return { prevRow: null, nextRow: null };
  const siblings = structure.outline.filter((entry) => entry.sectionId === node.sectionId);
  const index = siblings.findIndex((entry) => entry.rowIndex === rowIndex);
  return {
    prevRow: siblings[index - 1]?.rowIndex ?? null,
    nextRow: siblings[index + 1]?.rowIndex ?? null,
  };
}
