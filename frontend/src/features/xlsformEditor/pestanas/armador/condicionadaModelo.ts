// Regla condicionada en la restricción (E19 paso 4 editor-conjoint, 2026-11-06): «Si ‹P› es …, sólo acepta …». En
// XLSForm es `if(<condición>, <regla>, true())`: fuera del caso, cualquier respuesta pasa. El editor ya la leía; aquí se
// separa en condición y regla interior para que los demás armadores (formato, cuántas opciones, las que van solas…)
// trabajen sobre la regla interior y el envoltorio se conserve al escribir.

import type { Expr } from "../../logic";
import { parseExpression, serializeExpression } from "../../logic";

// El parser lee true() como el literal verdadero; se acepta también la llamada por si cambia.
const esVerdadero = (e: Expr | undefined) =>
  Boolean(e && ((e.kind === "literal" && e.value === true) || (e.kind === "call" && e.name === "true" && e.args.length === 0)));

/** Condición y regla interior; condición vacía si la restricción no está condicionada. */
export function leerCondicionada(constraint: string): { condicion: string; regla: string } {
  const raw = constraint.trim();
  if (!raw) return { condicion: "", regla: "" };
  const ast = parseExpression(raw);
  if (ast && ast.kind === "call" && ast.name === "if" && ast.args.length === 3 && esVerdadero(ast.args[2])) {
    return { condicion: serializeExpression(ast.args[0]!), regla: serializeExpression(ast.args[1]!) };
  }
  return { condicion: "", regla: raw };
}

/** La restricción con esta regla, sólo cuando se cumple la condición (sin condición, la regla tal cual). */
export function escribirCondicionada(regla: string, condicion: string): string {
  const r = regla.trim();
  const c = condicion.trim();
  if (!r) return "";
  return c ? `if(${c}, ${r}, true())` : r;
}
