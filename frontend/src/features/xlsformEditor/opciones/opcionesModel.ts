// Modelo de la pestaña «Listas de opciones» (2026-10-16): el catálogo deja de ser un panel lateral. Cada lista se
// nombra por lo que contiene («Sí, No»), no sólo por su código (`lst_p0003`), y se agrupa por lo que pide atención:
// las repetidas (se pueden unificar), las que usa el formulario y las que nadie usa.

import type { BuilderNode, BuilderStructure, CatalogSummary } from "../types";
import { stripMarkdown } from "../helpers/markdown";
import { repeticionesDe } from "../logic/repeticiones";
import type { GrupoListasRepetidas } from "../listas/listasModel";
import type { ReglaListaGrupo } from "../pestanas/PestanaReglas";

/** Las primeras etiquetas de la lista, para nombrarla por su contenido. */
export function nombreLegible(items: readonly { label: string; name: string }[], max = 3): string {
  const etiquetas = items.map((i) => (i.label || i.name).trim()).filter(Boolean);
  if (!etiquetas.length) return "Sin opciones";
  const vistas = etiquetas.slice(0, max).join(", ");
  const resto = etiquetas.length - max;
  return resto > 0 ? `${vistas} y ${resto} más` : vistas;
}

/** Preguntas que usan la lista (select_one / select_multiple / rank con ese list_name). */
export function usosDeLista(structure: BuilderStructure | null, listName: string): BuilderNode[] {
  if (!structure || !listName) return [];
  return structure.outline.filter((n) => n.typeInfo.listName === listName);
}

/** Tipo con el que se dibuja la lista: el de su primera pregunta, o selección única si nadie la usa. */
export function tipoDeLista(structure: BuilderStructure | null, listName: string): string {
  return usosDeLista(structure, listName)[0]?.typeInfo.base || "select_one";
}

/** Cuántas preguntas usan cada lista, leído de la estructura del editor: entiende la lista en `type` y también en
 * una columna `list_name` o `select_from_list_name` aparte, que el conteo sobre la columna `type` no veía (H1). */
export function usosPorLista(structure: BuilderStructure | null, catalogs: readonly CatalogSummary[]): Record<string, number> {
  const usos: Record<string, number> = Object.fromEntries(catalogs.map((c) => [c.listName, 0]));
  for (const n of structure?.outline ?? []) {
    const l = n.typeInfo.listName;
    if (l && l in usos) usos[l] += 1;
  }
  return usos;
}

/**
 * De dónde salen las opciones de una lista que NO vive en la hoja choices (S3, 2026-10-17):
 *  - `repeticion` → `select_one ${x}`: las respuestas a `x`, una por cada fila de la repetición que la contiene.
 *  - `archivo`    → `select_one_from_file archivo.csv`: las filas de un archivo externo.
 *  - `busqueda`   → appearance `search(…)`: las filas de un CSV externo, al momento de responder.
 * null: una lista normal de choices.
 */
export type OrigenLista =
  | { tipo: "repeticion"; variable: string; etiquetaVariable: string; repeticion: string | null }
  | { tipo: "archivo"; archivo: string }
  | { tipo: "busqueda"; archivo: string | null };

const DE_VARIABLE = /^\$\{\s*([^}\s]+)\s*\}$/;
const limpia = (s: string) => stripMarkdown(s).replace(/\s+/g, " ").trim();

export function origenDeLista(listName: string, structure: BuilderStructure | null): OrigenLista | null {
  const nombre = listName.trim();
  const m = nombre.match(DE_VARIABLE);
  if (m) {
    const variable = m[1]!;
    const nodo = structure?.outline.find((n) => n.name === variable) ?? null;
    const reps = nodo ? repeticionesDe(nodo, structure) : [];
    const etiqueta = nodo ? limpia(nodo.label) : "";
    return { tipo: "repeticion", variable, etiquetaVariable: etiqueta && etiqueta !== variable ? etiqueta : variable, repeticion: reps[reps.length - 1]?.etiqueta ?? null };
  }
  const usos = usosDeLista(structure, nombre);
  if (usos.some((n) => /_from_file$/.test(n.typeInfo.base))) return { tipo: "archivo", archivo: nombre };
  const busqueda = usos.map((n) => n.appearance.match(/search\(\s*['"]([^'"]+)['"]/)).find(Boolean);
  if (busqueda !== undefined || usos.some((n) => /search\(/.test(n.appearance))) return { tipo: "busqueda", archivo: busqueda?.[1] ?? null };
  return null;
}

/** La frase que explica de dónde salen las opciones de una lista dinámica. */
export function textoOrigen(o: OrigenLista): string {
  switch (o.tipo) {
    case "repeticion":
      return o.repeticion
        ? `Las opciones son las respuestas a «${o.etiquetaVariable}», una por cada fila registrada en la repetición «${o.repeticion}». No se escriben aquí: salen de lo que se anota en la entrevista.`
        : `Las opciones son las respuestas a «${o.etiquetaVariable}» que se registran en la entrevista. No se escriben aquí.`;
    case "archivo":
      return `Las opciones salen del archivo ${o.archivo}, que se adjunta al formulario. No se escriben aquí.`;
    case "busqueda":
      return o.archivo
        ? `Las opciones salen del archivo ${o.archivo}.csv al momento de responder (búsqueda). No se escriben aquí.`
        : "Las opciones salen de un archivo externo al momento de responder (búsqueda). No se escriben aquí.";
  }
}

/** Nombre corto de una lista dinámica para la lista de la izquierda. */
export function nombreDeOrigen(o: OrigenLista): string {
  if (o.tipo === "repeticion") return o.repeticion ? `Filas de «${o.repeticion}»` : `Respuestas a «${o.etiquetaVariable}»`;
  return o.tipo === "archivo" ? `Archivo ${o.archivo}` : "Búsqueda en archivo";
}

function usosTexto(n: number): string {
  return n === 0 ? "sin uso" : n === 1 ? "en 1 pregunta" : `en ${n} preguntas`;
}

export function gruposDeListas(
  catalogs: readonly CatalogSummary[],
  usos: Readonly<Record<string, number>>,
  repetidas: readonly GrupoListasRepetidas[],
  structure: BuilderStructure | null,
): ReglaListaGrupo[] {
  const enRepetidas = new Set(repetidas.flatMap((g) => g.listas));
  const item = (c: CatalogSummary) => {
    const origen = c.items.length === 0 ? origenDeLista(c.listName, structure) : null;
    return {
    key: c.listName,
    baseType: tipoDeLista(structure, c.listName),
    numero: origen ? "·" : String(c.items.length),
    titulo: origen ? nombreDeOrigen(origen) : nombreLegible(c.items),
    resumen: `${c.listName}, ${usosTexto(usos[c.listName] ?? 0)}`,
    aviso: (usos[c.listName] ?? 0) === 0,
    };
  };
  return [
    { titulo: "Se repiten", items: catalogs.filter((c) => enRepetidas.has(c.listName)).map(item) },
    { titulo: "En uso", items: catalogs.filter((c) => !enRepetidas.has(c.listName) && (usos[c.listName] ?? 0) > 0).map(item) },
    { titulo: "Sin uso", items: catalogs.filter((c) => !enRepetidas.has(c.listName) && (usos[c.listName] ?? 0) === 0).map(item) },
  ];
}
