// =============================================================================
// parsing/detectMatrixCandidates.ts — candidatos de matriz del cuestionario
// =============================================================================
// Un "candidato de matriz" es un run de preguntas contiguas (en orden del
// survey) de tipo select_one/select_multiple que comparten la MISMA lista de
// opciones (`list_name`) y viven en la MISMA sección (mismo grupo contenedor
// inmediato), con ≥2 preguntas. El motor R hoy los auto-detecta; esta función
// replica esa detección en el frontend para que el usuario elija cuáles se
// arman como matriz en el PDF.
//
// Reglas de corte de un run (cualquiera reinicia la acumulación):
//   - fila de otro tipo entre medio (nota, texto, cálculo…);
//   - apertura/cierre de grupo o repeat (cambia la sección/contigüidad);
//   - misma sección pero distinto `list_name`;
//   - distinta sección (parent contenedor distinto).
//
// Reusa `rowToRecord` (con su fallback multilingüe de label) y `parseType`
// del parseo canónico; no reinventa el split de tipos ni la jerarquía.
// =============================================================================

import type { XlsformEditorWorkbook } from "../types";
import { extractChoiceItems } from "./buildIndex";
import { parseType } from "./parseType";
import { rowToRecord } from "./sheetUtils";

/** Una opción de la escala del candidato (código + etiqueta), en orden. */
export type MatrixScaleOption = {
  /** Código/valor de la opción (`name` en la hoja choices). */
  code: string;
  /** Etiqueta legible de la opción (`label` en la hoja choices). */
  label: string;
};

export type MatrixCandidate = {
  /** Id estable dentro del workbook (basado en la fila de la 1ª pregunta). */
  id: string;
  /** Etiqueta de la sección contenedora (o "Formulario" en la raíz). */
  sectionLabel: string;
  /** `list_name` compartido por todas las preguntas del run. */
  listName: string;
  /** Número de preguntas del run (≥2). */
  count: number;
  /** Nombres de variable de las preguntas, en orden del survey. */
  memberNames: string[];
  /** Etiquetas de las preguntas, en orden del survey. */
  questionLabels: string[];
  /**
   * Opciones de la escala (leídas de `choices` para `listName`, en orden), para
   * que el usuario pueda elegir cuál es la columna especial de "sin información".
   */
  scaleOptions: MatrixScaleOption[];
};

const SELECT_BASES = new Set(["select_one", "select_multiple"]);
const ROOT_SECTION_ID = "__root__";
const ROOT_SECTION_LABEL = "Formulario";

type OpenSection = { id: string; label: string };

type RunAccumulator = {
  sectionId: string;
  sectionLabel: string;
  listName: string;
  firstRowIndex: number;
  memberNames: string[];
  questionLabels: string[];
};

export function detectMatrixCandidates(workbook: XlsformEditorWorkbook): MatrixCandidate[] {
  const survey = workbook.survey;
  if (!survey || survey.rows.length === 0) return [];

  const candidates: MatrixCandidate[] = [];
  const sectionStack: OpenSection[] = [];
  let run: RunAccumulator | null = null;

  const currentSection = (): OpenSection =>
    sectionStack[sectionStack.length - 1] ?? { id: ROOT_SECTION_ID, label: ROOT_SECTION_LABEL };

  const flush = () => {
    // >=1: una sola pregunta con lista también es candidata a matriz (1 fila).
    // El diálogo la ofrece apagada por defecto (opt-in), así el look por defecto
    // no cambia respecto de la auto-detección (que sigue agrupando 3+).
    if (run && run.memberNames.length >= 1) {
      const scaleOptions: MatrixScaleOption[] = workbook.choices
        ? extractChoiceItems(workbook.choices, run.listName).map((item) => ({
            code: item.name,
            label: item.label,
          }))
        : [];
      candidates.push({
        id: `matrix_${run.firstRowIndex}`,
        sectionLabel: run.sectionLabel,
        listName: run.listName,
        count: run.memberNames.length,
        memberNames: [...run.memberNames],
        questionLabels: [...run.questionLabels],
        scaleOptions,
      });
    }
    run = null;
  };

  survey.rows.forEach((_row, rowIndex) => {
    const record = rowToRecord(survey, rowIndex);
    const { base, listName } = parseType(record.type ?? "");

    if (base === "begin_group" || base === "begin_repeat") {
      flush();
      const label = (record.label ?? "").trim() || (record.name ?? "").trim() || "Sección";
      sectionStack.push({ id: `sec_${rowIndex}`, label });
      return;
    }
    if (base === "end_group" || base === "end_repeat") {
      flush();
      sectionStack.pop();
      return;
    }

    if (SELECT_BASES.has(base) && listName) {
      const section = currentSection();
      const name = (record.name ?? "").trim();
      const label = (record.label ?? "").trim() || name;
      if (
        run &&
        run.sectionId === section.id &&
        run.listName === listName
      ) {
        run.memberNames.push(name);
        run.questionLabels.push(label);
      } else {
        flush();
        run = {
          sectionId: section.id,
          sectionLabel: section.label,
          listName,
          firstRowIndex: rowIndex,
          memberNames: [name],
          questionLabels: [label],
        };
      }
      return;
    }

    // Cualquier otra fila (texto, nota, cálculo…) corta el run.
    flush();
  });

  flush();
  return candidates;
}
