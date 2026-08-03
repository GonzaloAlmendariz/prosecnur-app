// =============================================================================
// inspector/logic/IfBlock.tsx — bloque visual para `if(cond, then, else)`
// =============================================================================
// El patrón más común de fórmula en el corpus es `if(<cond>, <a>, <b>)`.
// En lugar de escribirlo a mano, lo desarmamos en tres pasos declarados:
//
//   ① SI SE CUMPLE    <LogicBuilder reutilizado, sin cabecera propia>
//   ② ENTONCES VALE   [ valor o ${var} ]
//   ③ SI NO VALE      [ valor o ${var} ]
//
// Los tres comparten tratamiento de etiqueta. El builder de la condición va
// en modo `bare`: la cabecera la pone este bloque, no él.
//
// La condición usa el mismo LogicBuilder de F2-2 — reaprovechamos toda
// la maquinaria de aplanado AND/OR. Los campos "entonces" y "si no" son
// atómicos: literal o referencia a una variable (sin sub-fórmulas
// anidadas en F2-4; eso entra en una iteración posterior si hace falta).
// =============================================================================

import type React from "react";
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
    <div
      className="pulso-logic-ifblock"
      data-qa-geometry-group="xlsform/calculation-if-steps"
      data-qa-geometry-contract="intrinsic"
    >
      <IfStep n={1} label="Si se cumple">
        <LogicBuilder
          expression={condExpr ? serializeExpression(condExpr) : ""}
          scope={scope}
          fieldLabel="Si se cumple"
          chrome="bare"
          onChange={setCond}
        />
      </IfStep>

      <IfStep n={2} label="Entonces vale">
        <ValueInput
          baseType="text"
          variables={scope.variables}
          value={thenValue}
          onChange={(next) => setBranch(1, next)}
        />
      </IfStep>

      <IfStep n={3} label="Si no vale">
        <ValueInput
          baseType="text"
          variables={scope.variables}
          value={elseValue}
          onChange={(next) => setBranch(2, next)}
        />
      </IfStep>
    </div>
  );
}

/** Un paso del `if`. Los tres comparten tratamiento de etiqueta para que la
 *  condición, el "entonces" y el "si no" se lean como el mismo nivel: antes
 *  la condición traía la cabecera del LogicBuilder y las ramas una etiqueta
 *  alineada a la derecha en una columna de 110 px. */
function IfStep({
  n,
  label,
  children,
}: {
  n: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pulso-logic-ifstep">
      <header className="pulso-logic-ifstep-head">
        <span className="pulso-logic-ifstep-mark" aria-hidden="true">
          {n}
        </span>
        <span className="pulso-logic-ifstep-label">{label}</span>
      </header>
      <div className="pulso-logic-ifstep-body">{children}</div>
    </section>
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
