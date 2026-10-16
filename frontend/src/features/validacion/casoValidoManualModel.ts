// «Qué caso cuenta» a mano: cómo se lee una condición y su efecto, en palabras.
// Una condición se arma con «cuenta si es» / «cuenta si no es» y uno o varios
// valores; el operador guardado (==, !=, in, not_in) sale de esas dos cosas.

import { formatoConteo, formatoConteoDe } from "../../lib/formatoNumero";
import type { CasoValidoColumna, CasoValidoCondicion, CasoValidoEfecto } from "../../api/validacion";

export type Sentido = "es" | "no_es";

export function condicionDesdeBorrador(variable: string, sentido: Sentido, valores: readonly string[]): CasoValidoCondicion | null {
  const vals = [...new Set(valores.map((v) => v.trim()).filter(Boolean))];
  if (!variable.trim() || !vals.length) return null;
  const operador = sentido === "es" ? (vals.length === 1 ? "==" : "in") : (vals.length === 1 ? "!=" : "not_in");
  return { variable: variable.trim(), operador, valores: vals };
}

function rotuloValor(valor: string, col?: CasoValidoColumna): string {
  const e = col?.valores.find((v) => v.valor === valor)?.etiqueta?.trim();
  return e && e !== valor ? `«${e}» (${valor})` : `«${valor}»`;
}

function unirConY(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} o ${xs[xs.length - 1]}`;
}

/** «seleccionado es «1»», «P1 no es «No responde» (99)». */
export function textoCondicion(c: CasoValidoCondicion, col?: CasoValidoColumna): string {
  const vals = unirConY(c.valores.map((v) => rotuloValor(v, col)));
  const niega = c.operador === "!=" || c.operador === "not_in";
  return `${c.variable} ${niega ? "no es" : "es"} ${vals}`;
}

/** Casos de la columna que cumplen la condición sola (sin vacíos en «es»). */
export function casosQueCumplen(col: CasoValidoColumna, sentido: Sentido, valores: readonly string[], nTotal: number): number {
  const elegidos = col.valores.filter((v) => valores.includes(v.valor)).reduce((s, v) => s + v.n, 0);
  return sentido === "es" ? elegidos : Math.max(0, nTotal - elegidos);
}

/** «Cuentan 2,500 de 3,318 casos; quedan fuera 818.» */
export function textoEfecto(e: CasoValidoEfecto): string {
  if (!e.n_total) return "";
  if (e.n_validos === e.n_total) return `Cuentan los ${formatoConteoDe(e.n_total, "caso")} de la base.`;
  if (e.n_validos === 0) return "Ningún caso cumple todas las condiciones: así no se aplicaría y contaría toda la base.";
  return `Cuentan ${formatoConteo(e.n_validos)} de ${formatoConteoDe(e.n_total, "caso")}; quedan fuera ${formatoConteo(e.n_excluidos)}.`;
}
