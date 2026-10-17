// Modelo de la pestaña «Listas de opciones» (2026-10-16): el catálogo deja de ser un panel lateral. Cada lista se
// nombra por lo que contiene («Sí, No»), no sólo por su código (`lst_p0003`), y se agrupa por lo que pide atención:
// las repetidas (se pueden unificar), las que usa el formulario y las que nadie usa.

import type { BuilderNode, BuilderStructure, CatalogSummary } from "../types";
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
  const item = (c: CatalogSummary) => ({
    key: c.listName,
    baseType: tipoDeLista(structure, c.listName),
    numero: String(c.items.length),
    titulo: nombreLegible(c.items),
    resumen: `${c.listName}, ${usosTexto(usos[c.listName] ?? 0)}`,
    aviso: (usos[c.listName] ?? 0) === 0,
  });
  return [
    { titulo: "Se repiten", items: catalogs.filter((c) => enRepetidas.has(c.listName)).map(item) },
    { titulo: "En uso", items: catalogs.filter((c) => !enRepetidas.has(c.listName) && (usos[c.listName] ?? 0) > 0).map(item) },
    { titulo: "Sin uso", items: catalogs.filter((c) => !enRepetidas.has(c.listName) && (usos[c.listName] ?? 0) === 0).map(item) },
  ];
}
