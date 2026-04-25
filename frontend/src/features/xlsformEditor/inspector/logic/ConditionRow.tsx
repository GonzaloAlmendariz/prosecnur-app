// =============================================================================
// inspector/logic/ConditionRow.tsx — fila atómica del builder visual
// =============================================================================
// Renderiza una `FlatCondition` como un trío {variable, operador, valor}
// alineado horizontalmente. Cuando el usuario cambia la variable, ajusta
// el predicado al default del nuevo tipo si el actual no aplica.
// =============================================================================

import { X } from "lucide-react";
import type { FlatCondition, LogicScope } from "../../logic";
import {
  defaultPredicate,
  predicateKey,
  predicatesForType,
} from "../../logic";
import { VariablePicker } from "./VariablePicker";
import { PredicatePicker } from "./PredicatePicker";
import { ValueInput } from "./ValueInput";

export type ConditionRowProps = {
  scope: LogicScope;
  condition: FlatCondition;
  onChange: (next: FlatCondition) => void;
  /** Si se provee, se muestra un botón de eliminar a la derecha. */
  onRemove?: () => void;
  disabled?: boolean;
};

export function ConditionRow({
  scope,
  condition,
  onChange,
  onRemove,
  disabled,
}: ConditionRowProps) {
  const selectedVar = scope.variables.find(
    (v) => v.name === condition.variableName,
  );
  const baseType = selectedVar?.baseType ?? "text";
  const predicates = predicatesForType(baseType);

  // Si el predicado actual no es válido para este tipo, lo bajamos al
  // default sin avisar — el usuario puede cambiarlo después.
  const currentValid = predicates.some(
    (p) => predicateKey(p) === predicateKey(condition.predicate),
  );
  const predicate = currentValid ? condition.predicate : defaultPredicate(baseType);

  const handleVarChange = (next: string) => {
    const nextVar = scope.variables.find((v) => v.name === next);
    const nextType = nextVar?.baseType ?? baseType;
    const nextPreds = predicatesForType(nextType);
    const stillValid = nextPreds.some(
      (p) => predicateKey(p) === predicateKey(predicate),
    );
    onChange({
      ...condition,
      variableName: next,
      predicate: stillValid ? predicate : defaultPredicate(nextType),
    });
  };

  const catalog = selectedVar?.listName
    ? scope.catalogsByListName.get(selectedVar.listName)
    : undefined;

  return (
    <div className="pulso-logic-condition-row">
      <div className="pulso-logic-condition-piece pulso-logic-condition-var">
        <VariablePicker
          variables={scope.variables}
          selected={condition.variableName}
          onChange={handleVarChange}
          disabled={disabled}
        />
      </div>
      <div className="pulso-logic-condition-piece">
        <PredicatePicker
          options={predicates}
          value={predicate}
          onChange={(next) => onChange({ ...condition, predicate: next })}
          disabled={disabled || !condition.variableName}
        />
      </div>
      <div className="pulso-logic-condition-piece pulso-logic-condition-value">
        <ValueInput
          baseType={baseType}
          catalog={catalog}
          variables={scope.variables.filter(
            (v) => v.name !== condition.variableName,
          )}
          value={condition.value}
          onChange={(next) => onChange({ ...condition, value: next })}
          disabled={disabled || !condition.variableName}
        />
      </div>
      {onRemove && (
        <button
          type="button"
          className="pulso-logic-condition-remove"
          onClick={onRemove}
          disabled={disabled}
          title="Eliminar condición"
          aria-label="Eliminar condición"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
