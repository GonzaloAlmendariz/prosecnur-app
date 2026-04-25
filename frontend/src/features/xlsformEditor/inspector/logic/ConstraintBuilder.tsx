// =============================================================================
// inspector/logic/ConstraintBuilder.tsx — builder visual de constraint
// =============================================================================
// Análogo a `LogicBuilder` pero para el campo `constraint`. La diferencia
// estructural es que el lhs siempre es `.` (current) y por eso usamos
// `ConstraintRow` en vez de `ConditionRow`.
//
// Casos:
//   1. Vacío → empty state con CTA "Agregar validación".
//   2. Una compare con `.` lhs → ConstraintRow inline.
//   3. AND/OR plano de compare-con-`.` → grupo plano.
//   4. Compleja → caja read-only con CTA "Reemplazar" + "Quitar".
//
// Helpers especiales:
//   - "Atajo entre min y max" agrega `. >= min and . <= max` con dos
//     campos numéricos (caso muy común en integer/decimal/date — del
//     corpus auditado).
// =============================================================================

import { Sparkles, X } from "lucide-react";
import {
  expandConstraint,
  parseExpression,
  serializeExpression,
  tryFlattenConstraint,
} from "../../logic";
import type { Expr, FlatConstraint, LogicScope } from "../../logic";
import { defaultPredicate } from "../../logic";
import { ConstraintRow } from "./ConstraintRow";

export type ConstraintBuilderProps = {
  expression: string;
  scope: LogicScope;
  /** Tipo base de la pregunta — los operadores y el control de valor se
   *  derivan de aquí. */
  baseType: string;
  /** Catálogo si la pregunta es select_*. */
  listName?: string;
  fieldLabel: string;
  hint?: string;
  onChange: (next: string) => void;
};

