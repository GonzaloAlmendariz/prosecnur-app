// =============================================================================
// logic/serialize.ts — serializador de AST a string ODK canónico
// =============================================================================
// Recorre un `Expr` y emite la expresión ODK equivalente. La salida es
// estable (mismo AST → mismo string), legible (espacios alrededor de
// operadores, paréntesis solo cuando importan) y compatible con el
// estándar ODK Collect / KoBoCollect.
//
// Reglas de paréntesis:
//   - AND dentro de OR siempre lleva paréntesis: (a and b) or c.
//   - Comparaciones nunca llevan paréntesis externos.
//   - `not(...)` es función, ya tiene paréntesis propios.
//   - Operandos de comparación nunca son lógicos, así que no hace falta
//     parentizarlos (un AST bien formado nunca pone `and` dentro de `=`).
// =============================================================================

import type { Expr } from "./ast";

export function serializeExpression(expr: Expr | null): string {
  if (!expr) return "";
  return emit(expr, 0);
}

/**
 * Emite el AST. `parentPrecedence` define la precedencia del contexto
 * para decidir si parentizar:
 *   0 = top-level / inside not/call/group (no parens needed)
 *   1 = OR (operands son AND o más altos)
 *   2 = AND (operands son comparaciones o más altos)
 *   3 = compare (no tiene operandos lógicos)
 */
function emit(expr: Expr, parentPrecedence: number): string {
  switch (expr.kind) {
    case "ref":
      return `\${${expr.name}}`;
    case "current":
      return ".";
    case "literal":
      return emitLiteral(expr.value);
    case "raw":
      return expr.text;
    case "compare": {
      const left = emit(expr.left, 3);
      const right = emit(expr.right, 3);
      return `${left} ${expr.op} ${right}`;
    }
    case "logical": {
      const myPrecedence = expr.op === "and" ? 2 : 1;
      const inner = expr.operands
        .map((op) => emit(op, myPrecedence))
        .join(` ${expr.op} `);
      // Necesitamos paréntesis si nos colocan dentro de un operador con
      // precedencia mayor o igual (ej. AND dentro de un compare, OR dentro
      // de AND/compare).
      return parentPrecedence > myPrecedence ? `(${inner})` : inner;
    }
    case "not":
      return `not(${emit(expr.operand, 0)})`;
    case "call":
      return `${expr.name}(${expr.args.map((a) => emit(a, 0)).join(", ")})`;
  }
}

function emitLiteral(value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  // String literal con comillas simples (estándar ODK). Solo escapamos la
  // comilla simple — los backslashes se preservan literal porque en ODK
  // no son escapes (los necesita intactos para regex: `\d`, `\s`, etc.).
  // El parser respeta la misma convención.
  const escaped = value.replace(/'/g, "\\'");
  return `'${escaped}'`;
}
