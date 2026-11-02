// Tipos de variable del explorador: cómo se nombran, cómo se filtran y cuánto
// dato tiene cada una. Puro (sin React) para que la lista, el selector de cruce
// y la cabecera digan lo mismo.

import type { ExploradorVariable } from "../../types";

export type TipoVariable = ExploradorVariable["tipo"];

/** Familias que se ofrecen como chips. «mixto» no es un filtro: entra sólo en «Todas». */
export type FamiliaTipo = "todas" | "so" | "sm" | "num" | "fecha" | "texto";

export const FAMILIAS_TIPO: readonly { id: FamiliaTipo; etiqueta: string }[] = [
  { id: "todas", etiqueta: "Todas" },
  { id: "so", etiqueta: "Única" },
  { id: "sm", etiqueta: "Múltiple" },
  { id: "num", etiqueta: "Numérica" },
  { id: "fecha", etiqueta: "Fecha" },
  { id: "texto", etiqueta: "Abierta" },
];

/** Etiqueta corta (insignia) y larga (cabecera) de cada tipo. */
export const TIPO_ETIQUETA: Readonly<Record<TipoVariable, { corta: string; larga: string }>> = {
  so: { corta: "Única", larga: "Selección única" },
  sm: { corta: "Múlt.", larga: "Selección múltiple" },
  num: { corta: "Núm.", larga: "Numérica" },
  fecha: { corta: "Fecha", larga: "Fecha" },
  texto: { corta: "Abierta", larga: "Respuesta abierta" },
  mixto: { corta: "Mixto", larga: "Tipo mixto" },
};

/** Tipo XLSForm cuyo sello (editor de formularios) representa a cada tipo del explorador. */
export const TIPO_XLSFORM: Readonly<Record<TipoVariable, string>> = {
  so: "select_one",
  sm: "select_multiple",
  num: "decimal",
  fecha: "date",
  texto: "text",
  mixto: "calculate",
};

/** Fracción de casos con dato, o null si la variable no tiene casos. */
export function completitud(v: Pick<ExploradorVariable, "n_validos" | "n_nulos">): number | null {
  const total = v.n_validos + v.n_nulos;
  return total > 0 ? v.n_validos / total : null;
}

/** Bajo este umbral la barra de completitud se pinta en ámbar. */
export const UMBRAL_COMPLETITUD = 0.8;

export function enFamilia(v: Pick<ExploradorVariable, "tipo">, familia: FamiliaTipo): boolean {
  return familia === "todas" || v.tipo === familia;
}

export function conteoPorFamilia(variables: readonly Pick<ExploradorVariable, "tipo">[]): Record<FamiliaTipo, number> {
  const conteo: Record<FamiliaTipo, number> = { todas: variables.length, so: 0, sm: 0, num: 0, fecha: 0, texto: 0 };
  for (const v of variables) {
    if (v.tipo !== "mixto") conteo[v.tipo] += 1;
  }
  return conteo;
}

/** Busca por texto de la pregunta o por código, sin mayúsculas ni tildes. */
export function normalizarBusqueda(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function coincide(v: Pick<ExploradorVariable, "name" | "label">, consulta: string): boolean {
  const q = normalizarBusqueda(consulta);
  if (!q) return true;
  return normalizarBusqueda(v.name).includes(q) || normalizarBusqueda(v.label ?? "").includes(q);
}
