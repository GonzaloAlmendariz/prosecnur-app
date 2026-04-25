// =============================================================================
// inspector/logic/ConstraintRow.tsx — fila atómica del constraint builder
// =============================================================================
// Como `ConditionRow` pero con el lhs fijo: la respuesta de la pregunta
// misma (operador ODK `.`). Renderiza un chip read-only "Tu respuesta"
// con el icono del tipo en lugar de un VariablePicker, seguido del
// PredicatePicker y el ValueInput.
//
// Los operadores válidos vienen de `predicatesForType(baseType)` —
// excluimos `selected`/`not_selected` porque solo aplican a select_*
// con lhs siendo una ref (no a `.`). Si la pregunta es select_one, el
// `.` se compara con la opción seleccionada con `=`/`!=`, lo cual ya
// está cubierto.
// =============================================================================

import { X } from "lucide-react";
import type { FlatConstraint, LogicScope, LogicVariable } from "../../logic";
import {
  defaultPredicate,
  predicateKey,
  predicatesForType,
} from "../../logic";
import { iconForType } from "../../helpers/icons";
import { paletteForType, paletteSoftForType } from "../../helpers/paletteForType";
import { typeLabel } from "../../parsing/parseType";
import { PredicatePicker } from "./PredicatePicker";
import { ValueInput } from "./ValueInput";

export type ConstraintRowProps = {
  scope: LogicScope;
  /** Tipo base de la pregunta misma — determina qué operadores ofrecemos
   *  y qué control de valor renderizar. */
  baseType: string;
  /** Nombre del catálogo si la pregunta es select_*. Se usa para popular
   *  el dropdown de valores. */
  listName?: string;
  constraint: FlatConstraint;
  onChange: (next: FlatConstraint) => void;
  onRemove?: () => void;
  disabled?: boolean;
};

export function ConstraintRow({
  scope,
  baseType,
  listName,
  constraint,
  onChange,
  onRemove,
  disabled,
}: ConstraintRowProps) {
  const predicates = predicatesForType(baseType).filter(
    // En constraint, `selected`/`not_selected` no aplican (el lhs es `.`,
    // no una ref). Para select_* dejamos solo "es" / "no es".
    (p) => p.kind === "compare",
  );
  const fallback = predicates[0] ?? defaultPredicate(baseType);
  const currentValid = predicates.some(
    (p) => predicateKey(p) === predicateKey(constraint.predicate),
  );
  const predicate = currentValid ? constraint.predicate : fallback;

  const Icon = iconForType(baseType);
  const accent = paletteForType(baseType);
  const accentSoft = paletteSoftForType(baseType);

  const catalog = listName ? scope.catalogsByListName.get(listName) : undefined;
  const otherVariables: LogicVariable[] = scope.variables.filter(
    () => true, // En constraint sí podemos referenciar cualquier otra variable.
  );

  return (
    <div className="pulso-logic-condition-row pulso-logic-constraint-row">
      <div className="pulso-logic-condition-piece pulso-logic-condition-var">
        <span
          className="pulso-logic-current"
          title="La respuesta de esta misma pregunta"
        >
          <span
            className="pulso-logic-current-icon"
            style={{ color: accent, background: accentSoft }}
          >
            <Icon size={13} />
          </span>
          <span className="pulso-logic-current-text">
            <strong>Tu respuesta</strong>
            <em>{typeLabel(baseType)}</em>
          </span>
        </span>
      </div>
      <div className="pulso-logic-condition-piece">
        <PredicatePicker
          options={predicates}
          value={predicate}
          onChange={(next) => onChange({ ...constraint, predicate: next })}
          disabled={disabled}
        />
      </div>
      <div className="pulso-logic-condition-piece pulso-logic-condition-value">
        <ValueInput
          baseType={baseType}
          catalog={catalog}
          variables={otherVariables}
          value={constraint.value}
          onChange={(next) => onChange({ ...constraint, value: next })}
          disabled={disabled}
        />
      </div>
      {onRemove && (
        <button
          type="button"
          className="pulso-logic-condition-remove"
          onClick={onRemove}
          disabled={disabled}
          title="Eliminar regla"
          aria-label="Eliminar regla"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
