// =============================================================================
// parsing/diagnostics.ts — chequeos estructurales sobre el workbook
// =============================================================================
// Genera la lista de `BuilderDiagnostic` que el panel del editor muestra como
// avisos al usuario. Cada diagnostic apunta a una fila o a un catálogo y trae
// un texto en español orientado a un usuario que NO sabe Excel.
//
// Los chequeos cubren:
//   - Settings: form_title / form_id vacíos.
//   - Survey: labels o names vacíos, names duplicados, listas huérfanas o
//     vacías para preguntas de selección, cálculos sin fórmula.
//   - Estructura: end_* sueltos, secciones sin cerrar.
//   - Choices: códigos vacíos o duplicados, labels vacíos, catálogos con
//     menos de 2 opciones.
//   - Lógica: referencias a variables inexistentes en relevant/constraint/
//     calculation/choice_filter.
// =============================================================================

import type {
  BuilderDiagnostic,
  XlsformEditorWorkbook,
  XlsformIndex,
} from "../types";
import { rowToRecord } from "./sheetUtils";

export function buildDiagnostics(
  workbook: XlsformEditorWorkbook | null,
  index: XlsformIndex | null,
): BuilderDiagnostic[] {
  if (!workbook || !index) return [];
  const diagnostics: BuilderDiagnostic[] = [];
  const { structure, catalogs } = index;
  const catalogNames = new Set(catalogs.map((catalog) => catalog.listName));
  const nameCounts = new Map<string, number>();
  const firstRowByName = new Map<string, number>();
  structure.outline.forEach((node) => {
    const name = (node.name ?? "").trim();
    if (!name) return;
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
    if (!firstRowByName.has(name)) firstRowByName.set(name, node.rowIndex);
  });

  // Settings
  const settings = rowToRecord(workbook.settings, 0);
  if (!(settings.form_title ?? "").trim()) {
    diagnostics.push({
      id: "settings-title",
      level: "warn",
      title: "Falta el título del formulario",
      detail: "Conviene definir un título visible antes de exportar el instrumento.",
    });
  }
  if (!(settings.form_id ?? "").trim()) {
    diagnostics.push({
      id: "settings-id",
      level: "warn",
      title: "Falta el ID interno del formulario",
      detail: "El XLSForm debería tener un form_id claro para publicarlo luego en ODK o KoBo.",
    });
  }

  // Survey rows
  structure.outline.forEach((node) => {
    if (!(node.label ?? "").trim()) {
      diagnostics.push({
        id: `label-${node.rowIndex}`,
        level: "warn",
        rowIndex: node.rowIndex,
        title: "Hay una pieza sin texto visible",
        detail:
          "Añade una etiqueta legible para que el formulario no quede opaco al momento de usarlo.",
      });
    }
    if (!(node.name ?? "").trim()) {
      diagnostics.push({
        id: `name-${node.rowIndex}`,
        level: "warn",
        rowIndex: node.rowIndex,
        title: "Hay una pieza sin nombre interno",
        detail:
          "El nombre interno ayuda a exportar, validar y reutilizar la información sin ambigüedad.",
      });
    } else if (
      (nameCounts.get(node.name) ?? 0) > 1 &&
      firstRowByName.get(node.name) === node.rowIndex
    ) {
      diagnostics.push({
        id: `duplicate-name-${node.name}`,
        level: "warn",
        rowIndex: node.rowIndex,
        title: `El nombre interno "${node.name}" está repetido`,
        detail: `Aparece ${nameCounts.get(node.name)} veces. Conviene que cada pregunta o pieza tenga un nombre interno único.`,
      });
    }
    if (
      node.kind === "question" &&
      (node.typeInfo.base === "select_one" || node.typeInfo.base === "select_multiple")
    ) {
      if (!node.typeInfo.listName) {
        diagnostics.push({
          id: `catalog-missing-${node.rowIndex}`,
          level: "warn",
          rowIndex: node.rowIndex,
          title: "La pregunta no tiene catálogo asignado",
          detail:
            "Asigna un catálogo de opciones para que esta pregunta de selección quede completa.",
        });
      } else if (!catalogNames.has(node.typeInfo.listName)) {
        diagnostics.push({
          id: `catalog-empty-${node.rowIndex}`,
          level: "warn",
          rowIndex: node.rowIndex,
          title: "El catálogo asignado todavía no tiene opciones",
          detail: `La pregunta apunta al catálogo "${node.typeInfo.listName}", pero ese catálogo aún no tiene opciones definidas.`,
        });
      }
    }
    if (node.kind === "calculate" && !node.calculation) {
      diagnostics.push({
        id: `calculate-${node.rowIndex}`,
        level: "warn",
        rowIndex: node.rowIndex,
        title: "El cálculo está vacío",
        detail:
          "La variable está marcada como cálculo, pero todavía no tiene una fórmula definida.",
      });
    }
    if (node.kind === "repeat") {
      diagnostics.push({
        id: `repeat-${node.rowIndex}`,
        level: "info",
        rowIndex: node.rowIndex,
        title: "Hay un bloque repeat importado",
        detail:
          "Por ahora el constructor no expone repeats de forma guiada; si necesitas ajustarlo, usa el modo avanzado.",
      });
    }
  });

  // Estructura: cierres sueltos / secciones sin cerrar
  structure.unmatchedEndRows.forEach((rowIndex) => {
    diagnostics.push({
      id: `unmatched-end-${rowIndex}`,
      level: "warn",
      rowIndex,
      title: "Hay un cierre de sección sin apertura previa",
      detail:
        "Se detectó un end_group/end_repeat suelto. Conviene revisarlo antes de exportar.",
    });
  });

  structure.unclosedSectionIds.forEach((id) => {
    const section = structure.sections.get(id);
    if (!section || section.rowIndex == null) return;
    diagnostics.push({
      id: `unclosed-${id}`,
      level: "warn",
      rowIndex: section.rowIndex,
      title: `La sección "${section.label}" quedó abierta`,
      detail: "Parece que esta sección se abrió pero no se cerró. Revísala antes de exportar el formulario.",
    });
  });

  // Choices
  catalogs.forEach((catalog) => {
    const codes = new Map<string, number>();
    catalog.items.forEach((item) => {
      const code = (item.name ?? "").trim();
      if (code) codes.set(code, (codes.get(code) ?? 0) + 1);
    });
    if (catalog.items.length < 2) {
      diagnostics.push({
        id: `catalog-short-${catalog.listName}`,
        level: "info",
        catalogName: catalog.listName,
        title: `El catálogo "${catalog.listName}" tiene pocas opciones`,
        detail:
          "Si lo vas a usar en una pregunta de selección, normalmente conviene definir al menos dos opciones.",
      });
    }
    catalog.items.forEach((item) => {
      if (!(item.name ?? "").trim()) {
        diagnostics.push({
          id: `catalog-code-${item.rowIndex}`,
          level: "warn",
          catalogName: catalog.listName,
          title: `Hay una opción sin código en "${catalog.listName}"`,
          detail: "Cada opción necesita un código interno estable para guardar respuestas y analizar datos.",
        });
      } else if ((codes.get(item.name) ?? 0) > 1) {
        diagnostics.push({
          id: `catalog-duplicate-${item.rowIndex}`,
          level: "warn",
          catalogName: catalog.listName,
          title: `El código "${item.name}" está repetido`,
          detail: `Dentro del catálogo "${catalog.listName}", los códigos deberían ser únicos.`,
        });
      }
      if (!(item.label ?? "").trim()) {
        diagnostics.push({
          id: `catalog-label-${item.rowIndex}`,
          level: "warn",
          catalogName: catalog.listName,
          title: `Hay una opción sin texto visible en "${catalog.listName}"`,
          detail: "El texto visible es lo que verá la persona encuestada en el formulario.",
        });
      }
    });
  });

  // Referencias rotas
  index.missingReferences.forEach((dependency) => {
    diagnostics.push({
      id: `missing-ref-${dependency.fromRowIndex}-${dependency.kind}-${dependency.toName}`,
      level: "warn",
      rowIndex: dependency.fromRowIndex,
      title: `La lógica usa "${dependency.toName}", pero esa variable no existe`,
      detail: `Revisa la expresión de ${dependency.kind}. El índice no encontró una pregunta con ese nombre interno.`,
    });
  });

  return diagnostics;
}
