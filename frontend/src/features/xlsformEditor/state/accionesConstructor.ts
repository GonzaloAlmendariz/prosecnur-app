// =============================================================================
// state/accionesConstructor.ts — acciones puras del Constructor sobre el borrador del workbook
// =============================================================================
// Rediseño del Constructor (2026-10-17). Cada acción recibe el borrador (copia editable que arma
// `updateWorkbook`) y la estructura derivada ANTES del cambio, muta el borrador y devuelve lo que la página
// necesita para dejar la selección donde corresponde. Sin React: se prueban con Vitest.
// =============================================================================

import { buildType } from "../parsing/parseType";
import { insertRecord, rowToRecord } from "../parsing/sheetUtils";
import type { BuilderStructure, XlsformEditorWorkbook } from "../types";

/**
 * Dónde cae una pieza nueva agregada con el «+» de la Estructura.
 * - `despuesDeFila`: la pieza queda inmediatamente después de esa fila; si es una sección o repetición, después de
 *   su bloque entero (su cierre incluido).
 * - `despuesDeFila: null`: la pieza queda primera dentro de `seccionFila` (o primera del formulario si también es
 *   null).
 * - `seccionFila`: la sección que la contiene (null = el formulario). Sólo decide cuando `despuesDeFila` es null.
 */
export type DestinoInsercion = { despuesDeFila: number | null; seccionFila: number | null };

export type ResultadoInsercion = {
  /** Fila del survey donde quedó la pieza (la apertura, si es una sección). */
  rowIndex: number;
  name: string;
  /** Lista creada para una selección (vacía si no aplica). */
  listName: string;
};

const ES_SECCION = new Set(["begin_group", "section"]);

/** Índice del survey donde se inserta una pieza nueva para el destino dado. */
export function indiceInsercion(structure: BuilderStructure, destino: DestinoInsercion, totalFilas: number): number {
  const tope = (n: number) => Math.max(0, Math.min(n, totalFilas));
  if (destino.despuesDeFila != null) {
    const span = structure.spans.get(destino.despuesDeFila);
    return tope((span ? span.end : destino.despuesDeFila) + 1);
  }
  if (destino.seccionFila != null) return tope(destino.seccionFila + 1);
  return 0;
}

function nombresUsados(draft: XlsformEditorWorkbook): Set<string> {
  const out = new Set<string>();
  draft.survey.rows.forEach((_, i) => {
    const n = (rowToRecord(draft.survey, i).name ?? "").trim();
    if (n) out.add(n);
  });
  return out;
}

function listasUsadas(draft: XlsformEditorWorkbook): Set<string> {
  const out = new Set<string>();
  draft.choices.rows.forEach((_, i) => {
    const n = (rowToRecord(draft.choices, i).list_name ?? "").trim();
    if (n) out.add(n);
  });
  return out;
}

function libre(base: string, usados: Set<string>, desde: number): string {
  let i = desde;
  let candidato = `${base}_${i}`;
  while (usados.has(candidato)) {
    i += 1;
    candidato = `${base}_${i}`;
  }
  return candidato;
}

const ETIQUETA_NUEVA: Readonly<Record<string, string>> = {
  select_one: "Nueva pregunta de selección",
  select_multiple: "Nueva pregunta de selección",
  calculate: "Nuevo cálculo",
  note: "Nueva nota informativa",
};

/**
 * Inserta una pieza en el lugar exacto del «+». Para preguntas reutiliza las reglas de `addQuestion` (nombre
 * `pregunta_N` o `calculo_N`, selección con su lista nueva y vacía, etiqueta por tipo); para una sección inserta el
 * par apertura y cierre. El nombre nunca choca con uno existente.
 */
export function insertarEn(
  draft: XlsformEditorWorkbook,
  structure: BuilderStructure,
  destino: DestinoInsercion,
  baseType: string,
  opciones: { listasExistentes?: Iterable<string> } = {},
): ResultadoInsercion {
  const indice = indiceInsercion(structure, destino, draft.survey.rows.length);
  const usados = nombresUsados(draft);
  const siguiente = draft.survey.rows.length + 1;

  if (ES_SECCION.has(baseType)) {
    const name = libre("seccion", usados, siguiente);
    insertRecord(draft.survey, indice, { type: "begin_group", name, label: "Nueva sección", relevant: "" });
    insertRecord(draft.survey, indice + 1, { type: "end_group" });
    return { rowIndex: indice, name, listName: "" };
  }

  const name = libre(baseType === "calculate" ? "calculo" : "pregunta", usados, siguiente);
  const esSeleccion = baseType === "select_one" || baseType === "select_multiple";
  let listName = "";
  if (esSeleccion) {
    const existentes = listasUsadas(draft);
    for (const l of opciones.listasExistentes ?? []) existentes.add(l);
    listName = existentes.has(`lista_${name}`) ? libre(`lista_${name}`, existentes, 2) : `lista_${name}`;
  }
  insertRecord(draft.survey, indice, {
    type: buildType(baseType, listName),
    name,
    label: ETIQUETA_NUEVA[baseType] ?? "Nueva pregunta",
    hint: "",
    required: "",
    relevant: "",
    constraint: "",
    calculation: "",
    choice_filter: "",
    appearance: "",
  });
  return { rowIndex: indice, name, listName };
}

// -----------------------------------------------------------------------------------------------------------------
// Acciones de la ficha (C20): duplicar, mover a otra sección, convertir en repetición
// -----------------------------------------------------------------------------------------------------------------

