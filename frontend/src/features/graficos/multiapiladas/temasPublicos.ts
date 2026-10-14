// Lógica pura de «Públicos por tema» (G12 parte 2): una tarjeta por tema y una referencia `publico$var` por público.
// Vive aparte del componente para que la sugerencia de la matriz (P20) la reutilice sin importar un .tsx.

import type { VarWithSource } from "../useVariables";
import { parseVarRef } from "../useVariables";

export type TemaPublicos = { key: string; title: string; vars: string[] };

/** El nombre de un público para leer («docentes» → «Docentes»); la clave interna no cambia. */
export const nombrePublico = (p: string) => (p ? p.charAt(0).toUpperCase() + p.slice(1).replace(/_/g, " ") : p);

export const buscar = (variables: readonly VarWithSource[], ref: string) => {
  const { source, name } = parseVarRef(ref);
  return variables.find((v) => v.name === name && (!source || v.source === source));
};

/** La referencia de un tema para un público (la que empieza con `publico$`). */
export function refDePublico(tema: TemaPublicos, publico: string): string {
  return tema.vars.find((r) => parseVarRef(r).source === publico) ?? "";
}

/** Pone `ref` en la línea de su público y deja las referencias en el orden de los públicos. */
export function conRef(tema: TemaPublicos, publicos: readonly string[], publico: string, ref: string | null): TemaPublicos {
  const destino = (ref && parseVarRef(ref).source) || publico;
  const porPublico = new Map(publicos.map((p) => [p, refDePublico(tema, p)]));
  porPublico.set(destino, ref ?? "");
  if (destino !== publico && !ref) porPublico.set(publico, "");
  return { ...tema, vars: publicos.map((p) => porPublico.get(p) ?? "").filter(Boolean) };
}

/** ¿La pregunta tiene otra escala que la primera del tema? */
export function otraEscala(variables: readonly VarWithSource[], tema: TemaPublicos, ref: string): boolean {
  const base = buscar(variables, tema.vars[0] ?? "")?.scale_signature;
  const esta = buscar(variables, ref)?.scale_signature;
  return !!base && !!esta && base !== esta;
}
