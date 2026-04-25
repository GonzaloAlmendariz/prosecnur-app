// =============================================================================
// inspector/logic/LogicBuilder.tsx — entry point del builder visual
// =============================================================================
// Recibe:
//   - `expression` — string ODK actual (puede estar vacío).
//   - `scope` — variables y catálogos disponibles.
//   - `onChange(nextExpression)` — string ODK para guardar.
//
// Decide qué renderizar:
//
//   1. Vacío (`expression === ""`) → empty state con CTA "Agregar condición".
//   2. Expresión simple (1 condición plana) → ConditionRow inline.
//   3. AND/OR plano de condiciones planas → LogicGroupBlock.
//   4. Expresión compleja (anidado, NOT, llamadas no-`selected`, AND/OR
//      mixto) → caja read-only con la expresión cruda y CTA para
//      reemplazarla por una nueva visual.
//
// La idea es que F2-2 cubra los 3 primeros casos (lo común); el caso 4
// queda como fallback honesto sin forzar parseo de cosas que no rinden
// bien en UI plana. F2-3+ aumentan la cobertura.
// =============================================================================

import { Sparkles, X } from "lucide-react";
import {
  expandCondition,
  parseExpression,
  serializeExpression,
  tryFlattenCondition,
} from "../../logic";
import type { Expr, FlatCondition, LogicScope } from "../../logic";
import { defaultPredicate } from "../../logic";
import { ConditionRow } from "./ConditionRow";
import { LogicGroupBlock } from "./LogicGroupBlock";

export type LogicBuilderProps = {
  /** Expresión ODK actual. */
  expression: string;
  scope: LogicScope;
  /** Etiqueta del campo (ej. "Cuándo aparece"). */
  fieldLabel: string;
  /** Hint debajo del builder. */
  hint?: string;
  /** Callback con la expresión ODK serializada. */
  onChange: (next: string) => void;
};

export function LogicBuilder({
  expression,
  scope,
  fieldLabel,
  hint,
  onChange,
}: LogicBuilderProps) {
  const ast = parseExpression(expression);
  const buildEmpty = (): FlatCondition => buildEmptyCondition(scope);

  // Caso 1: vacío.
  if (!ast) {
    return (
      <div className="pulso-logic-builder">
        <header className="pulso-logic-builder-header">
          <span className="pulso-section-eyebrow">{fieldLabel}</span>
        </header>
        <div className="pulso-logic-builder-empty">
          <Sparkles size={14} />
          <span>Sin condición — la pregunta siempre se muestra.</span>
          <button
            type="button"
            className="pulso-logic-builder-add"
            onClick={() => {
              const cond = buildEmpty();
              if (!cond.variableName) return;
              onChange(serializeExpression(expandCondition(cond)));
            }}
            disabled={!scope.variables.length}
          >
            + Agregar condición
          </button>
        </div>
        {hint && <p className="pulso-logic-builder-hint">{hint}</p>}
      </div>
    );
  }

  // Caso 4 helper: caja read-only para AST que no se puede aplanar.
  const renderRaw = (raw: string) => (
    <div className="pulso-logic-builder">
      <header className="pulso-logic-builder-header">
        <span className="pulso-section-eyebrow">{fieldLabel}</span>
        <span className="pulso-logic-builder-status">Avanzada</span>
      </header>
      <div className="pulso-logic-builder-raw">
        <pre>{raw}</pre>
        <p className="pulso-logic-builder-rawhint">
          Esta condición tiene una forma que el editor visual aún no
          maneja al 100%. Se preserva tal cual al exportar; la siguiente
          iteración del builder cubre <code>not()</code>, anidados y
          mezclas <em>y/o</em>.
        </p>
        <div className="pulso-logic-builder-rawactions">
          <button
            type="button"
            className="pulso-logic-builder-replace"
            onClick={() => {
              const cond = buildEmpty();
              if (!cond.variableName) return;
              onChange(serializeExpression(expandCondition(cond)));
            }}
            disabled={!scope.variables.length}
          >
            Reemplazar con builder visual
          </button>
          <button
            type="button"
            className="pulso-logic-builder-clear"
            onClick={() => onChange("")}
            title="Quitar la condición — la pregunta se mostrará siempre."
          >
            <X size={12} /> Quitar
          </button>
        </div>
      </div>
      {hint && <p className="pulso-logic-builder-hint">{hint}</p>}
    </div>
  );

  // Caso 2: condición simple.
  const flat = tryFlattenCondition(ast);
  if (flat) {
    return (
      <div className="pulso-logic-builder">
        <header className="pulso-logic-builder-header">
          <span className="pulso-section-eyebrow">{fieldLabel}</span>
          <button
            type="button"
            className="pulso-logic-builder-clear"
            onClick={() => onChange("")}
            title="Quitar la condición — la pregunta se mostrará siempre."
          >
            <X size={12} /> Quitar
          </button>
        </header>
        <div className="pulso-logic-builder-single">
          <ConditionRow
            scope={scope}
            condition={flat}
            onChange={(next) => {
              onChange(serializeExpression(expandCondition(next)));
            }}
          />
        </div>
        {hint && <p className="pulso-logic-builder-hint">{hint}</p>}
      </div>
    );
  }

  // Caso 3: AND/OR plano de condiciones planas.
  if (ast.kind === "logical") {
    const flatChildren: FlatCondition[] = [];
    let allFlat = true;
    for (const operand of ast.operands) {
      const child = tryFlattenCondition(operand);
      if (!child) {
        allFlat = false;
        break;
      }
      flatChildren.push(child);
    }
    if (allFlat && flatChildren.length >= 2) {
      const onChangeConditions = (next: FlatCondition[]) => {
        if (next.length === 0) {
          onChange("");
          return;
        }
        if (next.length === 1) {
          onChange(serializeExpression(expandCondition(next[0]!)));
          return;
        }
        const nextExpr: Expr = {
          kind: "logical",
          op: ast.op,
          operands: next.map(expandCondition),
        };
        onChange(serializeExpression(nextExpr));
      };
      const onChangeConnector = (nextConnector: "and" | "or") => {
        if (nextConnector === ast.op) return;
        const nextExpr: Expr = {
          kind: "logical",
          op: nextConnector,
          operands: ast.operands,
        };
        onChange(serializeExpression(nextExpr));
      };
      return (
        <div className="pulso-logic-builder">
          <header className="pulso-logic-builder-header">
            <span className="pulso-section-eyebrow">{fieldLabel}</span>
            <button
              type="button"
              className="pulso-logic-builder-clear"
              onClick={() => onChange("")}
              title="Quitar todas las condiciones."
            >
              <X size={12} /> Quitar
            </button>
          </header>
          <LogicGroupBlock
            scope={scope}
            connector={ast.op}
            onChangeConnector={onChangeConnector}
            conditions={flatChildren}
            onChangeConditions={onChangeConditions}
            fieldLabel="Condiciones"
            buildEmptyCondition={buildEmpty}
          />
          {hint && <p className="pulso-logic-builder-hint">{hint}</p>}
        </div>
      );
    }
  }

  // Caso 4: caemos al raw read-only.
  return renderRaw(serializeExpression(ast));
}

/**
 * Construye una condición default cuando el usuario agrega una vacía. Usa
 * la primera variable del scope (si existe) y su predicado por defecto.
 */
function buildEmptyCondition(scope: LogicScope): FlatCondition {
  const firstVar = scope.variables[0];
  const baseType = firstVar?.baseType ?? "text";
  return {
    variableName: firstVar?.name ?? "",
    predicate: defaultPredicate(baseType),
    value: { kind: "literal", raw: "" },
  };
}
