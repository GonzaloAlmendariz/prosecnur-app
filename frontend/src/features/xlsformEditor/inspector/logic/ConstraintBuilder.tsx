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

import { CheckCircle2, X } from "lucide-react";
import { IconHint } from "../../../../lib/icons";
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
  onApplyPreset?: (next: { expression: string; message: string }) => void;
  showShortcuts?: boolean;
};

export function ConstraintBuilder({
  expression,
  scope,
  baseType,
  listName,
  fieldLabel,
  hint,
  onChange,
  onApplyPreset,
  showShortcuts = true,
}: ConstraintBuilderProps) {
  const ast = parseExpression(expression);
  const shortcutPresets = constraintShortcutPresetsFor(baseType);

  const applyShortcut = (preset: ConstraintShortcutPreset) => {
    if (onApplyPreset) {
      onApplyPreset({ expression: preset.expression, message: preset.message });
      return;
    }
    onChange(preset.expression);
  };

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
          <IconHint size={14} />
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
        {showShortcuts && shortcutPresets.length > 0 && (
          <div className="pulso-constraint-shortcuts" aria-label="Atajos comunes de validación">
            <div className="pulso-constraint-shortcuts-head">
              <span className="pulso-section-eyebrow">Atajos Kobo</span>
              <strong>Reglas frecuentes sin escribir fórmula</strong>
              <small>Aplican un constraint listo para exportar; en el inspector también completan el mensaje para campo.</small>
            </div>
            <div className="pulso-constraint-shortcut-grid">
              {shortcutPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="pulso-constraint-shortcut"
                  onClick={() => applyShortcut(preset)}
                  title={preset.hint}
                >
                  <span className="pulso-constraint-shortcut-icon" aria-hidden="true">
                    <CheckCircle2 size={12} />
                  </span>
                  <span className="pulso-constraint-shortcut-copy">
                    <strong>{preset.label}</strong>
                    <small>{preset.hint}</small>
                    <em>{preset.message}</em>
                  </span>
                  {preset.badge && <code>{preset.badge}</code>}
                </button>
              ))}
            </div>
          </div>
        )}
        {hint && <p className="pulso-logic-builder-hint">{hint}</p>}
      </div>
    );
  }

  const renderRaw = (raw: string) => (
    <div className="pulso-logic-builder">
      <header className="pulso-logic-builder-header">
        <span className="pulso-section-eyebrow">{fieldLabel}</span>
        <span className="pulso-logic-builder-status">Regla técnica</span>
      </header>
      <div className="pulso-logic-builder-raw">
        <pre>{raw}</pre>
        <p className="pulso-logic-builder-rawhint">
          Esta validación vino con una forma técnica. Se preserva tal cual al
          exportar; puedes reemplazarla por una regla guiada si necesitas
          editarla desde esta vista.
        </p>
        <div className="pulso-logic-builder-rawactions">
          <button
            type="button"
            className="pulso-logic-builder-replace"
            onClick={() => {
              onChange(serializeExpression(expandConstraint(buildEmpty())));
            }}
          >
            Crear regla guiada
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

type ConstraintShortcutPreset = {
  id: string;
  label: string;
  hint: string;
  expression: string;
  message: string;
  badge?: string;
};

function constraintShortcutPresetsFor(baseType: string): ConstraintShortcutPreset[] {
  if (baseType === "text" || baseType === "") {
    return [
      {
        id: "email",
        label: "Correo electrónico",
        hint: "Acepta respuestas como nombre@dominio.org.",
        expression: "regex(., '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$')",
        message: "Ingresa un correo electrónico válido.",
        badge: "regex",
      },
      {
        id: "digits",
        label: "Solo dígitos",
        hint: "Para DNI, teléfonos, códigos numéricos o identificadores.",
        expression: "regex(., '^\\d+$')",
        message: "Ingresa solo números, sin letras ni símbolos.",
        badge: "0-9",
      },
      {
        id: "code",
        label: "Código sin espacios",
        hint: "Acepta letras, números, guion y guion bajo.",
        expression: "regex(., '^[A-Za-z0-9_-]+$')",
        message: "Ingresa un código sin espacios.",
        badge: "ABC_123",
      },
    ];
  }
  if (baseType === "integer" || baseType === "decimal") {
    return [
      {
        id: "positive",
        label: "Mayor que cero",
        hint: "Para montos, cantidades o mediciones que deben ser positivas.",
        expression: ". > 0",
        message: "Ingresa un valor mayor que cero.",
        badge: "> 0",
      },
      {
        id: "non-negative",
        label: "Cero o más",
        hint: "Permite cero, pero no acepta valores negativos.",
        expression: ". >= 0",
        message: "Ingresa un valor igual o mayor que cero.",
        badge: ">= 0",
      },
      {
        id: "adult-range",
        label: "Edad 18 a 65",
        hint: "Atajo común para edad adulta o población laboral.",
        expression: ". >= 18 and . <= 65",
        message: "Ingresa una edad entre 18 y 65.",
        badge: "18-65",
      },
    ];
  }
  if (baseType === "date") {
    return [
      {
        id: "not-future",
        label: "No futura",
        hint: "Acepta fechas iguales o anteriores a hoy.",
        expression: ". <= today()",
        message: "La fecha no puede ser posterior a hoy.",
        badge: "today()",
      },
    ];
  }
  if (baseType === "select_multiple") {
    return [
      {
        id: "max-three",
        label: "Máximo 3 opciones",
        hint: "Limita cuántas opciones puede marcar la persona encuestada.",
        expression: "count-selected(.) <= 3",
        message: "Selecciona máximo 3 opciones.",
        badge: "count",
      },
    ];
  }
  return [];
}