export function ConstraintBuilder({
  expression,
  scope,
  baseType,
  listName,
  fieldLabel,
  hint,
  onChange,
}: ConstraintBuilderProps) {
  const ast = parseExpression(expression);

  const buildEmpty = (): FlatConstraint => ({
    predicate: defaultPredicate(baseType),
    value: { kind: "literal", raw: "" },
  });

  // Caso 1: vacío.
  if (!ast) {
    return (
      <div className="pulso-logic-builder">
        <header className="pulso-logic-builder-header">
          <span className="pulso-section-eyebrow">{fieldLabel}</span>
        </header>
        <div className="pulso-logic-builder-empty">
          <Sparkles size={14} />
          <span>Sin validación — la respuesta se acepta tal cual.</span>
          <button
            type="button"
            className="pulso-logic-builder-add"
            onClick={() => {
              onChange(serializeExpression(expandConstraint(buildEmpty())));
            }}
          >
            + Agregar validación
          </button>
        </div>
        {hint && <p className="pulso-logic-builder-hint">{hint}</p>}
      </div>
    );
  }

  const renderRaw = (raw: string) => (
    <div className="pulso-logic-builder">
      <header className="pulso-logic-builder-header">
        <span className="pulso-section-eyebrow">{fieldLabel}</span>
        <span className="pulso-logic-builder-status">Avanzada</span>
      </header>
      <div className="pulso-logic-builder-raw">
        <pre>{raw}</pre>
        <p className="pulso-logic-builder-rawhint">
          Esta validación tiene una forma que el editor visual aún no
          maneja. Se preserva tal cual al exportar; F2-3+ irá cubriendo
          formas adicionales.
        </p>
        <div className="pulso-logic-builder-rawactions">
          <button
            type="button"
            className="pulso-logic-builder-replace"
            onClick={() => {
              onChange(serializeExpression(expandConstraint(buildEmpty())));
            }}
          >
            Reemplazar con builder visual
          </button>
          <button
            type="button"
            className="pulso-logic-builder-clear"
            onClick={() => onChange("")}
            title="Quitar la validación."
          >
            <X size={12} /> Quitar
          </button>
        </div>
      </div>
      {hint && <p className="pulso-logic-builder-hint">{hint}</p>}
    </div>
  );

  // Caso 2: simple `. <op> X`.
  const flat = tryFlattenConstraint(ast);
  if (flat) {
    return (
      <div className="pulso-logic-builder">
        <header className="pulso-logic-builder-header">
          <span className="pulso-section-eyebrow">{fieldLabel}</span>
          <button
            type="button"
            className="pulso-logic-builder-clear"
            onClick={() => onChange("")}
            title="Quitar la validación."
          >
            <X size={12} /> Quitar
          </button>
        </header>
        <div className="pulso-logic-builder-single">
          <ConstraintRow
            scope={scope}
            baseType={baseType}
            listName={listName}
            constraint={flat}
            onChange={(next) => {
              onChange(serializeExpression(expandConstraint(next)));
            }}
          />
        </div>
        {hint && <p className="pulso-logic-builder-hint">{hint}</p>}
      </div>
    );
  }

  // Caso 3: AND/OR plano de compare-con-`.`.
  if (ast.kind === "logical") {
    const flatChildren: FlatConstraint[] = [];
    let allFlat = true;
    for (const operand of ast.operands) {
      const child = tryFlattenConstraint(operand);
      if (!child) {
        allFlat = false;
        break;
      }
      flatChildren.push(child);
    }
    if (allFlat && flatChildren.length >= 2) {
      const updateAt = (index: number, next: FlatConstraint) => {
        const copy = [...flatChildren];
        copy[index] = next;
        emit(copy);
      };
      const removeAt = (index: number) => {
        emit(flatChildren.filter((_, i) => i !== index));
      };
      const add = () => {
        emit([...flatChildren, buildEmpty()]);
      };
      const setConnector = (next: "and" | "or") => {
        if (next === ast.op) return;
        const expr: Expr = {
          kind: "logical",
          op: next,
          operands: ast.operands,
        };
        onChange(serializeExpression(expr));
      };
      const emit = (cs: FlatConstraint[]) => {
        if (cs.length === 0) {
          onChange("");
          return;
        }
        if (cs.length === 1) {
          onChange(serializeExpression(expandConstraint(cs[0]!)));
          return;
        }
        const expr: Expr = {
          kind: "logical",
          op: ast.op,
          operands: cs.map(expandConstraint),
        };
        onChange(serializeExpression(expr));
      };

      return (
        <div className="pulso-logic-builder">
          <header className="pulso-logic-builder-header">
            <span className="pulso-section-eyebrow">{fieldLabel}</span>
            <button
              type="button"
              className="pulso-logic-builder-clear"
              onClick={() => onChange("")}
              title="Quitar todas las reglas."
            >
              <X size={12} /> Quitar
            </button>
          </header>
          <div className="pulso-logic-group">
            <header className="pulso-logic-group-header">
              <span className="pulso-logic-group-prompt">Reglas</span>
              <span
                className="pulso-logic-group-connector"
                role="radiogroup"
                aria-label="Conector entre reglas"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={ast.op === "and"}
                  className={ast.op === "and" ? "is-on" : ""}
                  onClick={() => setConnector("and")}
                  title="Todas las reglas deben cumplirse"
                >
                  y
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={ast.op === "or"}
                  className={ast.op === "or" ? "is-on" : ""}
                  onClick={() => setConnector("or")}
                  title="Al menos una regla debe cumplirse"
                >
                  o
                </button>
              </span>
            </header>
            <div className="pulso-logic-group-body">
              {flatChildren.map((c, idx) => (
                <div className="pulso-logic-group-item" key={idx}>
                  {idx > 0 && (
                    <span className="pulso-logic-group-sep" aria-hidden="true">
                      {ast.op}
                    </span>
                  )}
                  <ConstraintRow
                    scope={scope}
                    baseType={baseType}
                    listName={listName}
                    constraint={c}
                    onChange={(next) => updateAt(idx, next)}
                    onRemove={
                      flatChildren.length > 1 ? () => removeAt(idx) : undefined
                    }
                  />
                </div>
              ))}
            </div>
            <footer className="pulso-logic-group-footer">
              <button
                type="button"
                className="pulso-logic-group-add"
                onClick={add}
              >
                + Agregar regla
              </button>
            </footer>
          </div>
          {hint && <p className="pulso-logic-builder-hint">{hint}</p>}
        </div>
      );
    }
  }

  return renderRaw(serializeExpression(ast));
}