/** Rango [inicio, fin] de la pieza: una pregunta es una fila; una sección, su apertura hasta su cierre. */
export function rangoDe(structure: BuilderStructure, rowIndex: number): { start: number; end: number } {
  return structure.spans.get(rowIndex) ?? { start: rowIndex, end: rowIndex };
}

/**
 * Duplica la pieza justo debajo de su bloque. Cada `name` copiado recibe uno libre (`<name>_copia`, `_copia_2`…) y
 * las referencias `${x}` DENTRO de la copia que apuntaban a una pieza copiada pasan a la copia; las que apuntan
 * fuera se quedan como estaban. Devuelve la fila de la copia.
 */
export function duplicarFila(draft: XlsformEditorWorkbook, structure: BuilderStructure, rowIndex: number): { rowIndex: number; name: string } {
  const { start, end } = rangoDe(structure, rowIndex);
  const usados = nombresUsados(draft);
  const colName = draft.survey.columns.indexOf("name");
  const renombres = new Map<string, string>();
  const copia = draft.survey.rows.slice(start, end + 1).map((fila) => [...fila]);
  if (colName >= 0) {
    for (const fila of copia) {
      const viejo = (fila[colName] ?? "").trim();
      if (!viejo) continue;
      let nuevo = `${viejo}_copia`;
      if (usados.has(nuevo)) nuevo = libre(`${viejo}_copia`, usados, 2);
      usados.add(nuevo);
      renombres.set(viejo, nuevo);
      fila[colName] = nuevo;
    }
  }
  if (renombres.size) {
    for (const fila of copia) {
      fila.forEach((celda, i) => {
        if (i === colName || !celda || !celda.includes("${")) return;
        fila[i] = celda.replace(/\$\{\s*([^}\s]+)\s*\}/g, (m, n: string) => (renombres.has(n) ? `\${${renombres.get(n)}}` : m));
      });
    }
  }
  draft.survey.rows.splice(end + 1, 0, ...copia);
  const name = colName >= 0 ? (copia[0]?.[colName] ?? "") : "";
  return { rowIndex: end + 1, name };
}

export type SeccionDestino = { rowIndex: number | null; etiqueta: string; profundidad: number };

/**
 * Secciones a las que se puede mover la pieza: el formulario (rowIndex null) y cada sección o repetición que no sea
 * la que ya la contiene ni la pieza misma o una de sus descendientes.
 */
export function seccionesDestino(structure: BuilderStructure, rowIndex: number): SeccionDestino[] {
  const { start, end } = rangoDe(structure, rowIndex);
  // La fila de apertura de una sección pertenece a esa sección: la que la contiene es su madre.
  const propia = structure.sections.get(`section-${rowIndex}`);
  const actual = (propia ? propia.parentId : structure.rowToSectionId.get(rowIndex)) ?? "root";
  const out: SeccionDestino[] = [];
  if (actual !== "root") out.push({ rowIndex: null, etiqueta: "Fuera de toda sección", profundidad: 0 });
  for (const meta of structure.sections.values()) {
    if (meta.kind === "root" || meta.rowIndex == null) continue;
    if (meta.rowIndex >= start && meta.rowIndex <= end) continue;
    if (meta.id === actual) continue;
    out.push({ rowIndex: meta.rowIndex, etiqueta: (meta.label || meta.name || "Sección sin título").trim(), profundidad: Math.max(0, meta.depth) });
  }
  return out.sort((a, b) => (a.rowIndex ?? -1) - (b.rowIndex ?? -1));
}

/** Plan para llevar la pieza al final de otra sección (o del formulario, con `seccionFila` null). */
export function planMoverASeccion(
  structure: BuilderStructure,
  rowIndex: number,
  seccionFila: number | null,
  totalFilas: number,
): { fromStart: number; count: number; insertAt: number; newStart: number } | null {
  const { start, end } = rangoDe(structure, rowIndex);
  const count = end - start + 1;
  let destino: number;
  if (seccionFila == null) destino = totalFilas;
  else {
    const meta = structure.sections.get(`section-${seccionFila}`);
    if (!meta || meta.endRowIndex == null) return null;
    if (seccionFila >= start && seccionFila <= end) return null;
    destino = meta.endRowIndex;
  }
  const insertAt = destino > end ? destino - count : destino;
  if (insertAt === start) return null;
  return { fromStart: start, count, insertAt, newStart: insertAt };
}

const APERTURA = /^begin[\s_]+(group|repeat)\b/i;
const CIERRE = /^end[\s_]+(group|repeat)\b/i;

/** Convierte una sección en repetición o al revés: cambia la apertura y su cierre. */
export function alternarRepeticion(draft: XlsformEditorWorkbook, structure: BuilderStructure, rowIndex: number): "repeat" | "group" | null {
  const { end } = rangoDe(structure, rowIndex);
  const colType = draft.survey.columns.indexOf("type");
  if (colType < 0) return null;
  const abre = draft.survey.rows[rowIndex]?.[colType] ?? "";
  const m = abre.trim().match(APERTURA);
  if (!m) return null;
  const nuevo = m[1]!.toLowerCase() === "group" ? "repeat" : "group";
  const fila = [...draft.survey.rows[rowIndex]!];
  fila[colType] = `begin_${nuevo}`;
  draft.survey.rows[rowIndex] = fila;
  const cierre = draft.survey.rows[end];
  if (end !== rowIndex && cierre && CIERRE.test((cierre[colType] ?? "").trim())) {
    const filaCierre = [...cierre];
    filaCierre[colType] = `end_${nuevo}`;
    draft.survey.rows[end] = filaCierre;
  }
  return nuevo;
}
