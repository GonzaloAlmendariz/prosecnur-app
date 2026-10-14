// =============================================================================
// shell/editorMetrics.ts — el único conteo del editor (U8)
// =============================================================================
// Una definición para todo el producto:
//   · «preguntas» = preguntas de la encuesta SurveyMonkey (sólo en el import);
//   · «campos»    = variables del formulario que reciben respuesta: toda fila
//     con nombre que no es estructura (grupo/repetición) ni nota, sin contar el
//     «Otro (especifique)» `<x>_other` cuando su pregunta madre existe (viaja
//     con ella). Una matriz cuenta una vez por fila.
// Es el mismo criterio del import (`totalCamposFormulario`: 1 por pregunta, o
// sus filas si es matriz) y del calce de campañas en el backend
// (`.sm_mb_alin_preguntas`: sin estructura, sin notas, sin `_other` con madre).
// Antes el editor contaba también notas y `_other` (113 contra 92 en Docentes).
// =============================================================================

import type { BuilderDiagnostic, BuilderNode, BuilderStructure } from "../types";

export type SuiteMetrics = {
  pieces: number;
  /** Variables que reciben respuesta (ver cabecera). Es el número que se muestra. */
  fields: number;
  sections: number;
  questions: number;
  catalogs: number;
  required: number;
  logicRules: number;
  warnings: number;
  infos: number;
};

export function isQuestionLike(node: Pick<BuilderNode, "kind">): boolean {
  return node.kind === "question" || node.kind === "note" || node.kind === "calculate";
}

export function isSectionLike(node: Pick<BuilderNode, "kind">): boolean {
  return node.kind === "section" || node.kind === "repeat";
}

const STRUCTURAL_OR_NOTE = new Set(["begin_group", "end_group", "begin_repeat", "end_repeat", "note"]);

/**
 * Cuenta campos sobre pares (tipo base, nombre). Lo usan el editor (sobre el
 * outline) y la tarjeta de la biblioteca (sobre la hoja `survey`).
 */
export function countAnswerFields(rows: ReadonlyArray<{ base: string; name: string }>): number {
  const candidates = rows.filter((row) => row.base && row.name && !STRUCTURAL_OR_NOTE.has(row.base));
  const names = new Set(candidates.map((row) => row.name));
  return candidates.filter((row) => {
    const parent = row.name.endsWith("_other") ? row.name.slice(0, -"_other".length) : "";
    return !(parent && names.has(parent));
  }).length;
}

export function countFieldsInOutline(nodes: readonly BuilderNode[]): number {
  return countAnswerFields(
    nodes
      .filter((node) => node.kind !== "section" && node.kind !== "repeat")
      .map((node) => ({ base: node.kind === "note" ? "note" : node.typeInfo?.base ?? "", name: node.name ?? "" })),
  );
}

export function buildSuiteMetrics(
  structure: BuilderStructure | null,
  catalogsCount: number,
  diagnostics: BuilderDiagnostic[],
): SuiteMetrics {
  const nodes = structure?.outline ?? [];
  return {
    pieces: nodes.length,
    fields: countFieldsInOutline(nodes),
    sections: nodes.filter(isSectionLike).length,
    questions: nodes.filter(isQuestionLike).length,
    catalogs: catalogsCount,
    required: nodes.filter((node) => node.required).length,
    logicRules: nodes.filter(
      (node) =>
        node.relevant?.trim() ||
        node.constraint?.trim() ||
        node.calculation?.trim() ||
        node.choiceFilter?.trim(),
    ).length,
    warnings: diagnostics.filter((diagnostic) => diagnostic.level === "warn").length,
    infos: diagnostics.filter((diagnostic) => diagnostic.level === "info").length,
  };
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** «92 campos · 17 secciones»: el par que repiten cabecera, outline y vista completa. */
export function formatFieldSectionPair(fields: number, sections: number): string {
  return `${plural(fields, "campo", "campos")} · ${plural(sections, "sección", "secciones")}`;
}

/** Texto humano del estado de guardado para el chip del header. */
export function formatSaveStatus(dirty: boolean, lastSavedAt: number | null, now = Date.now()): string {
  if (dirty) {
    if (lastSavedAt == null) return "Cambios sin guardar";
    return `Cambios sin guardar · último guardado ${formatRelativeTime(lastSavedAt, now)}`;
  }
  if (lastSavedAt == null) return "Sin cambios pendientes";
  return `Guardado ${formatRelativeTime(lastSavedAt, now)}`;
}

/** Convierte un timestamp ms epoch en frase tipo "hace 4 s" / "hace 2 min". */
export function formatRelativeTime(ts: number, now = Date.now()): string {
  const diffMs = now - ts;
  if (diffMs < 0) return "ahora";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 5) return "ahora";
  if (sec < 60) return `hace ${sec} s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const day = Math.floor(hr / 24);
  return `hace ${day} d`;
}
