// =============================================================================
// shell/formCardMetrics.ts — métricas ligeras de una tarjeta de formulario
// =============================================================================
// El hub pinta una tarjeta por formulario con dos números: cuántas preguntas
// tiene y cuántas secciones. Ambos se calculan sobre la hoja `survey` del
// workbook (localStorage), sin ir al backend. La lógica es pura y testeada:
// el `.tsx` de la tarjeta solo la presenta.
// =============================================================================

import type { XlsformEditorWorkbook } from "../types";
import { parseType } from "../parsing/parseType";

/** Bases de `type` que NO cuentan como pregunta (marcadores de estructura). */
const STRUCTURAL_BASES = new Set([
  "begin_group",
  "end_group",
  "begin_repeat",
  "end_repeat",
]);

export type FormCardMetrics = {
  /** Filas de `survey` cuyo `type` no es begin/end group/repeat (ni vacío). */
  questions: number;
  /** Número de secciones = grupos (`begin_group`). */
  sections: number;
};

/** Índice de una columna en una hoja; -1 si no existe. */
function columnIndex(columns: readonly string[], name: string): number {
  return columns.indexOf(name);
}

/**
 * Cuenta preguntas y secciones sobre la hoja `survey`. Defensivo ante hojas
 * ausentes o sin columna `type` (devuelve ceros).
 */
export function computeFormMetrics(
  workbook: XlsformEditorWorkbook | null | undefined,
): FormCardMetrics {
  const survey = workbook?.survey;
  if (!survey || !Array.isArray(survey.rows) || survey.rows.length === 0) {
    return { questions: 0, sections: 0 };
  }
  const typeIdx = columnIndex(survey.columns, "type");
  if (typeIdx < 0) return { questions: 0, sections: 0 };

  let questions = 0;
  let sections = 0;
  for (const row of survey.rows) {
    const rawType = typeof row[typeIdx] === "string" ? row[typeIdx] : "";
    const { base } = parseType(rawType);
    if (!base) continue;
    if (base === "begin_group") sections += 1;
    if (!STRUCTURAL_BASES.has(base)) questions += 1;
  }
  return { questions, sections };
}

/**
 * Formatea un timestamp de guardado a texto relativo en español
 * ("hace 3 min", "hace 2 d"). `now` es inyectable para tests.
 */
export function formatRelativeSavedAt(ts: number, now: number = Date.now()): string {
  const diffMs = now - ts;
  if (diffMs < 0) return "recién";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return "recién";
  const min = Math.floor(sec / 60);
  if (min < 1) return "hace instantes";
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `hace ${day} d`;
  const month = Math.floor(day / 30);
  if (month < 12) return `hace ${month} mes${month === 1 ? "" : "es"}`;
  const year = Math.floor(day / 365);
  return `hace ${year} año${year === 1 ? "" : "s"}`;
}

export type FormOrigin = "blank" | "xlsform" | "surveymonkey";

/** Normaliza el `kind` del origen a uno de los tres tipos conocidos. */
export function normalizeOrigin(kind: string | null | undefined): FormOrigin {
  if (kind === "xlsform") return "xlsform";
  if (kind === "surveymonkey") return "surveymonkey";
  return "blank";
}

/** Etiqueta humana del origen de un formulario. */
export function originLabel(origin: FormOrigin): string {
  switch (origin) {
    case "xlsform":
      return "Importado de XLSForm";
    case "surveymonkey":
      return "Traducido de SurveyMonkey";
    default:
      return "Creado de cero";
  }
}
