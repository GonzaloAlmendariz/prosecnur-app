// =============================================================================
// logic/conditionAdapter.ts — adapter AST ↔ "condición plana" del builder
// =============================================================================
// El builder visual maneja "condiciones" planas (`{ variable, predicate,
// value }`) más fáciles de bindear a UI. Este adapter las convierte a/desde
// el AST canónico — sin él cada componente reescribiría la misma lógica.
//
// Una condición simple es UNA de:
//   1. `${var} <op> 'value'`           → kind=compare
//   2. `${var} <op> N`                  → kind=compare con número
//   3. `${var} <op> ${otherVar}`        → kind=compare con ref como rhs
//   4. `selected(${var}, 'value')`      → kind=selected
//   5. `not(selected(${var}, 'value'))` → kind=not_selected
//
// Cualquier otra forma se considera "compleja" y se trata con el árbol
// AND/OR/NOT directamente — no se aplana.
// =============================================================================

import type { Expr } from "./ast";
import type { PredicateKind } from "./operators";

/**
 * Una condición simple — la unidad atómica del builder. `value` es el
 * lado derecho: literal o referencia a otra variable.
 */
export type FlatCondition = {
  variableName: string;
  predicate: PredicateKind;
  /** Valor del rhs. Si `kind=ref`, apunta a otra variable. */
  value:
    | { kind: "literal"; raw: string }
    | { kind: "ref"; variableName: string };
};

/**
 * Intenta aplanar `expr` a una condición simple. Si la forma no encaja en
 * los 5 patrones soportados, devuelve `null` y el caller maneja el caso
 * "compleja" usando el AST tal cual.
 */
export function tryFlattenCondition(expr: Expr): FlatCondition | null {
  // Patrón 4: selected(${var}, 'value')
  if (expr.kind === "call" && expr.name === "selected" && expr.args.length === 2) {
    const v = expr.args[0]!;
    const val = expr.args[1]!;
    if (v.kind === "ref" && val.kind === "literal") {
      return {
        variableName: v.name,
        predicate: { kind: "selected", label: "incluye" },
        value: { kind: "literal", raw: String(val.value) },
      };
    }
  }
  // Patrón 5: not(selected(${var}, 'value'))
  if (expr.kind === "not" && expr.operand.kind === "call" &&
      expr.operand.name === "selected" && expr.operand.args.length === 2) {
    const v = expr.operand.args[0]!;
    const val = expr.operand.args[1]!;
    if (v.kind === "ref" && val.kind === "literal") {
      return {
        variableName: v.name,
        predicate: { kind: "not_selected", label: "no incluye" },
        value: { kind: "literal", raw: String(val.value) },
      };
    }
  }
  // Patrones 1-3: compare con ref como lhs
  if (expr.kind === "compare" && expr.left.kind === "ref") {
    const variableName = expr.left.name;
    if (expr.right.kind === "literal") {
      return {
        variableName,
        predicate: { kind: "compare", op: expr.op, label: opLabel(expr.op) },
        value: { kind: "literal", raw: String(expr.right.value) },
      };
    }
    if (expr.right.kind === "ref") {
      return {
        variableName,
        predicate: { kind: "compare", op: expr.op, label: opLabel(expr.op) },
        value: { kind: "ref", variableName: expr.right.name },
      };
    }
  }
  return null;
}

/**
 * Convierte una `FlatCondition` de vuelta al AST. Inversa exacta de
 * `tryFlattenCondition` — round-trip estable.
 */
export function expandCondition(cond: FlatCondition): Expr {
  const lhs: Expr = { kind: "ref", name: cond.variableName };
  // Si la pred es selected/not_selected, ignoramos el operador del compare.
  if (cond.predicate.kind === "selected") {
    return {
      kind: "call",
      name: "selected",
      args: [lhs, valueExpr(cond.value)],
    };
  }
  if (cond.predicate.kind === "not_selected") {
    return {
      kind: "not",
      operand: {
        kind: "call",
        name: "selected",
        args: [lhs, valueExpr(cond.value)],
      },
    };
  }
  return {
    kind: "compare",
    op: cond.predicate.op,
    left: lhs,
    right: valueExpr(cond.value),
  };
}

// ----------------------------------------------------------------------------
// Constraint: el lhs es siempre `.` (current value de la pregunta misma).
// El rhs sigue siendo literal o ref a otra variable.
// ----------------------------------------------------------------------------

export type FlatConstraint = {
  predicate: PredicateKind;
  value:
    | { kind: "literal"; raw: string }
    | { kind: "ref"; variableName: string };
};

/**
 * Aplana una expresión constraint a un par {predicado, valor} cuando
 * encaja en `. <op> X`. Si no, devuelve null y el caller usa la caja
 * read-only.
 */
export function tryFlattenConstraint(expr: Expr): FlatConstraint | null {
  if (expr.kind === "compare" && expr.left.kind === "current") {
    if (expr.right.kind === "literal") {
      return {
        predicate: { kind: "compare", op: expr.op, label: opLabel(expr.op) },
        value: { kind: "literal", raw: String(expr.right.value) },
      };
    }
    if (expr.right.kind === "ref") {
      return {
        predicate: { kind: "compare", op: expr.op, label: opLabel(expr.op) },
        value: { kind: "ref", variableName: expr.right.name },
      };
    }
  }
  return null;
}

/** Inversa de `tryFlattenConstraint`. Solo soporta compare (no selected). */
export function expandConstraint(c: FlatConstraint): Expr {
  if (c.predicate.kind !== "compare") {
    // Defensivo — los predicados selected/not_selected no aplican a `.`.
    // Caemos a `=` para no romper.
    return {
      kind: "compare",
      op: "=",
      left: { kind: "current" },
      right: valueExpr(c.value),
    };
  }
  return {
    kind: "compare",
    op: c.predicate.op,
    left: { kind: "current" },
    right: valueExpr(c.value),
  };
}

function valueExpr(v: FlatCondition["value"]): Expr {
  if (v.kind === "ref") return { kind: "ref", name: v.variableName };
  // Detección heurística de tipo del literal — si es un número parseable
  // sin perder precisión, lo emitimos como número; si es 'true'/'false'
  // lo emitimos boolean; si no, string.
  const raw = v.raw;
  if (raw === "true" || raw === "false") {
    return { kind: "literal", value: raw === "true" };
  }
  if (raw !== "" && !isNaN(Number(raw)) && raw === String(Number(raw))) {
    return { kind: "literal", value: Number(raw) };
  }
  return { kind: "literal", value: raw };
}

function opLabel(op: string): string {
  switch (op) {
    case "=":
      return "igual a";
    case "!=":
      return "distinto de";
    case "<":
      return "menor que";
    case "<=":
      return "menor o igual";
    case ">":
      return "mayor que";
    case ">=":
      return "mayor o igual";
    default:
      return op;
  }
}
