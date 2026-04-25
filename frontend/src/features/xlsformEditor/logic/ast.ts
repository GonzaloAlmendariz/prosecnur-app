// =============================================================================
// logic/ast.ts — tipos del AST de expresiones ODK/XLSForm
// =============================================================================
// El editor maneja `relevant`, `constraint`, `calculation` y `choice_filter`
// como strings ODK. Para construir UI visual (builder guiado + canvas) sin
// duplicar parseo en cada componente, los normalizamos a un AST común y
// volvemos a serializar al exportar/guardar.
//
// El AST cubre el subset ODK que aparece en el corpus auditado (ESPP, RMS,
// HST, GIZ): comparaciones, AND/OR/NOT con paréntesis, llamadas a función
// (selected, count-selected, regex, if, position, jr:choice-name, …),
// referencias a variables (`${name}`), `.` (valor actual en constraint) y
// literales string/number/boolean.
//
// Las expresiones que no se puedan parsear caen al nodo `raw` para que el
// editor las preserve tal cual al re-exportar — política "no perder nada".
// =============================================================================

/**
 * Operador de comparación binaria. ODK acepta los seis canónicos del
 * estándar XPath 1.0; no incluimos `eq`/`ne` (variantes raras no usadas
 * en el corpus).
 */
export type CompareOp = "=" | "!=" | "<" | "<=" | ">" | ">=";

/**
 * Operador lógico. ODK usa `and`/`or` (lower-case, palabras), no `&&`/`||`.
 */
export type LogicalOp = "and" | "or";

/**
 * Nodo del AST. Discriminated union por `kind`. Todas las ramas se
 * pueden serializar de forma estable y todas las ramas son inmutables
 * (los consumidores deben crear nuevas instancias para cambios).
 */
export type Expr =
  // ${var_name}
  | { kind: "ref"; name: string }
  // . (valor actual de la pregunta — solo en constraint)
  | { kind: "current" }
  // 'texto', 12, 3.14, true, false
  | { kind: "literal"; value: string | number | boolean }
  // left <op> right
  | { kind: "compare"; op: CompareOp; left: Expr; right: Expr }
  // a and b and c  (n-ario, los flatten paths reusan operands)
  | { kind: "logical"; op: LogicalOp; operands: Expr[] }
  // not(expr)
  | { kind: "not"; operand: Expr }
  // selected(${x}, 'val'), if(${a}=1, 'A', 'B'), position(..), …
  | { kind: "call"; name: string; args: Expr[] }
  // Texto crudo que no pudimos parsear — se preserva al serializar.
  | { kind: "raw"; text: string };

// ----------------------------------------------------------------------------
// Constructores convenientes (sintáctico azúcar para tests/builder)
// ----------------------------------------------------------------------------

export function ref(name: string): Expr {
  return { kind: "ref", name };
}

export function current(): Expr {
  return { kind: "current" };
}

export function lit(value: string | number | boolean): Expr {
  return { kind: "literal", value };
}

export function compare(left: Expr, op: CompareOp, right: Expr): Expr {
  return { kind: "compare", op, left, right };
}

export function and(...operands: Expr[]): Expr {
  return { kind: "logical", op: "and", operands };
}

export function or(...operands: Expr[]): Expr {
  return { kind: "logical", op: "or", operands };
}

export function not(operand: Expr): Expr {
  return { kind: "not", operand };
}

export function call(name: string, ...args: Expr[]): Expr {
  return { kind: "call", name, args };
}

export function raw(text: string): Expr {
  return { kind: "raw", text };
}

// ----------------------------------------------------------------------------
// Comparaciones de igualdad estructural (útiles para tests + memoización)
// ----------------------------------------------------------------------------

/**
 * Igualdad profunda entre dos AST. No considera `raw` con whitespace
 * distinto como iguales — para esa semántica laxa, comparar la
 * serialización canónica.
 */
export function equalsExpr(a: Expr | null, b: Expr | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "ref":
      return a.name === (b as typeof a).name;
    case "current":
      return true;
    case "literal":
      return a.value === (b as typeof a).value;
    case "compare": {
      const bb = b as typeof a;
      return (
        a.op === bb.op &&
        equalsExpr(a.left, bb.left) &&
        equalsExpr(a.right, bb.right)
      );
    }
    case "logical": {
      const bb = b as typeof a;
      if (a.op !== bb.op) return false;
      if (a.operands.length !== bb.operands.length) return false;
      return a.operands.every((op, i) => equalsExpr(op, bb.operands[i] ?? null));
    }
    case "not":
      return equalsExpr(a.operand, (b as typeof a).operand);
    case "call": {
      const bb = b as typeof a;
      if (a.name !== bb.name) return false;
      if (a.args.length !== bb.args.length) return false;
      return a.args.every((arg, i) => equalsExpr(arg, bb.args[i] ?? null));
    }
    case "raw":
      return a.text === (b as typeof a).text;
  }
}
