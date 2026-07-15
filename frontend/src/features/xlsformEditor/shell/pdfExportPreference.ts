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
 * Ancho de las tablas de matriz en el PDF (opción GLOBAL):
 *   - "full": la matriz ocupa todo el ancho de la página (default);
 *   - "column": la matriz fluye dentro de una columna (útil en 2 columnas).
 */
export type PdfMatrixLayout = "full" | "column";

/**
 * Cabecera de una matriz en el PDF:
 *   - "auto": el motor R decide (default; se omite del payload);
 *   - "extremos": rotula solo los extremos de la escala;
 *   - "categorias": rotula cada categoría de la escala.
 */
export type MatrixHeader = "auto" | "extremos" | "categorias";

/**
 * Selección de columna especial ("sin información") de una matriz:
 *   - "auto": el motor R la detecta (comportamiento histórico; se omite del payload);
 *   - "none": la matriz no tiene columna especial;
 *   - cualquier otro string: el código de opción elegido explícitamente.
 */
export type MatrixSpecial = "auto" | "none" | string;

/**
 * Grupo de matriz enviado al motor R. `members` son los nombres de variable de
 * las preguntas del run; `tenor` es el enunciado guía opcional de la tabla
 * (cuando viene, ese tenor toma el número X y las filas pasan a X.1, X.2…);
 * `special` fija la columna de "sin información" (se omite cuando es "auto");
 * `header` fija el estilo de cabecera de la escala (se omite cuando es "auto").
 */
export type MatrixGroupPayload = {
  members: string[];
  tenor?: string;
  special?: string;
  header?: string;
};

/**
 * Arma `options.matrix_groups` a partir de los candidatos detectados, el set de
 * ids DESACTIVADOS (default = todos activos), el map id→tenor, el map
 * id→columna especial y el map id→cabecera. Los candidatos desactivados se
 * omiten; el tenor vacío o de solo espacios se descarta; `special` y `header`
 * se incluyen solo cuando NO son "auto".
 */
export function buildMatrixGroups(
  candidates: readonly MatrixCandidate[],
  disabledIds: ReadonlySet<string>,
  tenorById: Readonly<Record<string, string>>,
  specialById: Readonly<Record<string, string>> = {},
  headerById: Readonly<Record<string, string>> = {},
): MatrixGroupPayload[] {
  return candidates
    .filter((candidate) => !disabledIds.has(candidate.id))
    .map((candidate) => {
      const tenor = (tenorById[candidate.id] ?? "").trim();
      const special = (specialById[candidate.id] ?? "auto").trim() || "auto";
      const header = (headerById[candidate.id] ?? "auto").trim() || "auto";
      const group: MatrixGroupPayload = { members: candidate.memberNames };
      if (tenor) group.tenor = tenor;
      if (special !== "auto") group.special = special;
      if (header !== "auto") group.header = header;
      return group;
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
