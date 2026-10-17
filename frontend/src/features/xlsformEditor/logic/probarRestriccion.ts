// Probar una restricción (constraint) con valores de ejemplo, sin salir del editor (revamp E5, 2026-10-16).
// «.» es el valor que se prueba; las demás preguntas quedan vacías salvo que se pasen respuestas.

import type { BuilderNode } from "../types";
import { RESPUESTA_ACTUAL, UnsupportedExpressionError, evaluateExpr, type SimAnswers } from "./evaluate";
import { parseExpression } from "./parse";
import { tieneComillasTipograficas } from "../parsing/comillas";
import { LECTURA_FILA_ROTA, esFilaRota } from "../reglas/motor/filaRota";

export type ResultadoPrueba = "acepta" | "rechaza" | "no-evaluable";

/**
 * `propio`: el nombre de la pregunta dueña. Una restricción puede nombrarse a sí misma como `${pregunta}` en vez de
 * «.» (Spent_5th del ACNUR: `${Spent_5th} != ${Spent_4th} and …`); las dos son el valor que se prueba.
 */
export function evaluarRestriccion(expresion: string, valor: string, respuestas: SimAnswers = {}, propio?: string): ResultadoPrueba {
  const raw = expresion.trim();
  if (!raw) return "acepta";
  const ast = parseExpression(raw);
  if (!ast || ast.kind === "raw") return "no-evaluable";
  try {
    const r = evaluateExpr(ast, { ...respuestas, ...(propio ? { [propio]: valor } : {}), [RESPUESTA_ACTUAL]: valor });
    return (typeof r === "boolean" ? r : typeof r === "number" ? r !== 0 && !Number.isNaN(r) : r.length > 0) ? "acepta" : "rechaza";
  } catch (e) {
    if (e instanceof UnsupportedExpressionError) return "no-evaluable";
    throw e;
  }
}

export type CausaSinPrueba =
  | { tipo: "fila-rota" }
  | { tipo: "comillas" }
  | { tipo: "funcion"; funcion: string }
  | { tipo: "sintaxis" };

/** Por qué una restricción no se puede probar en el editor: la causa real, nunca una genérica. null si se puede. */
export function causaSinPrueba(node: BuilderNode): CausaSinPrueba | null {
  const raw = node.constraint.trim();
  if (!raw) return null;
  if (esFilaRota(node)) return { tipo: "fila-rota" };
  if (tieneComillasTipograficas(raw)) return { tipo: "comillas" };
  const ast = parseExpression(raw);
  if (!ast || ast.kind === "raw") return { tipo: "sintaxis" };
  try {
    evaluateExpr(ast, { ...(node.name ? { [node.name]: "" } : {}), [RESPUESTA_ACTUAL]: "" });
    return null;
  } catch (e) {
    if (!(e instanceof UnsupportedExpressionError)) throw e;
    const fn = e.message.match(/función ([^\s(]+)\(\)/)?.[1];
    return fn ? { tipo: "funcion", funcion: fn } : { tipo: "sintaxis" };
  }
}

/** La causa en una frase para quien prueba la regla. */
export function textoCausaSinPrueba(c: CausaSinPrueba): string {
  switch (c.tipo) {
    case "fila-rota":
      return `${LECTURA_FILA_ROTA}: no hay una regla que probar.`;
    case "comillas":
      return "No se puede probar: la regla usa comillas tipográficas (‘ ’ “ ”), que ODK no acepta. Cámbialas por comillas rectas.";
    case "funcion":
      return `La regla usa ${c.funcion}(), que el editor no sabe evaluar: se comprueba en el teléfono.`;
    case "sintaxis":
      return "El editor no reconoce la forma de esta regla: revísala en el código XLSForm.";
  }
}

/** Números que aparecen en la expresión: los bordes de un rango son los casos interesantes. */
function numerosDe(expresion: string): number[] {
  return [...new Set((expresion.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
}

/** Valores de ejemplo según el tipo y la propia regla: bordes del rango, uno dentro, uno fuera, decimal, vacío. */
export function valoresDeEjemplo(node: BuilderNode, opciones: readonly string[] = []): string[] {
  const base = node.typeInfo.base;
  if (base === "select_one") return opciones.slice(0, 6);
  if (base === "select_multiple") {
    // Una sola opción, dos juntas, y la última (suele ser «ninguna»/«no sabe») con otra: ahí muerden las reglas
    // de exclusividad y los topes de count-selected.
    const o = opciones.slice(0, 8);
    const vals = new Set<string>(o.slice(0, 3));
    if (o.length >= 2) vals.add(`${o[0]} ${o[1]}`);
    if (o.length >= 3) vals.add(`${o[0]} ${o[1]} ${o[2]}`);
    if (o.length >= 2) vals.add(`${o[0]} ${o[o.length - 1]}`);
    if (o.length >= 4) vals.add(o.join(" "));
    return [...vals];
  }
  const nums = numerosDe(node.constraint);
  if (base === "integer" || base === "decimal" || base === "range") {
    const vals = new Set<string>();
    if (nums.length) {
      const min = nums[0];
      const max = nums[nums.length - 1];
      vals.add(String(min - 1));
      vals.add(String(min));
      if (max !== min) vals.add(String(Math.round((min + max) / 2)));
      vals.add(String(max));
      vals.add(String(max + 1));
    } else {
      ["-1", "0", "5", "100"].forEach((v) => vals.add(v));
    }
    // Un decimal sólo se prueba en preguntas decimales: en las enteras el teléfono ni deja escribirlo.
    if (base === "decimal") vals.add(`${(nums[0] ?? 1) + 0.5}`);
    return [...vals].slice(0, 7);
  }
  if (base === "date" || base === "datetime") {
    const hoy = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const dias = (n: number) => iso(new Date(hoy.getTime() + n * 86_400_000));
    return [iso(hoy), dias(1), dias(-365), "1900-01-01"];
  }
  if (base === "text") {
    if (/regex/.test(node.constraint)) return ["", "abc", "12345", "123456789", "correo@ejemplo.pe", "12/2025"];
    if (/string-length/.test(node.constraint)) {
      const n = nums[nums.length - 1] ?? 10;
      return ["", "a", "x".repeat(Math.max(1, n)), "x".repeat(n + 1)];
    }
    return ["", "texto de ejemplo"];
  }
  return [];
}
