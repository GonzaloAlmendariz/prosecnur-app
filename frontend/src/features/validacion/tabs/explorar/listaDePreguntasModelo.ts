// La lista "Preguntas" de Explorar (ítem 38 del checklist del practicante):
// qué secciones se ven con lo escrito en el buscador y el tipo elegido, cómo se
// rotula cada sección y cuáles quedan abiertas. Puro, sin React.

import type { ExploradorSeccion, ExploradorVariable } from "../../types";
import { normalizarBusqueda } from "../../reglas/campos/modeloPregunta";
import { enFamilia, type FamiliaTipo } from "./tiposVariable";

/** Nombre con que el motor agrupa las preguntas que no están dentro de ningún grupo del formulario. */
const SECCION_SUELTA = "General";

/**
 * Una pregunta calza si cada palabra escrita aparece en su código o en su
 * texto, sin mayúsculas ni tildes ("region lima" encuentra "Región de Lima").
 */
export function calzaConLaBusqueda(v: Pick<ExploradorVariable, "name" | "label">, consulta: string): boolean {
  const palabras = normalizarBusqueda(consulta.trim()).split(/\s+/).filter(Boolean);
  if (!palabras.length) return true;
  const pajar = `${normalizarBusqueda(v.name)} ${normalizarBusqueda(v.label ?? "")}`;
  return palabras.every((p) => pajar.includes(p));
}

/** Las secciones con las preguntas que pasan la búsqueda y el tipo; sin las que quedan vacías. */
export function seccionesVisibles(
  secciones: readonly ExploradorSeccion[],
  consulta: string,
  familia: FamiliaTipo,
): ExploradorSeccion[] {
  return secciones
    .map((s) => ({ ...s, variables: s.variables.filter((v) => enFamilia(v, familia) && calzaConLaBusqueda(v, consulta)) }))
    .filter((s) => s.variables.length > 0);
}

export type RotuloDeSeccion = {
  /** Lo que se lee en el encabezado. */
  texto: string;
  /** `true` si el formulario no trae rótulo y se muestra el nombre del grupo tal cual. */
  esIdentificador: boolean;
};

/**
 * El rótulo de una sección: el del grupo en el formulario si el motor lo manda
 * (`etiqueta`, campo opcional); si no, el nombre del grupo, que se muestra
 * discreto. Las preguntas fuera de todo grupo van en "Sin sección".
 */
export function rotuloDeSeccion(seccion: ExploradorSeccion): RotuloDeSeccion {
  const etiqueta = (seccion as ExploradorSeccion & { etiqueta?: unknown }).etiqueta;
  if (typeof etiqueta === "string" && etiqueta.trim() && etiqueta.trim() !== seccion.nombre) {
    return { texto: etiqueta.trim(), esIdentificador: false };
  }
  if (!seccion.nombre || seccion.nombre === SECCION_SUELTA) return { texto: "Sin sección", esIdentificador: false };
  return { texto: seccion.nombre, esIdentificador: true };
}

/** La sección donde está una pregunta, o `null` si ninguna la tiene. */
export function seccionDe(secciones: readonly ExploradorSeccion[], pregunta: string | null): string | null {
  if (!pregunta) return null;
  return secciones.find((s) => s.variables.some((v) => v.name === pregunta))?.nombre ?? null;
}

/** Las secciones que hay que plegar para comprimir todas, salvo la de la pregunta elegida. */
export function plegadasAlComprimir(
  secciones: readonly ExploradorSeccion[],
  elegida: string | null,
): string[] {
  const abierta = seccionDe(secciones, elegida);
  return secciones.map((s) => s.nombre).filter((n) => n !== abierta);
}

/** `true` si todas las secciones a la vista están abiertas (la cabecera ofrece entonces comprimirlas). */
export function todasAbiertas(secciones: readonly ExploradorSeccion[], plegadas: readonly string[]): boolean {
  const cerradas = new Set(plegadas);
  return secciones.every((s) => !cerradas.has(s.nombre));
}
