// =============================================================================
// logic/inspect.ts — utilidades de walk sobre el AST
// =============================================================================
// Funciones derivadas (puras) que recorren un `Expr` para extraer
// información estructural útil:
//
//   - `collectRefs(expr)` — Set de variables `${name}` referenciadas.
//   - `collectCalls(expr)` — Set de nombres de funciones invocadas.
//   - `walk(expr, visitor)` — recorrido genérico para tooling.
//   - `mapExpr(expr, fn)` — transforma cada nodo (útil para refactors,
//     ej. renombrar una variable).
//
// Estas piezas alimentan el canvas Obsidian-style (F2-5/F2-6) — para
// dibujar las flechas de dependencia entre preguntas necesitamos saber
// quién referencia a quién en cada expresión.
// =============================================================================

import type { Expr } from "./ast";

/** Devuelve el Set de variables referenciadas dentro de la expresión. */
export function collectRefs(expr: Expr | null): Set<string> {
  const refs = new Set<string>();
  if (!expr) return refs;
  walk(expr, (node) => {
    if (node.kind === "ref") refs.add(node.name);
  });
  return refs;
}

/** Devuelve el Set de funciones invocadas dentro de la expresión. */
export function collectCalls(expr: Expr | null): Set<string> {
  const calls = new Set<string>();
  if (!expr) return calls;
  walk(expr, (node) => {
    if (node.kind === "call") calls.add(node.name);
  });
  return calls;
}

/**
 * Recorrido depth-first del AST. El visitor se invoca con cada nodo
 * (incluido el raíz). No retorna nada; usa cierre para acumular.
 */
export function walk(expr: Expr, visit: (node: Expr) => void): void {
  visit(expr);
  switch (expr.kind) {
    case "compare":
      walk(expr.left, visit);
      walk(expr.right, visit);
      return;
    case "logical":
      for (const op of expr.operands) walk(op, visit);
      return;
    case "not":
      walk(expr.operand, visit);
      return;
    case "call":
      for (const a of expr.args) walk(a, visit);
      return;
    default:
      return;
  }
}

/**
 * Transforma cada nodo del AST aplicando `fn`. Si `fn(node)` devuelve
 * el mismo nodo, se reusa la instancia (preserva igualdad referencial
 * cuando es posible — útil para memoización). Bottom-up: los hijos se
 * transforman antes que el padre.
 */
export function mapExpr(expr: Expr, fn: (node: Expr) => Expr): Expr {
  let next: Expr;
  switch (expr.kind) {
    case "compare": {
      const left = mapExpr(expr.left, fn);
      const right = mapExpr(expr.right, fn);
      next =
        left === expr.left && right === expr.right
          ? expr
          : { kind: "compare", op: expr.op, left, right };
      break;
    }
    case "logical": {
      let changed = false;
      const mapped = expr.operands.map((op) => {
        const m = mapExpr(op, fn);
        if (m !== op) changed = true;
        return m;
      });
      next = changed ? { kind: "logical", op: expr.op, operands: mapped } : expr;
      break;
    }
    case "not": {
      const operand = mapExpr(expr.operand, fn);
      next = operand === expr.operand ? expr : { kind: "not", operand };
      break;
    }
    case "call": {
      let changed = false;
      const mapped = expr.args.map((a) => {
        const m = mapExpr(a, fn);
        if (m !== a) changed = true;
        return m;
      });
      next = changed ? { kind: "call", name: expr.name, args: mapped } : expr;
      break;
    }
    default:
      next = expr;
  }
  return fn(next);
}

/**
 * Renombra todas las referencias `${oldName}` a `${newName}`. Útil cuando
 * el usuario cambia el `name` de una pregunta y queremos actualizar la
 * lógica que la referencia.
 */
export function renameRef(
  expr: Expr | null,
  oldName: string,
  newName: string,
): Expr | null {
  if (!expr) return null;
  return mapExpr(expr, (node) => {
    if (node.kind === "ref" && node.name === oldName) {
      return { kind: "ref", name: newName };
    }
    return node;
  });
}

/**
 * Cuenta nodos del AST por tipo. Métricas útiles para el canvas
 * (cantidad de comparaciones, branches AND/OR, llamadas, etc).
 */
export function exprStats(expr: Expr | null): {
  total: number;
  refs: number;
  literals: number;
  compares: number;
  logicals: number;
  calls: number;
  raws: number;
} {
  const stats = {
    total: 0,
    refs: 0,
    literals: 0,
    compares: 0,
    logicals: 0,
    calls: 0,
    raws: 0,
  };
  if (!expr) return stats;
  walk(expr, (node) => {
    stats.total += 1;
    switch (node.kind) {
      case "ref":
        stats.refs += 1;
        break;
      case "literal":
        stats.literals += 1;
        break;
      case "compare":
        stats.compares += 1;
        break;
      case "logical":
        stats.logicals += 1;
        break;
      case "call":
        stats.calls += 1;
        break;
      case "raw":
        stats.raws += 1;
        break;
    }
  });
  return stats;
}

/**
 * Detecta si la expresión es "simple" — un único compare, una llamada
 * `selected(...)` o un literal. Sirve para decidir si renderizamos el
 * builder one-liner o el árbol AND/OR completo.
 */
export function isSimpleExpression(expr: Expr | null): boolean {
  if (!expr) return true;
  if (expr.kind === "compare") {
    return isAtom(expr.left) && isAtom(expr.right);
  }
  if (expr.kind === "call" && expr.name === "selected" && expr.args.length === 2) {
    return isAtom(expr.args[0]!) && isAtom(expr.args[1]!);
  }
  if (expr.kind === "literal" || expr.kind === "ref" || expr.kind === "current") {
    return true;
  }
  return false;
}

function isAtom(expr: Expr): boolean {
  return (
    expr.kind === "ref" ||
    expr.kind === "current" ||
    expr.kind === "literal"
  );
}
