// Escritura de filtros de opciones (E5, 2026-10-20). Funciones puras: reciben un workbook y devuelven otro.
// Las celdas van en choices (la columna de la cascada, la del filtro fijo o las filter_* del filtro por opción) y la
// expresión en la columna choice_filter de la pregunta. El filtro por opción se escribe con porOpcion.ts.

import type { XlsformEditorSheet, XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { aplicarCascada, quitarCascada } from "./cascada";
import { columnaPara, opcionesDeLista } from "./porOpcion";
import type { FormaCascada, LecturaCascada, LecturaFijo } from "./modeloFiltros";

export { quitarCascada as quitarFiltro };

/** Pone la expresión en la columna choice_filter de la fila (crea la columna si falta). */
export function conExpresion(wb: XlsformEditorWorkbook, fila: number, expresion: string): XlsformEditorWorkbook {
  const cols = wb.survey.columns.includes("choice_filter") ? wb.survey.columns : [...wb.survey.columns, "choice_filter"];
  const iF = cols.indexOf("choice_filter");
  const rows = wb.survey.rows.map((r, i) => {
    const base = r.length < cols.length ? [...r, ...Array<string>(cols.length - r.length).fill("")] : r;
    return i === fila ? base.map((v, j) => (j === iF ? expresion : v)) : base;
  });
  return { ...wb, survey: { ...wb.survey, columns: cols, rows } };
}

function conColumna(hoja: XlsformEditorSheet, columna: string): XlsformEditorSheet {
  if (hoja.columns.includes(columna)) return hoja;
  return { ...hoja, columns: [...hoja.columns, columna], rows: hoja.rows.map((r) => [...r, ""]) };
}

/** Cambia la celda `columna` de todas las filas de la lista cuyo código está en `nuevo` (función del valor actual). */
function editarCeldas(wb: XlsformEditorWorkbook, lista: string, columna: string, nuevo: (codigo: string, actual: string) => string | null): XlsformEditorWorkbook {
  const choices = conColumna(wb.choices, columna);
  const iL = choices.columns.indexOf("list_name");
  const iN = choices.columns.indexOf("name");
  const iC = choices.columns.indexOf(columna);
  let cambio = choices !== wb.choices;
  const rows = choices.rows.map((r) => {
    if ((r[iL] ?? "").trim() !== lista) return r;
    const actual = (r[iC] ?? "").trim();
    const v = nuevo((r[iN] ?? "").trim(), actual);
    if (v === null || v === actual) return r;
    cambio = true;
    const f = r.length < choices.columns.length ? [...r, ...Array<string>(choices.columns.length - r.length).fill("")] : [...r];
    f[iC] = v;
    return f;
  });
  return cambio ? { ...wb, choices: { ...choices, rows } } : wb;
}

/**
 * Marca o desmarca la respuesta de la madre en una opción de la cascada. Con `igual` y `marcada` la celda guarda una
 * respuesta (marcar otra la reemplaza); con `incluye` guarda varias separadas por espacio.
 */
export function marcarCascada(wb: XlsformEditorWorkbook, lista: string, columna: string, forma: FormaCascada, codigo: string, respuesta: string): XlsformEditorWorkbook {
  return editarCeldas(wb, lista, columna, (c, actual) => {
    if (c !== codigo) return null;
    if (forma !== "incluye") return actual === respuesta ? "" : respuesta;
    const vs = actual.split(/\s+/).filter(Boolean);
    return (vs.includes(respuesta) ? vs.filter((v) => v !== respuesta) : [...vs, respuesta]).join(" ");
  });
}

/** La expresión de una cascada con sus opciones fijas. */
export function expresionCascada(c: LecturaCascada): string {
  const base = c.forma === "igual"
    ? `${c.columna} = \${${c.madre}}`
    : c.forma === "marcada"
      ? `selected(\${${c.madre}}, ${c.columna})`
      : `selected(${c.columna}, \${${c.madre}})`;
  return [base, ...c.siempre.map((s) => `name = '${s}'`)].join(" or ");
}

/** Hace fija (o deja de hacer fija) una opción de la cascada: aparece siempre, responda lo que responda. */
export function alternarFijaCascada(wb: XlsformEditorWorkbook, fila: number, c: LecturaCascada, codigo: string): XlsformEditorWorkbook {
  const siempre = c.siempre.includes(codigo) ? c.siempre.filter((s) => s !== codigo) : [...c.siempre, codigo];
  return conExpresion(wb, fila, expresionCascada({ ...c, siempre }));
}

/** Corrige códigos huérfanos de una columna (sólo en las filas de la lista). */
export function reemplazarCodigos(wb: XlsformEditorWorkbook, lista: string, columna: string, cambios: readonly { de: string; a: string }[]): XlsformEditorWorkbook {
  const mapa = new Map(cambios.map((c) => [c.de, c.a]));
  return editarCeldas(wb, lista, columna, (_c, actual) => mapa.get(actual) ?? null);
}

/** Cambia una columna de choices por otra en la expresión (no toca `${…}` ni texto entre comillas). */
export function renombrarColumna(expresion: string, de: string, a: string): string {
  const partes = expresion.split(/(\$\{[^}]*\}|'[^']*'|"[^"]*")/);
  const re = new RegExp(`(?<![\\w.-])${de.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w.-])`, "g");
  return partes.map((p, i) => (i % 2 === 1 ? p : p.replace(re, a))).join("");
}

/** La expresión de un filtro fijo por nombres. */
const expresionNombres = (codigos: readonly string[]) => codigos.map((c) => `name = '${c}'`).join(" or ");

/** Muestra u oculta opciones de un filtro fijo: con columna escribe las celdas; con nombres reescribe la expresión. */
export function marcarFijo(wb: XlsformEditorWorkbook, fila: number, lista: string, fijo: LecturaFijo, codigos: readonly string[], visibles: boolean): XlsformEditorWorkbook {
  if (fijo.forma === "columna") {
    const set = new Set(codigos);
    return editarCeldas(wb, lista, fijo.columna, (c, actual) => {
      if (!set.has(c)) return null;
      if (visibles) return fijo.valor;
      return actual === fijo.valor ? "" : null;
    });
  }
  const orden = opcionesDeLista(wb.choices, lista);
  const actuales = new Set(fijo.codigos);
  for (const c of codigos) if (visibles) actuales.add(c); else actuales.delete(c);
  const nuevos = orden.filter((c) => actuales.has(c));
  return conExpresion(wb, fila, nuevos.length ? expresionNombres(nuevos) : "name = ''");
}

/** Lo que pide cada forma al crear o cambiar un filtro. */
export type Intento =
  | { forma: "cascada"; madre: string; columna: string }
  | { forma: "opcion"; preguntas: string[] }
  | { forma: "fijo"; columna: string; valor: string }
  | { forma: "expresion"; texto: string };

/** ¿Tiene el intento lo mínimo para escribirse? */
export function intentoCompleto(i: Intento): boolean {
  if (i.forma === "cascada") return !!i.madre && /^[A-Za-z_][\w.-]*$/.test(i.columna);
  if (i.forma === "opcion") return i.preguntas.length >= 2;
  if (i.forma === "fijo") return /^[A-Za-z_][\w.-]*$/.test(i.columna) && i.columna !== "name" && !!i.valor.trim();
  return !!i.texto.trim();
}

/**
 * Escribe un filtro nuevo (o reemplaza el que había) en la pregunta de la fila `fila`, cuya lista es `lista`.
 *  - cascada: la columna (vacía si es nueva; si ya existe conserva sus valores) y `col = ${madre}`;
 *  - por opción: una columna filter_* vacía por pregunta y todas las opciones fijas, para repartirlas en la matriz;
 *  - fijo: la columna con todas las opciones marcadas si es nueva (nada cambia para el encuestado hasta desmarcar);
 *  - expresión: el texto tal cual.
 */
export function escribirIntento(wb: XlsformEditorWorkbook, fila: number, lista: string, i: Intento): XlsformEditorWorkbook {
  if (i.forma === "cascada") return aplicarCascada(wb, fila, lista, { madre: i.madre, columna: i.columna, asignaciones: {} });
  if (i.forma === "opcion") {
    const columnas = i.preguntas.map((p) => columnaPara(p, null));
    let choices = wb.choices;
    for (const c of columnas) choices = conColumna(choices, c);
    const codigos = opcionesDeLista(choices, lista);
    const expr = [...i.preguntas.map((p, k) => `selected(${columnas[k]}, \${${p}})`), ...codigos.map((c) => `name = '${c}'`)].join(" or ");
    return conExpresion({ ...wb, choices }, fila, expr);
  }
  if (i.forma === "fijo") {
    const nueva = !wb.choices.columns.includes(i.columna);
    const base = nueva ? editarCeldas(wb, lista, i.columna, () => i.valor.trim()) : wb;
    return conExpresion(base, fila, `${i.columna} = '${i.valor.trim().replace(/'/g, "")}'`);
  }
  return conExpresion(wb, fila, i.texto.trim());
}
