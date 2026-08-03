// =============================================================================
// inspector/logic/calculationReadout.ts — lectura de una fórmula `if(...)`
// =============================================================================
// El panel "Cómo se calcula" muestra el árbol editable completo. Para una
// fórmula como `indice_hs` ese árbol mide miles de píxeles y no hay forma
// de saber de un vistazo qué produce la variable. Este módulo saca los
// pocos datos que responden esa pregunta —cuántas condiciones, con qué
// conector, qué valores devuelve— para pintarlos arriba del árbol.
//
// Devuelve DATOS, no prosa: quien renderiza decide cómo los presenta.
// =============================================================================

import { serializeExpression } from "../../logic";
import type { Expr } from "../../logic";
import type { LogicalOp } from "../../logic/ast";

export type CalculationReadout = {
  /** Conector de la raíz de la condición; `null` si la raíz no es lógica. */
  conector: LogicalOp | null;
  /** Operandos directos de la raíz de la condición (1 si no es lógica). */
  bloques: number;
  /** Comparaciones atómicas en toda la condición (hojas del árbol lógico). */
  comparaciones: number;
  /** Valor que toma la variable cuando la condición se cumple. */
  entonces: string;
  /** Valor que toma cuando no se cumple. */
  siNo: string;
};

/** Hojas del árbol lógico: todo lo que no es `and`/`or`. `not(x)` cuenta
 *  como una sola comparación —es la negación de una, no dos—. */
function contarComparaciones(expr: Expr | undefined): number {
  if (!expr) return 0;
  if (expr.kind === "logical") {
    return expr.operands.reduce((total, operand) => total + contarComparaciones(operand), 0);
  }
  return 1;
}

/** Texto corto de una rama del `if`. Un literal se muestra tal cual; el
 *  resto se serializa (`${var}`, `today()`, …). */
function textoDeRama(expr: Expr | undefined): string {
  if (!expr) return "";
  if (expr.kind === "literal") return String(expr.value);
  return serializeExpression(expr);
}

/**
 * Lee un `if(cond, entonces, si_no)` ya validado por el caller. Devuelve
 * `null` si la forma no es esa.
 */
export function readCalculation(expr: Expr): CalculationReadout | null {
  if (expr.kind !== "call" || expr.name !== "if" || expr.args.length !== 3) {
    return null;
  }
  const [cond, entonces, siNo] = expr.args;
  return {
    conector: cond && cond.kind === "logical" ? cond.op : null,
    bloques: cond && cond.kind === "logical" ? cond.operands.length : cond ? 1 : 0,
    comparaciones: contarComparaciones(cond),
    entonces: textoDeRama(entonces),
    siNo: textoDeRama(siNo),
  };
}
