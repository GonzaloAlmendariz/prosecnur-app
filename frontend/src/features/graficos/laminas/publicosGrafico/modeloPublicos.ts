// Los públicos de un gráfico de resumen (Q2-11 de la prueba con Arte, ADR 0135 §2): cuando `vars` lleva `base$*` (todas
// las preguntas de escala de esa base), el inspector no muestra un selector de pregunta vacío por cada una sino una ficha
// por público, que se agrega, se quita y se ORDENA: el orden de `vars` es el de las filas del panorama. Las preguntas
// sueltas que haya se conservan detrás y se ajustan en la lista de la regla. Pura: sin React.

import { parseVarRef } from "../../useVariables";

/** `base$*`: todas las preguntas de escala de esa base. */
export function esComodin(ref: unknown): ref is string {
  if (typeof ref !== "string") return false;
  const r = parseVarRef(ref);
  return r.name === "*" && !!r.source;
}

const lista = (valor: unknown): string[] => (Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string" && v !== "") : []);

/** ¿Las preguntas se eligen por público? Basta un `base$*` en la lista. */
export function usaPublicos(valor: unknown): boolean {
  return lista(valor).some(esComodin);
}

/** Los públicos de la lista, en su orden y sin repetir. */
export function publicosDe(valor: unknown): string[] {
  const out: string[] = [];
  for (const ref of lista(valor)) {
    const base = esComodin(ref) ? parseVarRef(ref).source : null;
    if (base && !out.includes(base)) out.push(base);
  }
  return out;
}

/** Las preguntas sueltas de la lista (las que no son `base$*`). */
export function sueltasDe(valor: unknown): string[] {
  return lista(valor).filter((r) => !esComodin(r));
}

/** La lista con estos públicos, en este orden, y las sueltas detrás. */
export function conPublicos(valor: unknown, publicos: readonly string[]): string[] {
  return [...publicos.map((b) => `${b}$*`), ...sueltasDe(valor)];
}

/** Cuántos públicos admite el gráfico: Fortalezas y alertas lee uno. */
export function maxPublicos(graficador: string): number {
  return graficador === "p_fortalezas" ? 1 : Number.POSITIVE_INFINITY;
}

export function moverPublicoEn(publicos: readonly string[], i: number, d: -1 | 1): string[] {
  const j = i + d;
  if (j < 0 || j >= publicos.length) return [...publicos];
  const out = [...publicos];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
