// Filtro «por opción» (C27, 2026-10-17): cada opción de la lista la habilita una pregunta distinta. Es el patrón del
// hostigamiento (Tipo 2): «¿cuál fue la más grave?» sólo ofrece las formas que la persona dijo haber vivido.
//
//   choice_filter = filter_P14=${P14} or filter_P15=${P15} or … or name = '0'
//   choices: la opción 1 lleva en filter_P14 la respuesta de P14 que la habilita; la 2, en filter_P15; …
//
// Forma vieja: si varias respuestas habilitan la misma opción (P14 = 2, 3, 4 o 5), la opción se repetía en `choices`,
// una fila por valor, y exigía `allow_choice_duplicates`. Se sigue leyendo.
// Forma que escribe este módulo (compacta): una fila por opción y los valores separados por espacio en filter_P14,
//   choice_filter = selected(filter_P14, ${P14}) or selected(filter_P15, ${P15}) or … or name = '0'
// sin opciones repetidas. Ambas formas las traduce el motor de lectura (reglas/motor/filtros.ts).
// Funciones puras: leen y devuelven un workbook nuevo.

import type { XlsformEditorSheet, XlsformEditorWorkbook } from "../../../api/multiIntegrado";

export type TerminoPorOpcion = { columna: string; pregunta: string };

export type LecturaPorOpcion = {
  terminos: TerminoPorOpcion[];
  /** Códigos de las opciones que se muestran siempre (`name = '0'`). */
  siempre: string[];
};

/** Qué habilita una opción: la pregunta y sus respuestas. Sin pregunta, la opción se muestra siempre. */
export type AsignacionOpcion = { pregunta: string; valores: string[]; /** Sin pregunta y sin mostrarse nunca. */ oculta?: boolean };

const TERMINO_COLUMNA = /^\s*\(?\s*([A-Za-z_][\w.-]*)\s*=\s*\$\{\s*([^}\s]+)\s*\}\s*\)?\s*$/;
const TERMINO_COMPACTO = /^\s*\(?\s*selected\(\s*([A-Za-z_][\w.-]*)\s*,\s*\$\{\s*([^}\s]+)\s*\}\s*\)\s*\)?\s*$/;
const TERMINO_NAME = /^\s*\(?\s*name\s*=\s*['"]([^'"]*)['"]\s*\)?\s*$/;

/**
 * Lee un `choice_filter` por opción. Pide al menos dos términos de columna, o uno con opciones fijas: un solo
 * `columna=${madre}` es la cascada simple, que tiene su propio editor.
 */
export function leerPorOpcion(expr: string): LecturaPorOpcion | null {
  const texto = (expr ?? "").trim();
  if (!texto || /\band\b/.test(texto)) return null;
  const terminos: TerminoPorOpcion[] = [];
  const siempre: string[] = [];
  let compacta = false;
  for (const parte of texto.split(/\s+or\s+/)) {
    const s = TERMINO_COMPACTO.exec(parte);
    if (s && s[1] !== "name") {
      terminos.push({ columna: s[1], pregunta: s[2] });
      compacta = true;
      continue;
    }
    const c = TERMINO_COLUMNA.exec(parte);
    if (c && c[1] !== "name") {
      terminos.push({ columna: c[1], pregunta: c[2] });
      continue;
    }
    const n = TERMINO_NAME.exec(parte);
    if (n) {
      siempre.push(n[1]);
      continue;
    }
    return null;
  }
  if (terminos.length === 0) return null;
  // Un solo `columna=${madre}` es la cascada; un solo `selected(columna, ${madre})` ya es la forma por opción.
  if (terminos.length === 1 && siempre.length === 0 && !compacta) return null;
  return { terminos, siempre };
}

function indices(choices: XlsformEditorSheet) {
  return { iL: choices.columns.indexOf("list_name"), iN: choices.columns.indexOf("name") };
}

/** Códigos de las opciones de la lista en su orden, sin repetir (la forma original repite una opción por valor). */
export function opcionesDeLista(choices: XlsformEditorSheet, lista: string): string[] {
  const { iL, iN } = indices(choices);
  if (iL < 0 || iN < 0) return [];
  const vistas: string[] = [];
  for (const r of choices.rows) {
    if ((r[iL] ?? "").trim() !== lista) continue;
    const codigo = (r[iN] ?? "").trim();
    if (!vistas.includes(codigo)) vistas.push(codigo);
  }
  return vistas;
}

/** Lo que hoy habilita cada opción, leído de las columnas del filtro (juntando las filas repetidas). */
export function asignacionesPorOpcion(choices: XlsformEditorSheet, lista: string, lectura: LecturaPorOpcion): Record<string, AsignacionOpcion> {
  const { iL, iN } = indices(choices);
  const out: Record<string, AsignacionOpcion> = {};
  if (iL < 0 || iN < 0) return out;
  const cols = lectura.terminos.map((t) => ({ ...t, i: choices.columns.indexOf(t.columna) })).filter((t) => t.i >= 0);
  for (const r of choices.rows) {
    if ((r[iL] ?? "").trim() !== lista) continue;
    const codigo = (r[iN] ?? "").trim();
    const actual = out[codigo] ?? { pregunta: "", valores: [] };
    for (const t of cols) {
      // Forma compacta: «2 3 4» en una celda. Forma vieja: un valor por fila repetida.
      const vs = (r[t.i] ?? "").trim().split(/\s+/).filter(Boolean);
      if (!vs.length) continue;
      if (!actual.pregunta) actual.pregunta = t.pregunta;
      if (actual.pregunta === t.pregunta) for (const v of vs) if (!actual.valores.includes(v)) actual.valores.push(v);
      break;
    }
    out[codigo] = actual;
  }
  for (const [codigo, a] of Object.entries(out)) if (!a.pregunta && !lectura.siempre.includes(codigo)) a.oculta = true;
  return out;
}

