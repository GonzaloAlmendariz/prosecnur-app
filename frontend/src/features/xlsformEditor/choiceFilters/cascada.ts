// Filtro de opciones en cascada (F2, 2026-10-16): «el filtro de opciones tiene una ventana pero hasta que el editor no
// cree nada no se puede hacer nada con ella». La forma estándar de XLSForm: la lista de la pregunta hija lleva una
// columna con, por cada opción, el código de la respuesta de la pregunta madre que la habilita; la hija declara
// `choice_filter` = `<columna>=${madre}`. Funciones puras: leen y escriben un workbook nuevo.

import type { XlsformEditorSheet, XlsformEditorWorkbook } from "../../../api/multiIntegrado";

export type Cascada = {
  /** `name` de la pregunta madre. */
  madre: string;
  /** Columna de `choices` que vincula cada opción hija con una respuesta de la madre. */
  columna: string;
  /** Código de la opción hija → código de la respuesta madre que la habilita ("" = siempre visible). */
  asignaciones: Record<string, string>;
};

const CASCADA_RE = /^\s*([A-Za-z_][\w.-]*)\s*=\s*\$\{([^}]+)\}\s*$/;

/** Lee un `choice_filter` simple (`columna=${madre}`); `null` si tiene otra forma. */
export function leerExpresionCascada(expr: string): { columna: string; madre: string } | null {
  const m = CASCADA_RE.exec(expr ?? "");
  return m ? { columna: m[1], madre: m[2].trim() } : null;
}

/** Columna sugerida para una madre: `filtro_<madre>`, libre en `choices`. */
export function columnaSugerida(choices: XlsformEditorSheet, madre: string): string {
  const base = `filtro_${madre}`.replace(/[^\w]/g, "_");
  let nombre = base;
  for (let i = 2; choices.columns.includes(nombre) && i < 100; i += 1) nombre = `${base}_${i}`;
  return nombre;
}

function conColumna(hoja: XlsformEditorSheet, columna: string): XlsformEditorSheet {
  if (hoja.columns.includes(columna)) return hoja;
  return { ...hoja, columns: [...hoja.columns, columna], rows: hoja.rows.map((r) => [...r, ""]) };
}

/** Valores actuales de la columna para la lista hija (para editar un filtro existente). */
export function asignacionesActuales(choices: XlsformEditorSheet, lista: string, columna: string): Record<string, string> {
  const iL = choices.columns.indexOf("list_name"), iN = choices.columns.indexOf("name"), iC = choices.columns.indexOf(columna);
  if (iL < 0 || iN < 0 || iC < 0) return {};
  const out: Record<string, string> = {};
  for (const r of choices.rows) if ((r[iL] ?? "").trim() === lista) out[(r[iN] ?? "").trim()] = (r[iC] ?? "").trim();
  return out;
}

/** Escribe la cascada: la columna en `choices` para la lista hija y el `choice_filter` de la fila hija. */
export function aplicarCascada(wb: XlsformEditorWorkbook, filaHija: number, lista: string, c: Cascada): XlsformEditorWorkbook {
  const choices = conColumna(wb.choices, c.columna);
  const iL = choices.columns.indexOf("list_name"), iN = choices.columns.indexOf("name"), iC = choices.columns.indexOf(c.columna);
  const filasChoices = choices.rows.map((r) => {
    if ((r[iL] ?? "").trim() !== lista) return r;
    const codigo = (r[iN] ?? "").trim();
    if (!(codigo in c.asignaciones)) return r;
    const fila = [...r];
    fila[iC] = c.asignaciones[codigo];
    return fila;
  });
  const survey = conColumna(wb.survey, "choice_filter");
  const iF = survey.columns.indexOf("choice_filter");
  const filasSurvey = survey.rows.map((r, i) => {
    if (i !== filaHija) return r;
    const fila = [...r];
    fila[iF] = `${c.columna}=\${${c.madre}}`;
    return fila;
  });
  return { ...wb, choices: { ...choices, rows: filasChoices }, survey: { ...survey, rows: filasSurvey } };
}

/** Quita el filtro de la pregunta (deja la columna de `choices`: otra pregunta puede usarla). */
export function quitarCascada(wb: XlsformEditorWorkbook, filaHija: number): XlsformEditorWorkbook {
  const iF = wb.survey.columns.indexOf("choice_filter");
  if (iF < 0) return wb;
  return { ...wb, survey: { ...wb.survey, rows: wb.survey.rows.map((r, i) => (i === filaHija ? r.map((v, k) => (k === iF ? "" : v)) : r)) } };
}
