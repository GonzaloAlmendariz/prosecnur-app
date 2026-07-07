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

import { useState } from "react";
import { X } from "lucide-react";
import { IconHint } from "../../../../lib/icons";
import {
  expandCondition,
  parseExpression,
  serializeExpression,
  treeToExpr,
  tryBuildLogicTree,
  tryFlattenCondition,
} from "../../logic";
import type { Expr, FlatCondition, LogicScope, LogicTree } from "../../logic";
import { defaultPredicate } from "../../logic";
import { ConditionRow } from "./ConditionRow";
import { LogicGroupBlock } from "./LogicGroupBlock";
import { LogicTreeBuilder } from "./LogicTreeBuilder";
import { VariablePicker } from "./VariablePicker";

export type LogicBuilderProps = {
  /** Expresión ODK actual. */
  expression: string;
  scope: LogicScope;
  /** Etiqueta del campo (ej. "Cuándo aparece"). */
  fieldLabel: string;
  /** Hint debajo del builder. */
  hint?: string;
  /** Sujeto visible para textos humanos: "esta pregunta", "este bloque". */
  targetNoun?: string;
  /** Callback con la expresión ODK serializada. */
  onChange: (next: string) => void;
};

export function LogicBuilder({
  expression,
  scope,
  fieldLabel,
  hint,
  targetNoun = "esta pregunta",
  onChange,
}: LogicBuilderProps) {
  const rawExpression = expression.trim();
  const [manualOpen, setManualOpen] = useState(false);
  const [guidedEmptyOpen, setGuidedEmptyOpen] = useState(false);
  const [manualValue, setManualValue] = useState(rawExpression);
  const ast = parseExpression(expression);
  const buildEmpty = (): FlatCondition => buildEmptyCondition(scope);
  const hasVariables = scope.variables.length > 0;
  const openManual = () => {
    setManualValue(rawExpression);
    setManualOpen(true);
  };

  if (manualOpen) {
    return (
      <div className="pulso-logic-builder">
        <header className="pulso-logic-builder-header">
          <span className="pulso-section-eyebrow">{fieldLabel}</span>
        </header>
        <ManualFormulaEditor
          value={manualValue}
          targetNoun={targetNoun}
          onChange={setManualValue}
          onApply={() => {
            onChange(manualValue.trim());
            setManualOpen(false);
          }}
          onCancel={() => setManualOpen(false)}
        />
        {hint && <p className="pulso-logic-builder-hint">{hint}</p>}
      </div>
    );
  }

  // Caso 1: vacío.
  if (!ast) {
    if (guidedEmptyOpen && !hasVariables) {
      return (
        <div className="pulso-logic-builder">
          <header className="pulso-logic-builder-header">
            <span className="pulso-section-eyebrow">{fieldLabel}</span>
          </header>
          <div className="pulso-logic-builder-guided-empty">
            <NoVariablesGuidedCondition />
            <p>
              Las condiciones guiadas necesitan una pregunta ubicada antes de
              {` ${targetNoun}`}. Cuando exista, aparecerá aquí para elegirla.
            </p>
            <div className="pulso-logic-builder-rawactions">
              <button
                type="button"
                className="pulso-logic-builder-advanced"
                onClick={openManual}
              >
                Escribir fórmula XLSForm
              </button>
              <button
                type="button"
                className="pulso-logic-builder-clear"
                onClick={() => setGuidedEmptyOpen(false)}
              >
                Volver
              </button>
            </div>
          </div>
          {hint && <p className="pulso-logic-builder-hint">{hint}</p>}
        </div>
      );
    }

    const emptyText = hasVariables
      ? `Sin condición — ${targetNoun} siempre se muestra.`
      : `Sin preguntas previas para armar una regla guiada. ${capitalizeFirst(targetNoun)} puede condicionarse con una fórmula XLSForm.`;
    return (
      <div className="pulso-logic-builder">
        <header className="pulso-logic-builder-header">
          <span className="pulso-section-eyebrow">{fieldLabel}</span>
        </header>
        <div className="pulso-logic-builder-empty">
          <IconHint size={14} />
          <span>{emptyText}</span>
          <button
            type="button"
            className="pulso-logic-builder-add"
            onClick={() => {
              if (!hasVariables) {
                setGuidedEmptyOpen(true);
                return;
              }
              const cond = buildEmpty();
              if (!cond.variableName) {
                setGuidedEmptyOpen(true);
                return;
              }
              onChange(serializeExpression(expandCondition(cond)));
            }}
          >
            + Agregar condición
          </button>
          {hasVariables && (
            <button
              type="button"
              className="pulso-logic-builder-advanced"
              onClick={openManual}
            >
              Fórmula avanzada
            </button>
          )}
        </div>
        {hint && <p className="pulso-logic-builder-hint">{hint}</p>}
      </div>
    );
  }

  if (ast.kind === "raw") {
    return (
      <div className="pulso-logic-builder">
        <header className="pulso-logic-builder-header">
          <span className="pulso-section-eyebrow">{fieldLabel}</span>
          <button
            type="button"
            className="pulso-logic-builder-clear"
            onClick={() => onChange("")}
            title={`Quitar la condición — ${targetNoun} se mostrará siempre.`}
          >
            <X size={12} /> Quitar
          </button>
        </header>
        <div className="pulso-logic-builder-raw">
          <pre>{ast.text}</pre>
          <p className="pulso-logic-builder-rawhint">
            Esta fórmula se preserva al exportar. Puedes editarla aquí si ya
            conoces el código XLSForm.
          </p>
          <div className="pulso-logic-builder-rawactions">
            <button
              type="button"
              className="pulso-logic-builder-replace"
              onClick={openManual}
            >
              Editar fórmula
            </button>
            {hasVariables && (
              <button
                type="button"
                className="pulso-logic-builder-advanced"
                onClick={() => {
                  const cond = buildEmpty();
                  if (!cond.variableName) return;
                  onChange(serializeExpression(expandCondition(cond)));
                }}
              >
                Rehacer guiado
              </button>
            )}
          </div>
        </div>
        {hint && <p className="pulso-logic-builder-hint">{hint}</p>}
      </div>
    );
  }

  // Caso 4 helper: el AST no encaja en flat ni en AND/OR plano. Se
  // construye un LogicTree y se renderiza con `LogicTreeBuilder` que
  // soporta mezclas AND/OR + grupos anidados. Si el árbol es enteramente
  // raw (cosas como regex, count-selected, etc), `LogicTreeBuilder`
  // muestra la caja honesta sin badge "Avanzada" agresivo.
  const renderTree = (treeRoot: LogicTree) => (
    <div className="pulso-logic-builder">
      <header className="pulso-logic-builder-header">
        <span className="pulso-section-eyebrow">{fieldLabel}</span>
        <button
          type="button"
          className="pulso-logic-builder-clear"
          onClick={() => onChange("")}
          title={`Quitar la condición — ${targetNoun} se mostrará siempre.`}
        >
          <X size={12} /> Quitar
        </button>
      </header>
      <LogicTreeBuilder
        tree={treeRoot}
        scope={scope}
        onChange={(next) => {
          if (next.kind === "group" && next.children.length === 0) {
            onChange("");
            return;
          }
          onChange(serializeExpression(treeToExpr(next)));
        }}
        isRoot
      />
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
            title={`Quitar la condición — ${targetNoun} se mostrará siempre.`}
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

  // Caso 4: AND/OR mezclado, anidamientos, not() arbitrarios — usamos el
  // LogicTreeBuilder que sí maneja árboles. Si la fórmula es 100% raw
  // (regex, etc), el builder lo muestra como caja honesta sin botón
  // "reemplazar todo".
  const tree = tryBuildLogicTree(ast);
  return renderTree(tree);
}

function NoVariablesGuidedCondition() {
  return (
    <div className="pulso-logic-condition-row pulso-logic-condition-row--starter">
      <div className="pulso-logic-condition-piece pulso-logic-condition-var">
        <span className="pulso-logic-condition-label">Pregunta</span>
        <VariablePicker
          variables={[]}
          selected=""
          onChange={() => {
            // No hay variables elegibles todavía.
          }}
          placeholder="Elige una pregunta previa"
        />
      </div>
      <div className="pulso-logic-starter-note">
        Criterio y valor aparecerán cuando exista una pregunta previa.
      </div>
    </div>
  );
}

function ManualFormulaEditor({
  value,
  targetNoun,
  onChange,
  onApply,
  onCancel,
}: {
  value: string;
  targetNoun: string;
  onChange: (next: string) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const clean = value.trim();
  return (
    <div className="pulso-logic-builder-manual">
      <label>
        <span>Fórmula XLSForm para mostrar {targetNoun}</span>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={2}
          placeholder="${pregunta_1} = 'si'"
        />
      </label>
      <p>
        Úsala cuando necesitas una condición avanzada o todavía no hay una
        pregunta previa disponible para el asistente visual.
      </p>
      <div className="pulso-logic-builder-rawactions">
        <button
          type="button"
          className="pulso-logic-builder-replace"
          onClick={onApply}
          disabled={!clean}
        >
          Aplicar fórmula
        </button>
        <button type="button" className="pulso-logic-builder-clear" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
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
