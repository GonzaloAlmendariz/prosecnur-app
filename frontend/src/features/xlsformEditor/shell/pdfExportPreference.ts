// =============================================================================
// shell/pdfExportPreference.ts — lógica pura del selector "DISEÑO DEL PDF"
// =============================================================================
// El popover del split-button de exportación combina tres dimensiones: número de
// columnas (1/2), lenguaje de lógica del cuestionario (saltos/condiciones) y si
// se imprimen los recuadros de N.º de cuestionario en la cabecera. Aquí viven los
// tipos y los helpers puros de etiquetado para poder testearlos sin montar el
// componente.
// =============================================================================

import type { MatrixCandidate } from "../parsing/detectMatrixCandidates";

export type PdfColumns = 1 | 2;
export type PdfLogicLanguage = "saltos" | "condiciones";

/**
 * Grupo de matriz enviado al motor R. `members` son los nombres de variable de
 * las preguntas del run; `tenor` es el enunciado guía opcional de la tabla
 * (cuando viene, ese tenor toma el número X y las filas pasan a X.1, X.2…).
 */
export type MatrixGroupPayload = { members: string[]; tenor?: string };

/**
 * Arma `options.matrix_groups` a partir de los candidatos detectados, el set de
 * ids DESACTIVADOS (default = todos activos) y el map id→tenor. Los candidatos
 * desactivados se omiten; el tenor vacío o de solo espacios se descarta.
 */
export function buildMatrixGroups(
  candidates: readonly MatrixCandidate[],
  disabledIds: ReadonlySet<string>,
  tenorById: Readonly<Record<string, string>>,
): MatrixGroupPayload[] {
  return candidates
    .filter((candidate) => !disabledIds.has(candidate.id))
    .map((candidate) => {
      const tenor = (tenorById[candidate.id] ?? "").trim();
      return tenor
        ? { members: candidate.memberNames, tenor }
        : { members: candidate.memberNames };
    });
}

export type PdfExportPreference = {
  columns: PdfColumns;
  logicLanguage: PdfLogicLanguage;
  showQuestionnaireNumber: boolean;
};

export const DEFAULT_PDF_EXPORT_PREFERENCE: PdfExportPreference = {
  columns: 2,
  logicLanguage: "saltos",
  showQuestionnaireNumber: true,
};

export function columnsLabel(columns: PdfColumns): string {
  return columns === 1 ? "una columna" : "dos columnas";
}

export function logicLanguageLabel(logicLanguage: PdfLogicLanguage): string {
  return logicLanguage === "saltos" ? "saltos" : "condiciones";
}

export function questionnaireNumberLabel(showQuestionnaireNumber: boolean): string {
  return showQuestionnaireNumber ? "con N.º de cuestionario" : "sin N.º de cuestionario";
}

/** Texto del `title` del botón principal: refleja las dimensiones activas. */
export function exportButtonTitle(pref: PdfExportPreference): string {
  return `Exportar PDF (${columnsLabel(pref.columns)}, ${logicLanguageLabel(pref.logicLanguage)}, ${questionnaireNumberLabel(pref.showQuestionnaireNumber)})`;
}
