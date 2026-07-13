// =============================================================================
// inspector/logic/ConstraintBuilder.tsx — builder visual de constraint
// =============================================================================
// Análogo a `LogicBuilder` pero para el campo `constraint`. La diferencia
// estructural es que el lhs siempre es `.` (current) y por eso usamos
// `ConstraintRow` en vez de `ConditionRow`.
//
// Casos:
//   1. Vacío → empty state con CTA "Agregar validación" (+ galería "Formato
//      del texto" para preguntas de texto).
//   2. Regla de texto reconocida (`regex(., '…')` del catálogo textRules) →
//      TextRuleSuite en modo humano, reversible al reabrir.
//   3. Una compare con `.` lhs → ConstraintRow inline.
//   4. AND/OR plano de compare-con-`.` → grupo plano.
//   5. AND plano mixto (compares planas + reglas de texto reconocidas) →
//      filas mixtas. Límite documentado: solo op `and`; un OR con regex o un
//      operando no reconocible cae a la caja técnica.
//   6. Compleja → caja read-only con CTA "Reemplazar" + "Quitar".
//
// Helpers especiales:
//   - "Atajo entre min y max" agrega `. >= min and . <= max` con dos
//     campos numéricos (caso muy común en integer/decimal/date — del
//     corpus auditado).
//   - Los presets regex (email/dígitos/código) se definen desde el catálogo
//     textRules — una sola fuente para preset, galería y reconocimiento.
// =============================================================================

import type { ReactNode } from "react";
import { CheckCircle2, X } from "lucide-react";
import { IconHint } from "../../../../lib/icons";
import TechTerm from "../../helpers/TechTerm";
import {
  expandConstraint,
  parseExpression,
  serializeExpression,
  tryFlattenConstraint,
} from "../../logic";
import type { Expr, FlatConstraint, LogicScope } from "../../logic";
import { defaultPredicate } from "../../logic";
import { ConstraintRow } from "./ConstraintRow";
import { TextRuleSuite } from "./TextRuleSuite";
import { buildTextRuleConstraint, matchTextRule, textRuleById } from "./textRules";
import type { TextRuleParams, TextRuleRecipe } from "./textRules";

