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
  /** El contenedor ya declaró la variable (grupo de una sola variable) y la
   *  fila solo edita criterio y valor. Evita repetir la misma pregunta —a
   *  veces de 800 px de texto— una vez por comparación. */
  hideVariable?: boolean;
};

/**
 * Reapunta una condición a otra variable conservando el criterio si sigue
 * siendo válido para el nuevo tipo, y adaptando el valor. Vive fuera del
 * componente porque el encabezado de un grupo de una sola variable reapunta
 * TODAS sus condiciones de golpe con la misma semántica.
 */
export function retargetConditionVariable(
  condition: FlatCondition,
  nextName: string,
  scope: LogicScope,
): FlatCondition {
  const nextVar = scope.variables.find((v) => v.name === nextName);
  const nextType = nextVar?.baseType ?? "text";
  const nextCatalog = nextVar?.listName
    ? scope.catalogsByListName.get(nextVar.listName)
    : undefined;
  const nextPreds = predicatesForType(nextType, { includePresence: true });
  const stillValid = nextPreds.some(
    (p) => predicateKey(p) === predicateKey(condition.predicate),
  );
  const nextPredicate = stillValid ? condition.predicate : defaultPredicate(nextType);
  return {
    ...condition,
    variableName: nextName,
    predicate: nextPredicate,
    value: valueForPredicateTransition(nextPredicate, condition.value, nextType, nextCatalog),
  };
}

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
  hideVariable,
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
    onChange(retargetConditionVariable({ ...condition, predicate }, next, scope));
  };

  const catalog = selectedVar?.listName
    ? scope.catalogsByListName.get(selectedVar.listName)
    : undefined;
  const showsValue = predicate.kind !== "presence";
  // La pista del valor explica cómo llenar un campo vacío. Repetida bajo un
  // valor ya elegido es ruido: en `indice_hs` salían 42 copias del mismo
  // texto en un panel que ya medía 8 364 px.
  const needsValueHint =
    showsValue &&
    (condition.value.kind === "ref"
      ? !condition.value.variableName
      : condition.value.raw.trim() === "");
  const valueHint = valueHintForType(baseType, catalog);

  return (
    <div
      className={[
        "pulso-logic-condition-row",
        showsValue ? "" : "has-presence",
        hideVariable ? "is-headless" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {!hideVariable && (
        <div className="pulso-logic-condition-piece pulso-logic-condition-var">
          <span className="pulso-logic-condition-label">Pregunta</span>
          <VariablePicker
            variables={scope.variables}
            selected={condition.variableName}
            onChange={handleVarChange}
            disabled={disabled}
          />
        </div>
      )}
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
          {needsValueHint && (
            <span className="pulso-logic-condition-hint">{valueHint}</span>
          )}
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