/** Columna donde vive la pregunta: la que ya usaba el filtro para ella, o `filter_<pregunta>`. */
export function columnaPara(pregunta: string, previa: LecturaPorOpcion | null): string {
  return previa?.terminos.find((t) => t.pregunta === pregunta)?.columna ?? `filter_${pregunta}`.replace(/[^\w.-]/g, "_");
}

/** La expresión que resulta de una tabla de asignaciones, en el orden de las opciones. */
export function expresionPorOpcion(orden: readonly string[], asignaciones: Record<string, AsignacionOpcion>, previa: LecturaPorOpcion | null): string {
  const preguntas: string[] = [];
  const siempre: string[] = [];
  for (const codigo of orden) {
    const a = asignaciones[codigo];
    if (a?.pregunta && a.valores.length) {
      if (!preguntas.includes(a.pregunta)) preguntas.push(a.pregunta);
    } else if (!a?.pregunta && !a?.oculta) {
      siempre.push(codigo);
    }
  }
  const partes = [
    ...preguntas.map((q) => `selected(${columnaPara(q, previa)}, \${${q}})`),
    ...siempre.map((c) => `name = '${c}'`),
  ];
  return partes.join(" or ");
}

function conColumnas(hoja: XlsformEditorSheet, columnas: readonly string[]): XlsformEditorSheet {
  const faltan = columnas.filter((c) => !hoja.columns.includes(c));
  if (!faltan.length) return hoja;
  return { ...hoja, columns: [...hoja.columns, ...faltan], rows: hoja.rows.map((r) => [...r, ...faltan.map(() => "")]) };
}

/**
 * Escribe el filtro en la forma compacta: reemplaza las filas de la lista (en el lugar de la primera) por una fila por
 * opción, con las respuestas que la habilitan separadas por espacio en la columna de su pregunta, y pone la expresión
 * `selected(columna, ${pregunta})` en la pregunta. Las filas repetidas de la forma vieja se funden en una. Una opción
 * sin pregunta queda visible siempre (`name = '…'`); una con pregunta pero sin respuestas no se muestra nunca. No toca
 * settings: sin opciones repetidas no hace falta `allow_choice_duplicates`.
 */
export function aplicarPorOpcion(
  wb: XlsformEditorWorkbook,
  filaPregunta: number,
  lista: string,
  asignaciones: Record<string, AsignacionOpcion>,
  previa: LecturaPorOpcion | null,
): XlsformEditorWorkbook {
  const orden = opcionesDeLista(wb.choices, lista);
  const usadas = [...new Set(orden.map((c) => asignaciones[c]?.pregunta).filter((q): q is string => Boolean(q)))];
  const nuevas = usadas.map((q) => columnaPara(q, previa));
  const limpiar = [...new Set([...(previa?.terminos.map((t) => t.columna) ?? []), ...nuevas])];
  const choices = conColumnas(wb.choices, nuevas);
  const { iL, iN } = indices(choices);
  const iLimpiar = limpiar.map((c) => choices.columns.indexOf(c)).filter((i) => i >= 0);

  const primeraPorCodigo = new Map<string, string[]>();
  let inicio = -1;
  choices.rows.forEach((r, k) => {
    if ((r[iL] ?? "").trim() !== lista) return;
    if (inicio < 0) inicio = k;
    const codigo = (r[iN] ?? "").trim();
    if (!primeraPorCodigo.has(codigo)) primeraPorCodigo.set(codigo, r);
  });
  const bloque: string[][] = [];
  for (const codigo of orden) {
    const base = (primeraPorCodigo.get(codigo) ?? []).map((v, j) => (iLimpiar.includes(j) ? "" : v));
    const a = asignaciones[codigo];
    if (a?.pregunta && a.valores.length) {
      const iC = choices.columns.indexOf(columnaPara(a.pregunta, previa));
      bloque.push(base.map((x, j) => (j === iC ? a.valores.join(" ") : x)));
    } else {
      bloque.push(base);
    }
  }
  const filas: string[][] = [];
  choices.rows.forEach((r, k) => {
    if (k === inicio) filas.push(...bloque);
    if ((r[iL] ?? "").trim() !== lista) filas.push(r);
  });

  const survey = conColumnas(wb.survey, ["choice_filter"]);
  const iF = survey.columns.indexOf("choice_filter");
  const expresion = expresionPorOpcion(orden, asignaciones, previa);
  const filasSurvey = survey.rows.map((r, i) => (i === filaPregunta ? r.map((v, j) => (j === iF ? expresion : v)) : r));
  return {
    ...wb,
    choices: { ...choices, rows: filas },
    survey: { ...survey, rows: filasSurvey },
  };
}
