// =============================================================================
// shell/pdfExportPreference.ts — lógica pura del selector "DISEÑO DEL PDF"
// =============================================================================
// El popover del split-button de exportación combina tres dimensiones: número de
// columnas (1/2), lenguaje de lógica del cuestionario (saltos/condiciones) y si
// se imprimen los recuadros de N.º de cuestionario en la cabecera. Aquí viven los
// tipos y los helpers puros de etiquetado para poder testearlos sin montar el
// componente.
// =============================================================================

export type PdfColumns = 1 | 2;
export type PdfLogicLanguage = "saltos" | "condiciones";

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