export type ConstraintBuilderProps = {
  expression: string;
  scope: LogicScope;
  /** Tipo base de la pregunta — los operadores y el control de valor se
   *  derivan de aquí. */
  baseType: string;
  /** Catálogo si la pregunta es select_*. */
  listName?: string;
  /** Etiqueta del campo. Acepta nodos para incrustar `<TechTerm />`. */
  fieldLabel: ReactNode;
  hint?: string;
  /** Columna XLSForm que edita este builder (ej. "constraint") — se
   *  muestra junto al readout "Código Kobo". Solo estética. */
  techTerm?: string;
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
  techTerm,
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

  // Mismo canal que los presets: expresión + mensaje sugerido cuando el
  // padre lo soporta (LogicTab llena constraint_message); si no, solo la
  // expresión.
  const applyTextRule = (expression: string, message: string) => {
    if (onApplyPreset) {
      onApplyPreset({ expression, message });
      return;
    }
    onChange(expression);
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
              <small>Aplican la regla <TechTerm t="constraint" /> y su mensaje, listos para exportar.</small>
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
        {showShortcuts && (baseType === "text" || baseType === "") && (
          <div className="pulso-xftr-section">
            <div className="pulso-xftr-section-head">
              <span className="pulso-section-eyebrow">
                Formato del texto <TechTerm t="regex" />
              </span>
              <small>Reglas en lenguaje claro: longitud, contenido y formato.</small>
            </div>
            <TextRuleSuite
              active={null}
              onApply={applyTextRule}
              onClear={() => onChange("")}
            />
          </div>
        )}
        {hint && <p className="pulso-logic-builder-hint">{hint}</p>}
      </div>
    );
  }

  // Caso 2: regla de texto reconocida — el constraint completo es un
  // `regex(., '…')` del catálogo. Reversible: guardar → reabrir → se ve la
  // receta humana, no código.
  const textRule = matchTextRule(ast);
  if (textRule) {
    return (
      <div className="pulso-logic-builder">
        <header className="pulso-logic-builder-header">
          <span className="pulso-section-eyebrow">{fieldLabel}</span>
          <span className="pulso-logic-builder-status">
            Formato del texto <TechTerm t="regex" />
          </span>
        </header>
        <TextRuleSuite
          active={textRule}
          onApply={applyTextRule}
          onClear={() => onChange("")}
        />
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
        <span className="pulso-xfi-code-head" aria-hidden="true">
          Código Kobo{techTerm ? <> <TechTerm t={techTerm} /></> : null}
        </span>
        <pre>{raw}</pre>
        <p className="pulso-logic-builder-rawhint">
          Se preserva al exportar; reemplázala por una regla guiada para editarla.
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

  // Caso 3: simple `. <op> X`.
  const flat = tryFlattenConstraint(ast);
  if (flat) {
    // Concatenar: al sumar una segunda regla promovemos a un AND plano, que
    // en el siguiente render cae al caso 4 (grupo con toggle y/o). Así se
    // arma "entre X e Y" (. >= X and . <= Y) sin escribir fórmula.
    const addSecondRule = () => {
      onChange(
        serializeExpression({
          kind: "logical",
          op: "and",
          operands: [expandConstraint(flat), expandConstraint(buildEmpty())],
        }),
      );
    };
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
        <footer className="pulso-logic-builder-footer">
          <button
            type="button"
            className="pulso-logic-group-add"
            onClick={addSecondRule}
            title="Sumar otra regla (ej. entre un mínimo y un máximo)"
          >
            + Agregar regla
          </button>
        </footer>
        {hint && <p className="pulso-logic-builder-hint">{hint}</p>}
      </div>
    );
  }

  // Caso 4: AND/OR plano de compare-con-`.`.
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

    // Caso 5: AND plano mixto — cada operando es una compare plana o una
    // regla de texto reconocida. Límite documentado: solo op `and` (un OR
    // con regex cae a la caja técnica); al editar una regla dentro del AND
    // solo se reemplaza su expresión (no se toca el constraint_message
    // combinado del usuario).
    if (ast.op === "and") {
      type MixedChild =
        | { kind: "flat"; flat: FlatConstraint; expr: Expr }
        | {
            kind: "rule";
            rule: { recipe: TextRuleRecipe; params: TextRuleParams };
            expr: Expr;
          };
      const children: MixedChild[] = [];
      let supported = true;
      let ruleCount = 0;
      for (const operand of ast.operands) {
        const flatChild = tryFlattenConstraint(operand);
        if (flatChild) {
          children.push({ kind: "flat", flat: flatChild, expr: operand });
          continue;
        }
        const ruleChild = matchTextRule(operand);
        if (ruleChild) {
          children.push({ kind: "rule", rule: ruleChild, expr: operand });
          ruleCount += 1;
          continue;
        }
        supported = false;
        break;
      }
      if (supported && ruleCount > 0 && children.length >= 2) {
        const exprs = children.map((child) => child.expr);
        const emitExprs = (next: Expr[]) => {
          if (next.length === 0) {
            onChange("");
            return;
          }
          if (next.length === 1) {
            onChange(serializeExpression(next[0]!));
            return;
          }
          onChange(
            serializeExpression({ kind: "logical", op: "and", operands: next }),
          );
        };
        const replaceAt = (index: number, expr: Expr) => {
          const copy = [...exprs];
          copy[index] = expr;
          emitExprs(copy);
        };
        const removeAt = (index: number) => {
          emitExprs(exprs.filter((_, i) => i !== index));
        };
        const addFlat = () => {
          emitExprs([...exprs, expandConstraint(buildEmpty())]);
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
                <span className="pulso-xftr-mixed-connector">
                  todas deben cumplirse
                </span>
              </header>
              <div className="pulso-logic-group-body">
                {children.map((child, idx) => (
                  <div className="pulso-logic-group-item" key={idx}>
                    {idx > 0 && (
                      <span className="pulso-logic-group-sep" aria-hidden="true">
                        and
                      </span>
                    )}
                    {child.kind === "flat" ? (
                      <ConstraintRow
                        scope={scope}
                        baseType={baseType}
                        listName={listName}
                        constraint={child.flat}
                        onChange={(next) => replaceAt(idx, expandConstraint(next))}
                        onRemove={
                          children.length > 1 ? () => removeAt(idx) : undefined
                        }
                      />
                    ) : (
                      <TextRuleSuite
                        variant="row"
                        active={child.rule}
                        onApply={(nextExpr) => {
                          const parsed = parseExpression(nextExpr);
                          if (parsed) replaceAt(idx, parsed);
                        }}
                        onClear={() => removeAt(idx)}
                      />
                    )}
                  </div>
                ))}
              </div>
              <footer className="pulso-logic-group-footer">
                <button
                  type="button"
                  className="pulso-logic-group-add"
                  onClick={addFlat}
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

/**
 * Preset regex definido desde el catálogo textRules — una sola fuente para
 * la expresión y el mensaje (los presets email/digits/code migraron aquí).
 */
function presetFromTextRule(
  preset: { id: string; recipeId: string; label: string; hint: string; badge?: string },
): ConstraintShortcutPreset | null {
  const recipe = textRuleById(preset.recipeId);
  if (!recipe) return null;
  return {
    id: preset.id,
    label: preset.label,
    hint: preset.hint,
    expression: buildTextRuleConstraint(recipe, recipe.defaults),
    message: recipe.buildMessage(recipe.defaults),
    badge: preset.badge,
  };
}

function constraintShortcutPresetsFor(baseType: string): ConstraintShortcutPreset[] {
  if (baseType === "text" || baseType === "") {
    return [
      presetFromTextRule({
        id: "email",
        recipeId: "correo-electronico",
        label: "Correo electrónico",
        hint: "Acepta respuestas como nombre@dominio.org.",
        badge: "regex",
      }),
      presetFromTextRule({
        id: "digits",
        recipeId: "solo-numeros",
        label: "Solo dígitos",
        hint: "Para DNI, teléfonos, códigos numéricos o identificadores.",
        badge: "0-9",
      }),
      presetFromTextRule({
        id: "code",
        recipeId: "codigo-sin-espacios",
        label: "Código sin espacios",
        hint: "Acepta letras, números, guion y guion bajo.",
        badge: "ABC_123",
      }),
    ].filter((preset): preset is ConstraintShortcutPreset => preset !== null);
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
