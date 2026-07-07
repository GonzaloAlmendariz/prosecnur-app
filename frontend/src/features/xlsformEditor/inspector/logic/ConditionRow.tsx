// =============================================================================
// inspector/logic/ConditionRow.tsx — fila atómica del builder visual
// =============================================================================
// Renderiza una `FlatCondition` como un trío {variable, operador, valor}
// alineado horizontalmente. Cuando el usuario cambia la variable, ajusta
// el predicado al default del nuevo tipo si el actual no aplica.
// =============================================================================

import { X } from "lucide-react";
import type { FlatCondition, LogicCatalog, LogicScope, PredicateKind } from "../../logic";
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

function defaultLiteralForPredicate(
  baseType: string,
  predicate: PredicateKind,
  catalog?: LogicCatalog,
): string {
  if (predicate.kind === "selected" || predicate.kind === "not_selected") {
    return catalog?.items[0]?.name ?? "";
  }
  if ((baseType === "select_one" || baseType === "select_multiple") && catalog?.items[0]?.name) {
    return catalog.items[0].name;
  }
  if (baseType === "integer" || baseType === "decimal") return "0";
  if (baseType === "date") return "2026-01-01";
  if (baseType === "datetime") return "2026-01-01T00:00";
  if (baseType === "time") return "00:00";
  return "valor";
}

function valueForPredicate(
  next: PredicateKind,
  currentValue: FlatCondition["value"],
  baseType: string,
  catalog?: LogicCatalog,
): FlatCondition["value"] {
  if (next.kind === "presence") return { kind: "literal", raw: "" };
  if (currentValue.kind === "ref") return currentValue;
  if (currentValue.raw.trim()) return currentValue;
  return {
    kind: "literal",
    raw: defaultLiteralForPredicate(baseType, next, catalog),
  };
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
      value: valueForPredicate(nextPredicate, condition.value, nextType, nextCatalog),
    });
  };

  const catalog = selectedVar?.listName
    ? scope.catalogsByListName.get(selectedVar.listName)
    : undefined;
  const showsValue = predicate.kind !== "presence";

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
              value: valueForPredicate(next, condition.value, baseType, catalog),
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
