// =============================================================================
// logic/operators.ts — operadores y predicados disponibles según tipo
// =============================================================================
// Cada tipo XLSForm soporta un set distinto de operadores. Definirlo
// declarativamente aquí evita repartir la lógica por componentes.
//
// "Predicado" = forma de comparación con semántica especial:
//   - "compare" — `<lhs> <op> <rhs>` con op ∈ {=, !=, <, <=, >, >=}.
//   - "selected" — `selected(<lhs>, '<value>')` para select_multiple.
//   - "not_selected" — `not(selected(<lhs>, '<value>'))`.
// =============================================================================

import type { CompareOp } from "./ast";

export type PredicateKind =
  | { kind: "compare"; op: CompareOp; label: string }
  | { kind: "selected"; label: string }
  | { kind: "not_selected"; label: string };

/**
 * Devuelve la lista de predicados disponibles para un tipo base. El orden
 * es el orden en que se ofrecen al usuario en el OperatorPicker — se
 * pone primero el más común.
 */
export function predicatesForType(baseType: string): PredicateKind[] {
  switch (baseType) {
    case "select_one":
      return [
        { kind: "compare", op: "=", label: "es" },
        { kind: "compare", op: "!=", label: "no es" },
      ];
    case "select_multiple":
      return [
        { kind: "selected", label: "incluye" },
        { kind: "not_selected", label: "no incluye" },
      ];
    case "integer":
    case "decimal":
      return [
        { kind: "compare", op: "=", label: "igual a" },
        { kind: "compare", op: "!=", label: "distinto de" },
        { kind: "compare", op: ">", label: "mayor que" },
        { kind: "compare", op: ">=", label: "mayor o igual" },
        { kind: "compare", op: "<", label: "menor que" },
        { kind: "compare", op: "<=", label: "menor o igual" },
      ];
    case "date":
    case "datetime":
    case "time":
      return [
        { kind: "compare", op: "=", label: "igual a" },
        { kind: "compare", op: "!=", label: "distinto de" },
        { kind: "compare", op: "<", label: "antes de" },
        { kind: "compare", op: "<=", label: "antes o igual a" },
        { kind: "compare", op: ">", label: "después de" },
        { kind: "compare", op: ">=", label: "después o igual a" },
      ];
    case "text":
    case "":
      return [
        { kind: "compare", op: "=", label: "es" },
        { kind: "compare", op: "!=", label: "no es" },
      ];
    default:
      return [
        { kind: "compare", op: "=", label: "es" },
        { kind: "compare", op: "!=", label: "no es" },
      ];
  }
}

/** Predicado por defecto cuando creamos una condición nueva. */
export function defaultPredicate(baseType: string): PredicateKind {
  const list = predicatesForType(baseType);
  return list[0] ?? { kind: "compare", op: "=", label: "es" };
}

/** Identidad estable para usar como key en React. */
export function predicateKey(p: PredicateKind): string {
  if (p.kind === "compare") return `cmp:${p.op}`;
  return p.kind;
}
