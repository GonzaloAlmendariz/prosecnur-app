// Cálculos de «Probar formulario» (checklist editor-conjoint, E1, 2026-11-06).
// Un `calculate` no lo responde nadie, pero lo que muestra el formulario depende de él: el nivel sorteado de un
// atributo, el perfil que se pregunta al final. Aquí se evalúan todos en orden de fila contra las respuestas de la
// prueba. `random()` sale de un generador sembrado por prueba: el mismo sorteo mientras dura la prueba y otro al
// reiniciarla, como hace `once(random())` en la plataforma para cada entrevista.

import type { Expr } from "../../logic/ast";
import { UnsupportedExpressionError, evaluateExpr, type SimAnswers } from "../../logic/evaluate";
import { parseExpressionLectura } from "../../logic/parse";
import type { BuilderNode } from "../../types";

/** Semilla nueva para una prueba (cada «Reiniciar» pide otra). */
export function semillaNueva(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

function hashTexto(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Número en [0, 1) fijo para una semilla, una variable y la posición del `random()` dentro de su fórmula. */
export function azarSembrado(semilla: number, variable: string, posicion = 0): number {
  let t = (hashTexto(`${variable}#${posicion}`) ^ semilla) >>> 0;
  t = (t + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
}

/** Reemplaza cada `random()` por su número sembrado, para que `evaluateExpr` lo lea como literal. */
function conAzarFijo(expr: Expr, azar: () => number): Expr {
  switch (expr.kind) {
    case "call":
      if (expr.name.toLowerCase() === "random" && expr.args.length === 0) return { kind: "literal", value: azar() };
      return { ...expr, args: expr.args.map((a) => conAzarFijo(a, azar)) };
    case "compare":
      return { ...expr, left: conAzarFijo(expr.left, azar), right: conAzarFijo(expr.right, azar) };
    case "logical":
      return { ...expr, operands: expr.operands.map((o) => conAzarFijo(o, azar)) };
    case "not":
      return { ...expr, operand: conAzarFijo(expr.operand, azar) };
    default:
      return expr;
  }
}

function comoTexto(v: string | number | boolean): string {
  if (typeof v === "number") return Number.isFinite(v) ? String(Math.round(v * 1e9) / 1e9) : "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return v;
}

/**
 * Valor de cada `calculate` evaluable, por nombre. Los que usan algo que el evaluador no cubre quedan fuera (el
 * simulador los sigue mostrando como «[referencia]»). Dos pasadas bastan para un cálculo que cita a otro de más abajo.
 */
export function calcularValores(nodos: readonly BuilderNode[], respuestas: SimAnswers, semilla: number): Record<string, string> {
  const calculos = nodos
    .filter((n) => n.kind === "calculate" && n.name && n.calculation.trim())
    .sort((a, b) => a.rowIndex - b.rowIndex)
    .map((n) => ({ nombre: n.name, ast: parseExpressionLectura(n.calculation) }));
  const valores: Record<string, string> = {};
  for (let pasada = 0; pasada < 2; pasada += 1) {
    let cambio = false;
    for (const { nombre, ast } of calculos) {
      if (!ast || ast.kind === "raw") continue;
      let posicion = 0;
      const expr = conAzarFijo(ast, () => azarSembrado(semilla, nombre, posicion++));
      try {
        const v = comoTexto(evaluateExpr(expr, { ...respuestas, ...valores }));
        if (valores[nombre] !== v) {
          valores[nombre] = v;
          cambio = true;
        }
      } catch (e) {
        if (!(e instanceof UnsupportedExpressionError)) throw e;
      }
    }
    if (!cambio) break;
  }
  return valores;
}
