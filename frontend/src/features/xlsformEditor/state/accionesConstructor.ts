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
