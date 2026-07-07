// =============================================================================
// inspector/logic/ConditionRow.tsx — fila atómica del builder visual
// =============================================================================
// Renderiza una `FlatCondition` como un trío {variable, operador, valor}
// alineado horizontalmente. Cuando el usuario cambia la variable, ajusta
// el predicado al default del nuevo tipo si el actual no aplica.
// =============================================================================

import { X } from "lucide-react";
import type { FlatCondition, LogicCatalog, LogicScope } from "../../logic";
import {
  defaultPredicate,
  predicateKey,
  predicatesForType,
  valueForPredicateTransition,
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

function valueHintForType(baseType: string, catalog?: LogicCatalog): string {
  if (baseType === "select_one" || baseType === "select_multiple") {
    return catalog ? "Elige la opción que activa la regla." : "Conecta un catálogo para elegir una opción.";
  }
  if (baseType === "integer" || baseType === "decimal") return "Escribe el número esperado.";
  if (baseType === "date" || baseType === "datetime" || baseType === "time") return "Define el momento esperado.";
  return "Escribe el texto exacto esperado.";
}

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
  const predicates = predicatesForType(baseType, { includePresence: true });

  // Si el predicado actual no es válido para este tipo, lo bajamos al
  // default sin avisar — el usuario puede cambiarlo después.
  const currentValid = predicates.some(
    (p) => predicateKey(p) === predicateKey(condition.predicate),
  );
  const predicate = currentValid ? condition.predicate : defaultPredicate(baseType);

  const handleVarChange = (next: string) => {
    const nextVar = scope.variables.find((v) => v.name === next);
    const nextType = nextVar?.baseType ?? baseType;
    const nextCatalog = nextVar?.listName
      ? scope.catalogsByListName.get(nextVar.listName)
      : undefined;
    const nextPreds = predicatesForType(nextType, { includePresence: true });
    const stillValid = nextPreds.some(
      (p) => predicateKey(p) === predicateKey(predicate),
    );
    const nextPredicate = stillValid ? predicate : defaultPredicate(nextType);
    onChange({
      ...condition,
      variableName: next,
      predicate: nextPredicate,
      value: valueForPredicateTransition(nextPredicate, condition.value, nextType, nextCatalog),
    });
  };

  const catalog = selectedVar?.listName
    ? scope.catalogsByListName.get(selectedVar.listName)
    : undefined;
  const showsValue = predicate.kind !== "presence";
  const valueHint = valueHintForType(baseType, catalog);

  return (
    <div className={`pulso-logic-condition-row${showsValue ? "" : " has-presence"}`}>
      <div className="pulso-logic-condition-piece pulso-logic-condition-var">
        <span className="pulso-logic-condition-label">Pregunta</span>
        <VariablePicker
          variables={scope.variables}
          selected={condition.variableName}
          onChange={handleVarChange}
          disabled={disabled}
        />
      </div>
      <div className="pulso-logic-condition-piece">
        <span className="pulso-logic-condition-label">Criterio</span>
        <PredicatePicker
          options={predicates}
          value={predicate}
          onChange={(next) =>
            onChange({
              ...condition,
              predicate: next,
              value: valueForPredicateTransition(next, condition.value, baseType, catalog),
            })
          }
          disabled={disabled || !condition.variableName}
        />
      </div>
      {showsValue && (
        <div className="pulso-logic-condition-piece pulso-logic-condition-value">
          <span className="pulso-logic-condition-label">Valor</span>
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
          <span className="pulso-logic-condition-hint">{valueHint}</span>
        </div>
      )}
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
