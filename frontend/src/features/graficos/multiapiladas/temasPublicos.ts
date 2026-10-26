// Lógica pura de «Públicos por tema» (G12 parte 2): una tarjeta por tema y una referencia `publico$var` por público.
// Vive aparte del componente para que la sugerencia de la matriz (P20) la reutilice sin importar un .tsx.

import type { VarWithSource } from "../useVariables";
import { parseVarRef } from "../useVariables";

export type TemaPublicos = { key: string; title: string; vars: string[] };

/** La clave de un tema como la guarda el plan: minúsculas, sólo letras, números y guion bajo. */
export const claveTema = (texto: string): string => texto.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");

/**
 * Los temas con claves únicas y nunca vacías: la que falta o se repite toma la siguiente `tema_N` libre. Dos temas con la
 * misma clave se guardaban como uno (el segundo pisaba al primero en `vars` y `titulos_grupo`): pasaba al agregar un tema
 * después de quitar otro, porque el nuevo nacía con `tema_${cantidad + 1}`, una clave en uso (Renzo, Arte_v1-7).
 */
export function temasConClaveUnica<T extends { key: string }>(temas: readonly T[]): T[] {
  const propias = temas.map((t) => claveTema(t.key ?? ""));
  const usadas = new Set<string>();
  let n = 0;
  const libre = () => { do { n += 1; } while (usadas.has(`tema_${n}`) || propias.includes(`tema_${n}`)); return `tema_${n}`; };
  return temas.map((t, i) => {
    const clave = propias[i] && !usadas.has(propias[i]) ? propias[i] : libre();
    usadas.add(clave);
    return clave === t.key ? t : { ...t, key: clave };
  });
}

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
