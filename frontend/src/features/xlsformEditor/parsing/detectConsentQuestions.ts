// =============================================================================
// parsing/detectConsentQuestions.ts — preguntas candidatas a consentimiento
// =============================================================================
// El PDF impreso puede marcar una pregunta como "variable de consentimiento":
// se asume que todo el formulario depende de ella (sus condiciones no se
// repiten y su rechazo cierra la encuesta). El selector del diálogo "Configurar
// PDF" ofrece las preguntas de selección única del cuestionario — que es la
// forma natural de un consentimiento (Sí/No, Acepto/No acepto).
//
// Reusa `rowToRecord` (con su fallback multilingüe de label) y `parseType` del
// parseo canónico; no reinventa el split de tipos.
// =============================================================================

import type { XlsformEditorWorkbook } from "../types";
import { parseType } from "./parseType";
import { rowToRecord } from "./sheetUtils";

/** Una pregunta candidata a consentimiento: nombre de variable + etiqueta. */
export type ConsentQuestion = {
  /** Nombre de variable (`name` en la hoja survey). */
  name: string;
  /** Etiqueta legible (o el nombre si no hay label). */
  label: string;
};

// Tipos base tratados como candidatos a consentimiento: selección única y las
// confirmaciones simples de ODK (`acknowledge`).
const CONSENT_BASES = new Set(["select_one", "acknowledge"]);

/**
 * Recorre `workbook.survey` y devuelve las preguntas de selección única (más
 * `acknowledge`) con nombre no vacío, en orden del survey. Descarta filas de
 * grupo/repeat y cualquier otro tipo.
 */
export function detectConsentQuestions(workbook: XlsformEditorWorkbook): ConsentQuestion[] {
  const survey = workbook.survey;
  if (!survey || survey.rows.length === 0) return [];

  const out: ConsentQuestion[] = [];
  survey.rows.forEach((_row, rowIndex) => {
    const record = rowToRecord(survey, rowIndex);
    const { base } = parseType(record.type ?? "");
    if (!CONSENT_BASES.has(base)) return;
    const name = (record.name ?? "").trim();
    if (!name) return;
    const label = (record.label ?? "").trim() || name;
    out.push({ name, label });
  });
  return out;
}
