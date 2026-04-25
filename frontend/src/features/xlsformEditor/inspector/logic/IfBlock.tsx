// =============================================================================
// inspector/logic/IfBlock.tsx — bloque visual para `if(cond, then, else)`
// =============================================================================
// El patrón más común de fórmula en el corpus es `if(<cond>, <a>, <b>)`.
// En lugar de escribirlo a mano, lo desarmamos visualmente:
//
//   ┌─ Cuando se cumple ──────────┐
//   │  <LogicBuilder reutilizado> │
//   └─────────────────────────────┘
//   Entonces:  [ valor o ${var} ]
//   Si no:     [ valor o ${var} ]
//
// La condición usa el mismo LogicBuilder de F2-2 — reaprovechamos toda
// la maquinaria de aplanado AND/OR. Los campos "entonces" y "si no" son
// atómicos: literal o referencia a una variable (sin sub-fórmulas
// anidadas en F2-4; eso entra en una iteración posterior si hace falta).
// =============================================================================

import {
  parseExpression,
  serializeExpression,
} from "../../logic";
import type { Expr, LogicScope } from "../../logic";
import { LogicBuilder } from "./LogicBuilder";
import { ValueInput } from "./ValueInput";

export type IfBlockProps = {
  scope: LogicScope;
  /** AST raíz `if(cond, then, else)`. Garantizamos en el caller que
   *  `expr.kind === "call" && expr.name === "if" && expr.args.length === 3`. */
  expr: Expr & { kind: "call"; name: "if" };
  onChange: (next: Expr) => void;
};

export function IfBlock({ scope, expr, onChange }: IfBlockProps) {
  const [condExpr, thenExpr, elseExpr] = expr.args;

  const setCond = (nextStr: string) => {
    const next = parseExpression(nextStr) ?? { kind: "literal" as const, value: "" };
    onChange({
      ...expr,
      args: [next, thenExpr ?? lit(""), elseExpr ?? lit("")],
    });
  };

  const setBranch = (
    branchIdx: 1 | 2,
    next:
      | { kind: "literal"; raw: string }
      | { kind: "ref"; variableName: string },
  ) => {
    const value: Expr =
      next.kind === "ref"
        ? { kind: "ref", name: next.variableName }
        : autoTypeLiteral(next.raw);
    const args: Expr[] = [
      condExpr ?? lit(""),
      branchIdx === 1 ? value : thenExpr ?? lit(""),
      branchIdx === 2 ? value : elseExpr ?? lit(""),
    ];
    onChange({ ...expr, args });
  };

  // Convertimos los branches al formato del ValueInput.
  const thenValue = exprToValueInput(thenExpr);
  const elseValue = exprToValueInput(elseExpr);

  return (
    <div className="pulso-logic-ifblock">
      <div className="pulso-logic-ifblock-cond">
        <LogicBuilder
          expression={condExpr ? serializeExpression(condExpr) : ""}
          scope={scope}
          fieldLabel="Si se cumple"
          onChange={setCond}
        />
      </div>

      <div className="pulso-logic-ifblock-branch">
        <span className="pulso-logic-ifblock-branchlabel">entonces vale</span>
        <ValueInput
          baseType="text"
          variables={scope.variables}
          value={thenValue}
          onChange={(next) => setBranch(1, next)}
        />
      </div>

      <div className="pulso-logic-ifblock-branch">
        <span className="pulso-logic-ifblock-branchlabel">si no vale</span>
        <ValueInput
          baseType="text"
          variables={scope.variables}
          value={elseValue}
          onChange={(next) => setBranch(2, next)}
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Helpers locales
// ----------------------------------------------------------------------------

function lit(value: string | number | boolean): Expr {
  return { kind: "literal", value };
}

function exprToValueInput(
  expr: Expr | undefined,
):
  | { kind: "literal"; raw: string }
  | { kind: "ref"; variableName: string } {
  if (!expr) return { kind: "literal", raw: "" };
  if (expr.kind === "ref") return { kind: "ref", variableName: expr.name };
  if (expr.kind === "literal") {
    return { kind: "literal", raw: String(expr.value) };
  }
  // Cualquier otra forma (sub-fórmula) se aplana a su serialización
  // como literal — no perdemos nada porque la guardamos como string
  // pero en la UI se ve como texto plano. Si el usuario edita el campo,
  // se reemplaza por un literal nuevo.
  return { kind: "literal", raw: serializeExpression(expr) };
}

function autoTypeLiteral(raw: string): Expr {
  if (raw === "true" || raw === "false") {
    return { kind: "literal", value: raw === "true" };
  }
  if (raw !== "" && !isNaN(Number(raw)) && raw === String(Number(raw))) {
    return { kind: "literal", value: Number(raw) };
  }
  return { kind: "literal", value: raw };
}
